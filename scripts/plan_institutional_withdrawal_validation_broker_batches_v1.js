#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateDailyPayload, QUALITY_VERSION } = require('./lib/histock_broker_quality');
const { POLICY_VERSION, deriveReferenceResponseBytes, assessPersistedStatus } = require('./lib/histock_broker_status_policy');

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
const rows = expansion.rows || [];
const rowMap = new Map(rows.map((r) => [r.stock, r]));
const scheduledExpansionStocks = expansion.scheduled?.broker_stocks || [];

function stockRoot(stock) {
  return path.join('data_research', 'institutional-flow', 'histock', stock);
}
function dailyPath(stock, date) {
  return path.join(stockRoot(stock), 'daily', `${date.replaceAll('-', '')}.json`);
}
function statusPath(stock, date) {
  return path.join(stockRoot(stock), 'batch-status', `exact-source-date-${date.replaceAll('-', '')}.json`);
}
function inspectStatus(stock, date, referenceResponseBytes) {
  const file = statusPath(stock, date);
  if (!fs.existsSync(file)) return { outcome: null, assessment: { terminal: false, retryable: true, classification: 'missing' } };
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (payload.stock !== stock || payload.date !== date) return { outcome: 'invalid_status', file, assessment: { terminal: false, retryable: true, classification: 'invalid_status' } };
    return { outcome: payload.outcome || null, terminal_for_date: payload.terminal_for_date === true, file, payload, assessment: assessPersistedStatus(payload, { referenceResponseBytes }) };
  } catch (error) {
    return { outcome: 'invalid_status', file, error: error.message, assessment: { terminal: false, retryable: true, classification: 'invalid_status' } };
  }
}
function inspect(stock, date, referenceResponseBytes) {
  const file = dailyPath(stock, date);
  if (fs.existsSync(file)) {
    try {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      const check = validateDailyPayload(payload, { stock, date });
      if (check.valid) return { valid: true, reason: 'valid_daily' };
      return { valid: false, reason: 'quality_rejected', details: check };
    } catch (error) {
      return { valid: false, reason: 'invalid_json', details: { message: error.message } };
    }
  }
  const status = inspectStatus(stock, date, referenceResponseBytes);
  if (status.outcome === 'source_empty' && status.assessment.retryable) return { valid: false, reason: 'ambiguous_degraded_source_empty', terminal: false, status };
  if (status.outcome === 'source_empty') return { valid: false, reason: 'source_empty', terminal: true, status };
  if (status.outcome === 'source_rows_incomplete') return { valid: false, reason: 'source_rows_incomplete', terminal: true, status };
  if (status.outcome === 'permanent_error') return { valid: false, reason: 'permanent_error', terminal: true, status };
  if (status.outcome === 'transient_error' || status.outcome === 'suspected_degraded_response') return { valid: false, reason: status.outcome, terminal: false, status };
  return { valid: false, reason: 'missing', status };
}

const referenceByStock = new Map();
for (const row of rows) referenceByStock.set(row.stock, deriveReferenceResponseBytes(stockRoot(row.stock)));

const unsafeRepairTasks = [];
const unsafeAudit = [];
let retainedTerminalSourceEmpty = 0;
for (const row of rows) {
  if (!row.coverage_eligible_before_tdcc_broker || row.tdcc_observations < 3) continue;
  const referenceResponseBytes = referenceByStock.get(row.stock);
  for (const date of Array.isArray(row.common_source_dates) ? row.common_source_dates : []) {
    if (fs.existsSync(dailyPath(row.stock, date))) {
      try {
        const payload = JSON.parse(fs.readFileSync(dailyPath(row.stock, date), 'utf8'));
        if (validateDailyPayload(payload, { stock: row.stock, date }).valid) continue;
      } catch (_) {}
    }
    const status = inspectStatus(row.stock, date, referenceResponseBytes);
    if (status.outcome !== 'source_empty') continue;
    if (status.assessment.retryable) {
      const task = { stock: row.stock, date, reason: status.assessment.classification };
      unsafeRepairTasks.push(task);
      unsafeAudit.push({
        stock: row.stock,
        date,
        run_id: status.payload?.run_id || null,
        updated_at: status.payload?.updated_at || null,
        diagnostics: status.payload?.diagnostics || null,
        reference_response_bytes: referenceResponseBytes,
        assessment: status.assessment,
      });
    } else {
      retainedTerminalSourceEmpty += 1;
    }
  }
}

const regularTasks = [];
const perStock = [];
let totalSourceEmpty = 0;
let totalSourceRowsIncomplete = 0;
let totalPermanentError = 0;
let totalTransientRetry = 0;
for (const stock of scheduledExpansionStocks) {
  const row = rowMap.get(stock);
  if (!row) throw new Error(`Scheduled broker stock missing from rows: ${stock}`);
  if (row.tdcc_observations < 3) throw new Error(`Broker scheduling before TDCC gate for ${stock}`);
  const dates = Array.isArray(row.common_source_dates) ? row.common_source_dates : [];
  const valid = [];
  const retryableCandidates = [];
  const sourceEmpty = [];
  const sourceRowsIncomplete = [];
  const ambiguousSourceEmpty = [];
  const permanentError = [];
  const qualityRejected = [];
  const transientRetry = [];
  const referenceResponseBytes = referenceByStock.get(stock);

  for (const date of dates) {
    const check = inspect(stock, date, referenceResponseBytes);
    if (check.valid) {
      valid.push(date);
      continue;
    }
    if (check.reason === 'source_empty') {
      sourceEmpty.push(date);
      continue;
    }
    if (check.reason === 'source_rows_incomplete') {
      sourceRowsIncomplete.push(date);
      continue;
    }
    if (check.reason === 'permanent_error') {
      permanentError.push(date);
      continue;
    }
    retryableCandidates.push(date);
    if (check.reason === 'ambiguous_degraded_source_empty') ambiguousSourceEmpty.push(date);
    if (check.reason === 'transient_error' || check.reason === 'suspected_degraded_response') transientRetry.push(date);
    if (!['missing', 'transient_error', 'suspected_degraded_response', 'ambiguous_degraded_source_empty'].includes(check.reason)) qualityRejected.push({ date, reason: check.reason });
  }

  const needed = Math.max(0, targetDays - valid.length);
  const selected = retryableCandidates.slice(0, needed);
  selected.forEach((date) => regularTasks.push({ stock, date, reason: 'coverage_needed' }));
  totalSourceEmpty += sourceEmpty.length;
  totalSourceRowsIncomplete += sourceRowsIncomplete.length;
  totalPermanentError += permanentError.length;
  totalTransientRetry += transientRetry.length;

  perStock.push({
    stock,
    common_source_dates: dates.length,
    existing_valid_days: valid.length,
    target_days: targetDays,
    needed_days: needed,
    source_empty_dates: sourceEmpty.length,
    source_rows_incomplete_dates: sourceRowsIncomplete.length,
    ambiguous_source_empty_dates: ambiguousSourceEmpty.length,
    permanent_error_dates: permanentError.length,
    transient_retry_dates: transientRetry.length,
    retryable_candidate_dates: retryableCandidates.length,
    scheduled_candidate_days: selected.length,
    exhausted_before_target: needed > retryableCandidates.length,
    reference_response_bytes: referenceResponseBytes,
    quality_rejected_existing: qualityRejected,
  });
}

const seen = new Set();
const tasks = [];
for (const task of [...unsafeRepairTasks, ...regularTasks]) {
  const key = `${task.stock}@${task.date}`;
  if (seen.has(key)) continue;
  seen.add(key);
  tasks.push(task);
}

const cap = batchSize * maxBatches;
const scheduled = tasks.slice(0, cap);
const batches = [];
for (let i = 0; i < scheduled.length; i += batchSize) {
  const slice = scheduled.slice(i, i + batchSize);
  batches.push({ batch: batches.length, task_count: slice.length, tasks: slice.map((x) => `${x.stock}@${x.date}`).join(','), repair_tasks: slice.filter((x) => x.reason !== 'coverage_needed').length });
}

const scheduledUnsafe = scheduled.filter((x) => x.reason !== 'coverage_needed').length;
const planStocks = [...new Set(tasks.map((x) => x.stock))];
const plan = {
  schema_version: 4,
  methodology: 'institutional-withdrawal-validation-broker-batch-plan-v1',
  generated_without_outcomes: true,
  source_expansion_plan: expansionFile,
  calendar_policy: 'each task date comes from that stock common Foreign+OHLCV source-derived dates; data_history_sma/trading_days.json is never read',
  failure_memory_policy: 'confirmed source_empty and permanent_error remain terminal; source_rows_incomplete is terminal only for that exact acquisition date and is unusable non-negative evidence, so the planner skips that date and continues alternate source dates; HTTP-200/header-only/materially-shrunken legacy source_empty checkpoints are unsafe and requeued; transient and suspected degraded responses remain retryable',
  status_policy_version: POLICY_VERSION,
  data_quality: { version: QUALITY_VERSION },
  target_days: targetDays,
  batch_size_requests: batchSize,
  max_batches_per_run: maxBatches,
  stocks: planStocks,
  expansion_scheduled_stocks: scheduledExpansionStocks,
  source_empty_audit: {
    unsafe_ambiguous_dates: unsafeAudit.length,
    retained_terminal_source_empty_dates: retainedTerminalSourceEmpty,
    unsafe_requeue: unsafeAudit,
  },
  per_stock: perStock,
  counts: {
    stocks: planStocks.length,
    unsafe_source_empty_repairs: unsafeRepairTasks.length,
    scheduled_unsafe_repairs: scheduledUnsafe,
    deferred_unsafe_repairs: Math.max(0, unsafeRepairTasks.length - scheduledUnsafe),
    terminal_source_empty_dates: totalSourceEmpty,
    terminal_source_rows_incomplete_dates: totalSourceRowsIncomplete,
    terminal_permanent_error_dates: totalPermanentError,
    transient_retry_dates: totalTransientRetry,
    missing_needed_tasks: tasks.length,
    scheduled_tasks: scheduled.length,
    deferred_tasks: tasks.length - scheduled.length,
    planned_batches: batches.length,
  },
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
  fs.appendFileSync(githubOutput, `stocks=${planStocks.join(',')}\n`);
}
console.log(JSON.stringify(plan, null, 2));
