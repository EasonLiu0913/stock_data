#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateDailyPayload, QUALITY_VERSION } = require('./lib/histock_broker_quality');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const expansionFile = arg('expansion', path.join('data_research', 'institutional-flow', 'validation', 'coverage-expansion-v1.json'));
const batchSize = Number(arg('batch-size-requests', '5'));
const maxBatches = Number(arg('max-batches-per-run', '24'));
const targetDays = Number(arg('target-days', '40'));
const output = arg('output', '');
const githubOutput = arg('github-output', '');

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10) throw new Error('batch-size-requests must be 1..10');
if (!Number.isInteger(maxBatches) || maxBatches < 1 || maxBatches > 100) throw new Error('max-batches-per-run must be 1..100');
if (!Number.isInteger(targetDays) || targetDays < 40 || targetDays > 120) throw new Error('target-days must be 40..120');
if (!fs.existsSync(expansionFile)) throw new Error(`Expansion plan missing: ${expansionFile}`);

const expansion = JSON.parse(fs.readFileSync(expansionFile, 'utf8'));
if (expansion.methodology !== 'institutional-withdrawal-validation-coverage-expansion-v1' || expansion.generated_without_outcomes !== true) {
  throw new Error('Invalid expansion plan contract');
}
const rowMap = new Map((expansion.rows || []).map((r) => [r.stock, r]));
const stocks = expansion.scheduled?.broker_stocks || [];

function inspect(stock, date) {
  const file = path.join('data_research', 'institutional-flow', 'histock', stock, 'daily', `${date.replaceAll('-', '')}.json`);
  if (!fs.existsSync(file)) return { valid: false, reason: 'missing' };
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const check = validateDailyPayload(payload, { stock, date });
    return check.valid ? { valid: true } : { valid: false, reason: 'quality_rejected', details: check };
  } catch (error) {
    return { valid: false, reason: 'invalid_json', details: { message: error.message } };
  }
}

const tasks = [];
const perStock = [];
for (const stock of stocks) {
  const row = rowMap.get(stock);
  if (!row) throw new Error(`Scheduled broker stock missing from rows: ${stock}`);
  if (row.tdcc_observations < 3) throw new Error(`Broker scheduling before TDCC gate for ${stock}`);
  const dates = Array.isArray(row.common_source_dates) ? row.common_source_dates : [];
  const valid = [];
  const missing = [];
  const qualityRejected = [];
  for (const date of dates) {
    const check = inspect(stock, date);
    if (check.valid) valid.push(date);
    else {
      missing.push(date);
      if (check.reason !== 'missing') qualityRejected.push({ date, reason: check.reason });
    }
  }
  const needed = Math.max(0, targetDays - valid.length);
  const selected = missing.slice(0, needed);
  selected.forEach((date) => tasks.push({ stock, date }));
  perStock.push({ stock, common_source_dates: dates.length, existing_valid_days: valid.length, target_days: targetDays, needed_days: needed, scheduled_candidate_days: selected.length, quality_rejected_existing: qualityRejected });
}

const cap = batchSize * maxBatches;
const scheduled = tasks.slice(0, cap);
const batches = [];
for (let i = 0; i < scheduled.length; i += batchSize) {
  const slice = scheduled.slice(i, i + batchSize);
  batches.push({ batch: batches.length, task_count: slice.length, tasks: slice.map((x) => `${x.stock}@${x.date}`).join(',') });
}

const plan = {
  schema_version: 1,
  methodology: 'institutional-withdrawal-validation-broker-batch-plan-v1',
  generated_without_outcomes: true,
  source_expansion_plan: expansionFile,
  calendar_policy: 'each task date comes from that stock common Foreign+OHLCV source-derived dates; data_history_sma/trading_days.json is never read',
  data_quality: { version: QUALITY_VERSION },
  target_days: targetDays,
  batch_size_requests: batchSize,
  max_batches_per_run: maxBatches,
  stocks,
  per_stock: perStock,
  counts: { stocks: stocks.length, missing_needed_tasks: tasks.length, scheduled_tasks: scheduled.length, deferred_tasks: tasks.length - scheduled.length, planned_batches: batches.length },
  batches,
  generated_at: new Date().toISOString(),
};

if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
}
if (githubOutput) {
  fs.appendFileSync(githubOutput, `matrix=${JSON.stringify({ include: batches })}\n`);
  fs.appendFileSync(githubOutput, `scheduled_count=${scheduled.length}\n`);
  fs.appendFileSync(githubOutput, `deferred_count=${tasks.length - scheduled.length}\n`);
  fs.appendFileSync(githubOutput, `batch_count=${batches.length}\n`);
  fs.appendFileSync(githubOutput, `stocks=${stocks.join(',')}\n`);
}
console.log(JSON.stringify(plan, null, 2));
