'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const analysis = require('../public/assets/etf-market-regime-analysis');

function makeRows(multipliers, fields = ['marketClose', 'etf0050AdjustedClose', 'etf0052AdjustedClose', 'etf00631LAdjustedClose']) {
  return multipliers.map((multiplier, index) => {
    const row = { date: `202601${String(index + 1).padStart(2, '0')}` };
    for (const field of fields) row[field] = 100 * multiplier;
    return row;
  });
}

function compound(count, dailyRate) {
  return Array.from({ length: count }, (_, index) => (1 + dailyRate) ** index);
}

test('classifies strong clean trends as continuous regimes', () => {
  const up = analysis.classifyMarketWindow(makeRows(compound(20, 0.01)));
  const down = analysis.classifyMarketWindow(makeRows(compound(20, -0.01)));
  assert.equal(up.regime, 'continuous_up');
  assert.equal(down.regime, 'continuous_down');
  assert.ok(up.trendR2 > 0.99);
  assert.ok(down.trendR2 > 0.99);
});

test('separates gradual moves from range-bound windows', () => {
  const gradualUp = analysis.classifyMarketWindow(makeRows(compound(20, 0.001)));
  const gradualDown = analysis.classifyMarketWindow(makeRows(compound(20, -0.001)));
  const range = analysis.classifyMarketWindow(makeRows([
    1, 1.005, 0.998, 1.004, 0.997, 1.003, 0.999, 1.004, 0.998, 1.002,
    1, 1.003, 0.999, 1.002, 0.998, 1.001, 1, 1.002, 0.999, 1.001
  ]));
  assert.equal(gradualUp.regime, 'gradual_up');
  assert.equal(gradualDown.regime, 'gradual_down');
  assert.equal(range.regime, 'range_bound');
});

test('holding metrics use the requested adjusted-price field', () => {
  const rows = [
    { date: '20260101', adjusted: 100, raw: 50 },
    { date: '20260102', adjusted: 105, raw: 49 },
    { date: '20260103', adjusted: 110, raw: 48 }
  ];
  const metrics = analysis.calculateHoldingMetrics(rows, 'adjusted');
  assert.equal(metrics.totalReturnPct, 10);
  assert.equal(metrics.maxDrawdownPct, 0);
  assert.equal(metrics.positiveDayRatePct, 100);
});

test('rolling samples and regime summaries compare all ETFs', () => {
  const rows = compound(30, 0.005).map((marketMultiplier, index) => ({
    date: `202602${String(index + 1).padStart(2, '0')}`,
    marketClose: 100 * marketMultiplier,
    etf0050AdjustedClose: 100 * marketMultiplier,
    etf0052AdjustedClose: 100 * ((1.006) ** index),
    etf00631LAdjustedClose: 100 * ((1.01) ** index)
  }));
  const etfs = [
    { id: '0050', adjustedCloseField: 'etf0050AdjustedClose' },
    { id: '0052', adjustedCloseField: 'etf0052AdjustedClose' },
    { id: '00631L', adjustedCloseField: 'etf00631LAdjustedClose' }
  ];
  const samples = analysis.buildRollingRegimeSamples(rows, etfs, { windowDays: 20, stepDays: 5 });
  const summary = analysis.summarizeRegimeSamples(samples, etfs);
  assert.equal(samples.length, 3);
  assert.equal(summary.continuous_up.sampleCount, 3);
  assert.ok(summary.continuous_up.etfs['00631L'].averageReturnPct > summary.continuous_up.etfs['0052'].averageReturnPct);
  assert.ok(summary.continuous_up.etfs['0052'].averageReturnPct > summary.continuous_up.etfs['0050'].averageReturnPct);
});

test('date filtering accepts ISO date inputs', () => {
  const rows = [
    { date: '20260101' },
    { date: '20260102' },
    { date: '20260103' }
  ];
  assert.deepEqual(analysis.filterRowsByDate(rows, '2026-01-02', '2026-01-03').map((row) => row.date), ['20260102', '20260103']);
});
