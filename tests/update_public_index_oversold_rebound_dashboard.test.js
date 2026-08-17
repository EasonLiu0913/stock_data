'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateIndex } = require('../scripts/generate_public_index');

test('canonical index generator inserts rebound dashboard once in registry order', () => {
  const source = '<script>\n        const tools = [\n            { file: \'old.html\' }\n        ];\n</script>';
  const registry = {
    schema_version: 1,
    pages: [
      { id: 'old', file: 'old.html', title: 'Old', description: 'old', order: 20 },
      { id: 'rebound', file: 'oversold-rebound-dashboard.html', title: 'Rebound', description: 'rebound', order: 10 },
    ],
  };
  const once = generateIndex(source, registry);
  const twice = generateIndex(once, registry);
  assert.match(once, /oversold-rebound-dashboard\.html/);
  assert.equal((once.match(/oversold-rebound-dashboard\.html/g) || []).length, 1);
  assert.equal(twice, once);
  assert.ok(once.indexOf('oversold-rebound-dashboard.html') < once.indexOf('old.html'));
});

test('canonical index generator fails instead of silently corrupting an unknown index shape', () => {
  assert.throws(() => generateIndex('<html></html>', { schema_version: 1, pages: [] }), /missing the canonical/);
});
