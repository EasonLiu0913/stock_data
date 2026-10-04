'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  evaluateEligibility,
  buildObservabilityRecord,
  ELIGIBLE,
} = require('./evaluate_institutional_accumulation_catalyst_scheduled_canary_eligibility');

const STATE_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-bounded-scheduled-canary-state-v1.json';
const OBS_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
const TARGET = 3;
const FROZEN_STOCKS = Object.freeze(['1102','1104','1216']);

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'));
}
function serialize(value) { return `${JSON.stringify(value, null, 2)}\n`; }

function validateState(state) {
  if (!state || state.schema_version !== 1) throw new Error('scheduled_canary_state_schema_invalid');
  if (state.experiment_id !== 'institutional-accumulation-catalyst-bounded-schedule-enablement-canary-v1') throw new Error('scheduled_canary_experiment_identity_invalid');
  if (state.target_accepted_eligible_scheduled_occurrences !== TARGET) throw new Error('scheduled_canary_target_invalid');
  if (!Number.isInteger(state.accepted_eligible_scheduled_occurrence_count)
      || state.accepted_eligible_scheduled_occurrence_count < 0
      || state.accepted_eligible_scheduled_occurrence_count > TARGET) throw new Error('scheduled_canary_count_invalid');
  if (!Array.isArray(state.occurrences)) throw new Error('scheduled_canary_occurrences_invalid');
  if (state.closed !== false) throw new Error('scheduled_canary_state_closed');
  if (state.pending_occurrence !== null && typeof state.pending_occurrence !== 'object') throw new Error('scheduled_canary_pending_invalid');
  return true;
}

function prepareScheduledOccurrence({ state, observations, candidateTimestamp, triggerIdentity }) {
  validateState(state);
  if (!triggerIdentity || typeof triggerIdentity !== 'string') throw new Error('trigger_identity_required');
  if (state.pending_occurrence) {
    return {
      state,
      should_collect: false,
      terminal_reason: 'pending_occurrence_requires_closeout',
      accepted_count_before: state.accepted_eligible_scheduled_occurrence_count,
      accepted_count_after: state.accepted_eligible_scheduled_occurrence_count,
    };
  }
  if (state.accepted_eligible_scheduled_occurrence_count >= TARGET) {
    const evaluation = evaluateEligibility(observations, candidateTimestamp);
    const record = {
      trigger_identity: triggerIdentity,
      candidate_timestamp: candidateTimestamp,
      eligibility: evaluation,
      accepted_count_before: state.accepted_eligible_scheduled_occurrence_count,
      accepted_count_after: state.accepted_eligible_scheduled_occurrence_count,
      request_count_per_stock: Object.fromEntries(FROZEN_STOCKS.map(s => [s, 0])),
      snapshot_count_per_stock: Object.fromEntries(FROZEN_STOCKS.map(s => [s, 0])),
      source_endpoints_used: [],
      accepted_snapshot_paths: [],
      accepted_snapshot_ids: [],
      status: 'skipped',
      terminal_reason: 'accepted_eligible_target_reached',
    };
    return {
      state: {...state, occurrences: [...state.occurrences, record]},
      should_collect: false,
      terminal_reason: record.terminal_reason,
      accepted_count_before: record.accepted_count_before,
      accepted_count_after: record.accepted_count_after,
    };
  }

  const evaluation = evaluateEligibility(observations, candidateTimestamp);
  const base = buildObservabilityRecord(evaluation);
  const record = {
    trigger_identity: triggerIdentity,
    candidate_timestamp: candidateTimestamp,
    eligibility: evaluation,
    accepted_count_before: state.accepted_eligible_scheduled_occurrence_count,
    accepted_count_after: state.accepted_eligible_scheduled_occurrence_count,
    request_count_per_stock: base.request_count_per_stock,
    snapshot_count_per_stock: base.snapshot_count_per_stock,
    source_endpoints_used: [],
    accepted_snapshot_paths: [],
    accepted_snapshot_ids: [],
    status: evaluation.result === ELIGIBLE ? 'eligible_pending_collection' : 'skipped',
    terminal_reason: evaluation.result === ELIGIBLE ? 'eligible_pending_collection' : evaluation.result,
  };

  if (evaluation.result !== ELIGIBLE) {
    return {
      state: {...state, occurrences: [...state.occurrences, record]},
      should_collect: false,
      terminal_reason: record.terminal_reason,
      accepted_count_before: record.accepted_count_before,
      accepted_count_after: record.accepted_count_after,
    };
  }

  return {
    state: {
      ...state,
      pending_occurrence: {
        trigger_identity: triggerIdentity,
        candidate_timestamp: candidateTimestamp,
        accepted_count_before: state.accepted_eligible_scheduled_occurrence_count,
      },
      occurrences: [...state.occurrences, record],
    },
    should_collect: true,
    terminal_reason: 'eligible_pending_collection',
    accepted_count_before: state.accepted_eligible_scheduled_occurrence_count,
    accepted_count_after: state.accepted_eligible_scheduled_occurrence_count,
  };
}

function finalizeScheduledOccurrence({ state, triggerIdentity, stockResults }) {
  validateState(state);
  const pending = state.pending_occurrence;
  if (!pending || pending.trigger_identity !== triggerIdentity) throw new Error('scheduled_canary_pending_identity_mismatch');
  if (!Array.isArray(stockResults) || stockResults.length !== 3) throw new Error('scheduled_canary_stock_results_incomplete');
  const byStock = Object.fromEntries(stockResults.map(r => [String(r.stock), r]));
  if (JSON.stringify(Object.keys(byStock).sort()) !== JSON.stringify([...FROZEN_STOCKS].sort())) throw new Error('scheduled_canary_stock_results_universe_invalid');

  let totalRequests = 0;
  const requestCountPerStock = {};
  const snapshotCountPerStock = {};
  const sourceEndpoints = new Set();
  const acceptedPaths = [];
  const acceptedIds = [];
  for (const stock of FROZEN_STOCKS) {
    const r = byStock[stock];
    if (!Number.isInteger(r.request_count) || r.request_count < 1 || r.request_count > 2) throw new Error('scheduled_canary_request_budget_invalid');
    if (!Number.isInteger(r.snapshot_count) || r.snapshot_count < 1 || r.snapshot_count > 2) throw new Error('scheduled_canary_snapshot_count_invalid');
    totalRequests += r.request_count;
    requestCountPerStock[stock] = r.request_count;
    snapshotCountPerStock[stock] = r.snapshot_count;
    for (const e of r.source_endpoints_used || []) sourceEndpoints.add(e);
    acceptedPaths.push(...(r.accepted_snapshot_paths || []));
    acceptedIds.push(...(r.accepted_snapshot_ids || []));
  }
  if (totalRequests > 6) throw new Error('scheduled_canary_total_request_budget_invalid');

  const nextCount = state.accepted_eligible_scheduled_occurrence_count + 1;
  if (nextCount > TARGET) throw new Error('scheduled_canary_target_overflow');
  const occurrenceIndex = state.occurrences.findIndex(o => o.trigger_identity === triggerIdentity && o.status === 'eligible_pending_collection');
  if (occurrenceIndex < 0) throw new Error('scheduled_canary_pending_occurrence_record_missing');

  const occurrences = state.occurrences.slice();
  occurrences[occurrenceIndex] = {
    ...occurrences[occurrenceIndex],
    accepted_count_after: nextCount,
    request_count_per_stock: requestCountPerStock,
    snapshot_count_per_stock: snapshotCountPerStock,
    source_endpoints_used: [...sourceEndpoints].sort(),
    accepted_snapshot_paths: [...acceptedPaths].sort(),
    accepted_snapshot_ids: [...acceptedIds].sort(),
    status: 'accepted',
    terminal_reason: nextCount >= TARGET ? 'accepted_target_reached_closeout_required' : 'accepted',
  };

  return {
    ...state,
    accepted_eligible_scheduled_occurrence_count: nextCount,
    pending_occurrence: null,
    occurrences,
  };
}

function main() {
  const [mode, candidateTimestamp, triggerIdentity, resultsPath] = process.argv.slice(2);
  const root = process.cwd();
  const state = readJson(root, STATE_RELATIVE);
  if (mode === 'prepare') {
    const observations = readJson(root, OBS_RELATIVE);
    const result = prepareScheduledOccurrence({state, observations, candidateTimestamp, triggerIdentity});
    fs.writeFileSync(path.join(root, ...STATE_RELATIVE.split('/')), serialize(result.state));
    process.stdout.write(`${JSON.stringify({
      should_collect: result.should_collect,
      terminal_reason: result.terminal_reason,
      accepted_count_before: result.accepted_count_before,
      accepted_count_after: result.accepted_count_after,
    })}\n`);
    return;
  }
  if (mode === 'finalize') {
    if (!resultsPath) throw new Error('stock_results_path_required');
    const stockResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const next = finalizeScheduledOccurrence({state, triggerIdentity, stockResults});
    fs.writeFileSync(path.join(root, ...STATE_RELATIVE.split('/')), serialize(next));
    process.stdout.write(`${JSON.stringify({
      accepted_count_after: next.accepted_eligible_scheduled_occurrence_count,
      terminal_reason: next.occurrences.find(o => o.trigger_identity === triggerIdentity)?.terminal_reason,
    })}\n`);
    return;
  }
  throw new Error('mode must be prepare or finalize');
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = {
  STATE_RELATIVE,
  OBS_RELATIVE,
  TARGET,
  FROZEN_STOCKS,
  validateState,
  prepareScheduledOccurrence,
  finalizeScheduledOccurrence,
  serialize,
};
