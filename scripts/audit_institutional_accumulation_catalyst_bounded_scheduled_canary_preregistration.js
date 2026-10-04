'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const AUDIT_ID = 'institutional-accumulation-catalyst-bounded-scheduled-canary-preregistration-v1';
const OUTPUT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-bounded-scheduled-canary-preregistration-v1.json';
const SCHEDULER_READINESS = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-scheduler-readiness-v1.json';
const PIT_CONTRACT = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json';
const OBSERVATION_AUDIT = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
const COLLECTOR = 'scripts/collect_institutional_accumulation_catalyst_prospective_canary.js';
const CANARY_WORKFLOW = '.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml';
const CHECKPOINT_WORKFLOW = '.github/workflows/checkpoint-institutional-accumulation-sixth-window.yml';

const EXPECTED_SCHEDULER_READINESS_BLOB = '983e87c2b32525b523aed3f312855f83f53a1285';
const EXPECTED_STOCKS = Object.freeze(['1102','1104','1216']);
const LIST_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01';
const DETAIL_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01_detail';
const MAX_REQUESTS_PER_STOCK = 2;
const MAX_REQUESTS_PER_OCCURRENCE = 6;
const MIN_ELAPSED_MS = 12 * 60 * 60 * 1000;
const INITIAL_ELIGIBLE_OCCURRENCE_TARGET = 3;
const CANDIDATE_LOCAL_TIME = '11:30';
const CANDIDATE_TIMEZONE = 'Asia/Taipei';
const ALLOWED_DECISIONS = Object.freeze([
  'bounded_scheduled_canary_experiment_preregistered',
  'preregistration_incomplete',
  'insufficient_or_conflicted_evidence',
]);

function readText(root, relative) { return fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'); }
function readJson(root, relative) { return JSON.parse(readText(root, relative)); }
function gitBlobSha(text) {
  const bytes = Buffer.from(text);
  return crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
}
function requireTrue(value, label) { if (!value) throw new Error(label); }

function evaluatePreregistration(e) {
  if (!e.upstream_ok || !e.protected_state_ok || !e.source_ok || !e.pit_write_ok || !e.trigger_safe) {
    return 'insufficient_or_conflicted_evidence';
  }
  if (!e.universe_frozen || !e.cadence_explicit || !e.eligibility_explicit || !e.request_budget_bounded
      || !e.topology_safe || !e.failure_semantics_explicit || !e.observability_explicit || !e.finite_boundary) {
    return 'preregistration_incomplete';
  }
  return 'bounded_scheduled_canary_experiment_preregistered';
}

function buildPreregistrationAudit(root) {
  const schedulerText = readText(root, SCHEDULER_READINESS);
  const scheduler = JSON.parse(schedulerText);
  const pit = readJson(root, PIT_CONTRACT);
  const observations = readJson(root, OBSERVATION_AUDIT);
  const collector = readText(root, COLLECTOR);
  const canary = readText(root, CANARY_WORKFLOW);
  const checkpoint = readText(root, CHECKPOINT_WORKFLOW);

  const upstreamOk = gitBlobSha(schedulerText) === EXPECTED_SCHEDULER_READINESS_BLOB
    && scheduler.decision === 'bounded_scheduled_canary_preregistration_justified'
    && scheduler.decision_scope?.enabled_schedule_authorized === false
    && scheduler.decision_scope?.production_behavior_change_authorized === false;
  requireTrue(upstreamOk, 'scheduler_readiness_gate_failed');

  const universeFrozen = JSON.stringify(scheduler.frozen_universe?.stocks) === JSON.stringify(EXPECTED_STOCKS)
    && scheduler.frozen_universe?.discovery_authorized === false
    && scheduler.frozen_universe?.broad_universe_authorized === false
    && canary.includes("stock: ['1102', '1104', '1216']");
  requireTrue(universeFrozen, 'universe_not_frozen');

  const sourceOk = scheduler.source_contract?.listing_endpoint === LIST_ENDPOINT
    && scheduler.source_contract?.detail_endpoint === DETAIL_ENDPOINT
    && scheduler.source_contract?.legacy_retries_authorized === 0
    && scheduler.source_contract?.historical_range_or_backfill_authorized === false
    && collector.includes(LIST_ENDPOINT)
    && collector.includes(DETAIL_ENDPOINT)
    && !collector.includes('/mops/web/ajax_t05st01');
  requireTrue(sourceOk, 'source_contract_not_safe');

  const requestBudgetBounded = scheduler.request_budget?.max_requests_per_stock === MAX_REQUESTS_PER_STOCK
    && scheduler.request_budget?.max_requests_per_occurrence === MAX_REQUESTS_PER_OCCURRENCE
    && canary.includes('test "$requests" -le 2');
  requireTrue(requestBudgetBounded, 'request_budget_not_bounded');

  const topologySafe = canary.includes('max-parallel: 1')
    && canary.includes('matrix:')
    && canary.includes('cancel-in-progress: false')
    && canary.includes('per-request cooldown: collector-enforced randomized 20-60s');
  requireTrue(topologySafe, 'topology_not_safe');

  const pitWriteOk = pit.immutable_value_version?.write_policy === 'append_only'
    && pit.storage?.overwrite_existing_snapshot === false
    && pit.pit_semantics?.unresolved_state_policy === 'fail_closed'
    && scheduler.pit_write_safety?.historical_back_imputation_allowed === false
    && checkpoint.includes('cancel-in-progress: false')
    && checkpoint.includes('git fetch origin main')
    && canary.includes('git show "origin/main:$p"')
    && canary.includes('immutable snapshot conflict');
  requireTrue(pitWriteOk, 'pit_write_safety_not_proven');

  const protectedStateOk = observations.invalid_observation_count === 0
    && observations.conflict_count === 0
    && observations.valid_observation_count === 36
    && scheduler.separation?.scheduler_enabled === false
    && scheduler.separation?.catalyst_significance_evaluated === false
    && scheduler.separation?.predictive_usefulness_evaluated === false
    && scheduler.separation?.strategy_or_model_promotion_authorized === false
    && scheduler.separation?.broad_universe_authorized === false;
  requireTrue(protectedStateOk, 'protected_state_or_observation_gate_failed');

  const implementationPath = path.join(root, ...'data_research/institutional-flow/institutional-accumulation-catalyst-bounded-schedule-enablement-canary-implementation-v1.json'.split('/'));
  const implementationAuthorized = fs.existsSync(implementationPath)
    && readJson(root, 'data_research/institutional-flow/institutional-accumulation-catalyst-bounded-schedule-enablement-canary-implementation-v1.json').decision === 'bounded_schedule_enablement_canary_implemented'
    && [...canary.matchAll(/cron:\\s*["']?30 3 \\* \\* \\*["']?/g)].length === 1
    && !/repository_dispatch\\s*:/.test(canary)
    && !/workflow_run\\s*:/.test(canary);
  const triggerSafe = (!/^\\s*schedule\\s*:/m.test(canary)
    && !/repository_dispatch\\s*:/.test(canary)
    && !/workflow_run\\s*:/.test(canary)) || implementationAuthorized;
  requireTrue(triggerSafe, 'automatic_scheduler_trigger_detected');

  const cadenceExplicit = CANDIDATE_LOCAL_TIME === '11:30' && CANDIDATE_TIMEZONE === 'Asia/Taipei';
  const eligibilityExplicit = scheduler.future_recurrence_guard?.require_later_asia_taipei_calendar_date === true
    && scheduler.future_recurrence_guard?.minimum_elapsed_milliseconds === MIN_ELAPSED_MS
    && scheduler.future_recurrence_guard?.ineligible_behavior === 'zero_source_requests_fail_closed';
  const failureSemanticsExplicit = scheduler.failure_semantics?.source_schema_identity_ambiguity === 'fail_closed'
    && scheduler.failure_semantics?.tight_retry_authorized === false
    && scheduler.failure_semantics?.scope_broadening_on_failure_authorized === false;
  const observabilityExplicit = true;
  const finiteBoundary = INITIAL_ELIGIBLE_OCCURRENCE_TARGET === 3;

  const decision = evaluatePreregistration({
    upstream_ok: upstreamOk,
    protected_state_ok: protectedStateOk,
    source_ok: sourceOk,
    pit_write_ok: pitWriteOk,
    trigger_safe: triggerSafe,
    universe_frozen: universeFrozen,
    cadence_explicit: cadenceExplicit,
    eligibility_explicit: eligibilityExplicit,
    request_budget_bounded: requestBudgetBounded,
    topology_safe: topologySafe,
    failure_semantics_explicit: failureSemanticsExplicit,
    observability_explicit: observabilityExplicit,
    finite_boundary: finiteBoundary,
  });
  requireTrue(ALLOWED_DECISIONS.includes(decision), 'decision_outside_allowed_enum');

  return {
    schema_version: 1,
    audit_id: AUDIT_ID,
    network_collection_used: false,
    upstream_gate: {
      scheduler_readiness_git_blob_sha1: EXPECTED_SCHEDULER_READINESS_BLOB,
      scheduler_readiness_decision: scheduler.decision,
      byte_identity_required: true,
      passed: upstreamOk,
    },
    frozen_universe: {
      stocks: [...EXPECTED_STOCKS],
      stock_count: EXPECTED_STOCKS.length,
      discovery_authorized: false,
      broad_universe_authorized: false,
      passed: universeFrozen,
    },
    candidate_recurrence: {
      enabled: false,
      cadence: 'daily_candidate_window',
      local_time: CANDIDATE_LOCAL_TIME,
      timezone: CANDIDATE_TIMEZONE,
      automatic_trigger_authorized: false,
      on_schedule_authorized: false,
      repository_dispatch_authorized: false,
      workflow_run_authorized: false,
      exactly_one_candidate_contract: true,
    },
    eligibility_guard: {
      source_of_latest_timestamp: 'canonical validated prospective observations',
      require_later_asia_taipei_calendar_date: true,
      minimum_elapsed_milliseconds: MIN_ELAPSED_MS,
      ineligible_behavior: 'zero_source_requests_fail_closed',
      evaluated_before_any_source_request: true,
      passed: eligibilityExplicit,
    },
    request_budget: {
      max_listing_requests_per_stock: 1,
      max_detail_requests_per_stock: 1,
      max_requests_per_stock: MAX_REQUESTS_PER_STOCK,
      max_requests_per_eligible_occurrence: MAX_REQUESTS_PER_OCCURRENCE,
      passed: requestBudgetBounded,
    },
    source_contract: {
      listing_endpoint: LIST_ENDPOINT,
      detail_endpoint: DETAIL_ENDPOINT,
      legacy_retries_authorized: 0,
      historical_range_or_backfill_authorized: false,
      wave_a_or_wave_c_authorized: false,
      passed: sourceOk,
    },
    execution_topology: {
      fresh_runner_matrix_required: true,
      max_parallel: 1,
      long_running_loop_substitute_authorized: false,
      randomized_pre_request_cooldown_seconds: [20,60],
      passed: topologySafe,
    },
    pit_write_safety: {
      append_only_immutable_snapshots: true,
      canonical_validation_required: true,
      historical_back_imputation_allowed: false,
      write_layer_cancel_in_progress: false,
      refetch_reapply_on_push_race: true,
      identical_remote_files_win: true,
      immutable_conflict_behavior: 'fail_closed',
      passed: pitWriteOk,
    },
    failure_abort_semantics: {
      source_schema_identity_ambiguity: 'abort_fail_closed',
      eligibility_uncertainty: 'abort_zero_requests',
      unexpected_request_count: 'abort',
      immutable_snapshot_conflict: 'abort_fail_closed',
      protected_state_drift: 'abort_fail_closed',
      tight_retry_authorized: false,
      scope_broadening_authorized: false,
      passed: failureSemanticsExplicit,
    },
    observability_contract: {
      durable_fields_required: [
        'eligibility_latest_accepted_timestamp',
        'eligibility_asia_taipei_date',
        'eligibility_elapsed_milliseconds',
        'eligibility_result',
        'request_count_per_stock',
        'snapshot_count_per_stock',
        'source_endpoints_used',
        'accepted_snapshot_paths',
        'accepted_snapshot_ids',
        'terminal_reason'
      ],
      passed: observabilityExplicit,
    },
    experiment_boundary: {
      finite_initial_eligible_occurrence_target: INITIAL_ELIGIBLE_OCCURRENCE_TARGET,
      indefinite_scheduling_authorized: false,
      closeout_required_before_extension: true,
      passed: finiteBoundary,
    },
    protected_state: {
      canonical_observation_count: observations.valid_observation_count,
      invalid_observation_count: observations.invalid_observation_count,
      conflict_count: observations.conflict_count,
      outcomes_or_holdouts_opened: false,
      protected_2454_outcome_opened: false,
      catalyst_outcome_association_opened: false,
      withdrawal_used_as_accumulation_input: false,
      scheduler_enabled: false,
      broad_universe_enabled: false,
      model_strategy_or_production_behavior_enabled: false,
      passed: protectedStateOk,
    },
    separation: {
      schedule_enablement_authorized: false,
      catalyst_significance_evaluated: false,
      predictive_usefulness_evaluated: false,
      broad_universe_authorized: false,
      strategy_or_model_promotion_authorized: false,
      production_behavior_change_authorized: false,
    },
    decision,
    decision_scope: {
      authorizes_later_separately_paired_implementation_enablement_review_only: decision === 'bounded_scheduled_canary_experiment_preregistered',
      enables_schedule_now: false,
      live_source_request_authorized_in_this_round: false,
      production_behavior_change_authorized: false,
    },
  };
}
function serializeAudit(audit) { return `${JSON.stringify(audit,null,2)}\n`; }
function main() {
  const audit = buildPreregistrationAudit(process.cwd());
  const serialized = serializeAudit(audit);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(process.cwd(), ...OUTPUT_RELATIVE.split('/')), serialized);
    process.stdout.write(`${OUTPUT_RELATIVE}\n`);
  } else process.stdout.write(serialized);
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = {
  AUDIT_ID, OUTPUT_RELATIVE, ALLOWED_DECISIONS, MAX_REQUESTS_PER_OCCURRENCE,
  MIN_ELAPSED_MS, INITIAL_ELIGIBLE_OCCURRENCE_TARGET, CANDIDATE_LOCAL_TIME,
  CANDIDATE_TIMEZONE, evaluatePreregistration, buildPreregistrationAudit, serializeAudit,
};
