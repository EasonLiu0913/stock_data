'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  percentileRank,
  classifyScore,
  alignSeries,
  buildFactor,
} = require('../scripts/crawl_refined_product_tightness');

test('percentileRank uses midpoint treatment for ties', () => {
  assert.equal(percentileRank([1, 2, 2, 4], 2), 50);
});

test('classifyScore returns descriptive five-band states', () => {
  assert.equal(classifyScore(10).code, 'very_loose');
  assert.equal(classifyScore(25).code, 'loose');
  assert.equal(classifyScore(50).code, 'balanced');
  assert.equal(classifyScore(65).code, 'tight');
  assert.equal(classifyScore(85).code, 'very_tight');
});

test('alignSeries converts gallons to barrels before subtracting Brent', () => {
  const rows = alignSeries(
    [{ date: '20260102', value: 2 }],
    [{ date: '20260102', value: 2.5 }],
    [{ date: '20260102', value: 70 }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].jet_crack_usd_per_barrel, 14);
  assert.equal(rows[0].diesel_crack_usd_per_barrel, 35);
});

test('buildFactor scores synchronized rising cracks as tighter context', () => {
  const rows = [];
  for (let i = 0; i < 120; i += 1) {
    const day = String(i + 1).padStart(3, '0');
    rows.push({
      date: `2026${day}`,
      jet_usd_per_gallon: 2 + i * 0.01,
      diesel_usd_per_gallon: 2.1 + i * 0.012,
      brent_usd_per_barrel: 70,
      jet_crack_usd_per_barrel: 14 + i * 0.42,
      diesel_crack_usd_per_barrel: 18.2 + i * 0.504,
    });
  }
  const factor = buildFactor(rows, rows.at(-1).date);
  assert.equal(factor.confirmation, 'both_rising_20d');
  assert.ok(factor.score >= 80);
  assert.equal(factor.state.code, 'very_tight');
  assert.ok(factor.jet.change_20d_usd_per_barrel > 0);
  assert.ok(factor.diesel.change_20d_usd_per_barrel > 0);
});
