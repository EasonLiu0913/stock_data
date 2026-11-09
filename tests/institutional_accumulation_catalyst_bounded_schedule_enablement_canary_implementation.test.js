'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {readFrozenArtifact}=require('./helpers/frozen_institutional_audit_artifact');
const ARTIFACT='data_research/institutional-flow/institutional-accumulation-catalyst-bounded-schedule-enablement-canary-implementation-v1.json';
const ARTIFACT_SHA256='c5b5f85460da1585ab445fdd9b8343a7a39156695d264de1124e3be36bf1a5cb';

test('frozen implementation audit records its historical guarded schedule and no forbidden trigger',()=>{
  const a=readFrozenArtifact(ARTIFACT,ARTIFACT_SHA256);
  assert.equal(a.schedule.enabled,true);
  assert.equal(a.schedule.github_actions_utc_cron,'30 3 * * *');
  assert.equal(a.schedule.exact_automatic_schedule_count,1);
  assert.equal(a.schedule.repository_dispatch_present,false);
  assert.equal(a.schedule.workflow_run_present,false);
  assert.equal(a.pre_request_gate.durable_preflight_checkpoint_before_collection,true);
});

test('frozen implementation audit records the initial finite scheduled state',()=>{
  const a=readFrozenArtifact(ARTIFACT,ARTIFACT_SHA256);
  assert.equal(a.finite_state.accepted_eligible_scheduled_occurrence_count,0);
  assert.equal(a.finite_state.target_accepted_eligible_scheduled_occurrences,3);
  assert.equal(a.finite_state.pending_occurrence,null);
  assert.equal(a.finite_state.occurrence_count,0);
  assert.equal(a.finite_state.post_target_collection_allowed,false);
});

test('frozen implementation audit preserves execution and protected bounds',()=>{
  const a=readFrozenArtifact(ARTIFACT,ARTIFACT_SHA256);
  assert.deepEqual(a.execution.stocks,['1102','1104','1216']);
  assert.equal(a.execution.max_requests_per_eligible_occurrence,6);
  assert.equal(a.execution.max_parallel,1);
  assert.equal(a.protected_state.canonical_observation_count,36);
  assert.equal(a.protected_state.outcomes_opened,false);
  assert.equal(a.protected_state.holdouts_opened,false);
});

test('frozen implementation artifact retains its registered decision',()=>{
  const a=readFrozenArtifact(ARTIFACT,ARTIFACT_SHA256);
  assert.equal(a.decision,'bounded_schedule_enablement_canary_implemented');
  assert.equal(a.decision_scope.manual_dispatch_for_validation_authorized,false);
});
