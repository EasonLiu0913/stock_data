'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateIndex } = require('../scripts/generate_public_index');

test('canonical index generator inserts the ETF analysis once in registry order', () => {
  const source = '<script>\n        const tools = [\n            { file: \'old.html\' }\n        ];\n</script>';
  const registry = {
    schema_version: 1,
    pages: [
      { id: 'old', file: 'old.html', title: 'Old', description: 'old', order: 20 },
      { id: 'etf', file: 'etf-market-regime-analysis.html', title: 'ETF', description: 'etf', order: 10 },
    ],
  };
  const once = generateIndex(source, registry);
  const twice = generateIndex(once, registry);
  assert.match(once, /etf-market-regime-analysis\.html/);
  assert.equal((once.match(/etf-market-regime-analysis\.html/g) || []).length, 1);
  assert.equal(twice, once);
  assert.ok(once.indexOf('etf-market-regime-analysis.html') < once.indexOf('old.html'));
});

test('canonical index generator fails on an unknown index shape', () => {
  assert.throws(() => generateIndex('<html></html>', { schema_version: 1, pages: [] }), /missing the canonical/);
});
