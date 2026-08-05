'use strict';

const {
  round,
  percentile,
  median,
  average,
  rate,
} = require('./round_3_candidate_research_lib');

function standardDeviation(values) {
  const usable = values.filter(Number.isFinite);
  if (usable.length < 2) return null;
  const mean = average(usable);
  const variance = usable.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / usable.length;
  return Math.sqrt(variance);
}

function dailyReturns(rows) {
  const result = [];
  for (let index = 1; index < rows.length; index += 1) {
    const previous = Number(rows[index - 1]?.close);
    const current = Number(rows[index]?.close);
    if (Number.isFinite(previous) && previous > 0 && Number.isFinite(current) && current > 0) {
      result.push(((current / previous) - 1) * 100);
    }
  }
  return result;
}

function maxDrawdownPct(rows) {
  let peak = null;
  let maximumDrawdown = 0;
  for (const row of rows) {
    const close = Number(row?.close);
    if (!Number.isFinite(close) || close <= 0) continue;
    if (!Number.isFinite(peak) || close > peak) peak = close;
    const drawdown = ((close / peak) - 1) * 100;
    if (drawdown < maximumDrawdown) maximumDrawdown = drawdown;
  }
  return Number.isFinite(peak) ? maximumDrawdown : null;
}

function computeTrailingRisk(rows, index, lookbackDays = 20) {
  if (!Array.isArray(rows) || !Number.isInteger(index) || index < 1) {
    return { available: false };
  }
  const start = Math.max(0, index - Math.max(2, Number(lookbackDays) || 20));
  const selected = rows.slice(start, index + 1);
  const returns = dailyReturns(selected);
  const latest = selected.at(-1) || null;
  const previous = selected.at(-2) || null;
  const closes = selected.map(row => Number(row?.close)).filter(value => Number.isFinite(value) && value > 0);
  if (returns.length < Math.min(10, lookbackDays) || closes.length < 2) {
    return { available: false };
  }
  const negativeReturns = returns.filter(value => value < 0);
  const volatility = standardDeviation(returns);
  const downsideVolatility = standardDeviation(negativeReturns);
  const latestReturn = Number.isFinite(Number(latest?.close))
    && Number.isFinite(Number(previous?.close))
    && Number(previous.close) > 0
    ? ((Number(latest.close) / Number(previous.close)) - 1) * 100
    : null;
  const high = Math.max(...closes);
  const sma20 = Number(latest?.sma20);
  const sma20Gap = Number.isFinite(Number(latest?.close)) && Number.isFinite(sma20) && sma20 > 0
    ? ((Number(latest.close) / sma20) - 1) * 100
    : null;
  return {
    available: true,
    valid_return_days: returns.length,
    realized_volatility_20d_pct: round(Number.isFinite(volatility) ? volatility * Math.sqrt(20) : null),
    downside_volatility_20d_pct: round(Number.isFinite(downsideVolatility)
      ? downsideVolatility * Math.sqrt(20)
      : negativeReturns.length === 1 ? Math.abs(negativeReturns[0]) * Math.sqrt(20) : null),
    max_drawdown_20d_pct: round(maxDrawdownPct(selected)),
    distance_from_high_20d_pct: round(((Number(latest.close) / high) - 1) * 100),
    latest_return_1d_pct: round(latestReturn),
    sma20_gap_pct: round(sma20Gap),
  };
}

function computeForwardExcursion(rows, index, horizonDays = 5) {
  if (!Array.isArray(rows) || !Number.isInteger(index)) return { available: false };
  const current = Number(rows[index]?.close);
  if (!Number.isFinite(current) || current <= 0) return { available: false };
  const future = rows.slice(index + 1, index + 1 + Math.max(1, Number(horizonDays) || 5));
  if (future.length < horizonDays) return { available: false };
  const returns = future.map(row => Number(row?.close))
    .filter(value => Number.isFinite(value) && value > 0)
    .map(value => ((value / current) - 1) * 100);
  if (returns.length < horizonDays) return { available: false };
  return {
    available: true,
    max_adverse_excursion_5d_pct: round(Math.min(...returns)),
    max_favorable_excursion_5d_pct: round(Math.max(...returns)),
  };
}

function valueAtPath(target, path) {
  if (!path) return undefined;
  return String(path).split('.').reduce((value, key) => (
    value === null || value === undefined ? undefined : value[key]
  ), target);
}

function evaluateConstraint(target, constraint = {}) {
  const value = valueAtPath(target, constraint.path);
  if (value === null || value === undefined || value === '') return null;
  const op = constraint.op || 'eq';
  if (op === 'in') {
    return Array.isArray(constraint.values) ? constraint.values.includes(value) : false;
  }
  if (op === 'eq') return value === constraint.value;
  if (op === 'neq') return value !== constraint.value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (op === 'lt') return numeric < Number(constraint.value);
  if (op === 'lte') return numeric <= Number(constraint.value);
  if (op === 'gt') return numeric > Number(constraint.value);
  if (op === 'gte') return numeric >= Number(constraint.value);
  if (op === 'between') {
    const minimum = Number(constraint.min);
    const maximum = Number(constraint.max);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return false;
    const minPass = constraint.min_inclusive === false ? numeric > minimum : numeric >= minimum;
    const maxPass = constraint.max_inclusive === false ? numeric < maximum : numeric <= maximum;
    return minPass && maxPass;
  }
  throw new Error(`Unsupported selector operator: ${op}`);
}

function evaluateConstraintList(target, constraints, mode) {
  const rows = Array.isArray(constraints) ? constraints : [];
  if (!rows.length) return true;
  const states = rows.map(constraint => evaluateConstraint(target, constraint));
  if (mode === 'any') {
    if (states.includes(true)) return true;
    if (states.includes(null)) return null;
    return false;
  }
  if (mode === 'not') {
    if (states.includes(true)) return false;
    if (states.includes(null)) return null;
    return true;
  }
  if (states.includes(false)) return false;
  if (states.includes(null)) return null;
  return true;
}

function evaluateSelector(target, definition = {}) {
  const allowed = Array.isArray(definition.allowed_market_regimes)
    ? definition.allowed_market_regimes
    : [];
  if (allowed.length && !allowed.includes(target.market_regime)) return false;
  const selector = definition.selector || {};
  const all = evaluateConstraintList(target, selector.all, 'all');
  if (all === false) return false;
  const any = evaluateConstraintList(target, selector.any, 'any');
  if (any === false) return false;
  const not = evaluateConstraintList(target, selector.not, 'not');
  if (not === false) return false;
  if ([all, any, not].includes(null)) return null;
  return true;
}

function buildWalkForwardFolds(dates, options = {}) {
  const unique = [...new Set((dates || []).filter(Boolean))].sort();
  const initialTrain = Math.max(1, Number(options.initial_train_days || options.initialTrainDays || 20));
  const purge = Math.max(0, Number(options.purge_days || options.purgeDays || 5));
  const validation = Math.max(1, Number(options.validation_days || options.validationDays || 10));
  const test = Math.max(1, Number(options.test_days || options.testDays || 5));
  const step = Math.max(1, Number(options.step_days || options.stepDays || test));
  const folds = [];
  let testStart = initialTrain + purge + validation + purge;
  let foldNumber = 1;
  while (testStart + test <= unique.length) {
    const validationStart = testStart - purge - validation;
    const trainEnd = validationStart - purge;
    if (trainEnd < initialTrain) break;
    const trainDates = unique.slice(0, trainEnd);
    const validationDates = unique.slice(validationStart, validationStart + validation);
    const testDates = unique.slice(testStart, testStart + test);
    folds.push({
      fold_id: `wf_${String(foldNumber).padStart(2, '0')}`,
      train: [trainDates[0] || null, trainDates.at(-1) || null],
      purge_before_validation: [unique[trainEnd] || null, unique[validationStart - 1] || null],
      validation: [validationDates[0] || null, validationDates.at(-1) || null],
      purge_before_test: [unique[validationStart + validation] || null, unique[testStart - 1] || null],
      test: [testDates[0] || null, testDates.at(-1) || null],
      train_dates: trainDates,
      validation_dates: validationDates,
      test_dates: testDates,
    });
    foldNumber += 1;
    testStart += step;
  }
  return folds;
}

function cvarLowerTail(values, percentileValue = 0.05) {
  const usable = values.filter(Number.isFinite);
  if (!usable.length) return null;
  const threshold = percentile(usable, percentileValue);
  return average(usable.filter(value => value <= threshold));
}

function summarizeTailRiskGroup(events, options = {}) {
  const returns1d = events.map(event => event.outcome?.forward_return_1d_pct);
  const returns3d = events.map(event => event.outcome?.forward_return_3d_pct);
  const returns5d = events.map(event => event.outcome?.forward_return_5d_pct);
  const excess5d = events.map(event => event.outcome?.forward_excess_return_5d_pct);
  const adverse = events.map(event => event.outcome?.max_adverse_excursion_5d_pct);
  const favorable = events.map(event => event.outcome?.max_favorable_excursion_5d_pct);
  const extremeLoss = Number(options.extreme_loss_threshold_pct ?? -8);
  const severeAdverse = Number(options.severe_adverse_excursion_threshold_pct ?? -10);
  return {
    event_count: events.length,
    stock_count: new Set(events.map(event => event.stock_code)).size,
    average_return_1d_pct: round(average(returns1d)),
    average_return_3d_pct: round(average(returns3d)),
    average_return_5d_pct: round(average(returns5d)),
    median_return_5d_pct: round(median(returns5d)),
    return_5d_p10_pct: round(percentile(returns5d, 0.10)),
    return_5d_p05_pct: round(percentile(returns5d, 0.05)),
    cvar_5pct_return_5d_pct: round(cvarLowerTail(returns5d, 0.05)),
    worst_return_5d_pct: round(returns5d.filter(Number.isFinite).sort((a, b) => a - b)[0] ?? null),
    positive_return_5d_rate_pct: round(rate(returns5d, value => value > 0), 2),
    average_excess_return_5d_pct: round(average(excess5d)),
    excess_return_5d_p10_pct: round(percentile(excess5d, 0.10)),
    positive_excess_return_5d_rate_pct: round(rate(excess5d, value => value > 0), 2),
    extreme_loss_rate_pct: round(rate(returns5d, value => value <= extremeLoss), 2),
    median_max_adverse_excursion_5d_pct: round(median(adverse)),
    adverse_excursion_5d_p10_pct: round(percentile(adverse, 0.10)),
    severe_adverse_excursion_rate_pct: round(rate(adverse, value => value <= severeAdverse), 2),
    median_max_favorable_excursion_5d_pct: round(median(favorable)),
  };
}

function summarizeCandidateWalkForward(events, definition, folds, tailOptions = {}) {
  const selected = events.filter(event => event.candidate_id === definition.candidate_id);
  const foldSummaries = folds.map(fold => {
    const trainSet = new Set(fold.train_dates);
    const validationSet = new Set(fold.validation_dates);
    const testSet = new Set(fold.test_dates);
    return {
      fold_id: fold.fold_id,
      boundaries: {
        train: fold.train,
        purge_before_validation: fold.purge_before_validation,
        validation: fold.validation,
        purge_before_test: fold.purge_before_test,
        test: fold.test,
      },
      train: summarizeTailRiskGroup(selected.filter(event => trainSet.has(event.signal_date)), tailOptions),
      validation: summarizeTailRiskGroup(selected.filter(event => validationSet.has(event.signal_date)), tailOptions),
      test: summarizeTailRiskGroup(selected.filter(event => testSet.has(event.signal_date)), tailOptions),
    };
  });
  const allTestDates = new Set(folds.flatMap(fold => fold.test_dates));
  const byRegime = {};
  for (const regime of ['bull', 'sideways', 'bear', 'unknown']) {
    byRegime[regime] = summarizeTailRiskGroup(
      selected.filter(event => event.market_regime === regime),
      tailOptions,
    );
  }
  return {
    candidate_id: definition.candidate_id,
    family_id: definition.family_id,
    version: definition.version,
    label: definition.label,
    kind: definition.kind,
    objective: definition.objective,
    base_candidate_id: definition.base_candidate_id,
    all: summarizeTailRiskGroup(selected, tailOptions),
    by_regime: byRegime,
    walk_forward_test: summarizeTailRiskGroup(
      selected.filter(event => allTestDates.has(event.signal_date)),
      tailOptions,
    ),
    folds: foldSummaries,
  };
}

function compareMinimum(actual, expected, label, reasons) {
  if (!Number.isFinite(actual) || actual < expected) reasons.push(`${label}: ${actual ?? 'null'} < ${expected}`);
}

function compareMaximum(actual, expected, label, reasons) {
  if (!Number.isFinite(actual) || actual > expected) reasons.push(`${label}: ${actual ?? 'null'} > ${expected}`);
}

function foldSucceeded(group, objective) {
  if (!group || !group.event_count) return false;
  if (objective === 'risk_filter') {
    return Number.isFinite(group.average_excess_return_5d_pct)
      && group.average_excess_return_5d_pct < 0
      && Number.isFinite(group.positive_excess_return_5d_rate_pct)
      && group.positive_excess_return_5d_rate_pct < 50;
  }
  return Number.isFinite(group.average_excess_return_5d_pct)
    && group.average_excess_return_5d_pct > 0
    && Number.isFinite(group.positive_excess_return_5d_rate_pct)
    && group.positive_excess_return_5d_rate_pct > 50;
}

function evaluateWalkForwardPromotion(summary, definition) {
  const gate = definition.promotion_gate || {};
  const reasons = [];
  compareMinimum(summary.all.event_count, Number(gate.min_total_events || 0), 'total events', reasons);
  const minFoldEvents = Number(gate.min_test_events_per_fold || 0);
  const eligibleFolds = summary.folds.filter(fold => fold.test.event_count >= minFoldEvents);
  const successfulFolds = eligibleFolds.filter(fold => foldSucceeded(fold.test, definition.objective));
  compareMinimum(eligibleFolds.length, Number(gate.min_eligible_test_folds || 0), 'eligible test folds', reasons);
  compareMinimum(successfulFolds.length, Number(gate.min_successful_test_folds || 0), 'successful test folds', reasons);
  const aggregate = summary.walk_forward_test;
  if (definition.objective === 'risk_filter') {
    compareMaximum(
      aggregate.average_excess_return_5d_pct,
      Number(gate.max_walk_forward_test_average_excess_return_5d_pct ?? 0),
      'walk-forward test average excess return',
      reasons,
    );
    compareMaximum(
      aggregate.positive_excess_return_5d_rate_pct,
      Number(gate.max_walk_forward_test_positive_excess_return_5d_rate_pct ?? 50),
      'walk-forward test positive excess rate',
      reasons,
    );
  } else {
    compareMinimum(
      aggregate.average_excess_return_5d_pct,
      Number(gate.min_walk_forward_test_average_excess_return_5d_pct ?? 0),
      'walk-forward test average excess return',
      reasons,
    );
    compareMinimum(
      aggregate.positive_excess_return_5d_rate_pct,
      Number(gate.min_walk_forward_test_positive_excess_return_5d_rate_pct ?? 50),
      'walk-forward test positive excess rate',
      reasons,
    );
    compareMinimum(
      aggregate.return_5d_p10_pct,
      Number(gate.min_walk_forward_test_return_5d_p10_pct ?? -Infinity),
      'walk-forward test return p10',
      reasons,
    );
    compareMinimum(
      aggregate.cvar_5pct_return_5d_pct,
      Number(gate.min_walk_forward_test_cvar_5pct_return_5d_pct ?? -Infinity),
      'walk-forward test CVaR 5%',
      reasons,
    );
    compareMaximum(
      aggregate.extreme_loss_rate_pct,
      Number(gate.max_walk_forward_test_extreme_loss_rate_pct ?? Infinity),
      'walk-forward test extreme loss rate',
      reasons,
    );
  }
  return {
    status: reasons.length ? 'hold_research' : 'promotion_eligible',
    passed: reasons.length === 0,
    reasons,
    eligible_test_folds: eligibleFolds.map(fold => fold.fold_id),
    successful_test_folds: successfulFolds.map(fold => fold.fold_id),
  };
}

function buildCompactSummary(payload) {
  return {
    schema_version: payload.schema_version,
    research_id: payload.research_id,
    candidate_registry_id: payload.candidate_registry_id,
    candidate_registry_status: payload.candidate_registry_status,
    generated_at: payload.generated_at,
    cutoff_date: payload.cutoff_date,
    source_date_range: payload.source_date_range,
    eligible_signal_date_range: payload.eligible_signal_date_range,
    cooldown_trading_days: payload.cooldown_trading_days,
    market_regime_definition: payload.market_regime_definition,
    market_regime_signal_date_count: payload.market_regime_signal_date_count,
    walk_forward_definition: payload.walk_forward_definition,
    walk_forward_folds: payload.walk_forward_folds,
    tail_risk_definition: payload.tail_risk_definition,
    leakage_guard: payload.leakage_guard,
    source_file_count: payload.source_file_count,
    candidate_definitions: payload.candidate_definitions,
    base_candidate_independent_event_count: payload.base_candidate_independent_event_count,
    availability_observation_count: payload.availability_observation_count,
    raw_signal_count: payload.raw_signal_count,
    independent_event_count: Array.isArray(payload.events) ? payload.events.length : 0,
    cooldown_suppressed_count: Array.isArray(payload.cooldown_suppressed_events)
      ? payload.cooldown_suppressed_events.length
      : 0,
    summaries: payload.summaries,
  };
}

module.exports = {
  standardDeviation,
  dailyReturns,
  maxDrawdownPct,
  computeTrailingRisk,
  computeForwardExcursion,
  valueAtPath,
  evaluateConstraint,
  evaluateSelector,
  buildWalkForwardFolds,
  cvarLowerTail,
  summarizeTailRiskGroup,
  summarizeCandidateWalkForward,
  foldSucceeded,
  evaluateWalkForwardPromotion,
  buildCompactSummary,
};
