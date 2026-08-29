#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const start = arg('start', '2026-04-01');
const end = arg('end', '2026-08-21');
const seed = arg('seed', 'institutional-withdrawal-validation-expansion-v1');
const maxTdccStocks = Number(arg('max-tdcc-stocks', '6'));
const maxBrokerStocks = Number(arg('max-broker-stocks', '3'));
const brokerTargetDays = Number(arg('broker-target-days', '40'));
const output = arg('output', path.join('data_research', 'institutional-flow', 'validation', 'coverage-expansion-v1.json'));
const githubOutput = arg('github-output', '');
const foreignRoot = arg('foreign-root', 'data_twse_foreign_investors');
const ohlcvRoot = arg('ohlcv-root', 'data_fubon');
const tdccRoot = arg('tdcc-root', path.join('data_tdcc_shareholding', 'history'));
const brokerRoot = arg('broker-root', path.join('data_research', 'institutional-flow', 'histock'));

const development = new Set(['2330', '2317', '2454', '2382', '2303', '2449']);
const MIN_COMMON = 40;
const MIN_RATIO = 0.8;
const MIN_TDCC = 3;

if (!/^20\d{2}-\d{2}-\d{2}$/.test(start) || !/^20\d{2}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error('Invalid range');
if (!Number.isInteger(maxTdccStocks) || maxTdccStocks < 1 || maxTdccStocks > 30) throw new Error('max-tdcc-stocks must be 1..30');
if (!Number.isInteger(maxBrokerStocks) || maxBrokerStocks < 1 || maxBrokerStocks > 20) throw new Error('max-broker-stocks must be 1..20');
if (!Number.isInteger(brokerTargetDays) || brokerTargetDays < 40 || brokerTargetDays > 120) throw new Error('broker-target-days must be 40..120');

const iso = (raw) => `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
const ymd = (date) => date.replaceAll('-', '');
const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const hashKey = (stock) => crypto.createHash('sha256').update(`${seed}|${stock}`).digest('hex');

function sourceTradingDates() {
  if (!isDir(foreignRoot)) throw new Error(`Missing foreign root: ${foreignRoot}`);
  const dates = [];
  const rejected = [];
  for (const name of fs.readdirSync(foreignRoot).filter((n) => /^\d{8}_twse_foreign_investors\.json$/.test(n)).sort()) {
    const raw = name.slice(0, 8);
    const date = iso(raw);
    if (date < start || date > end) continue;
    try {
      const p = readJson(path.join(foreignRoot, name));
      if (p.stat === 'OK' && String(p.date) === raw && Array.isArray(p.data)) dates.push(date);
      else rejected.push({ date, file: name, reason: 'invalid_foreign_payload' });
    } catch (error) {
      rejected.push({ date, file: name, reason: `invalid_json:${error.message}` });
    }
  }
  if (rejected.length) throw new Error(`Rejected source calendar rows: ${JSON.stringify(rejected.slice(0, 20))}`);
  if (dates.length < MIN_COMMON) throw new Error(`Source-derived calendar has only ${dates.length} sessions in ${start}..${end}`);
  return dates;
}

function foreignPresence(dates) {
  const map = new Map();
  for (const date of dates) {
    const p = readJson(path.join(foreignRoot, `${ymd(date)}_twse_foreign_investors.json`));
    for (const row of p.data || []) {
      const stock = String(row?.[1] || '').trim();
      if (!/^\d{4}$/.test(stock)) continue;
      if (!map.has(stock)) map.set(stock, new Set());
      map.get(stock).add(date);
    }
  }
  return map;
}

function ohlcvPresence(dates) {
  const map = new Map();
  for (const date of dates) {
    const file = path.join(ohlcvRoot, `fubon_${ymd(date)}_sma.json`);
    if (!fs.existsSync(file)) continue;
    let p;
    try { p = readJson(file); } catch { continue; }
    const slash = date.replaceAll('-', '/');
    for (const [stock, byDate] of Object.entries(p)) {
      if (!/^\d{4}$/.test(stock)) continue;
      const row = byDate?.[slash];
      if (!row) continue;
      const values = [row.Price, row.Open, row.High, row.Low, row.Volume].map(Number);
      if (!values.every(Number.isFinite)) continue;
      if (!map.has(stock)) map.set(stock, new Set());
      map.get(stock).add(date);
    }
  }
  return map;
}

function tdccDates(stock) {
  const root = path.join(tdccRoot, stock);
  if (!isDir(root)) return [];
  const out = [];
  for (const name of fs.readdirSync(root).filter((n) => /^\d{8}\.json$/.test(n)).sort()) {
    try {
      const p = readJson(path.join(root, name));
      const date = String(p.observed_date || '');
      if (p.source === 'tdcc_official_historical_query' && p.stock === stock && date >= start && date <= end) out.push(date);
    } catch {}
  }
  return out;
}

function brokerDates(stock, allowed) {
  const root = path.join(brokerRoot, stock, 'daily');
  if (!isDir(root)) return [];
  return fs.readdirSync(root)
    .filter((n) => /^\d{8}\.json$/.test(n))
    .map((n) => iso(n.slice(0, 8)))
    .filter((d) => allowed.has(d) && d >= start && d <= end)
    .sort();
}

const calendar = sourceTradingDates();
const calendarSet = new Set(calendar);
const foreign = foreignPresence(calendar);
const ohlcv = ohlcvPresence(calendar);
const universe = [...new Set([...foreign.keys(), ...ohlcv.keys()])]
  .filter((s) => !development.has(s))
  .sort();

const rows = [];
for (const stock of universe) {
  const fp = foreign.get(stock) || new Set();
  const op = ohlcv.get(stock) || new Set();
  const common = calendar.filter((d) => fp.has(d) && op.has(d));
  const ratio = calendar.length ? common.length / calendar.length : 0;
  const coverageEligible = common.length >= MIN_COMMON && ratio >= MIN_RATIO;
  const tdcc = tdccDates(stock);
  const broker = brokerDates(stock, new Set(common));
  rows.push({
    stock,
    expansion_order_key: hashKey(stock),
    common_source_sessions: common.length,
    common_source_ratio: Number(ratio.toFixed(4)),
    common_source_dates: common,
    tdcc_observations: tdcc.length,
    normalized_broker_days: broker.length,
    coverage_eligible_before_tdcc_broker: coverageEligible,
    needs_tdcc: coverageEligible && tdcc.length < MIN_TDCC,
    needs_broker: coverageEligible && tdcc.length >= MIN_TDCC && broker.length < brokerTargetDays,
    ready: coverageEligible && tdcc.length >= MIN_TDCC && broker.length >= brokerTargetDays,
  });
}

const eligible = rows.filter((r) => r.coverage_eligible_before_tdcc_broker)
  .sort((a, b) => a.expansion_order_key.localeCompare(b.expansion_order_key) || a.stock.localeCompare(b.stock));
const tdccQueue = eligible.filter((r) => r.needs_tdcc);
const brokerQueue = eligible.filter((r) => r.needs_broker);
const ready = eligible.filter((r) => r.ready).map((r) => r.stock).sort();
const tdccScheduled = tdccQueue.slice(0, maxTdccStocks).map((r) => r.stock);
const brokerScheduled = brokerQueue.slice(0, maxBrokerStocks).map((r) => r.stock);

const payload = {
  schema_version: 1,
  methodology: 'institutional-withdrawal-validation-coverage-expansion-v1',
  generated_without_outcomes: true,
  range: { start, end },
  development_stocks_excluded: [...development],
  calendar: {
    source: 'valid TWSE foreign-investor daily files',
    policy: 'source-derived; data_history_sma/trading_days.json is never read',
    sessions: calendar.length,
    first: calendar[0],
    last: calendar.at(-1),
  },
  coverage_gate: { minimum_common_sessions: MIN_COMMON, minimum_common_ratio: MIN_RATIO, minimum_tdcc_observations: MIN_TDCC, minimum_normalized_broker_days: brokerTargetDays },
  expansion_order: { algorithm: 'sha256(seed|stock)', seed, purpose: 'network request scheduling only; never a validation sample filter' },
  counts: {
    non_development_universe: rows.length,
    coverage_eligible_before_tdcc_broker: eligible.length,
    tdcc_queue: tdccQueue.length,
    broker_queue: brokerQueue.length,
    ready: ready.length,
  },
  scheduled: { tdcc_stocks: tdccScheduled, broker_stocks: brokerScheduled },
  ready_stocks: ready,
  rows,
  guardrails: [
    'No lifecycle outcomes, returns, drawdowns, or v6.1 labels are read.',
    'Expansion order only bounds request load. Once the frozen validation coverage planner returns eligible stocks, all eligible stocks are included.',
    'Historical TDCC remains association-only and production_no_lookahead_safe=false.',
    'OHLCV gaps remain gaps; sessions are not compressed or imputed.',
  ],
  generated_at: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);

if (githubOutput) {
  fs.appendFileSync(githubOutput, `tdcc_stocks=${tdccScheduled.join(',')}\n`);
  fs.appendFileSync(githubOutput, `broker_stocks=${brokerScheduled.join(',')}\n`);
  fs.appendFileSync(githubOutput, `eligible_count=${eligible.length}\nready_count=${ready.length}\n`);
}

console.log(JSON.stringify({ range: payload.range, calendar: payload.calendar, counts: payload.counts, scheduled: payload.scheduled, ready_stocks: ready }, null, 2));
