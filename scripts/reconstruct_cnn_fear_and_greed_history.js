#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  addDaysCompact,
  buildMatrix,
  normalizeCompactDate,
  parseArgs,
  readJson,
  writeJsonAtomic
} = require('./lib/range_backfill');

const SOURCE_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'data_cnn_fear_and_greed');
const FILE_NAME = 'cnn_fear_and_greed.json';

async function fetchJson(url = SOURCE_URL, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        accept: 'application/json, text/plain, */*',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        referer: 'https://www.cnn.com/markets/fear-and-greed',
        'user-agent': 'Mozilla/5.0 (compatible; stock-data-cnn-history/1.0)'
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function pointDate(point) {
  const timestamp = Number(point?.x);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toISOString().slice(0, 10).replaceAll('-', '');
}

function normalizeHistoricalRows(payload) {
  const rows = payload?.fear_and_greed_historical?.data;
  if (!Array.isArray(rows)) throw new Error('CNN payload missing fear_and_greed_historical.data[]');
  const byDate = new Map();
  for (const row of rows) {
    const date = pointDate(row);
    const score = Number(row?.y);
    const rating = String(row?.rating || '').trim();
    if (!date || !Number.isFinite(score) || !rating) continue;
    byDate.set(date, { x: Number(row.x), y: score, rating });
  }
  const normalized = [...byDate.entries()]
    .map(([date, row]) => ({ date, ...row }))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (!normalized.length) throw new Error('CNN historical series contains no valid points');
  return normalized;
}

function nearestScoreAtOrBefore(rows, targetDate) {
  const row = rows.filter((item) => item.date <= targetDate).at(-1);
  return row ? row.y : null;
}

function buildSnapshot(rows, index, sourcePayload) {
  const row = rows[index];
  const priorRows = rows.slice(0, index + 1);
  const timestamp = new Date(row.x).toISOString();
  const sourceTimestamp = sourcePayload?.fear_and_greed?.timestamp || null;
  const sourceSnapshotDate = sourceTimestamp
    ? String(sourceTimestamp).slice(0, 10).replaceAll('-', '')
    : null;
  return {
    schemaVersion: 1,
    reconstructed: true,
    reconstructed_at: new Date().toISOString(),
    reconstruction: {
      method: 'cnn_fear_and_greed_historical_series',
      source_url: SOURCE_URL,
      source_snapshot_date: sourceSnapshotDate,
      source_snapshot_timestamp: sourceTimestamp,
      point_timestamp_ms: row.x,
      note: 'This historical daily file was reconstructed from CNN historical series and is not an archived same-day HTTP snapshot.'
    },
    fear_and_greed: {
      score: row.y,
      rating: row.rating,
      timestamp,
      previous_close: index > 0 ? rows[index - 1].y : null,
      previous_1_week: nearestScoreAtOrBefore(priorRows, addDaysCompact(row.date, -7)),
      previous_1_month: nearestScoreAtOrBefore(priorRows, addDaysCompact(row.date, -30)),
      previous_1_year: nearestScoreAtOrBefore(priorRows, addDaysCompact(row.date, -365))
    },
    fear_and_greed_historical: {
      timestamp: row.x,
      score: row.y,
      rating: row.rating,
      data: priorRows.map((item) => ({ x: item.x, y: item.y, rating: item.rating }))
    }
  };
}

function validateStoredSnapshot(file, date) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return ['missing or empty file'];
  let payload;
  try { payload = readJson(file); } catch (error) { return [`invalid JSON: ${error.message}`]; }
  const score = Number(payload?.fear_and_greed?.score);
  const rating = String(payload?.fear_and_greed?.rating || '').trim();
  const timestamp = String(payload?.fear_and_greed?.timestamp || '');
  const timestampDate = timestamp.slice(0, 10).replaceAll('-', '');
  const errors = [];
  if (!Number.isFinite(score)) errors.push('score invalid');
  if (!rating) errors.push('rating missing');
  if (timestampDate !== date) errors.push(`timestamp date is ${timestampDate || '(empty)'}`);
  return errors;
}

function buildPlan({ payload, start, end, batchSize = 20, outputDir = DEFAULT_OUTPUT_DIR, force = false }) {
  const normalizedStart = normalizeCompactDate(start, 'start date');
  const normalizedEnd = normalizeCompactDate(end, 'end date');
  if (normalizedStart > normalizedEnd) throw new Error('start is after end');
  const rows = normalizeHistoricalRows(payload);
  const available = rows.filter((row) => row.date >= normalizedStart && row.date <= normalizedEnd);
  const invalid = [];
  const valid = [];
  for (const row of available) {
    const file = path.join(outputDir, row.date, FILE_NAME);
    const errors = force ? ['forced'] : validateStoredSnapshot(file, row.date);
    if (errors.length) invalid.push({ date: row.date, errors }); else valid.push(row.date);
  }
  const pendingDates = invalid.map((item) => item.date);
  return {
    dataset: 'cnn_fear_and_greed',
    start: normalizedStart,
    end: normalizedEnd,
    source_first_date: rows[0].date,
    source_last_date: rows.at(-1).date,
    available_date_count: available.length,
    valid_date_count: valid.length,
    pending_date_count: pendingDates.length,
    pending_dates: pendingDates,
    invalid,
    matrix: buildMatrix(pendingDates, batchSize)
  };
}

function writeDates({ payload, dates, outputDir = DEFAULT_OUTPUT_DIR, force = false }) {
  const rows = normalizeHistoricalRows(payload);
  const indexByDate = new Map(rows.map((row, index) => [row.date, index]));
  const results = [];
  for (const rawDate of dates) {
    const date = normalizeCompactDate(rawDate);
    const index = indexByDate.get(date);
    if (index === undefined) throw new Error(`CNN historical series has no point for ${date}`);
    const file = path.join(outputDir, date, FILE_NAME);
    const existingErrors = validateStoredSnapshot(file, date);
    if (!force && existingErrors.length === 0) {
      results.push({ date, status: 'skipped', file });
      continue;
    }
    writeJsonAtomic(file, buildSnapshot(rows, index, payload));
    const errors = validateStoredSnapshot(file, date);
    if (errors.length) throw new Error(`Stored CNN snapshot ${date} is invalid: ${errors.join('; ')}`);
    results.push({ date, status: fs.existsSync(file) ? 'written' : 'created', file });
  }
  return results;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const payload = args.get('input-file')
    ? readJson(path.resolve(args.get('input-file')))
    : await fetchJson();
  const outputDir = args.get('output-dir') ? path.resolve(args.get('output-dir')) : DEFAULT_OUTPUT_DIR;
  const force = args.has('force');
  if (args.has('plan-only')) {
    const start = args.get('start');
    const end = args.get('end');
    if (!start || !end) throw new Error('--start and --end are required with --plan-only');
    process.stdout.write(`${JSON.stringify(buildPlan({
      payload,
      start,
      end,
      batchSize: Number(args.get('batch-size') || 20),
      outputDir,
      force
    }))}\n`);
    return;
  }
  const dates = String(args.get('dates') || args.get('date') || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  if (!dates.length) throw new Error('--dates or --date is required');
  const results = writeDates({ payload, dates, outputDir, force });
  console.log(JSON.stringify({ written: results.length, results }));
}

if (require.main === module) main().catch((error) => {
  console.error(`Failed to reconstruct CNN Fear & Greed history: ${error.message}`);
  process.exitCode = 1;
});

module.exports = {
  buildPlan,
  buildSnapshot,
  normalizeHistoricalRows,
  pointDate,
  validateStoredSnapshot,
  writeDates
};
