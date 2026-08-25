'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  METHODOLOGY_VERSION,
  buildResearchSummary,
  evidenceStatus,
  stabilityEvidenceStatus,
  buildRankingAnalysis,
  industryDistribution,
} = require('../scripts/momentum_research_summary');

function history(date, stocks) {
  const gradeCounts = { A: 0, B: 0, C: 0, none: 0 };
  for (const item of stocks) gradeCounts[item.momentum_grade || 'none'] += 1;
  return {
    signal_date: date,
    stock_count: stocks.length,
    source_registry_fingerprint: 'fingerprint-v1',
    grade_counts: gradeCounts,
    stocks,
  };
}

function stock(code, score, grade, acceleration, facts = {}, industry = '電子') {
  return {
    stock_code: code,
    stock_name: code,
    industry,
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
  assert.equal(METHODOLOGY_VERSION, 2);
  assert.equal(summary.schema_version, 2);
  assert.deepEqual(summary.signal_dates, ['20260821', '20260824']);
  assert.deepEqual(summary.mature_horizon_dates['1'], ['20260821']);
  assert.deepEqual(summary.mature_horizon_dates['3'], []);
  const gradeB = summary.groups.find(group => group.id === 'grade_b');
  assert.equal(gradeB.selected_count, 1);
  assert.equal(gradeB.horizons['1'].sample_count, 1);
  assert.equal(gradeB.horizons['1'].mean_return_pct, 4);
  assert.equal(gradeB.horizons['3'].sample_count, 0);
  assert.equal(gradeB.horizons['3'].mean_return_pct, null);
  assert.equal(gradeB.stability['1'].mature_date_count, 1);
  assert.equal(gradeB.stability['1'].evidence_status, 'insufficient');
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

test('small samples and short date history are explicitly marked insufficient', () => {
  assert.equal(evidenceStatus(0), 'insufficient');
  assert.equal(evidenceStatus(29), 'insufficient');
  assert.equal(evidenceStatus(30), 'observe');
  assert.equal(evidenceStatus(99), 'observe');
  assert.equal(evidenceStatus(100), 'research_ready');
  assert.equal(stabilityEvidenceStatus(4), 'insufficient');
  assert.equal(stabilityEvidenceStatus(5), 'observe');
  assert.equal(stabilityEvidenceStatus(19), 'observe');
  assert.equal(stabilityEvidenceStatus(20), 'research_ready');
});

test('cross-date stability measures date-level direction instead of letting one large date dominate', () => {
  const histories = [
    history('20260801', [stock('A', 70, 'B', null), stock('B', 71, 'B', null)]),
    history('20260804', [stock('A', 72, 'B', 2), stock('B', 73, 'B', 2)]),
    history('20260805', [stock('A', 74, 'B', 2), stock('B', 75, 'B', 2)]),
  ];
  const replays = [
    replay('20260801', [['A', 10], ['B', 10]]),
    replay('20260804', [['A', -1], ['B', -1]]),
    replay('20260805', [['A', 2], ['B', 2]]),
  ];
  const summary = buildResearchSummary(histories, replays);
  const stability = summary.groups.find(group => group.id === 'grade_b').stability['1'];
  assert.equal(stability.mature_date_count, 3);
  assert.equal(stability.positive_date_rate_pct, 66.67);
  assert.equal(stability.directional_consistency_pct, 66.67);
  assert.equal(stability.best_date.signal_date, '20260801');
  assert.equal(stability.worst_date.signal_date, '20260804');
});

test('ranking analysis reports overlap, entrants, exits and rank changes using prior signal date only', () => {
  const histories = [
    history('20260821', [
      stock('A', 80, 'A', null), stock('B', 70, 'B', null), stock('C', 60, 'C', null), stock('D', 50, 'C', null),
    ]),
    history('20260824', [
      stock('C', 90, 'A', 30), stock('A', 82, 'A', 2), stock('D', 55, 'C', 5), stock('E', 52, 'C', null),
    ]),
  ];
  const ranking = buildRankingAnalysis(histories, 4);
  assert.equal(ranking.comparable_pair_count, 1);
  const current = ranking.dates[1];
  assert.equal(current.previous_signal_date, '20260821');
  assert.equal(current.top50_overlap_count, 3);
  assert.equal(current.top50_overlap_pct, 75);
  const c = current.movers.find(item => item.stock_code === 'C');
  assert.equal(c.rank, 1);
  assert.equal(c.previous_rank, 3);
  assert.equal(c.rank_change, 2);
  assert.equal(c.score_change, 30);
  assert.equal(current.movers.find(item => item.stock_code === 'E').previous_rank, null);
});

test('industry distribution compares selected share with same-universe baseline and reports concentration', () => {
  const universe = [
    stock('A', 80, 'A', null, {}, '電子'),
    stock('B', 70, 'B', null, {}, '電子'),
    stock('C', 60, 'C', null, {}, '金融'),
    stock('D', 40, null, null, {}, '金融'),
    stock('E', 30, null, null, {}, '航運'),
  ];
  const result = industryDistribution(universe.filter(item => item.momentum_score >= 50), universe);
  assert.equal(result.selected_count, 3);
  assert.equal(result.universe_count, 5);
  assert.equal(result.industry_count, 2);
  const electronics = result.industries.find(item => item.industry === '電子');
  assert.equal(electronics.selected_share_pct, 66.67);
  assert.equal(electronics.universe_share_pct, 40);
  assert.equal(electronics.lift_ratio, 1.67);
  assert.equal(result.top3_share_pct, 100);
  assert.ok(result.hhi > 5000);
});

test('summary exposes rank persistence and industry segments without changing Momentum model version', () => {
  const histories = [
    history('20260821', [stock('A', 70, 'B', null, {}, '電子'), stock('B', 40, null, null, {}, '金融')]),
    history('20260824', [stock('A', 72, 'B', 2, {}, '電子'), stock('B', 55, 'C', 15, {}, '金融')]),
  ];
  const summary = buildResearchSummary(histories, []);
  assert.equal(summary.momentum_model_version, 1);
  assert.equal(summary.methodology_version, 2);
  assert.equal(summary.ranking_analysis.comparable_pair_count, 1);
  assert.equal(summary.industry_analysis.overall.score_50_plus.selected_count, 3);
  assert.deepEqual(summary.promotion_policy.required_checks_before_promotion, [
    'sample_size', 'cross_date_stability', 'rank_persistence', 'industry_distribution', 'market_context',
  ]);
});
