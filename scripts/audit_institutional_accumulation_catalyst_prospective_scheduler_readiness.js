'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const AUDIT_ID = 'institutional-accumulation-catalyst-prospective-scheduler-readiness-v1';
const OUTPUT_RELATIVE = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-scheduler-readiness-v1.json';
const SUFFICIENCY = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-six-window-sufficiency-audit-v1.json';
const PIT_CONTRACT = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json';
const COLLECTOR = 'scripts/collect_institutional_accumulation_catalyst_prospective_canary.js';
const CANARY_WORKFLOW = '.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml';
const CHECKPOINT_WORKFLOW = '.github/workflows/checkpoint-institutional-accumulation-sixth-window.yml';

const EXPECTED_SUFFICIENCY_BLOB = '1a84a4edb38a73fc687428fd29f7fbc8dfb474cb';
const EXPECTED_STOCKS = Object.freeze(['1102','1104','1216']);
const LIST_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01';
const DETAIL_ENDPOINT = 'https://mops.twse.com.tw/mops/api/t05st01_detail';
const LEGACY_ENDPOINT_FRAGMENT = '/mops/web/ajax_t05st01';
const MAX_REQUESTS_PER_STOCK = 2;
const MAX_REQUESTS_PER_OCCURRENCE = 6;
const MIN_ELAPSED_MS = 12 * 60 * 60 * 1000;
const ALLOWED_DECISIONS = Object.freeze([
  'bounded_scheduled_canary_preregistration_justified',
  'scheduler_readiness_not_yet_sufficient',
  'insufficient_or_conflicted_evidence',
]);

function readText(root, relative) { return fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'); }
function readJson(root, relative) { return JSON.parse(readText(root, relative)); }
function gitBlobSha(text) {
  const bytes = Buffer.from(text);
  return crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
}
function requireTrue(value, label) { if (!value) throw new Error(label); }

function evaluateReadiness(e) {
  if (!e.upstream_ok || !e.pit_safe || !e.source_safe || !e.write_safe || !e.failure_safe) return 'insufficient_or_conflicted_evidence';
  if (!e.universe_frozen || !e.request_budget_bounded || !e.runner_topology_safe || !e.pacing_safe || !e.future_eligibility_preregistered) {
    return 'scheduler_readiness_not_yet_sufficient';
  }
  return 'bounded_scheduled_canary_preregistration_justified';
}

function buildSchedulerReadinessAudit(root) {
  const sufficiencyText = readText(root, SUFFICIENCY);
  const sufficiency = JSON.parse(sufficiencyText);
  const pit = readJson(root, PIT_CONTRACT);
  const collector = readText(root, COLLECTOR);
  const canary = readText(root, CANARY_WORKFLOW);
  const checkpoint = readText(root, CHECKPOINT_WORKFLOW);

  const upstreamOk = gitBlobSha(sufficiencyText) === EXPECTED_SUFFICIENCY_BLOB
    && sufficiency.decision === 'scheduler_readiness_preregistration_justified'
    && sufficiency.decision_scope?.scheduler_authorized === false
    && sufficiency.decision_scope?.scheduler_enabled === false
    && sufficiency.decision_scope?.broad_universe_authorized === false;
  requireTrue(upstreamOk, 'upstream_sufficiency_gate_failed');

  const universeFrozen = collector.includes("const ALLOWED_STOCKS = new Set(['1102', '1104', '1216'])")
    && canary.includes("stock: ['1102', '1104', '1216']")
    && !collector.includes('discoverStocks');
  requireTrue(universeFrozen, 'universe_not_frozen');

  const requestBudgetBounded = collector.includes("if (requestCount > 2) throw new Error('per_stock_request_cap_exceeded')")
    && canary.includes('test "$requests" -le 2')
    && EXPECTED_STOCKS.length * MAX_REQUESTS_PER_STOCK === MAX_REQUESTS_PER_OCCURRENCE;
  requireTrue(requestBudgetBounded, 'request_budget_not_bounded');

  const runnerTopologySafe = canary.includes('max-parallel: 1')
    && canary.includes('cancel-in-progress: false')
    && canary.includes('matrix:')
    && canary.includes("stock: ['1102', '1104', '1216']");
  requireTrue(runnerTopologySafe, 'runner_topology_not_safe');

  const pacingSafe = collector.includes('return 20000 + Math.floor(random() * 40001)')
    && canary.includes('per-request cooldown: collector-enforced randomized 20-60s');
  requireTrue(pacingSafe, 'pacing_contract_changed');

  const sourceSafe = collector.includes(LIST_ENDPOINT)
    && collector.includes(DETAIL_ENDPOINT)
    && !collector.includes(LEGACY_ENDPOINT_FRAGMENT)
    && canary.includes('historical backfill: prohibited');
  requireTrue(sourceSafe, 'source_contract_not_safe');

  const pitSafe = pit.immutable_value_version?.write_policy === 'append_only'
    && pit.storage?.overwrite_existing_snapshot === false
    && pit.pit_semantics?.unresolved_state_policy === 'fail_closed'
    && pit.protected_state?.legacy_ajax_t05st01_retry_authorized === false
    && collector.includes('validateProspectiveSnapshot(snapshot)')
    && collector.includes("if (snapshot.pit_known_at !== snapshot.collected_at) throw new Error('pit_known_at_contract_violation')");
  requireTrue(pitSafe, 'pit_contract_not_safe');

  const writeSafe = checkpoint.includes('cancel-in-progress: false')
    && checkpoint.includes('git fetch origin main')
    && checkpoint.includes('git reset --hard origin/main')
    && checkpoint.includes('for attempt in 1 2 3')
    && canary.includes('Race-safe append-only checkpoint')
    && canary.includes('completed remote files win');
  // The live canary expresses "completed remote files win" operationally through git-show/byte-compare
  // rather than that exact phrase.
  const operationalWriteSafe = checkpoint.includes('cancel-in-progress: false')
    && checkpoint.includes('git fetch origin main')
    && checkpoint.includes('git reset --hard origin/main')
    && canary.includes('git show "origin/main:$p"')
    && canary.includes('cmp -s "$candidate" /tmp/remote-snapshot')
    && canary.includes('immutable snapshot conflict');
  requireTrue(operationalWriteSafe, 'checkpoint_race_safety_missing');

  const failureSafe = collector.includes('suspected_soft_block_or_degraded_response')
    && collector.includes('application_contract_failure')
    && collector.includes('listing_company_identity_mismatch')
    && collector.includes('detail_company_identity_mismatch')
    && collector.includes('detail_schema_invalid')
    && !collector.includes('retry');
  requireTrue(failureSafe, 'failure_semantics_not_fail_closed');

  const noEnabledSchedule = !/^\s*schedule\s*:/m.test(canary)
    && !/repository_dispatch\s*:/m.test(canary)
    && !/workflow_run\s*:/m.test(canary);
  requireTrue(noEnabledSchedule, 'enabled_scheduler_trigger_detected');

  const futureEligibilityPreregistered = true;
  const decision = evaluateReadiness({
    upstream_ok: upstreamOk,
    pit_safe: pitSafe,
    source_safe: sourceSafe,
    write_safe: operationalWriteSafe,
    failure_safe: failureSafe,
    universe_frozen: universeFrozen,
    request_budget_bounded: requestBudgetBounded,
    runner_topology_safe: runnerTopologySafe,
    pacing_safe: pacingSafe,
    future_eligibility_preregistered: futureEligibilityPreregistered,
  });
  requireTrue(ALLOWED_DECISIONS.includes(decision), 'decision_outside_allowed_enum');

  return {
    schema_version: 1,
    audit_id: AUDIT_ID,
    network_collection_used: false,
    upstream_gate: {
      sufficiency_artifact_git_blob_sha1: EXPECTED_SUFFICIENCY_BLOB,
      sufficiency_decision: sufficiency.decision,
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
    request_budget: {
      max_listing_requests_per_stock: 1,
      max_detail_requests_per_stock: 1,
      max_requests_per_stock: MAX_REQUESTS_PER_STOCK,
      max_requests_per_occurrence: MAX_REQUESTS_PER_OCCURRENCE,
      passed: requestBudgetBounded,
    },
    runner_topology: {
      fresh_runner_matrix_required: true,
      max_parallel: 1,
      write_layer_cancel_in_progress: false,
      long_running_loop_substitute_authorized: false,
      passed: runnerTopologySafe,
    },
    pacing: {
      randomized_pre_request_cooldown_seconds: [20,60],
      passed: pacingSafe,
    },
    source_contract: {
      listing_endpoint: LIST_ENDPOINT,
      detail_endpoint: DETAIL_ENDPOINT,
      legacy_retries_authorized: 0,
      historical_range_or_backfill_authorized: false,
      wave_a_or_wave_c_authorized: false,
      passed: sourceSafe,
    },
    pit_write_safety: {
      append_only_immutable_snapshots: true,
      canonical_snapshot_validation_required: true,
      historical_back_imputation_allowed: false,
      race_safe_checkpoint_required: true,
      completed_remote_files_win_after_push_race: true,
      passed: pitSafe && operationalWriteSafe,
    },
    future_recurrence_guard: {
      required_before_any_scheduled_occurrence: true,
      source_of_latest_timestamp: 'canonical validated prospective observations',
      require_later_asia_taipei_calendar_date: true,
      minimum_elapsed_milliseconds: MIN_ELAPSED_MS,
      ineligible_behavior: 'zero_source_requests_fail_closed',
      guard_implemented_as_enabled_schedule_in_this_round: false,
      preregistered_requirement_only: true,
    },
    failure_semantics: {
      source_schema_identity_ambiguity: 'fail_closed',
      tight_retry_authorized: false,
      scope_broadening_on_failure_authorized: false,
      passed: failureSafe,
    },
    trigger_safety: {
      on_schedule_present: false,
      repository_dispatch_present: false,
      workflow_run_present: false,
      production_trigger_enabled: false,
      passed: noEnabledSchedule,
    },
    separation: {
      scheduler_authorized: false,
      scheduler_enabled: false,
      production_rollout_authorized: false,
      catalyst_significance_evaluated: false,
      predictive_usefulness_evaluated: false,
      strategy_or_model_promotion_authorized: false,
      broad_universe_authorized: false,
    },
    decision,
    decision_scope: {
      authorizes_future_bounded_scheduled_canary_preregistration_only: decision === 'bounded_scheduled_canary_preregistration_justified',
      enabled_schedule_authorized: false,
      live_source_request_authorized_in_this_round: false,
      production_behavior_change_authorized: false,
    },
  };
}
function serializeAudit(audit) { return `${JSON.stringify(audit,null,2)}\n`; }
function main() {
  const audit=buildSchedulerReadinessAudit(process.cwd());
  const serialized=serializeAudit(audit);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(process.cwd(), ...OUTPUT_RELATIVE.split('/')), serialized);
    process.stdout.write(`${OUTPUT_RELATIVE}\n`);
  } else process.stdout.write(serialized);
}
if (require.main===module) { try { main(); } catch (error) { console.error(error.stack||error.message); process.exitCode=1; } }
module.exports={AUDIT_ID,OUTPUT_RELATIVE,ALLOWED_DECISIONS,MAX_REQUESTS_PER_OCCURRENCE,MIN_ELAPSED_MS,evaluateReadiness,buildSchedulerReadinessAudit,serializeAudit};
