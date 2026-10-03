'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {
  ALLOWED_DECISIONS,
  MAX_REQUESTS_PER_OCCURRENCE,
  MIN_ELAPSED_MS,
  evaluateReadiness,
  buildSchedulerReadinessAudit,
}=require('../scripts/audit_institutional_accumulation_catalyst_prospective_scheduler_readiness');

function evidence(overrides={}) {
  return {
    upstream_ok:true,pit_safe:true,source_safe:true,write_safe:true,failure_safe:true,
    universe_frozen:true,request_budget_bounded:true,runner_topology_safe:true,pacing_safe:true,
    future_eligibility_preregistered:true,...overrides,
  };
}

test('safe frozen canary path justifies only future bounded scheduled-canary preregistration',()=>{
  assert.equal(evaluateReadiness(evidence()),'bounded_scheduled_canary_preregistration_justified');
});
test('missing bounded operational guard is not yet scheduler-ready',()=>{
  assert.equal(evaluateReadiness(evidence({runner_topology_safe:false})),'scheduler_readiness_not_yet_sufficient');
  assert.equal(evaluateReadiness(evidence({future_eligibility_preregistered:false})),'scheduler_readiness_not_yet_sufficient');
});
test('upstream/source/PIT/write/failure defect fails closed',()=>{
  assert.equal(evaluateReadiness(evidence({upstream_ok:false})),'insufficient_or_conflicted_evidence');
  assert.equal(evaluateReadiness(evidence({source_safe:false})),'insufficient_or_conflicted_evidence');
  assert.equal(evaluateReadiness(evidence({write_safe:false})),'insufficient_or_conflicted_evidence');
  assert.equal(evaluateReadiness(evidence({failure_safe:false})),'insufficient_or_conflicted_evidence');
});
test('current repository yields bounded preregistration only with no enabled scheduler',()=>{
  const a=buildSchedulerReadinessAudit(process.cwd());
  assert.ok(ALLOWED_DECISIONS.includes(a.decision));
  assert.equal(a.decision,'bounded_scheduled_canary_preregistration_justified');
  assert.equal(MAX_REQUESTS_PER_OCCURRENCE,6);
  assert.equal(MIN_ELAPSED_MS,43200000);
  assert.deepEqual(a.frozen_universe.stocks,['1102','1104','1216']);
  assert.equal(a.trigger_safety.production_trigger_enabled,false);
  assert.equal(a.future_recurrence_guard.ineligible_behavior,'zero_source_requests_fail_closed');
  assert.equal(a.future_recurrence_guard.preregistered_requirement_only,true);
  assert.equal(a.separation.scheduler_enabled,false);
  assert.equal(a.separation.predictive_usefulness_evaluated,false);
  assert.equal(a.decision_scope.enabled_schedule_authorized,false);
});
