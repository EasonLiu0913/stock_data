'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'prediction-replay-formal-strategy-enhancement.js'),
  'utf8',
);

test('registered strategy selection stores its own scope', () => {
  assert.match(source, /selection\.scope \|\| 'candidates'/);
  assert.doesNotMatch(source, /selection\.direction/);
});

test('strategy buttons do not reuse prediction accuracy tabs', () => {
  assert.match(source, /state\.caseType = 'all'/);
  assert.match(source, /scope,\n\s*};/);
  assert.doesNotMatch(source, /setSelection\('registered_strategy_scope'/);
});

test('large candidate member lists are not rendered inside strategy cards', () => {
  assert.doesNotMatch(source, /formal-strategy-members/);
  assert.doesNotMatch(source, /<b>候選：<\/b>/);
  assert.match(source, /下方「案例清單」顯示完整個股資料/);
});
