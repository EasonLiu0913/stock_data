'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildResult,
  resolveEventSession
} = require('../scripts/build_institutional_accumulation_catalyst_outcome_association_execution');

test('owner authorization is durable and bounded', () => {
  const r = buildResult();
  assert.equal(r.authorization.owner_authorized, true);
  assert.equal(r.authorization.durable_handoff_marker_present, true);
  assert.equal(r.authorization.protected_2454_holdout_withdrawal_authorized, false);
  assert.equal(r.authorization.score_rank_model_production_authorized, false);
});

test('frozen protocol and event intelligence identities remain unchanged', () => {
  const r = buildResult();
  assert.equal(r.parent_protocol.methodology_sha256, '5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be');
  assert.equal(r.frozen_event_intelligence.git_blob_sha1, 'ee34b995148886ed4f4b27940c6a854fff26f3bb');
  assert.equal(r.frozen_event_intelligence.methodology_sha256, '27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96');
});

test('primary cohort remains exactly 11 with 169 left-censored excluded', () => {
  const r = buildResult();
  assert.equal(r.protocol_integrity.cohort_primary_count, 11);
  assert.equal(r.protocol_integrity.left_censored_excluded_count, 169);
  assert.equal(r.primary_events.length, 11);
  assert.equal(new Set(r.primary_events.map(x => x.event_identity)).size, 11);
});

test('after-close event requires a later eligible session and fails closed when calendar ends earlier', () => {
  const a = resolveEventSession('2026-09-22T11:10:33.107Z', ['20260804']);
  assert.equal(a.classification, 'after_regular_close');
  assert.equal(a.status, 'missing');
  assert.equal(a.event_session, null);
});

test('before-open event can use the same upcoming eligible trading date', () => {
  const a = resolveEventSession('2026-09-22T00:00:00.000Z', ['20260922','20260923']);
  assert.equal(a.classification, 'before_open');
  assert.equal(a.status, 'resolved');
  assert.equal(a.event_session, '20260922');
});

test('no alternate alignment, imputation, or post-hoc rule change is introduced', () => {
  const r = buildResult();
  assert.equal(r.protocol_integrity.rules_changed_after_outcome_access, false);
  assert.equal(r.protocol_integrity.fallback_alignment_added, false);
  assert.equal(r.protocol_integrity.imputation_used, false);
});

test('current snapshot does not materialize numeric outcomes without a protocol-valid event session', () => {
  const r = buildResult();
  assert.equal(r.coverage.primary_events, 11);
  assert.equal(r.coverage.event_session_resolved, 0);
  assert.equal(r.coverage.event_session_unresolved, 11);
  assert.equal(r.coverage.numeric_return_horizons_materialized, 0);
  for (const row of r.primary_events) {
    assert.equal(row.alignment.status, 'missing');
    for (const h of ['D1','D3','D5']) {
      assert.equal(row.returns[h].value_pct, null);
      assert.equal(row.returns[h].benchmark_pct, null);
      assert.equal(row.returns[h].relative_pct, null);
    }
  }
});

test('prohibited optimized or production outputs remain explicitly forbidden', () => {
  const r = buildResult();
  assert.deepEqual(r.prohibited_outputs, [
    'optimized threshold',
    'score',
    'rank',
    'predictive model',
    'production strategy',
    'statistical significance claim'
  ]);
});
