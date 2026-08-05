'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { validateRegistry } = require('../scripts/strategy_tag_engine');

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
