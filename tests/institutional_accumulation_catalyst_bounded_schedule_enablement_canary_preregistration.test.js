'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  ALLOWED_DECISIONS,
  evaluatePreregistration,
  buildAudit,
  serializeAudit,
} = require('../scripts/audit_institutional_accumulation_catalyst_bounded_schedule_enablement_canary_preregistration');

function evidence(overrides={}) {
  return {
    upstream:true, protected:true, source:true, pit:true, trigger_safe:true,
    schedule:true, eligibility:true, bounds:true, topology:true, observability:true,
    finite_gate:true, stop_semantics:true, ...overrides,
  };
}

test('decision enum is frozen and complete evidence preregisters only the later implementation round', () => {
  assert.deepEqual(ALLOWED_DECISIONS, [
    'bounded_schedule_enablement_canary_preregistered',
    'preregistration_incomplete',
    'insufficient_or_conflicted_evidence',
  ]);
  assert.equal(evaluatePreregistration(evidence()), 'bounded_schedule_enablement_canary_preregistered');
  assert.equal(evaluatePreregistration(evidence({schedule:false})), 'preregistration_incomplete');
  assert.equal(evaluatePreregistration(evidence({trigger_safe:false})), 'insufficient_or_conflicted_evidence');
});

test('preregistration freezes exact disabled Taipei schedule and finite three-eligible-occurrence gate', () => {
  const a = buildAudit(process.cwd());
  assert.equal(a.schedule_contract.enabled, false);
  assert.equal(a.schedule_contract.candidate_local_time, '11:30');
  assert.equal(a.schedule_contract.timezone, 'Asia/Taipei');
  assert.equal(a.schedule_contract.utc_offset, '+08:00');
  assert.equal(a.schedule_contract.dst_observed, false);
  assert.equal(a.schedule_contract.github_actions_utc_cron, '30 3 * * *');
  assert.equal(a.schedule_contract.current_live_workflow_has_schedule_trigger, false);
  assert.equal(a.finite_experiment_gate.target_accepted_eligible_scheduled_occurrences, 3);
  assert.equal(a.finite_experiment_gate.skipped_or_ineligible_cron_firings_consume_target, false);
  assert.equal(a.finite_experiment_gate.indefinite_scheduling_authorized, false);
});

test('eligibility, source, topology, PIT and protected bounds remain fail-closed', () => {
  const a = buildAudit(process.cwd());
  assert.deepEqual(a.frozen_bounds.stocks, ['1102','1104','1216']);
  assert.equal(a.frozen_bounds.max_requests_per_eligible_occurrence, 6);
  assert.equal(a.eligibility_before_request.evaluated_before_any_source_request, true);
  assert.equal(a.eligibility_before_request.minimum_elapsed_milliseconds, 43200000);
  assert.equal(a.eligibility_before_request.missing_or_evaluator_error_behavior, 'zero_source_requests_fail_closed');
  assert.equal(a.source_contract.legacy_retries_authorized, 0);
  assert.equal(a.source_contract.historical_backfill_authorized, false);
  assert.equal(a.execution_topology.max_parallel, 1);
  assert.deepEqual(a.execution_topology.randomized_pre_request_cooldown_seconds, [20,60]);
  assert.equal(a.observability_and_checkpoint.append_only_immutable_snapshots, true);
  assert.equal(a.observability_and_checkpoint.write_layer_cancel_in_progress, false);
  assert.equal(a.protected_state.canonical_observation_count, 36);
  assert.equal(a.protected_state.outcomes_opened, false);
  assert.equal(a.protected_state.holdouts_opened, false);
});

test('committed preregistration artifact regenerates byte-identically and does not authorize schedule enablement', () => {
  const built = buildAudit(process.cwd());
  const committed = fs.readFileSync('data_research/institutional-flow/institutional-accumulation-catalyst-bounded-schedule-enablement-canary-preregistration-v1.json', 'utf8');
  assert.equal(serializeAudit(built), committed);
  assert.equal(built.decision, 'bounded_schedule_enablement_canary_preregistered');
  assert.equal(built.decision_scope.enables_schedule_now, false);
  assert.equal(built.decision_scope.live_source_request_authorized_in_this_round, false);
  assert.equal(built.decision_scope.production_behavior_change_authorized, false);
});
