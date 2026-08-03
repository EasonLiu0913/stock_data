'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'prediction-replay-dashboard.html'),
  'utf8',
);

test('installs rebound judgement after embedded replay list enhancement', () => {
  assert.match(source, /const scheduleInject=\(\)=>setTimeout\(inject,150\)/);
  assert.match(source, /rebound-evaluation-policy\.js\?v=2/);
  assert.match(source, /prediction-replay-strategy-result-judgement-enhancement\.js\?v=3/);
});
