'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeTrailingRisk,
  computeForwardExcursion,
  evaluateSelector,
  buildWalkForwardFolds,
  summarizeTailRiskGroup,
  evaluateWalkForwardPromotion,
  buildCompactSummary,
} = require('../scripts/round_4_walk_forward_research_lib');

function rowsFromCloses(closes) {
  return closes.map((close, index) => ({
    date: `20260${String(index + 1).padStart(3, '0')}`,
    close,
    sma20: 100,
  }));
}

function outcome(return5d, excess = return5d, adverse = Math.min(0, return5d), favorable = Math.max(0, return5d)) {
  return {
    forward_return_1d_pct: return5d / 5,
    forward_return_3d_pct: return5d * 0.6,
    forward_return_5d_pct: return5d,
    forward_excess_return_5d_pct: excess,
    max_adverse_excursion_5d_pct: adverse,
    max_favorable_excursion_5d_pct: favorable,
  };
}

test('trailing risk stops at the signal index and ignores future prices', () => {
  const rows = rowsFromCloses([
    90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
    10, 500,
  ]);
  const risk = computeTrailingRisk(rows, 20, 20);
  assert.equal(risk.available, true);
  assert.equal(risk.latest_return_1d_pct, 0.9174);
  assert.equal(risk.distance_from_high_20d_pct, 0);
  assert.ok(risk.max_drawdown_20d_pct >= 0);
});

test('forward excursion separates adverse and favorable movement from endpoint return', () => {
  const rows = rowsFromCloses([100, 95, 110, 90, 105, 102]);
  const excursion = computeForwardExcursion(rows, 0, 5);
  assert.deepEqual(excursion, {
    available: true,
    max_adverse_excursion_5d_pct: -10,
    max_favorable_excursion_5d_pct: 10,
  });
});

test('selector preserves unknown state instead of converting missing metrics to false', () => {
  const definition = {
    allowed_market_regimes: ['bull'],
    selector: {
      all: [{ path: 'signal.risk.sma20_gap_pct', op: 'gte', value: 0 }],
    },
  };
  assert.equal(evaluateSelector({ market_regime: 'bull', signal: { risk: {} } }, definition), null);
  assert.equal(evaluateSelector({ market_regime: 'bear', signal: { risk: { sma20_gap_pct: 3 } } }, definition), false);
  assert.equal(evaluateSelector({ market_regime: 'bull', signal: { risk: { sma20_gap_pct: 3 } } }, definition), true);
});

test('walk-forward folds contain five-day purge gaps and non-overlapping test windows', () => {
  const dates = Array.from({ length: 55 }, (_, index) => `2026${String(index + 1).padStart(4, '0')}`);
  const folds = buildWalkForwardFolds(dates, {
    initial_train_days: 20,
    purge_days: 5,
    validation_days: 10,
    test_days: 5,
    step_days: 5,
  });
  assert.equal(folds.length, 3);
  const allTestDates = folds.flatMap(fold => fold.test_dates);
  assert.equal(new Set(allTestDates).size, allTestDates.length);
  for (const fold of folds) {
    assert.equal(fold.validation_dates.length, 10);
    assert.equal(fold.test_dates.length, 5);
    const trainEnd = dates.indexOf(fold.train_dates.at(-1));
    const validationStart = dates.indexOf(fold.validation_dates[0]);
    const validationEnd = dates.indexOf(fold.validation_dates.at(-1));
    const testStart = dates.indexOf(fold.test_dates[0]);
    assert.equal(validationStart - trainEnd - 1, 5);
    assert.equal(testStart - validationEnd - 1, 5);
  }
});

test('tail summary reports p10, p05, CVaR, extreme losses, and adverse excursion', () => {
  const returns = [-20, -10, -5, 0, 5, 10, 15, 20, 25, 30];
  const events = returns.map((value, index) => ({
    stock_code: String(index),
    outcome: outcome(value, value - 1, Math.min(value, -index), Math.max(value, index)),
  }));
  const summary = summarizeTailRiskGroup(events, {
    extreme_loss_threshold_pct: -8,
    severe_adverse_excursion_threshold_pct: -10,
  });
  assert.equal(summary.event_count, 10);
  assert.equal(summary.return_5d_p10_pct, -11);
  assert.equal(summary.return_5d_p05_pct, -15.5);
  assert.equal(summary.cvar_5pct_return_5d_pct, -20);
  assert.equal(summary.extreme_loss_rate_pct, 20);
  assert.ok(Number.isFinite(summary.median_max_adverse_excursion_5d_pct));
});

test('promotion gate rejects a candidate that wins only one eligible fold', () => {
  const definition = {
    objective: 'long_relative',
    promotion_gate: {
      min_total_events: 10,
      min_test_events_per_fold: 5,
      min_eligible_test_folds: 2,
      min_successful_test_folds: 2,
      min_walk_forward_test_average_excess_return_5d_pct: 0.5,
      min_walk_forward_test_positive_excess_return_5d_rate_pct: 55,
      min_walk_forward_test_return_5d_p10_pct: -8,
      min_walk_forward_test_cvar_5pct_return_5d_pct: -12,
      max_walk_forward_test_extreme_loss_rate_pct: 25,
    },
  };
  const summary = {
    all: { event_count: 20 },
    walk_forward_test: {
      average_excess_return_5d_pct: 1,
      positive_excess_return_5d_rate_pct: 60,
      return_5d_p10_pct: -5,
      cvar_5pct_return_5d_pct: -8,
      extreme_loss_rate_pct: 10,
    },
    folds: [
      { fold_id: 'wf_01', test: { event_count: 6, average_excess_return_5d_pct: 1, positive_excess_return_5d_rate_pct: 60 } },
      { fold_id: 'wf_02', test: { event_count: 6, average_excess_return_5d_pct: -1, positive_excess_return_5d_rate_pct: 40 } },
    ],
  };
  const result = evaluateWalkForwardPromotion(summary, definition);
  assert.equal(result.status, 'hold_research');
  assert.deepEqual(result.successful_test_folds, ['wf_01']);
});

test('promotion gate can pass a stable long candidate with controlled tails', () => {
  const definition = {
    objective: 'long_relative',
    promotion_gate: {
      min_total_events: 10,
      min_test_events_per_fold: 5,
      min_eligible_test_folds: 2,
      min_successful_test_folds: 2,
      min_walk_forward_test_average_excess_return_5d_pct: 0.5,
      min_walk_forward_test_positive_excess_return_5d_rate_pct: 55,
      min_walk_forward_test_return_5d_p10_pct: -8,
      min_walk_forward_test_cvar_5pct_return_5d_pct: -12,
      max_walk_forward_test_extreme_loss_rate_pct: 25,
    },
  };
  const summary = {
    all: { event_count: 20 },
    walk_forward_test: {
      average_excess_return_5d_pct: 1.2,
      positive_excess_return_5d_rate_pct: 62,
      return_5d_p10_pct: -4,
      cvar_5pct_return_5d_pct: -7,
      extreme_loss_rate_pct: 5,
    },
    folds: [
      { fold_id: 'wf_01', test: { event_count: 6, average_excess_return_5d_pct: 1, positive_excess_return_5d_rate_pct: 60 } },
      { fold_id: 'wf_02', test: { event_count: 6, average_excess_return_5d_pct: 0.7, positive_excess_return_5d_rate_pct: 55.1 } },
    ],
  };
  const result = evaluateWalkForwardPromotion(summary, definition);
  assert.equal(result.status, 'promotion_eligible');
  assert.equal(result.passed, true);
});

test('compact summary excludes event rows while preserving fold and tail metadata', () => {
  const compact = buildCompactSummary({
    schema_version: 1,
    research_id: 'round_4',
    candidate_registry_id: 'registry',
    candidate_registry_status: 'research_only',
    generated_at: 'now',
    cutoff_date: '20260804',
    source_date_range: ['a', 'b'],
    eligible_signal_date_range: ['c', 'd'],
    cooldown_trading_days: 5,
    market_regime_definition: {},
    market_regime_signal_date_count: {},
    walk_forward_definition: {},
    walk_forward_folds: [{ fold_id: 'wf_01' }],
    tail_risk_definition: {},
    leakage_guard: {},
    source_file_count: {},
    candidate_definitions: [],
    base_candidate_independent_event_count: {},
    availability_observation_count: {},
    raw_signal_count: {},
    events: [{ id: 1 }],
    cooldown_suppressed_events: [{ id: 2 }],
    summaries: {},
  });
  assert.equal(compact.independent_event_count, 1);
  assert.equal(compact.cooldown_suppressed_count, 1);
  assert.equal(compact.events, undefined);
  assert.equal(compact.cooldown_suppressed_events, undefined);
  assert.equal(compact.walk_forward_folds.length, 1);
});
