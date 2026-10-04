'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  evaluateEligibility,
  buildObservabilityRecord,
  ELIGIBLE,
  INELIGIBLE_DATE,
  INELIGIBLE_ELAPSED,
  INVALID,
} = require('./evaluate_institutional_accumulation_catalyst_scheduled_canary_eligibility');

const OUTPUT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-schedule-enablement-readiness-v1.json';
const PREREG = 'data_research/institutional-flow/institutional-accumulation-catalyst-bounded-scheduled-canary-preregistration-v1.json';
const OBS = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
const CANARY = '.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml';
const CHECKPOINT = '.github/workflows/checkpoint-institutional-accumulation-sixth-window.yml';
const COLLECTOR = 'scripts/collect_institutional_accumulation_catalyst_prospective_canary.js';
const EXPECTED_PREREG_BLOB = '1fd1c72f7ff2a032beb3eaf29227cd01653bf0e1';
const ALLOWED_DECISIONS = Object.freeze([
  'bounded_schedule_enablement_preregistration_justified',
  'implementation_not_yet_ready',
  'insufficient_or_conflicted_evidence',
]);

function readText(root, rel) { return fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'); }
function readJson(root, rel) { return JSON.parse(readText(root, rel)); }
function gitBlobSha(text) {
  const bytes = Buffer.from(text);
  return crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
}
function req(v, label) { if (!v) throw new Error(label); }

function evaluateReadiness(e) {
  if (!e.upstream || !e.protected || !e.source || !e.pit || !e.trigger) return 'insufficient_or_conflicted_evidence';
  if (!e.eligibility || !e.observability || !e.bounds || !e.topology) return 'implementation_not_yet_ready';
  return 'bounded_schedule_enablement_preregistration_justified';
}

function buildAudit(root) {
  const preregText = readText(root, PREREG);
  const prereg = JSON.parse(preregText);
  const obs = readJson(root, OBS);
  const canary = readText(root, CANARY);
  const checkpoint = readText(root, CHECKPOINT);
  const collector = readText(root, COLLECTOR);

  const upstream = gitBlobSha(preregText) === EXPECTED_PREREG_BLOB
    && prereg.decision === 'bounded_scheduled_canary_experiment_preregistered'
    && prereg.decision_scope?.enables_schedule_now === false;
  req(upstream, 'upstream_preregistration_gate_failed');

  const protectedOk = obs.valid_observation_count === 36
    && obs.invalid_observation_count === 0
    && obs.conflict_count === 0
    && obs.protected_state?.outcomes_opened === false
    && obs.protected_state?.holdouts_opened === false
    && obs.protected_state?.catalyst_outcome_association_opened === false
    && obs.protected_state?.withdrawal_state_opened === false;
  req(protectedOk, 'protected_state_changed');

  const sourceOk = prereg.source_contract?.legacy_retries_authorized === 0
    && prereg.source_contract?.historical_range_or_backfill_authorized === false
    && prereg.source_contract?.wave_a_or_wave_c_authorized === false
    && collector.includes('https://mops.twse.com.tw/mops/api/t05st01')
    && collector.includes('https://mops.twse.com.tw/mops/api/t05st01_detail')
    && !collector.includes('/mops/web/ajax_t05st01');
  req(sourceOk, 'source_contract_changed');

  const topology = prereg.execution_topology?.max_parallel === 1
    && JSON.stringify(prereg.execution_topology?.randomized_pre_request_cooldown_seconds) === JSON.stringify([20,60])
    && canary.includes('max-parallel: 1')
    && canary.includes("stock: ['1102', '1104', '1216']");
  req(topology, 'topology_changed');

  const pit = prereg.pit_write_safety?.append_only_immutable_snapshots === true
    && prereg.pit_write_safety?.historical_back_imputation_allowed === false
    && prereg.pit_write_safety?.write_layer_cancel_in_progress === false
    && prereg.pit_write_safety?.refetch_reapply_on_push_race === true
    && checkpoint.includes('cancel-in-progress: false')
    && checkpoint.includes('git fetch origin main');
  req(pit, 'pit_write_safety_changed');

  const trigger = !/^\s*schedule\s*:/m.test(canary)
    && !/repository_dispatch\s*:/m.test(canary)
    && !/workflow_run\s*:/m.test(canary);
  req(trigger, 'automatic_trigger_present');

  const eEligible = evaluateEligibility(obs, '2026-10-05T11:30:00+08:00');
  const eSameDate = evaluateEligibility(obs, '2026-10-04T01:00:00+08:00');
  const shortState = JSON.parse(JSON.stringify(obs));
  shortState.collection_time_range.last = '2026-10-04T15:00:00.000Z';
  shortState.observations = shortState.observations.slice(0,-1).concat([{...shortState.observations.at(-1),collected_at:'2026-10-04T15:00:00.000Z'}]);
  const eShort = evaluateEligibility(shortState, '2026-10-05T00:30:00+08:00');
  const badState = JSON.parse(JSON.stringify(obs)); badState.conflict_count = 1;
  const eBad = evaluateEligibility(badState, '2026-10-05T11:30:00+08:00');

  const eligibility = eEligible.result === ELIGIBLE && eEligible.source_requests_authorized === 6
    && eSameDate.result === INELIGIBLE_DATE && eSameDate.source_requests_authorized === 0
    && eShort.result === INELIGIBLE_ELAPSED && eShort.source_requests_authorized === 0
    && eBad.result === INVALID && eBad.source_requests_authorized === 0;
  req(eligibility, 'eligibility_control_plane_not_ready');

  const o = buildObservabilityRecord(eEligible);
  const observability = JSON.stringify(o.request_count_per_stock) === JSON.stringify({1102:0,1104:0,1216:0})
    && JSON.stringify(o.snapshot_count_per_stock) === JSON.stringify({1102:0,1104:0,1216:0})
    && o.source_endpoints_used.length === 0
    && o.accepted_snapshot_paths.length === 0
    && o.accepted_snapshot_ids.length === 0
    && o.candidate_contract?.enabled === false
    && o.candidate_contract?.local_time === '11:30'
    && o.candidate_contract?.timezone === 'Asia/Taipei';
  req(observability, 'observability_control_plane_not_ready');

  const bounds = JSON.stringify(prereg.frozen_universe?.stocks) === JSON.stringify(['1102','1104','1216'])
    && prereg.request_budget?.max_requests_per_stock === 2
    && prereg.request_budget?.max_requests_per_eligible_occurrence === 6
    && prereg.experiment_boundary?.finite_initial_eligible_occurrence_target === 3
    && prereg.experiment_boundary?.indefinite_scheduling_authorized === false;
  req(bounds, 'experiment_bounds_changed');

  const decision = evaluateReadiness({
    upstream, protected: protectedOk, source: sourceOk, pit, trigger,
    eligibility, observability, bounds, topology,
  });
  req(ALLOWED_DECISIONS.includes(decision), 'decision_outside_enum');

  return {
    schema_version: 1,
    audit_id: 'institutional-accumulation-catalyst-schedule-enablement-readiness-v1',
    network_collection_used: false,
    live_canary_triggered: false,
    upstream_gate: {
      preregistration_git_blob_sha1: EXPECTED_PREREG_BLOB,
      preregistration_decision: prereg.decision,
      passed: upstream,
    },
    eligibility_control_plane: {
      latest_canonical_timestamp: obs.collection_time_range.last,
      candidate_contract: {enabled:false, local_time:'11:30', timezone:'Asia/Taipei'},
      minimum_elapsed_milliseconds: 43200000,
      requires_later_asia_taipei_date: true,
      results_supported: [ELIGIBLE, INELIGIBLE_DATE, INELIGIBLE_ELAPSED, INVALID],
      ineligible_or_invalid_source_requests: 0,
      eligible_future_request_budget: 6,
      passed: eligibility,
    },
    observability_control_plane: {
      request_counts_initialized_zero: true,
      snapshot_counts_initialized_zero: true,
      source_endpoints_used_initialized_empty: true,
      accepted_snapshot_paths_initialized_empty: true,
      accepted_snapshot_ids_initialized_empty: true,
      terminal_reason_required: true,
      passed: observability,
    },
    frozen_bounds: {
      stocks: ['1102','1104','1216'],
      max_requests_per_stock: 2,
      max_requests_per_eligible_occurrence: 6,
      initial_eligible_occurrence_target: 3,
      indefinite_scheduling_authorized: false,
      passed: bounds,
    },
    source_and_topology: {
      listing_endpoint: prereg.source_contract.listing_endpoint,
      detail_endpoint: prereg.source_contract.detail_endpoint,
      legacy_retries_authorized: 0,
      historical_backfill_authorized: false,
      wave_a_or_wave_c_authorized: false,
      fresh_runner_matrix_required: true,
      max_parallel: 1,
      randomized_pre_request_cooldown_seconds: [20,60],
      passed: sourceOk && topology,
    },
    pit_write_safety: {
      append_only_immutable_snapshots: true,
      historical_back_imputation_allowed: false,
      write_layer_cancel_in_progress: false,
      refetch_reapply_on_push_race: true,
      identical_remote_files_win: true,
      immutable_conflict_behavior: 'fail_closed',
      passed: pit,
    },
    trigger_safety: {
      on_schedule_present: false,
      repository_dispatch_present: false,
      workflow_run_present: false,
      schedule_enabled: false,
      passed: trigger,
    },
    protected_state: {
      canonical_observation_count: obs.valid_observation_count,
      invalid_observation_count: obs.invalid_observation_count,
      conflict_count: obs.conflict_count,
      outcomes_opened: false,
      holdouts_opened: false,
      protected_2454_outcome_opened: false,
      catalyst_outcome_association_opened: false,
      withdrawal_used_as_accumulation_input: false,
      model_strategy_or_production_behavior_enabled: false,
      passed: protectedOk,
    },
    decision,
    decision_scope: {
      authorizes_later_paired_schedule_enablement_canary_preregistration_only: decision === 'bounded_schedule_enablement_preregistration_justified',
      enables_schedule_now: false,
      live_source_request_authorized_in_this_round: false,
      production_behavior_change_authorized: false,
    },
  };
}
function serialize(a) { return JSON.stringify(a,null,2)+'\n'; }
function main() {
  const a = buildAudit(process.cwd());
  const s = serialize(a);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(process.cwd(), ...OUTPUT_RELATIVE.split('/')), s);
    process.stdout.write(OUTPUT_RELATIVE+'\n');
  } else process.stdout.write(s);
}
if (require.main === module) {
  try { main(); } catch (e) { console.error(e.stack || e.message); process.exitCode=1; }
}
module.exports={OUTPUT_RELATIVE,ALLOWED_DECISIONS,evaluateReadiness,buildAudit,serialize};
