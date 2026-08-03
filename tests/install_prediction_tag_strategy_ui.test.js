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

test('injectScript installs one version-tolerant reference', () => {
  const source = '<!doctype html><html><body><main></main></body></html>';
  const once = injectScript(source, 'prediction-tag-strategy-enhancement.js?v=1');
  const twice = injectScript(once, 'prediction-tag-strategy-enhancement.js?v=2');
  assert.match(once, /prediction-tag-strategy-enhancement\.js\?v=1/);
  assert.equal((twice.match(/prediction-tag-strategy-enhancement\.js/g) || []).length, 1);
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
    assert.match(html, new RegExp(script.split('?')[0].replaceAll('.', '\\.')));
  }
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
