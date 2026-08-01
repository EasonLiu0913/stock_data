'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  SCRIPT_TAG,
  listPredictionPages,
  injectScript,
  install,
} = require('../scripts/install_prediction_back_to_top');

test('injectScript adds the shared script before closing body exactly once', () => {
  const source = '<!doctype html><html><body><main>內容</main></body></html>';
  const once = injectScript(source);
  const twice = injectScript(once);
  assert.match(once, new RegExp(`${SCRIPT_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</body>`));
  assert.equal((once.match(/prediction-back-to-top\.js/g) || []).length, 1);
  assert.equal(twice, once);
});

test('installer targets every top-level prediction HTML page and ignores unrelated pages', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-to-top-'));
  fs.writeFileSync(path.join(dir, 'prediction-dashboard.html'), '<body></body>');
  fs.writeFileSync(path.join(dir, 'prediction-replay-dashboard.html'), '<body></body>');
  fs.writeFileSync(path.join(dir, 'prediction-stock.html'), '<body></body>');
  fs.writeFileSync(path.join(dir, 'index.html'), '<body></body>');
  fs.writeFileSync(path.join(dir, 'prediction-back-to-top.js'), '');
  assert.deepEqual(listPredictionPages(dir), [
    'prediction-dashboard.html',
    'prediction-replay-dashboard.html',
    'prediction-stock.html',
  ]);
  const result = install(dir);
  assert.equal(result.changed.length, 3);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /prediction-back-to-top/);
});

test('shared browser script is valid and protects existing dashboard arrow from duplication', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'prediction-back-to-top.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /document\.querySelector\('\.to-top'\)/);
  assert.match(source, /behavior: 'smooth'/);
  assert.match(source, /aria-label/);
});
