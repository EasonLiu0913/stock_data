'use strict';

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentage(numerator, denominator) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? (numerator / denominator) * 100
    : null;
}

function latestRow(record) {
  return Array.isArray(record?.history) ? record.history.at(-1) || null : null;
}

function summarizeBreadthRecords(records) {
  const rows = Array.isArray(records) ? records : [];
  let smaAvailable = 0;
  let aboveSma20 = 0;
  let returnAvailable = 0;
  let positiveReturn20d = 0;
  let breakoutAvailable = 0;
  let breakoutCount = 0;
  for (const record of rows) {
    const latest = latestRow(record);
    const close = finiteNumber(latest?.close);
    const sma20 = finiteNumber(latest?.sma20);
    if (Number.isFinite(close) && close > 0 && Number.isFinite(sma20) && sma20 > 0) {
      smaAvailable += 1;
      if (close > sma20) aboveSma20 += 1;
    }
    const return20d = finiteNumber(record?.return20d);
    if (Number.isFinite(return20d)) {
      returnAvailable += 1;
      if (return20d > 0) positiveReturn20d += 1;
    }
    if (record?.breakout?.pass === true || record?.breakout?.pass === false) {
      breakoutAvailable += 1;
      if (record.breakout.pass === true) breakoutCount += 1;
    }
  }
  return {
    peer_count: rows.length,
    sma20_available_count: smaAvailable,
    above_sma20_count: aboveSma20,
    above_sma20_rate_pct: round(percentage(aboveSma20, smaAvailable), 2),
    return_20d_available_count: returnAvailable,
    positive_return_20d_count: positiveReturn20d,
    positive_return_20d_rate_pct: round(percentage(positiveReturn20d, returnAvailable), 2),
    breakout_available_count: breakoutAvailable,
    breakout_count: breakoutCount,
    breakout_rate_pct: round(percentage(breakoutCount, breakoutAvailable), 2),
  };
}

function computeBreadthSnapshot(records, options = {}) {
  const rows = Array.isArray(records) ? records : [];
  const groups = new Map();
  for (const record of rows) {
    const industry = String(record?.industry || '').trim();
    if (!industry) continue;
    if (!groups.has(industry)) groups.set(industry, []);
    groups.get(industry).push(record);
  }
  const industries = {};
  for (const [industry, group] of groups.entries()) {
    industries[industry] = summarizeBreadthRecords(group);
  }
  return {
    minimum_industry_peers: Math.max(1, Number(options.minimumIndustryPeers || options.minimum_industry_peers || 5)),
    market: summarizeBreadthRecords(rows),
    industries,
  };
}

function breadthForIndustry(snapshot, industry) {
  const minimum = Number(snapshot?.minimum_industry_peers || 5);
  const market = snapshot?.market || {};
  const group = snapshot?.industries?.[String(industry || '').trim()] || null;
  const industryQualified = Boolean(group && group.peer_count >= minimum);
  return {
    market_peer_count: market.peer_count ?? 0,
    market_above_sma20_rate_pct: market.above_sma20_rate_pct ?? null,
    market_positive_return_20d_rate_pct: market.positive_return_20d_rate_pct ?? null,
    market_breakout_count: market.breakout_count ?? 0,
    market_breakout_rate_pct: market.breakout_rate_pct ?? null,
    industry_peer_count: group?.peer_count ?? 0,
    industry_breadth_available: industryQualified,
    industry_above_sma20_rate_pct: industryQualified ? group.above_sma20_rate_pct : null,
    industry_positive_return_20d_rate_pct: industryQualified ? group.positive_return_20d_rate_pct : null,
    industry_breakout_count: industryQualified ? group.breakout_count : null,
    industry_breakout_rate_pct: industryQualified ? group.breakout_rate_pct : null,
  };
}

function delta(value, reference) {
  return Number.isFinite(value) && Number.isFinite(reference) ? round(value - reference) : null;
}

function buildAblationComparison(summaries, definitions) {
  const groups = {};
  for (const definition of definitions || []) {
    if (definition?.analysis_role !== 'ablation' || !definition.ablation_group) continue;
    if (!groups[definition.ablation_group]) groups[definition.ablation_group] = [];
    groups[definition.ablation_group].push(definition);
  }
  const result = {};
  for (const [groupId, groupDefinitions] of Object.entries(groups)) {
    const referenceDefinition = groupDefinitions.find(item => item.ablation_role === 'reference');
    const reference = referenceDefinition ? summaries?.[referenceDefinition.candidate_id] : null;
    const referenceAll = reference?.all || {};
    const referenceTest = reference?.walk_forward_test || {};
    const rows = groupDefinitions.map(definition => {
      const summary = summaries?.[definition.candidate_id] || {};
      const all = summary.all || {};
      const test = summary.walk_forward_test || {};
      return {
        candidate_id: definition.candidate_id,
        label: definition.label,
        ablation_role: definition.ablation_role,
        removed_condition: definition.removed_condition ?? null,
        event_count: all.event_count ?? 0,
        recovered_event_count_vs_reference: reference
          ? (all.event_count ?? 0) - (referenceAll.event_count ?? 0)
          : null,
        walk_forward_test_event_count: test.event_count ?? 0,
        walk_forward_test_average_return_5d_pct: test.average_return_5d_pct ?? null,
        walk_forward_test_average_excess_return_5d_pct: test.average_excess_return_5d_pct ?? null,
        walk_forward_test_return_5d_p10_pct: test.return_5d_p10_pct ?? null,
        walk_forward_test_cvar_5pct_return_5d_pct: test.cvar_5pct_return_5d_pct ?? null,
        walk_forward_test_extreme_loss_rate_pct: test.extreme_loss_rate_pct ?? null,
        delta_test_excess_vs_reference_pct: delta(
          test.average_excess_return_5d_pct,
          referenceTest.average_excess_return_5d_pct,
        ),
        delta_test_p10_vs_reference_pct: delta(
          test.return_5d_p10_pct,
          referenceTest.return_5d_p10_pct,
        ),
      };
    });
    result[groupId] = {
      reference_candidate_id: referenceDefinition?.candidate_id || null,
      rows,
    };
  }
  return result;
}

function buildBreadthVariantComparison(summaries, definitions) {
  const groups = {};
  for (const definition of definitions || []) {
    if (definition?.analysis_role !== 'breadth_variant' || !definition.breadth_group) continue;
    if (!groups[definition.breadth_group]) groups[definition.breadth_group] = [];
    groups[definition.breadth_group].push(definition);
  }
  const result = {};
  for (const [groupId, groupDefinitions] of Object.entries(groups)) {
    result[groupId] = groupDefinitions.map(definition => {
      const summary = summaries?.[definition.candidate_id] || {};
      const all = summary.all || {};
      const test = summary.walk_forward_test || {};
      return {
        candidate_id: definition.candidate_id,
        label: definition.label,
        event_count: all.event_count ?? 0,
        selection_rate_from_base_pct: summary.selection_rate_from_base_pct ?? null,
        walk_forward_test_event_count: test.event_count ?? 0,
        walk_forward_test_average_return_5d_pct: test.average_return_5d_pct ?? null,
        walk_forward_test_average_excess_return_5d_pct: test.average_excess_return_5d_pct ?? null,
        walk_forward_test_positive_excess_return_5d_rate_pct:
          test.positive_excess_return_5d_rate_pct ?? null,
        walk_forward_test_return_5d_p10_pct: test.return_5d_p10_pct ?? null,
        walk_forward_test_cvar_5pct_return_5d_pct: test.cvar_5pct_return_5d_pct ?? null,
        walk_forward_test_extreme_loss_rate_pct: test.extreme_loss_rate_pct ?? null,
      };
    });
  }
  return result;
}

function evaluateRound5Promotion(summary, definition, baseEvaluator) {
  if (definition?.analysis_role === 'ablation') {
    return {
      status: 'analysis_only',
      passed: false,
      reasons: ['single-condition ablation variants are never promoted automatically'],
      eligible_test_folds: [],
      successful_test_folds: [],
    };
  }
  if (typeof baseEvaluator !== 'function') {
    throw new Error('Base walk-forward promotion evaluator is required');
  }
  return baseEvaluator(summary, definition);
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
    breadth_definition: payload.breadth_definition,
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
    ablation_comparison: payload.ablation_comparison,
    breadth_variant_comparison: payload.breadth_variant_comparison,
    summaries: payload.summaries,
  };
}

module.exports = {
  finiteNumber,
  round,
  percentage,
  summarizeBreadthRecords,
  computeBreadthSnapshot,
  breadthForIndustry,
  buildAblationComparison,
  buildBreadthVariantComparison,
  evaluateRound5Promotion,
  buildCompactSummary,
};
