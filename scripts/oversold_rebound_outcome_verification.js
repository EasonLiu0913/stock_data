'use strict';

const {
  finiteNumber,
  round,
  buildStockProfile,
} = require('./oversold_rebound_research_lib');

const LABEL_SPECS = Object.freeze({
  close_rebound_1d_5pct: { field: 'future_return_1d', threshold: 5, verificationField: 'future_return_1d' },
  close_rebound_3d_5pct: { field: 'future_return_3d', threshold: 5, verificationField: 'future_return_3d' },
  close_rebound_3d_10pct: { field: 'future_return_3d', threshold: 10, verificationField: 'future_return_3d' },
  close_rebound_5d_8pct: { field: 'future_return_5d', threshold: 8, verificationField: 'future_return_5d' },
  close_rebound_5d_10pct: { field: 'future_return_5d', threshold: 10, verificationField: 'future_return_5d' },
  close_rebound_10d_15pct: { field: 'future_return_10d', threshold: 15, verificationField: 'future_return_10d' },
  intraday_rebound_3d_5pct: { field: 'max_return_3d', threshold: 5, verificationField: 'future_return_3d' },
  intraday_rebound_5d_10pct: { field: 'max_return_5d', threshold: 10, verificationField: 'future_return_5d' },
});

function verifiedThresholdLabel(outcome, spec) {
  if (!outcome || typeof outcome !== 'object') return null;
  const verificationValue = finiteNumber(outcome[spec.verificationField]);
  if (!Number.isFinite(verificationValue)) return null;
  const value = finiteNumber(outcome[spec.field]);
  return Number.isFinite(value) ? value >= spec.threshold : null;
}

function verifyOutcome(outcome) {
  if (!outcome || typeof outcome !== 'object') return outcome;
  const labels = Object.fromEntries(
    Object.entries(LABEL_SPECS).map(([key, spec]) => [key, verifiedThresholdLabel(outcome, spec)]),
  );
  const completedHorizons = [1, 3, 5, 10].filter(horizon => Number.isFinite(finiteNumber(outcome[`future_return_${horizon}d`])));
  return {
    ...outcome,
    labels,
    verification: {
      completed_horizons: completedHorizons,
      max_completed_horizon: completedHorizons.at(-1) || 0,
      has_complete_1d: completedHorizons.includes(1),
      has_complete_3d: completedHorizons.includes(3),
      has_complete_5d: completedHorizons.includes(5),
      has_complete_10d: completedHorizons.includes(10),
    },
  };
}

function labelStats(events, key) {
  const values = events
    .map(event => event?.outcome_from_signal?.labels?.[key])
    .filter(value => value === true || value === false);
  const hits = values.filter(Boolean).length;
  const verified = values.length;
  return {
    hits,
    verified,
    misses: verified - hits,
    unverified: events.length - verified,
    hit_rate: verified ? round((hits / verified) * 100, 2) : null,
  };
}

function buildVerifiedStockProfile(stockCode, stockName, events) {
  const base = buildStockProfile(stockCode, stockName, events);
  const stats = Object.fromEntries(Object.keys(LABEL_SPECS).map(key => [key, labelStats(events, key)]));
  const primary = stats.intraday_rebound_5d_10pct;
  return {
    ...base,
    successful_rebound_count: primary.hits,
    non_success_count: primary.misses,
    unverified_outcome_count: primary.unverified,
    verified_outcome_count: primary.verified,
    rebound_rate_5d_intraday_10pct: primary.hit_rate,
    close_rebound_rate_3d_5pct: stats.close_rebound_3d_5pct.hit_rate,
    close_rebound_rate_5d_10pct: stats.close_rebound_5d_10pct.hit_rate,
    outcome_verification: stats,
    notes: [
      '各命中率分母只使用已走完對應持有期間的事件。',
      '歷史資料尾端尚未完成觀察期的事件標示為 unverified，不計入成功或失敗。',
    ],
  };
}

function finalizeResearchResult(result) {
  if (!result || !Array.isArray(result.stockResults)) throw new Error('Invalid research result');
  for (const stock of result.stockResults) {
    stock.events = stock.events.map(event => ({
      ...event,
      outcome_from_signal: verifyOutcome(event.outcome_from_signal),
      outcome_from_deepest_signal: verifyOutcome(event.outcome_from_deepest_signal),
    }));
    stock.profile = buildVerifiedStockProfile(stock.stock_code, stock.stock_name, stock.events);
  }

  const events = result.stockResults.flatMap(stock => stock.events);
  const outcomeCounts = Object.fromEntries(Object.keys(LABEL_SPECS).map(key => [key, labelStats(events, key)]));
  result.summary = {
    ...result.summary,
    schema_version: Math.max(2, Number(result.summary?.schema_version) || 1),
    outcome_counts: outcomeCounts,
    primary_outcome: {
      label: '5 個交易日內盤中最大反彈至少 10%',
      key: 'intraday_rebound_5d_10pct',
      ...outcomeCounts.intraday_rebound_5d_10pct,
    },
    notes: [
      ...(Array.isArray(result.summary?.notes) ? result.summary.notes : []),
      '反彈結果採獨立驗證分母；尚未走完觀察期的事件不會被誤算為未命中。',
    ],
  };
  if (result.manifest) {
    result.manifest.generated_at = result.summary.generated_at;
    result.manifest.outcome_verification_schema = 2;
  }
  return result;
}

module.exports = {
  LABEL_SPECS,
  verifiedThresholdLabel,
  verifyOutcome,
  labelStats,
  buildVerifiedStockProfile,
  finalizeResearchResult,
};
