#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MARKET_RISK_DIR = path.join(ROOT, 'data_market_risk');
const OUTPUT_DIR = path.join(MARKET_RISK_DIR, 'calibration');

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function normalizeDateList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.replace(/[^\d]/g, ''))
    .filter((item) => /^\d{8}$/.test(item));
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function loadSnapshot(date) {
  const file = path.join(MARKET_RISK_DIR, date, 'market_risk_snapshot.json');
  const data = readJson(file, null);
  return data ? { date, file: path.relative(ROOT, file), data } : null;
}

function summarize(records) {
  const scores = records.map((record) => record.data.market_risk_score).filter(Number.isFinite).sort((a, b) => a - b);
  const avg = scores.length ? scores.reduce((total, value) => total + value, 0) / scores.length : null;
  const percentile = (p) => scores.length ? scores[Math.min(scores.length - 1, Math.floor((scores.length - 1) * p))] : null;
  return {
    count: records.length,
    score_avg: round(avg, 2),
    score_min: round(scores[0]),
    score_p50: round(percentile(0.5)),
    score_p75: round(percentile(0.75)),
    score_max: round(scores.at(-1)),
    dates: records.map((record) => ({
      date: record.date,
      market_risk_score: record.data.market_risk_score,
      risk_label: record.data.risk_label,
      news_score: record.data.news?.keyword_risk_score ?? null,
      external_market_score: record.data.external_market?.external_market_risk_score ?? null,
      oil_futures_risk: record.data.external_market?.oil_futures_risk ?? null
    }))
  };
}

function allSnapshotDates() {
  if (!fs.existsSync(MARKET_RISK_DIR)) return [];
  return fs.readdirSync(MARKET_RISK_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const eventDates = normalizeDateList(args.get('event-dates') || '20260717,20260724');
  const controlDates = normalizeDateList(args.get('control-dates'));
  const events = eventDates.map(loadSnapshot).filter(Boolean);
  const controls = (controlDates.length ? controlDates : allSnapshotDates().filter((date) => !eventDates.includes(date)))
    .map(loadSnapshot)
    .filter(Boolean);
  const payload = {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    methodology: 'Compare existing market_risk_snapshot scores for known large-drop dates against optional control dates. This is a calibration report, not a trained model.',
    event_dates: eventDates,
    control_dates: controls.map((record) => record.date),
    event_summary: summarize(events),
    control_summary: summarize(controls),
    suggested_next_steps: [
      '累積至少 30 個大跌日與 60 個非大跌日後再調整權重。',
      '分開校準新聞、ADR/SOX/Nasdaq、油價期貨、匯率等子分數。',
      '避免用事件當天大跌後新聞訓練提前預警。'
    ]
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputFile = path.join(OUTPUT_DIR, 'market_risk_calibration.json');
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: path.relative(ROOT, outputFile),
    events: payload.event_summary.count,
    controls: payload.control_summary.count
  }));
}

main();
