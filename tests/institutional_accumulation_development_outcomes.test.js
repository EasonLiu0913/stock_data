'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FREEZE_FILE = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json');
const {
  EXPECTED_FREEZE_SHA256,
  HORIZONS,
  buildArtifact,
  horizonSession,
  selectDevelopmentAnchors,
  semanticFreezeHash,
  verifyFrozenManifest,
} = require('../scripts/open_institutional_accumulation_development_outcomes');

function loadFreeze() {
  return JSON.parse(fs.readFileSync(FREEZE_FILE, 'utf8'));
}

test('Phase 2 freeze identity and all referenced source bytes remain immutable', () => {
  const payload = loadFreeze();
  assert.equal(payload.content_sha256, EXPECTED_FREEZE_SHA256);
  assert.equal(semanticFreezeHash(payload), EXPECTED_FREEZE_SHA256);
  const verification = verifyFrozenManifest(payload, ROOT);
  assert.equal(verification.semantic_sha256, EXPECTED_FREEZE_SHA256);
  assert.ok(verification.verified_source_files > 0);
});

test('development selector materializes exactly the frozen methodology-development partition and never 2454', () => {
  const payload = loadFreeze();
  const selected = selectDevelopmentAnchors(payload);
  assert.equal(selected.length, 41);
  assert.ok(selected.every(anchor => anchor.partition === 'methodology_development'));
  assert.ok(selected.every(anchor => String(anchor.stock) !== '2454'));
});

test('horizon lookup counts sessions rather than calendar days', () => {
  const sessions = ['20260814', '20260817', '20260818', '20260819', '20260820', '20260821'];
  assert.equal(horizonSession(sessions, '20260814', 5), '20260821');
  assert.equal(horizonSession(sessions, '20260817', 5), null);
});

test('development-only artifact has no binary labels, holdout rows, protected stock, or industry-relative metric', () => {
  const artifact = buildArtifact(loadFreeze(), ROOT);
  assert.equal(artifact.outcome_opening_id, 'institutional-accumulation-outcome-opening-v1');
  assert.equal(artifact.binary_success_threshold, null);
  assert.equal(artifact.counts.methodology_development, 41);
  assert.equal(artifact.counts.stock_holdout_materialized, 0);
  assert.equal(artifact.counts.time_holdout_materialized, 0);
  assert.equal(artifact.counts.protected_2454_materialized, 0);
  assert.equal(artifact.outcomes.length, 41);
  assert.ok(artifact.outcomes.every(row => row.partition === 'methodology_development'));
  assert.ok(artifact.outcomes.every(row => row.stock !== '2454'));
  assert.deepEqual(Object.keys(artifact.coverage), HORIZONS.map(h => `D+${h}`));
  assert.match(artifact.same_industry_relative_outcomes, /^omitted:/);
  const encoded = JSON.stringify(artifact);
  for (const forbidden of ['repricing_success', 'failure_label', 'future_catalyst']) {
    assert.equal(encoded.includes(`\"${forbidden}\"`), false);
  }
});

test('not-yet-observed horizons remain explicit nulls rather than zero', () => {
  const artifact = buildArtifact(loadFreeze(), ROOT);
  for (const row of artifact.outcomes) {
    for (const horizon of HORIZONS) {
      const value = row.horizons[`D+${horizon}`];
      if (value.state !== 'horizon_not_observed') continue;
      assert.equal(value.horizon_date, null);
      assert.equal(value.absolute_forward_return, null);
      assert.equal(value.taiex_forward_return, null);
      assert.equal(value.taiex_relative_forward_return, null);
      assert.equal(value.mfe, null);
      assert.equal(value.mae, null);
    }
  }
});
