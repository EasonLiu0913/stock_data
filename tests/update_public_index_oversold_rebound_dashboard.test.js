'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { injectDashboardEntry } = require('../scripts/update_public_index_oversold_rebound_dashboard');

test('index updater inserts dashboard once at the top of tools', () => {
  const source = '<script>\n        const tools = [\n            { file: \'old.html\' }\n        ];\n</script>';
  const once = injectDashboardEntry(source);
  const twice = injectDashboardEntry(once);
  assert.match(once, /oversold-rebound-dashboard\.html/);
  assert.equal((once.match(/oversold-rebound-dashboard\.html/g) || []).length, 1);
  assert.equal(twice, once);
  assert.ok(once.indexOf('oversold-rebound-dashboard.html') < once.indexOf('old.html'));
});

test('index updater fails instead of silently corrupting an unknown index shape', () => {
  assert.throws(() => injectDashboardEntry('<html></html>'), /找不到/);
});
