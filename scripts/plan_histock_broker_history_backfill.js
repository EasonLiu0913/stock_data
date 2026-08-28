#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const stock = getArg('stock', '2449');
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-07-31');
const batchSize = Number(getArg('batch-size', '8'));
const output = getArg('output', '');
const githubOutput = getArg('github-output', '');
const root = path.join('data_research', 'institutional-flow', 'histock', stock);
const dailyDir = path.join(root, 'daily');
const tradingPath = path.join('data_history_sma', 'trading_days.json');
const nonTradingPath = path.join('data_history_sma', 'non_trading_days.json');

if (!/^[0-9A-Za-z]{4,6}$/.test(stock)) throw new Error(`Invalid stock: ${stock}`);
if (!/^20\d{2}-\d{2}-\d{2}$/.test(start) || !/^20\d{2}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error('Invalid date range');
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 30) throw new Error('batch-size must be 1..30');

const normalize = (v) => String(v).replaceAll('/', '-');
function load(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dates = new Set(Object.values(payload).flat().map(normalize));
  return { payload, dates };
}
function isValidDaily(date) {
  const file = path.join(dailyDir, `${date.replaceAll('-', '')}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8'));
    return p.source === 'histock' && p.research_only === true && p.stock === stock && p.date === date && Array.isArray(p.records) && p.records.length > 0;
  } catch {
    return false;
  }
}

const trading = load(tradingPath);
const nonTrading = load(nonTradingPath);
for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y += 1) {
  if (!Array.isArray(trading.payload[String(y)])) throw new Error(`Trading calendar missing year ${y}`);
}
const requested = [...trading.dates].filter((d) => d >= start && d <= end).sort();
const conflicts = requested.filter((d) => nonTrading.dates.has(d));
if (conflicts.length) throw new Error(`Trading/non-trading conflict: ${conflicts.join(',')}`);
const existing = requested.filter(isValidDaily);
const missing = requested.filter((d) => !isValidDaily(d));
const batches = [];
for (let i = 0; i < missing.length; i += batchSize) {
  const dates = missing.slice(i, i + batchSize);
  batches.push({ batch: batches.length, start: dates[0], end: dates.at(-1), dates: dates.join(',') });
}
const plan = {
  schema_version: 1,
  stock,
  range: { start, end },
  trading_day_source: tradingPath,
  non_trading_guard: nonTradingPath,
  batch_size: batchSize,
  counts: { requested_trading_days: requested.length, existing_valid_days: existing.length, missing_days: missing.length, batches: batches.length },
  requested_dates: requested,
  existing_dates: existing,
  missing_dates: missing,
  batches,
  generated_at: new Date().toISOString(),
};
if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
}
const matrix = JSON.stringify({ include: batches });
if (githubOutput) {
  fs.appendFileSync(githubOutput, `matrix=${matrix}\nmissing_count=${missing.length}\nrequested_count=${requested.length}\nexisting_count=${existing.length}\nbatch_count=${batches.length}\n`);
}
console.log(JSON.stringify(plan, null, 2));
