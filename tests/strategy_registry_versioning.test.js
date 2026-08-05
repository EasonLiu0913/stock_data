'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { validateRegistry, registryFingerprint } = require('../scripts/strategy_tag_engine');
const {
  liveSnapshotReplacementReason,
  shouldReplaceLiveSnapshot,
} = require('../scripts/apply_strategy_tag_registry');

const ROOT = path.resolve(__dirname, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

test('keeps legacy margin rebound V1 frozen and publishes the changed rule as V2', () => {
  const legacy = readJson('config/prediction-tag-strategy-registry.json');
  const current = readJson('config/strategy-tag-registry.json');

  const legacyTag = legacy.tags.find(item => item.tag_id === 'margin_significant_exit_v1');
  const legacyStrategy = legacy.strategies.find(item => item.strategy_id === 'oversold_margin_exit_rebound_v1');
  assert.deepEqual(legacyTag.parameters, {
    five_day_threshold_pct: -5,
    one_day_threshold_pct: -3,
  });
  assert.equal(legacyStrategy.version, 1);

  const currentTag = current.tags.find(item => item.tag_id === 'margin_significant_exit_v2');
  const currentStrategy = current.strategies.find(item => item.strategy_id === 'oversold_margin_exit_rebound_v2');
  assert.equal(currentTag.version, 2);
  assert.deepEqual(currentTag.expression.all, ['margin_exit_1d_v1', 'margin_exit_5d_v1']);
  assert.equal(currentStrategy.version, 2);
  assert.ok(currentStrategy.expression.all.includes('margin_significant_exit_v2'));
  assert.equal(current.tags.some(item => item.tag_id === 'margin_significant_exit_v1'), false);
  assert.equal(current.strategies.some(item => item.strategy_id === 'oversold_margin_exit_rebound_v1'), false);
  assert.equal(validateRegistry(current), true);
});

test('rebuilds a live snapshot whenever its registry fingerprint is stale', () => {
  const current = readJson('config/strategy-tag-registry.json');
  const currentFingerprint = registryFingerprint(current);

  assert.equal(shouldReplaceLiveSnapshot({
    registry_fingerprint: 'stale-registry-fingerprint',
  }, current), true);
  assert.equal(
    liveSnapshotReplacementReason({
      registry_fingerprint: 'stale-registry-fingerprint',
    }, current),
    'registry_fingerprint_mismatch',
  );
  assert.equal(shouldReplaceLiveSnapshot({
    registry_fingerprint: currentFingerprint,
  }, current), false);
});

test('still replaces fingerprints explicitly marked invalid', () => {
  const current = readJson('config/strategy-tag-registry.json');
  const invalidFingerprint = current.replace_invalid_live_fingerprints[0];
  const registryWithMatchingFingerprint = {
    ...current,
    replace_invalid_live_fingerprints: [invalidFingerprint],
  };

  assert.equal(
    liveSnapshotReplacementReason({ registry_fingerprint: invalidFingerprint }, registryWithMatchingFingerprint),
    'listed_invalid_fingerprint',
  );
});
