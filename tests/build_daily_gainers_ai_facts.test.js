'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { technicalFacts } = require('../scripts/build_daily_gainers_ai_facts');

test('technicalFacts reads canonical Fubon SMA and Volume fields', () => {
  const currentSma = {
    '1101': {
      '2026/09/01': {
        SMA5: '24.48',
        SMA20: '24.42',
        SMA60: '24.08',
        Volume: '108834',
      },
    },
  };
  const previousSma = {
    '1101': {
      '2026/08/31': {
        SMA5: '24.34',
        SMA20: '24.33',
        SMA60: '24.07',
        Volume: '496598',
      },
    },
  };

  const facts = technicalFacts(
    { code: '1101', close: '25.30', volume: '108834' },
    currentSma,
    previousSma,
    '20260901',
    '20260831',
  );

  assert.equal(facts.sma5, 24.48);
  assert.equal(facts.sma20, 24.42);
  assert.equal(facts.sma60, 24.08);
  assert.equal(facts.above_sma5, true);
  assert.equal(facts.above_sma20, true);
  assert.equal(facts.above_sma60, true);
  assert.equal(facts.previous_volume, 496598);
  assert.equal(facts.volume_ratio_vs_previous, 0.22);
});

test('technicalFacts keeps lowercase historical compatibility', () => {
  const currentSma = { '9999': { '2026/09/01': { sma5: '10', sma20: '9', sma60: '8' } } };
  const previousSma = { '9999': { '2026/08/31': { volume: '1000' } } };

  const facts = technicalFacts(
    { code: '9999', close: '11', volume: '500' },
    currentSma,
    previousSma,
    '20260901',
    '20260831',
  );

  assert.equal(facts.sma5, 10);
  assert.equal(facts.previous_volume, 1000);
  assert.equal(facts.volume_ratio_vs_previous, 0.5);
});
