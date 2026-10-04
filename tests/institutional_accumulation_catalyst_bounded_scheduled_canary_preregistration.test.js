'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ALLOWED_DECISIONS,
  MAX_REQUESTS_PER_OCCURRENCE,
  MIN_ELAPSED_MS,
  INITIAL_ELIGIBLE_OCCURRENCE_TARGET,
  CANDIDATE_LOCAL_TIME,
  CANDIDATE_TIMEZONE,
  evaluatePreregistration,
  buildPreregistrationAudit,
} = require('../scripts/audit_institutional_accumulation_catalyst_bounded_scheduled_canary_preregistration');

function evidence(overrides={}) {
  return {
    upstream_ok:true, protected_state_ok:true, source_ok:true, pit_write_ok:true, trigger_safe:true,
    universe_frozen:true, cadence_explicit:true, eligibility_explicit:true, request_budget_bounded:true,
    topology_safe:true, failure_semantics_explicit:true, observability_explicit:true, finite_boundary:true,
    ...overrides,
  };
}

test('complete bounded experiment contract preregisters without enabling scheduling', () => {
  assert.equal(evaluatePreregistration(evidence()), 'bounded_scheduled_canary_experiment_preregistered');
});
test('missing experiment contract fields remains incomplete', () => {
  assert.equal(evaluatePreregistration(evidence({cadence_explicit:false})), 'preregistration_incomplete');
  assert.equal(evaluatePreregistration(evidence({finite_boundary:false})), 'preregistration_incomplete');
  assert.equal(evaluatePreregistration(evidence({observability_explicit:false})), 'preregistration_incomplete');
});
test('upstream or protected safety defects fail closed', () => {
  assert.equal(evaluatePreregistration(evidence({upstream_ok:false})), 'insufficient_or_conflicted_evidence');
  assert.equal(evaluatePreregistration(evidence({trigger_safe:false})), 'insufficient_or_conflicted_evidence');
  assert.equal(evaluatePreregistration(evidence({protected_state_ok:false})), 'insufficient_or_conflicted_evidence');
});
test('current repository yields exactly one bounded preregistration decision with no enabled schedule', () => {
  const a = buildPreregistrationAudit(process.cwd());
  assert.ok(ALLOWED_DECISIONS.includes(a.decision));
  assert.equal(a.decision, 'bounded_scheduled_canary_experiment_preregistered');
  assert.deepEqual(a.frozen_universe.stocks, ['1102','1104','1216']);
  assert.equal(MAX_REQUESTS_PER_OCCURRENCE, 6);
  assert.equal(MIN_ELAPSED_MS, 43200000);
  assert.equal(INITIAL_ELIGIBLE_OCCURRENCE_TARGET, 3);
  assert.equal(CANDIDATE_LOCAL_TIME, '11:30');
  assert.equal(CANDIDATE_TIMEZONE, 'Asia/Taipei');
  assert.equal(a.candidate_recurrence.enabled, false);
  assert.equal(a.experiment_boundary.indefinite_scheduling_authorized, false);
  assert.equal(a.decision_scope.enables_schedule_now, false);
  assert.equal(a.decision_scope.live_source_request_authorized_in_this_round, false);
  assert.equal(a.decision_scope.production_behavior_change_authorized, false);
});
