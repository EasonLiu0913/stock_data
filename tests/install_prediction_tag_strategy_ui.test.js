'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  TARGETS,
  injectScript,
  install,
} = require('../scripts/install_prediction_tag_strategy_ui');
const predictionUi = require('../public/prediction-tag-strategy-enhancement');
const replayUi = require('../public/prediction-replay-tag-strategy-enhancement');

test('injectScript upgrades an existing version and keeps one reference', () => {
  const source = '<!doctype html><html><body><script src="prediction-tag-strategy-enhancement.js?v=1"></script></body></html>';
  const updated = injectScript(source, 'prediction-tag-strategy-enhancement.js?v=2');
  assert.match(updated, /prediction-tag-strategy-enhancement\.js\?v=2/);
  assert.equal((updated.match(/prediction-tag-strategy-enhancement\.js/g) || []).length, 1);
});

test('installer targets prediction and replay content pages and is idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-strategy-ui-'));
  for (const filename of Object.keys(TARGETS)) {
    fs.writeFileSync(path.join(directory, filename), '<html><body><main></main></body></html>');
  }
  const first = install(directory);
  const second = install(directory);
  assert.deepEqual(first.changed.sort(), Object.keys(TARGETS).sort());
  assert.deepEqual(second.changed, []);
  for (const [filename, script] of Object.entries(TARGETS)) {
    const html = fs.readFileSync(path.join(directory, filename), 'utf8');
    assert.match(html, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('prediction UI reads canonical registry fields and AND OR NOT selections', () => {
  const payload = predictionUi.normalizePayload({
    forecast_date: '20260803',
    tag_registry: [{ tag_id: 'a' }],
    strategy_registry_v2: [{ strategy_id: 's' }],
    strategy_classifications_v2: { s: { count: 0 } },
    stocks: [{ stock_code: '1', atomic_tags: ['a'], registered_strategy_matches: ['s'] }],
  });
  assert.equal(payload.tags[0].tag_id, 'a');
  assert.equal(payload.strategies[0].strategy_id, 's');
  assert.equal(payload.strategyClassifications.s.count, 0);
  assert.equal(predictionUi.compositeMatches(payload.stocks[0], { all: ['a'], any: [], not: ['b'] }), true);
  assert.equal(predictionUi.compositeMatches(payload.stocks[0], { all: [], any: ['b'], not: [] }), false);
  assert.equal(predictionUi.cycleMode(''), 'all');
  assert.equal(predictionUi.cycleMode('all'), 'any');
  assert.equal(predictionUi.cycleMode('any'), 'not');
  assert.equal(predictionUi.cycleMode('not'), '');
});

test('replay UI evaluates supported targets and keeps unavailable 5-day data unverified', () => {
  assert.deepEqual(replayUi.targetResult({ market_relative: { classification: 'relative_leadership' } }, 'relative_leadership').hit, true);
  assert.equal(replayUi.targetResult({ actual: { close_return: 5.1 } }, 'close_return_gt_5').hit, true);
  assert.equal(replayUi.targetResult({ actual: { max_return_5d: 10 } }, 'intraday_rebound_5d_10pct').hit, true);
  assert.equal(replayUi.targetResult({ actual: {} }, 'intraday_rebound_5d_10pct').verified, false);
});

test('browser enhancement scripts parse as JavaScript', () => {
  for (const filename of [
    'prediction-tag-strategy-enhancement.js',
    'prediction-replay-tag-strategy-enhancement.js',
  ]) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'public', filename), 'utf8');
    assert.doesNotThrow(() => new vm.Script(source), filename);
  }
});
