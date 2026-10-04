'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const AUDIT_ID = 'institutional-accumulation-catalyst-bounded-schedule-enablement-canary-preregistration-v1';
const OUTPUT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-bounded-schedule-enablement-canary-preregistration-v1.json';
const READINESS = 'data_research/institutional-flow/institutional-accumulation-catalyst-schedule-enablement-readiness-v1.json';
const OBSERVATION_AUDIT = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
const PIT_CONTRACT = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json';
const ELIGIBILITY = 'scripts/evaluate_institutional_accumulation_catalyst_scheduled_canary_eligibility.js';
const COLLECTOR = 'scripts/collect_institutional_accumulation_catalyst_prospective_canary.js';
const CANARY_WORKFLOW = '.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml';
const CHECKPOINT_WORKFLOW = '.github/workflows/checkpoint-institutional-accumulation-sixth-window.yml';

const EXPECTED_READINESS_BLOB = '32d221aca8e0d2d4575071ca9bef9092b0a8da27';
const EXPECTED_STOCKS = Object.freeze(['1102','1104','1216']);
const LIST_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01';
const DETAIL_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01_detail';
const ALLOWED_DECISIONS = Object.freeze([
  'bounded_schedule_enablement_canary_preregistered',
  'preregistration_incomplete',
  'insufficient_or_conflicted_evidence',
]);

function readText(root, rel) { return fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'); }
function readJson(root, rel) { return JSON.parse(readText(root, rel)); }
function gitBlobSha(text) {
  const bytes = Buffer.from(text);
  return crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
}
function req(value, label) { if (!value) throw new Error(label); }

function evaluatePreregistration(e) {
  if (!e.upstream || !e.protected || !e.source || !e.pit || !e.trigger_safe) return 'insufficient_or_conflicted_evidence';
  if (!e.schedule || !e.eligibility || !e.bounds || !e.topology || !e.observability || !e.finite_gate || !e.stop_semantics) {
    return 'preregistration_incomplete';
  }
  return 'bounded_schedule_enablement_canary_preregistered';
}

function buildAudit(root) {
  const readinessText = readText(root, READINESS);
  const readiness = JSON.parse(readinessText);
  const obs = readJson(root, OBSERVATION_AUDIT);
  const pit = readJson(root, PIT_CONTRACT);
  const evaluator = readText(root, ELIGIBILITY);
  const collector = readText(root, COLLECTOR);
  const canary = readText(root, CANARY_WORKFLOW);
  const checkpoint = readText(root, CHECKPOINT_WORKFLOW);

  const upstream = gitBlobSha(readinessText) === EXPECTED_READINESS_BLOB
    && readiness.decision === 'bounded_schedule_enablement_preregistration_justified'
    && readiness.decision_scope?.enables_schedule_now === false;
  req(upstream, 'upstream_readiness_gate_failed');

  const protectedOk = obs.valid_observation_count === 36
    && obs.invalid_observation_count === 0
    && obs.conflict_count === 0
    && obs.protected_state?.outcomes_opened === false
    && obs.protected_state?.holdouts_opened === false
    && obs.protected_state?.catalyst_outcome_association_opened === false
    && obs.protected_state?.withdrawal_state_opened === false;
  req(protectedOk, 'protected_state_changed');

  const sourceOk = readiness.source_and_topology?.listing_endpoint === LIST_ENDPOINT
    && readiness.source_and_topology?.detail_endpoint === DETAIL_ENDPOINT
    && readiness.source_and_topology?.legacy_retries_authorized === 0
    && readiness.source_and_topology?.historical_backfill_authorized === false
    && readiness.source_and_topology?.wave_a_or_wave_c_authorized === false
    && collector.includes(LIST_ENDPOINT)
    && collector.includes(DETAIL_ENDPOINT)
    && !collector.includes('/mops/web/ajax_t05st01');
  req(sourceOk, 'source_contract_changed');

  const topology = readiness.source_and_topology?.fresh_runner_matrix_required === true
    && readiness.source_and_topology?.max_parallel === 1
    && JSON.stringify(readiness.source_and_topology?.randomized_pre_request_cooldown_seconds) === JSON.stringify([20,60])
    && canary.includes('max-parallel: 1')
    && canary.includes("stock: ['1102', '1104', '1216']");
  req(topology, 'topology_changed');

  const pitSafe = pit.immutable_value_version?.write_policy === 'append_only'
    && pit.storage?.overwrite_existing_snapshot === false
    && pit.pit_semantics?.unresolved_state_policy === 'fail_closed'
    && readiness.pit_write_safety?.historical_back_imputation_allowed === false
    && readiness.pit_write_safety?.write_layer_cancel_in_progress === false
    && checkpoint.includes('cancel-in-progress: false')
    && checkpoint.includes('git fetch origin main');
  req(pitSafe, 'pit_write_safety_changed');

  const triggerSafe = !/^\s*schedule\s*:/m.test(canary)
    && !/repository_dispatch\s*:/m.test(canary)
    && !/workflow_run\s*:/m.test(canary);
  req(triggerSafe, 'automatic_trigger_present');

  const schedule = readiness.eligibility_control_plane?.candidate_contract?.enabled === false
    && readiness.eligibility_control_plane?.candidate_contract?.local_time === '11:30'
    && readiness.eligibility_control_plane?.candidate_contract?.timezone === 'Asia/Taipei'
    && new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date('2026-01-15T03:30:00Z')) === '11:30'
    && new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date('2026-07-15T03:30:00Z')) === '11:30';
  req(schedule, 'schedule_contract_not_proven');

  const eligibility = evaluator.includes("const MIN_ELAPSED_MS = 12 * 60 * 60 * 1000")
    && evaluator.includes("const CANDIDATE_TIMEZONE = 'Asia/Taipei'")
    && evaluator.includes("source_requests_authorized: 0")
    && readiness.eligibility_control_plane?.minimum_elapsed_milliseconds === 43200000
    && readiness.eligibility_control_plane?.requires_later_asia_taipei_date === true
    && readiness.eligibility_control_plane?.ineligible_or_invalid_source_requests === 0;
  req(eligibility, 'eligibility_contract_not_proven');

  const bounds = JSON.stringify(readiness.frozen_bounds?.stocks) === JSON.stringify(EXPECTED_STOCKS)
    && readiness.frozen_bounds?.max_requests_per_stock === 2
    && readiness.frozen_bounds?.max_requests_per_eligible_occurrence === 6
    && readiness.frozen_bounds?.initial_eligible_occurrence_target === 3
    && readiness.frozen_bounds?.indefinite_scheduling_authorized === false;
  req(bounds, 'bounds_changed');

  const observability = readiness.observability_control_plane?.request_counts_initialized_zero === true
    && readiness.observability_control_plane?.snapshot_counts_initialized_zero === true
    && readiness.observability_control_plane?.source_endpoints_used_initialized_empty === true
    && readiness.observability_control_plane?.accepted_snapshot_paths_initialized_empty === true
    && readiness.observability_control_plane?.accepted_snapshot_ids_initialized_empty === true
    && readiness.observability_control_plane?.terminal_reason_required === true;
  req(observability, 'observability_contract_not_proven');

  const finiteGate = bounds;
  const stopSemantics = triggerSafe && pitSafe && eligibility;

  const decision = evaluatePreregistration({
    upstream, protected: protectedOk, source: sourceOk, pit: pitSafe, trigger_safe: triggerSafe,
    schedule, eligibility, bounds, topology, observability, finite_gate: finiteGate, stop_semantics: stopSemantics,
  });
  req(ALLOWED_DECISIONS.includes(decision), 'decision_outside_enum');

  return {
    schema_version: 1,
    audit_id: AUDIT_ID,
    network_collection_used: false,
    live_canary_triggered: false,
    upstream_gate: {
      schedule_enablement_readiness_git_blob_sha1: EXPECTED_READINESS_BLOB,
      schedule_enablement_readiness_decision: readiness.decision,
      byte_identity_required: true,
      passed: upstream,
    },
    schedule_contract: {
      enabled: false,
      candidate_local_time: '11:30',
      timezone: 'Asia/Taipei',
      utc_offset: '+08:00',
      dst_observed: false,
      github_actions_utc_cron: '30 3 * * *',
      automatic_trigger_authorized_in_this_round: false,
      current_live_workflow_has_schedule_trigger: false,
      passed: schedule && triggerSafe,
    },
    eligibility_before_request: {
      uses_existing_deterministic_evaluator: true,
      require_later_asia_taipei_calendar_date: true,
      minimum_elapsed_milliseconds: 43200000,
      same_or_earlier_date_behavior: 'zero_source_requests_fail_closed',
      elapsed_under_12h_behavior: 'zero_source_requests_fail_closed',
      invalid_or_conflicted_behavior: 'zero_source_requests_fail_closed',
      missing_or_evaluator_error_behavior: 'zero_source_requests_fail_closed',
      durable_terminal_reason_required: true,
      evaluated_before_any_source_request: true,
      passed: eligibility,
    },
    frozen_bounds: {
      stocks: [...EXPECTED_STOCKS],
      max_listing_requests_per_stock: 1,
      max_detail_requests_per_stock: 1,
      max_requests_per_stock: 2,
      max_requests_per_eligible_occurrence: 6,
      discovery_authorized: false,
      broad_universe_authorized: false,
      passed: bounds,
    },
    source_contract: {
      listing_endpoint: LIST_ENDPOINT,
      detail_endpoint: DETAIL_ENDPOINT,
      legacy_retries_authorized: 0,
      historical_backfill_authorized: false,
      wave_a_or_wave_c_authorized: false,
      passed: sourceOk,
    },
    execution_topology: {
      fresh_runner_matrix_required: true,
      max_parallel: 1,
      randomized_pre_request_cooldown_seconds: [20,60],
      long_running_polling_loop_authorized: false,
      passed: topology,
    },
    observability_and_checkpoint: {
      pre_request_eligibility_record_required: true,
      request_count_per_stock_required: true,
      snapshot_count_per_stock_required: true,
      source_endpoints_used_required: true,
      accepted_snapshot_paths_required: true,
      accepted_snapshot_ids_required: true,
      terminal_reason_required: true,
      append_only_immutable_snapshots: true,
      canonical_validation_required: true,
      historical_back_imputation_allowed: false,
      write_layer_cancel_in_progress: false,
      refetch_reapply_on_push_race: true,
      identical_remote_files_win: true,
      immutable_conflict_behavior: 'fail_closed',
      passed: observability && pitSafe,
    },
    finite_experiment_gate: {
      target_accepted_eligible_scheduled_occurrences: 3,
      counter_unit: 'accepted_eligible_scheduled_occurrence',
      skipped_or_ineligible_cron_firings_consume_target: false,
      after_target_behavior: 'zero_source_requests_fail_closed_pending_mandatory_closeout',
      closeout_required_before_extension: true,
      indefinite_scheduling_authorized: false,
      passed: finiteGate,
    },
    implementation_stop_semantics: {
      accepted_eligible_count_unprovable: 'prevent_source_collection',
      protected_state_drift: 'prevent_source_collection',
      trigger_duplication: 'prevent_source_collection',
      request_budget_breach: 'prevent_source_collection',
      source_schema_identity_ambiguity: 'prevent_source_collection',
      checkpoint_conflict: 'prevent_source_collection',
      tight_retry_authorized: false,
      scope_broadening_authorized: false,
      passed: stopSemantics,
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
      broad_universe_enabled: false,
      passed: protectedOk,
    },
    decision,
    decision_scope: {
      authorizes_later_separately_paired_implementation_round_only: decision === 'bounded_schedule_enablement_canary_preregistered',
      enables_schedule_now: false,
      live_source_request_authorized_in_this_round: false,
      production_behavior_change_authorized: false,
    },
  };
}

function serializeAudit(audit) { return `${JSON.stringify(audit, null, 2)}\n`; }
function main() {
  const audit = buildAudit(process.cwd());
  const serialized = serializeAudit(audit);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(process.cwd(), ...OUTPUT_RELATIVE.split('/')), serialized);
    process.stdout.write(`${OUTPUT_RELATIVE}\n`);
  } else process.stdout.write(serialized);
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = { AUDIT_ID, OUTPUT_RELATIVE, ALLOWED_DECISIONS, evaluatePreregistration, buildAudit, serializeAudit };
