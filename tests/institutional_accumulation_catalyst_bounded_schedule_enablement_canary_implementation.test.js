'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {buildAudit,serializeAudit}=require('../scripts/audit_institutional_accumulation_catalyst_bounded_schedule_enablement_canary_implementation');

test('implementation has exactly one guarded schedule and no forbidden trigger',()=>{
  const a=buildAudit(process.cwd());
  assert.equal(a.schedule.enabled,true);
  assert.equal(a.schedule.github_actions_utc_cron,'30 3 * * *');
  assert.equal(a.schedule.exact_automatic_schedule_count,1);
  assert.equal(a.schedule.repository_dispatch_present,false);
  assert.equal(a.schedule.workflow_run_present,false);
  assert.equal(a.pre_request_gate.durable_preflight_checkpoint_before_collection,true);
});

test('finite scheduled state starts at zero of three with no pending occurrence',()=>{
  const a=buildAudit(process.cwd());
  assert.equal(a.finite_state.accepted_eligible_scheduled_occurrence_count,0);
  assert.equal(a.finite_state.target_accepted_eligible_scheduled_occurrences,3);
  assert.equal(a.finite_state.pending_occurrence,null);
  assert.equal(a.finite_state.occurrence_count,0);
  assert.equal(a.finite_state.post_target_collection_allowed,false);
});

test('execution and protected bounds stay frozen',()=>{
  const a=buildAudit(process.cwd());
  assert.deepEqual(a.execution.stocks,['1102','1104','1216']);
  assert.equal(a.execution.max_requests_per_eligible_occurrence,6);
  assert.equal(a.execution.max_parallel,1);
  assert.equal(a.protected_state.canonical_observation_count,36);
  assert.equal(a.protected_state.outcomes_opened,false);
  assert.equal(a.protected_state.holdouts_opened,false);
});

test('committed implementation artifact regenerates byte-identically',()=>{
  const a=buildAudit(process.cwd());
  const committed=fs.readFileSync('data_research/institutional-flow/institutional-accumulation-catalyst-bounded-schedule-enablement-canary-implementation-v1.json','utf8');
  assert.equal(serializeAudit(a),committed);
  assert.equal(a.decision,'bounded_schedule_enablement_canary_implemented');
  assert.equal(a.decision_scope.manual_dispatch_for_validation_authorized,false);
});
