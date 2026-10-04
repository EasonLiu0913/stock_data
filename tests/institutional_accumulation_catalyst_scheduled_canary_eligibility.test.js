'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ELIGIBLE, INELIGIBLE_DATE, INELIGIBLE_ELAPSED, INVALID,
  evaluateEligibility, buildObservabilityRecord, validateCanonicalObservationState,
} = require('../scripts/evaluate_institutional_accumulation_catalyst_scheduled_canary_eligibility');

const canonical = require('../data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json');

test('canonical observation state is accepted', () => {
  assert.equal(validateCanonicalObservationState(canonical), true);
});

test('later Taipei date and >=12h is eligible', () => {
  const r = evaluateEligibility(canonical, '2026-10-05T11:30:00+08:00');
  assert.equal(r.result, ELIGIBLE);
  assert.equal(r.source_requests_authorized, 6);
  assert.ok(r.elapsed_milliseconds >= 43200000);
});

test('same Taipei date fails closed with zero source requests', () => {
  const r = evaluateEligibility(canonical, '2026-10-04T01:00:00+08:00');
  assert.equal(r.result, INELIGIBLE_DATE);
  assert.equal(r.source_requests_authorized, 0);
});

test('later Taipei date but under 12h fails closed', () => {
  const state = JSON.parse(JSON.stringify(canonical));
  state.collection_time_range.last = '2026-10-04T15:00:00.000Z';
  state.observations = state.observations.slice(0,-1).concat([{...state.observations.at(-1), collected_at:'2026-10-04T15:00:00.000Z'}]);
  const r = evaluateEligibility(state, '2026-10-05T00:30:00+08:00');
  assert.equal(r.result, INELIGIBLE_ELAPSED);
  assert.equal(r.source_requests_authorized, 0);
});

test('invalid/conflicted state fails closed', () => {
  const state = JSON.parse(JSON.stringify(canonical));
  state.conflict_count = 1;
  const r = evaluateEligibility(state, '2026-10-05T11:30:00+08:00');
  assert.equal(r.result, INVALID);
  assert.equal(r.source_requests_authorized, 0);
});

test('observability record is deterministic and zero-count before execution', () => {
  const e = evaluateEligibility(canonical, '2026-10-05T11:30:00+08:00');
  const a = buildObservabilityRecord(e);
  const b = buildObservabilityRecord(e);
  assert.deepEqual(a,b);
  assert.deepEqual(a.request_count_per_stock, {1102:0,1104:0,1216:0});
  assert.deepEqual(a.snapshot_count_per_stock, {1102:0,1104:0,1216:0});
  assert.deepEqual(a.source_endpoints_used, []);
  assert.deepEqual(a.accepted_snapshot_paths, []);
  assert.deepEqual(a.accepted_snapshot_ids, []);
  assert.equal(a.candidate_contract.enabled, false);
  assert.equal(a.candidate_contract.local_time, '11:30');
  assert.equal(a.candidate_contract.timezone, 'Asia/Taipei');
});
