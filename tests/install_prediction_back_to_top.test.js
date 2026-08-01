'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  SCRIPT_TAG,
  REPLAY_WRAPPER_PAGES,
  listPredictionPages,
  injectScript,
  removeScript,
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

test('removeScript removes shared references from iframe wrappers', () => {
  const source = `<body><iframe id="viewer"></iframe>\n${SCRIPT_TAG}\n</body>`;
  const updated = removeScript(source);
  assert.doesNotMatch(updated, /prediction-back-to-top\.js/);
  assert.match(updated, /<iframe id="viewer"><\/iframe>/);
});

test('installer keeps one control in the scrollable replay page and none in wrapper layers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-to-top-'));
  fs.writeFileSync(path.join(dir, 'prediction-dashboard.html'), '<body><button class="to-top">↑</button></body>');
  fs.writeFileSync(path.join(dir, 'prediction-replay-dashboard.html'), `<body><iframe class="viewer"></iframe>${SCRIPT_TAG}</body>`);
  fs.writeFileSync(path.join(dir, 'prediction-replay-dashboard-embedded.html'), `<body><iframe id="viewer"></iframe>${SCRIPT_TAG}</body>`);
  fs.writeFileSync(path.join(dir, 'prediction-replay-dashboard-view.html'), '<body><main>可捲動內容</main></body>');
  fs.writeFileSync(path.join(dir, 'prediction-stock.html'), '<body></body>');
  fs.writeFileSync(path.join(dir, 'index.html'), '<body></body>');
  fs.writeFileSync(path.join(dir, 'prediction-back-to-top.js'), '');

  assert.deepEqual(REPLAY_WRAPPER_PAGES, new Set([
    'prediction-replay-dashboard.html',
    'prediction-replay-dashboard-embedded.html',
  ]));
  assert.deepEqual(listPredictionPages(dir), [
    'prediction-dashboard.html',
    'prediction-replay-dashboard-embedded.html',
    'prediction-replay-dashboard-view.html',
    'prediction-replay-dashboard.html',
    'prediction-stock.html',
  ]);

  const result = install(dir);
  assert.deepEqual(result.removed.sort(), [
    'prediction-replay-dashboard-embedded.html',
    'prediction-replay-dashboard.html',
  ]);
  assert.match(fs.readFileSync(path.join(dir, 'prediction-replay-dashboard-view.html'), 'utf8'), /prediction-back-to-top\.js/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'prediction-replay-dashboard.html'), 'utf8'), /prediction-back-to-top\.js/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'prediction-replay-dashboard-embedded.html'), 'utf8'), /prediction-back-to-top\.js/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /prediction-back-to-top/);
});

test('shared browser script is valid and suppresses native controls and iframe wrappers', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'prediction-back-to-top.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /iframe#viewer, iframe\.viewer/);
  assert.match(source, /button\[aria-label="回到最上方"\]/);
  assert.match(source, /document\.querySelector\(WRAPPER_IFRAME_SELECTOR\)/);
  assert.match(source, /behavior: 'smooth'/);
});
