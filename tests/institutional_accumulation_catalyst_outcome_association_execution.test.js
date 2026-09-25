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

test('repaired calendar materializes only mature preregistered windows', () => {
  const r = buildResult();
  assert.equal(r.coverage.primary_events, 11);
  assert.equal(r.coverage.event_session_resolved, 11);
  assert.equal(r.coverage.event_session_unresolved, 0);
  assert.equal(r.coverage.numeric_return_horizons_materialized, 11);
  assert.equal(r.coverage.margin_windows_materialized, 11);
  const resolved = r.primary_events.filter(x => x.alignment.status === 'resolved');
  const unresolved = r.primary_events.filter(x => x.alignment.status === 'missing');
  assert.equal(resolved.length, 11);
  assert.equal(unresolved.length, 0);
  const bySession = resolved.reduce((m,row) => {
    m[row.alignment.event_session] = (m[row.alignment.event_session] || 0) + 1;
    return m;
  }, {});
  assert.deepEqual(bySession, { '20260923': 9, '20260924': 2 });
  for (const row of resolved) {
    assert.equal(row.returns.D1.status, 'materialized');
    assert.equal(row.returns.D3.status, 'missing');
    assert.equal(row.returns.D5.status, 'missing');
    assert.equal(row.margin_financing.event_window.status, 'materialized');
  }
  for (const row of unresolved) {
    assert.equal(row.returns.D1.status, 'missing');
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
