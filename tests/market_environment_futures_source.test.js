'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { requireExactBaseDateSource } = require('../scripts/generate_market_environment');

test('strict market environment accepts matching TAIFEX trading date', () => {
  assert.doesNotThrow(() => requireExactBaseDateSource({ date: '20261109' }, '20261109', 'foreign_futures'));
});

test('strict market environment rejects stale TAIFEX source rather than silently falling back', () => {
  assert.throws(
    () => requireExactBaseDateSource({ date: '20261106' }, '20261109', 'foreign_futures'),
    /foreign_futures base-date source missing: expected 20261109, latest valid 20261106/,
  );
});

test('strict market environment rejects missing TAIFEX source', () => {
  assert.throws(
    () => requireExactBaseDateSource(null, '20261109', 'foreign_futures'),
    /foreign_futures base-date source missing: expected 20261109, latest valid none/,
  );
});

test('strict market environment rejects stale TWSE source as well', () => {
  assert.throws(
    () => requireExactBaseDateSource({ date: '20261106' }, '20261109', 'twse_index'),
    /twse_index base-date source missing/,
  );
});
