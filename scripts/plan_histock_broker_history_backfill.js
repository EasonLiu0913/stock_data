#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const scope = getArg('scope', 'single');
const stock = getArg('stock', '2449');
const stocksArg = getArg('stocks', '');
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-07-31');
const batchSizeRequests = Number(getArg('batch-size-requests', '8'));
const maxBatchesPerRun = Number(getArg('max-batches-per-run', '20'));
const output = getArg('output', '');
const githubOutput = getArg('github-output', '');
const tradingPath = path.join('data_history_sma', 'trading_days.json');
const nonTradingPath = path.join('data_history_sma', 'non_trading_days.json');
const universePath = path.join('data_twse', 'twse_industry.csv');

if (!['single', 'list', 'all'].includes(scope)) throw new Error('scope must be single, list, or all');
if (!/^20\d{2}-\d{2}-\d{2}$/.test(start) || !/^20\d{2}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error('Invalid date range');
if (!Number.isInteger(batchSizeRequests) || batchSizeRequests < 1 || batchSizeRequests > 30) throw new Error('batch-size-requests must be 1..30');
if (!Number.isInteger(maxBatchesPerRun) || maxBatchesPerRun < 1 || maxBatchesPerRun > 200) throw new Error('max-batches-per-run must be 1..200');

const stockOk = (v) => /^[0-9A-Za-z]{4,6}$/.test(v);
function resolveStocks() {
  if (scope === 'single') {
    if (!stockOk(stock)) throw new Error(`Invalid stock: ${stock}`);
    return [stock];
  }
  if (scope === 'list') {
    const values = [...new Set(stocksArg.split(',').map((x) => x.trim()).filter(Boolean))];
    if (!values.length || values.some((x) => !stockOk(x))) throw new Error('Invalid --stocks list');
    return values;
  }
  if (!fs.existsSync(universePath)) throw new Error(`Universe missing: ${universePath}`);
  const lines = fs.readFileSync(universePath, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  const values = [...new Set(lines.map((line) => line.split(',')[0].trim()).filter(stockOk))];
  if (!values.length) throw new Error('All-market universe is empty');
  return values;
}

const normalize = (v) => String(v).replaceAll('/', '-');
function loadCalendar(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { payload, dates: new Set(Object.values(payload).flat().map(normalize)) };
}
function isValidDaily(s, date) {
  const file = path.join('data_research', 'institutional-flow', 'histock', s, 'daily', `${date.replaceAll('-', '')}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8'));
    return p.source === 'histock' && p.research_only === true && p.stock === s && p.date === date && Array.isArray(p.records) && p.records.length > 0;
  } catch { return false; }
}

const stocks = resolveStocks();
const trading = loadCalendar(tradingPath);
const nonTrading = loadCalendar(nonTradingPath);
for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y += 1) {
  if (!Array.isArray(trading.payload[String(y)])) throw new Error(`Trading calendar missing year ${y}`);
}
const tradingDays = [...trading.dates].filter((d) => d >= start && d <= end).sort();
const conflicts = tradingDays.filter((d) => nonTrading.dates.has(d));
if (conflicts.length) throw new Error(`Trading/non-trading conflict: ${conflicts.join(',')}`);

const tasks = [];
let existingCount = 0;
for (const s of stocks) {
  for (const date of tradingDays) {
    if (isValidDaily(s, date)) existingCount += 1;
    else tasks.push({ stock: s, date });
  }
}
const theoretical = stocks.length * tradingDays.length;
const totalMissing = tasks.length;
const maxTasksThisRun = batchSizeRequests * maxBatchesPerRun;
const scheduledTasks = tasks.slice(0, maxTasksThisRun);
const batches = [];
for (let i = 0; i < scheduledTasks.length; i += batchSizeRequests) {
  const slice = scheduledTasks.slice(i, i + batchSizeRequests);
  batches.push({ batch: batches.length, task_count: slice.length, tasks: slice.map((t) => `${t.stock}@${t.date}`).join(',') });
}
const affectedStocks = [...new Set(scheduledTasks.map((t) => t.stock))];
const plan = {
  schema_version: 2,
  scope,
  stock_universe: stocks,
  range: { start, end },
  trading_day_source: tradingPath,
  non_trading_guard: nonTradingPath,
  all_market_source: scope === 'all' ? universePath : null,
  batch_size_requests: batchSizeRequests,
  max_batches_per_run: maxBatchesPerRun,
  counts: {
    stocks: stocks.length,
    trading_days: tradingDays.length,
    theoretical_stock_date_tasks: theoretical,
    existing_valid_tasks: existingCount,
    missing_tasks_total: totalMissing,
    scheduled_tasks_this_run: scheduledTasks.length,
    deferred_tasks: totalMissing - scheduledTasks.length,
    planned_batches: batches.length,
  },
  affected_stocks_this_run: affectedStocks,
  batches,
  generated_at: new Date().toISOString(),
};
if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
}
const matrix = JSON.stringify({ include: batches });
if (githubOutput) {
  fs.appendFileSync(githubOutput,
    `matrix=${matrix}\nmissing_count=${totalMissing}\nscheduled_count=${scheduledTasks.length}\ndeferred_count=${totalMissing - scheduledTasks.length}\nrequested_count=${theoretical}\nexisting_count=${existingCount}\nbatch_count=${batches.length}\naffected_stocks=${affectedStocks.join(',')}\nstock_count=${stocks.length}\ntrading_day_count=${tradingDays.length}\n`);
}
console.log(JSON.stringify(plan, null, 2));
