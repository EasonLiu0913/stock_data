'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildResearchSummary,
  evidenceStatus,
} = require('../scripts/momentum_research_summary');

function history(date, stocks) {
  return {
    signal_date: date,
    stock_count: stocks.length,
    source_registry_fingerprint: 'fingerprint-v1',
    grade_counts: { A: 0, B: 0, C: 0, none: 0 },
    stocks,
  };
}

function stock(code, score, grade, acceleration, facts = {}) {
  return {
    stock_code: code,
    momentum_score: score,
    momentum_grade: grade,
    momentum_acceleration: acceleration,
    facts,
  };
}

function replay(date, rows, completedHorizon = 1) {
  return {
    signal_date: date,
    completed_horizon: completedHorizon,
    stocks: rows.map(([code, r1, mfe = r1, mae = r1]) => ({
      stock_code: code,
      outcomes: {
        t_plus_1: r1 === null ? null : { return_pct: r1, max_gain_pct: mfe, max_drawdown_pct: mae },
        t_plus_3: null,
        t_plus_5: null,
      },
    })),
  };
}

test('research summary compares grades, acceleration and coexistable facts without future filling', () => {
  const histories = [
    history('20260821', [
      stock('A', 70, 'B', null, { price_volume_sync: true, chip_sync: true, breakout: false }),
      stock('B', 55, 'C', null, { price_volume_sync: false, chip_sync: false, breakout: true }),
    ]),
    history('20260824', [
      stock('A', 82, 'A', 12, { price_volume_sync: true, chip_sync: true, breakout: true }),
      stock('B', 52, 'C', -3, { price_volume_sync: false, chip_sync: false, breakout: false }),
    ]),
  ];
  const replays = [
    replay('20260821', [['A', 4, 6, -1], ['B', -2, 1, -3]]),
    replay('20260824', [['A', null], ['B', null]], 0),
  ];
  const summary = buildResearchSummary(histories, replays, { generatedAt: '2026-08-25T00:00:00Z' });
  assert.deepEqual(summary.signal_dates, ['20260821', '20260824']);
  assert.deepEqual(summary.mature_horizon_dates['1'], ['20260821']);
  assert.deepEqual(summary.mature_horizon_dates['3'], []);
  const gradeB = summary.groups.find(group => group.id === 'grade_b');
  assert.equal(gradeB.selected_count, 1);
  assert.equal(gradeB.horizons['1'].sample_count, 1);
  assert.equal(gradeB.horizons['1'].mean_return_pct, 4);
  assert.equal(gradeB.horizons['3'].sample_count, 0);
  assert.equal(gradeB.horizons['3'].mean_return_pct, null);
  const accel = summary.groups.find(group => group.id === 'accel_10_19');
  assert.equal(accel.selected_count, 1);
  assert.equal(accel.horizons['1'].sample_count, 0);
  const triple = summary.groups.find(group => group.id === 'triple_sync');
  assert.equal(triple.selected_count, 1);
  assert.equal(triple.matched_signal_dates[0], '20260824');
});

test('outcome statistics report coverage, median, positive rate and MFE hit rates', () => {
  const histories = [history('20260821', [
    stock('A', 70, 'B', null),
    stock('B', 71, 'B', null),
    stock('C', 72, 'B', null),
  ])];
  const replays = [replay('20260821', [
    ['A', 2, 5, -1],
    ['B', -1, 3, -4],
    ['C', null],
  ])];
  const summary = buildResearchSummary(histories, replays);
  const metrics = summary.groups.find(group => group.id === 'grade_b').horizons['1'];
  assert.equal(metrics.selected_count, 3);
  assert.equal(metrics.sample_count, 2);
  assert.equal(metrics.coverage_pct, 66.67);
  assert.equal(metrics.mean_return_pct, 0.5);
  assert.equal(metrics.median_return_pct, 0.5);
  assert.equal(metrics.positive_rate_pct, 50);
  assert.equal(metrics.hit_4_pct_rate, 50);
});

test('small samples are explicitly marked insufficient rather than promoted', () => {
  assert.equal(evidenceStatus(0), 'insufficient');
  assert.equal(evidenceStatus(29), 'insufficient');
  assert.equal(evidenceStatus(30), 'observe');
  assert.equal(evidenceStatus(99), 'observe');
  assert.equal(evidenceStatus(100), 'research_ready');
});
