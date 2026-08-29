#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const ENDPOINT = 'https://openapi.tdcc.com.tw/v1/opendata/1-5';
const outputRoot = getArg('output-root', 'data_tdcc_shareholding');
const inputFile = getArg('input-file');
const capturedAt = getArg('captured-at', new Date().toISOString());

const FIELD = {
  date: ['資料日期', 'Date'],
  stock: ['證券代號', 'Securities Code'],
  level: ['持股分級', 'Securities Holding Range'],
  holders: ['人數', 'Number of Holders'],
  shares: ['股數', 'Number of Shares/Units'],
  ratio: ['占集保庫存數比例%', '佔集保庫存數比例%', 'Percentage of Centrally Deposited Securities'],
};

function firstField(row, names) {
  for (const name of names) if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
  return undefined;
}
function clean(v) { return String(v ?? '').replace(/^\uFEFF/, '').trim(); }
function number(v) {
  const n = Number(clean(v).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}
function isoDate(yyyymmdd) {
  const s = clean(yyyymmdd).replaceAll('-', '').replaceAll('/', '');
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((x) => x.trim());
  if (lines.length < 2) return [];
  const parseLine = (line) => {
    const out = []; let cur = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out;
  };
  const headers = parseLine(lines[0]).map(clean);
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
}
function unwrapJson(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['data', 'result', 'records', 'items']) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}
function parsePayload(text, contentType = '') {
  const trimmed = text.trim();
  if (contentType.includes('json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try { return unwrapJson(JSON.parse(trimmed)); } catch {}
  }
  return parseCsv(text);
}
function normalizeRows(rows) {
  const out = [];
  for (const row of rows) {
    const observedDate = isoDate(firstField(row, FIELD.date));
    const stock = clean(firstField(row, FIELD.stock));
    const level = number(firstField(row, FIELD.level));
    const holders = number(firstField(row, FIELD.holders));
    const shares = number(firstField(row, FIELD.shares));
    const ratio = number(firstField(row, FIELD.ratio));
    if (!observedDate || !stock || !Number.isInteger(level) || level < 1 || level > 17) continue;
    if (holders === null || shares === null || ratio === null) continue;
    out.push({ observed_date: observedDate, stock, level, holders, shares, ratio_pct: ratio });
  }
  return out;
}
function summarizeStock(rows) {
  const byLevel = new Map(rows.map((r) => [r.level, r]));
  const ratioSum = (levels) => levels.reduce((sum, level) => sum + (byLevel.get(level)?.ratio_pct || 0), 0);
  return {
    gte_1000_lots_pct: Number((byLevel.get(15)?.ratio_pct || 0).toFixed(2)),
    le_100_lots_pct: Number(ratioSum([1,2,3,4,5,6,7,8,9]).toFixed(2)),
    levels_present: [...byLevel.keys()].sort((a,b) => a-b),
  };
}
async function loadSource() {
  if (inputFile) return { text: fs.readFileSync(inputFile, 'utf8'), contentType: 'text/plain', sourceUrl: `file:${inputFile}` };
  const response = await fetch(ENDPOINT, { headers: { 'user-agent': 'stock_data-tdcc-archiver/1.0', accept: 'application/json,text/csv,text/plain,*/*' } });
  if (!response.ok) throw new Error(`TDCC HTTP ${response.status}`);
  return { text: await response.text(), contentType: response.headers.get('content-type') || '', sourceUrl: ENDPOINT };
}

(async () => {
  const source = await loadSource();
  const rows = normalizeRows(parsePayload(source.text, source.contentType));
  if (!rows.length) throw new Error('TDCC payload parsed zero valid rows');
  const dates = [...new Set(rows.map((r) => r.observed_date))].sort();
  if (dates.length !== 1) throw new Error(`Expected exactly one TDCC observation date, got ${dates.join(',')}`);
  const observedDate = dates[0];
  const compact = observedDate.replaceAll('-', '');
  const byStock = new Map();
  for (const row of rows) {
    const list = byStock.get(row.stock) || []; list.push(row); byStock.set(row.stock, list);
  }
  const stockDir = path.join(outputRoot, 'stocks');
  const rawDir = path.join(outputRoot, 'raw');
  fs.mkdirSync(stockDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });
  const rawExt = source.contentType.includes('json') || source.text.trim().startsWith('[') || source.text.trim().startsWith('{') ? 'json' : 'csv';
  fs.writeFileSync(path.join(rawDir, `${compact}.${rawExt}`), source.text.endsWith('\n') ? source.text : `${source.text}\n`);
  let stockCount = 0;
  for (const [stock, stockRows] of byStock) {
    const levels = stockRows.sort((a,b) => a.level - b.level);
    const summary = summarizeStock(levels);
    const dir = path.join(stockDir, stock); fs.mkdirSync(dir, { recursive: true });
    const payload = {
      schema_version: 1,
      source: 'tdcc_official_openapi_1_5',
      source_type: 'official_open_data',
      research_only: false,
      production_safe: true,
      stock,
      observed_date: observedDate,
      captured_at: capturedAt,
      available_at: capturedAt,
      availability_policy: 'first_successful_archive_capture_timestamp_conservative_no_lookahead',
      source_url: source.sourceUrl,
      derived: {
        large_holder_definition: 'TDCC level 15: 1,000,001 shares or more (more than 1,000 lots)',
        small_holder_definition: 'TDCC levels 1-9: up to 100,000 shares (up to 100 lots)',
        large_holder_pct: summary.gte_1000_lots_pct,
        small_holder_pct: summary.le_100_lots_pct,
      },
      levels,
    };
    fs.writeFileSync(path.join(dir, `${compact}.json`), `${JSON.stringify(payload, null, 2)}\n`);
    stockCount += 1;
  }
  const manifest = {
    schema_version: 1,
    source: 'tdcc_official_openapi_1_5',
    source_url: source.sourceUrl,
    observed_date: observedDate,
    captured_at: capturedAt,
    available_at: capturedAt,
    rows: rows.length,
    stocks: stockCount,
    raw_file: `raw/${compact}.${rawExt}`,
    canonical_root: 'stocks',
    no_lookahead: 'available_at is the first successful archive capture timestamp; never backdate it to observed_date',
  };
  fs.writeFileSync(path.join(outputRoot, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(outputRoot, `manifest-${compact}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
