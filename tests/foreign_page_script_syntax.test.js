'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('foreign.html inline script parses as JavaScript', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/foreign.html'), 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'foreign.html should contain an inline script');
  assert.doesNotThrow(() => new vm.Script(match[1], { filename: 'foreign.html:inline-script' }));
});
