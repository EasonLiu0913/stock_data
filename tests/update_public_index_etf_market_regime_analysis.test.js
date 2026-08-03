'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { injectEntry } = require('../scripts/update_public_index_etf_market_regime_analysis');

test('index updater inserts the ETF analysis once at the top of tools', () => {
  const source = '<script>\n        const tools = [\n            { file: \'old.html\' }\n        ];\n</script>';
  const once = injectEntry(source);
  const twice = injectEntry(once);
  assert.match(once, /etf-market-regime-analysis\.html/);
  assert.equal((once.match(/etf-market-regime-analysis\.html/g) || []).length, 1);
  assert.equal(twice, once);
  assert.ok(once.indexOf('etf-market-regime-analysis.html') < once.indexOf('old.html'));
});

test('index updater fails on an unknown index shape', () => {
  assert.throws(() => injectEntry('<html></html>'), /找不到/);
});
