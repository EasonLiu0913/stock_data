'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  prepareScheduledOccurrence,
  finalizeScheduledOccurrence,
  TARGET,
} = require('../scripts/manage_institutional_accumulation_catalyst_scheduled_canary_state');

const observations = JSON.parse(fs.readFileSync(
  'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json',
  'utf8'
));

function makeState(overrides = {}) {
  return {
    schema_version: 1,
    experiment_id: 'institutional-accumulation-catalyst-bounded-schedule-enablement-canary-v1',
    target_accepted_eligible_scheduled_occurrences: 3,
    accepted_eligible_scheduled_occurrence_count: 0,
    pending_occurrence: null,
    occurrences: [],
    closed: false,
    ...overrides,
  };
}

test('scheduled canary target is exactly three accepted eligible occurrences', () => {
  assert.equal(TARGET, 3);
});

test('eligible candidate becomes pending without incrementing accepted count', () => {
  const r = prepareScheduledOccurrence({
    state: makeState(),
    observations,
    candidateTimestamp: '2026-10-05T03:30:00.000Z',
    triggerIdentity: 'schedule:1:1',
  });
  assert.equal(r.should_collect, true);
  assert.equal(r.state.accepted_eligible_scheduled_occurrence_count, 0);
  assert.equal(r.state.pending_occurrence.trigger_identity, 'schedule:1:1');
  assert.equal(r.state.occurrences.at(-1).status, 'eligible_pending_collection');
});

test('same-date and invalid canonical states fail closed', () => {
  const same = prepareScheduledOccurrence({
    state: makeState(),
    observations,
    candidateTimestamp: '2026-10-04T03:30:00.000Z',
    triggerIdentity: 'schedule:2:1',
  });
  assert.equal(same.should_collect, false);
  assert.equal(same.state.occurrences.at(-1).eligibility.source_requests_authorized, 0);

  const bad = JSON.parse(JSON.stringify(observations));
  bad.conflict_count = 1;
  const invalid = prepareScheduledOccurrence({
    state: makeState(),
    observations: bad,
    candidateTimestamp: '2026-10-05T03:30:00.000Z',
    triggerIdentity: 'schedule:3:1',
  });
  assert.equal(invalid.should_collect, false);
  assert.equal(invalid.state.occurrences.at(-1).eligibility.source_requests_authorized, 0);
});

test('pending ambiguity fails closed before another collection', () => {
  const r = prepareScheduledOccurrence({
    state: makeState({
      pending_occurrence: {
        trigger_identity: 'schedule:old:1',
        candidate_timestamp: '2026-10-05T03:30:00.000Z',
        accepted_count_before: 0,
      },
    }),
    observations,
    candidateTimestamp: '2026-10-06T03:30:00.000Z',
    triggerIdentity: 'schedule:4:1',
  });
  assert.equal(r.should_collect, false);
  assert.equal(r.terminal_reason, 'pending_occurrence_requires_closeout');
});

test('target reached produces a zero-request skip', () => {
  const r = prepareScheduledOccurrence({
    state: makeState({accepted_eligible_scheduled_occurrence_count: 3}),
    observations,
    candidateTimestamp: '2026-10-06T03:30:00.000Z',
    triggerIdentity: 'schedule:5:1',
  });
  assert.equal(r.should_collect, false);
  assert.equal(r.accepted_count_after, 3);
  assert.equal(r.state.occurrences.at(-1).terminal_reason, 'accepted_eligible_target_reached');
});

test('finalize requires all three stocks and increments once', () => {
  const prepared = prepareScheduledOccurrence({
    state: makeState(),
    observations,
    candidateTimestamp: '2026-10-05T03:30:00.000Z',
    triggerIdentity: 'schedule:6:1',
  }).state;
  const stockResults = ['1102', '1104', '1216'].map(stock => ({
    stock,
    request_count: 2,
    snapshot_count: 2,
    source_endpoints_used: [
      'https://mops.twse.com.tw/mops/api/t05st01',
      'https://mops.twse.com.tw/mops/api/t05st01_detail',
    ],
    accepted_snapshot_paths: [`p/${stock}/a`, `p/${stock}/b`],
    accepted_snapshot_ids: [`${stock}a`, `${stock}b`],
  }));
  const next = finalizeScheduledOccurrence({
    state: prepared,
    triggerIdentity: 'schedule:6:1',
    stockResults,
  });
  assert.equal(next.accepted_eligible_scheduled_occurrence_count, 1);
  assert.equal(next.pending_occurrence, null);
  assert.equal(next.occurrences.at(-1).status, 'accepted');
  assert.deepEqual(next.occurrences.at(-1).request_count_per_stock, {1102: 2, 1104: 2, 1216: 2});
});
