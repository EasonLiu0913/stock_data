'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFrozenArtifact}=require('./helpers/frozen_institutional_audit_artifact');
const {
  ALLOWED_DECISIONS,
  evaluateReadiness,
  buildAudit,
} = require('../scripts/audit_institutional_accumulation_catalyst_schedule_enablement_readiness');
const ARTIFACT='data_research/institutional-flow/institutional-accumulation-catalyst-schedule-enablement-readiness-v1.json';
const ARTIFACT_SHA256='8e24203d232194ff4046370625f369e9920fd23325163403e71836c740799fce';

function evidence(overrides={}) {
  return {
    upstream:true, protected:true, source:true, pit:true, trigger:true,
    eligibility:true, observability:true, bounds:true, topology:true,
    ...overrides,
  };
}

test('complete zero-network control plane justifies only later enablement preregistration', () => {
  assert.equal(
    evaluateReadiness(evidence()),
    'bounded_schedule_enablement_preregistration_justified',
  );
});

test('missing implementation evidence is not yet ready', () => {
  assert.equal(evaluateReadiness(evidence({eligibility:false})), 'implementation_not_yet_ready');
  assert.equal(evaluateReadiness(evidence({observability:false})), 'implementation_not_yet_ready');
  assert.equal(evaluateReadiness(evidence({topology:false})), 'implementation_not_yet_ready');
});

test('upstream/protected/trigger defect fails closed', () => {
  assert.equal(evaluateReadiness(evidence({upstream:false})), 'insufficient_or_conflicted_evidence');
  assert.equal(evaluateReadiness(evidence({protected:false})), 'insufficient_or_conflicted_evidence');
  assert.equal(evaluateReadiness(evidence({trigger:false})), 'insufficient_or_conflicted_evidence');
});

test('frozen readiness audit records one decision without enabling schedule', () => {
  const a = readFrozenArtifact(ARTIFACT,ARTIFACT_SHA256);
  assert.ok(ALLOWED_DECISIONS.includes(a.decision));
  assert.equal(a.decision, 'bounded_schedule_enablement_preregistration_justified');
  assert.deepEqual(a.frozen_bounds.stocks, ['1102','1104','1216']);
  assert.equal(a.frozen_bounds.max_requests_per_stock, 2);
  assert.equal(a.frozen_bounds.max_requests_per_eligible_occurrence, 6);
  assert.equal(a.frozen_bounds.initial_eligible_occurrence_target, 3);
  assert.equal(a.eligibility_control_plane.minimum_elapsed_milliseconds, 43200000);
  assert.equal(a.eligibility_control_plane.requires_later_asia_taipei_date, true);
  assert.equal(a.trigger_safety.schedule_enabled, false);
  assert.equal(a.decision_scope.enables_schedule_now, false);
  assert.equal(a.decision_scope.live_source_request_authorized_in_this_round, false);
  assert.equal(a.decision_scope.production_behavior_change_authorized, false);
});
