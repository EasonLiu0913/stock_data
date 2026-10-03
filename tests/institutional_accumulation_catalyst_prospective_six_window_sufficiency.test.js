'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ALLOWED_DECISIONS,
  MIN_SPAN_MS,
  evaluateSufficiency,
  buildSufficiencyAudit,
} = require('../scripts/audit_institutional_accumulation_catalyst_prospective_six_window_sufficiency');

function evidence(overrides={}) {
  return {
    invalid: 0,
    conflict: 0,
    reproducible: true,
    source_safe: true,
    protected_safe: true,
    complete_windows: 6,
    distinct_taipei_dates: 5,
    span_milliseconds: MIN_SPAN_MS + 1,
    ...overrides,
  };
}

test('six-window operational evidence justifies only scheduler-readiness preregistration', () => {
  assert.equal(evaluateSufficiency(evidence()), 'scheduler_readiness_preregistration_justified');
});
test('insufficient duration requires another manual canary', () => {
  assert.equal(evaluateSufficiency(evidence({complete_windows:5})), 'another_manual_canary_required');
  assert.equal(evaluateSufficiency(evidence({distinct_taipei_dates:3})), 'another_manual_canary_required');
  assert.equal(evaluateSufficiency(evidence({span_milliseconds:MIN_SPAN_MS-1})), 'another_manual_canary_required');
});
test('conflict or safety/reproducibility defect fails closed', () => {
  assert.equal(evaluateSufficiency(evidence({conflict:1})), 'insufficient_or_conflicted_evidence');
  assert.equal(evaluateSufficiency(evidence({source_safe:false})), 'insufficient_or_conflicted_evidence');
  assert.equal(evaluateSufficiency(evidence({protected_safe:false})), 'insufficient_or_conflicted_evidence');
});
test('current repository evidence yields one allowed outcome-blind decision', () => {
  const audit=buildSufficiencyAudit(process.cwd());
  assert.ok(ALLOWED_DECISIONS.includes(audit.decision));
  assert.equal(audit.network_collection_used,false);
  assert.equal(audit.canonical_evidence_shape.valid_observation_count,36);
  assert.equal(audit.canonical_evidence_shape.conflict_count,0);
  assert.equal(audit.temporal_coverage.distinct_asia_taipei_date_count,5);
  assert.equal(audit.sufficiency_policy.catalyst_significance_evaluated,false);
  assert.equal(audit.sufficiency_policy.predictive_usefulness_evaluated,false);
  assert.equal(audit.decision_scope.scheduler_authorized,false);
  assert.equal(audit.decision_scope.broad_universe_authorized,false);
});
