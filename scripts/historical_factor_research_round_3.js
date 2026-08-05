'use strict';

const {
  DEFAULT_OPTIONS: ROUND_2_DEFAULT_OPTIONS,
  compactDate,
  round,
  percentile,
  loadHistoricalPriceContext,
  calculateMarginCrowdingRaw,
} = require('./historical_factor_research_round_2');
const { calculateCrowdingWeakening } = require('./round_3_candidate_research_lib');
const { computeTrailingRisk } = require('./round_4_walk_forward_research_lib');

const DEFAULT_OPTIONS = Object.freeze({
  ...ROUND_2_DEFAULT_OPTIONS,
  latestReturn1dMaxPct: -2,
  maxDrawdown20dMaxPct: -12,
  realizedVolatility20dMinPct: 4,
  priceReturn5dMaxPct: -8,
  sma20GapMaxPct: -10,
  trailingRiskLookback: 20,
});

function calculateMarginCrowdingCapitulationContinuationRisk(
  crowdingWeakening,
  trailingRisk,
  options = {},
) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const weakeningAvailable = crowdingWeakening?.available === true;
  const riskAvailable = trailingRisk?.available === true;
  const latestReturn1dPct = Number(crowdingWeakening?.latest_return_1d_pct);
  const priceReturn5dPct = Number(crowdingWeakening?.price_return_5d_pct);
  const sma20GapPct = Number(crowdingWeakening?.sma20_gap_pct);
  const realizedVolatility20dPct = Number(trailingRisk?.realized_volatility_20d_pct);
  const maxDrawdown20dPct = Number(trailingRisk?.max_drawdown_20d_pct);
  const available = weakeningAvailable
    && riskAvailable
    && [
      latestReturn1dPct,
      priceReturn5dPct,
      sma20GapPct,
      realizedVolatility20dPct,
      maxDrawdown20dPct,
    ].every(Number.isFinite);

  if (!available) {
    return {
      available: false,
      pass: null,
      conditions: null,
      metrics: {
        latest_return_1d_pct: Number.isFinite(latestReturn1dPct) ? round(latestReturn1dPct) : null,
        price_return_5d_pct: Number.isFinite(priceReturn5dPct) ? round(priceReturn5dPct) : null,
        sma20_gap_pct: Number.isFinite(sma20GapPct) ? round(sma20GapPct) : null,
        realized_volatility_20d_pct: Number.isFinite(realizedVolatility20dPct)
          ? round(realizedVolatility20dPct)
          : null,
        max_drawdown_20d_pct: Number.isFinite(maxDrawdown20dPct)
          ? round(maxDrawdown20dPct)
          : null,
      },
    };
  }

  const conditions = {
    margin_crowding_weakening: crowdingWeakening.pass === true,
    latest_return_1d: latestReturn1dPct <= resolved.latestReturn1dMaxPct,
    max_drawdown_20d: maxDrawdown20dPct <= resolved.maxDrawdown20dMaxPct,
    realized_volatility_20d: realizedVolatility20dPct >= resolved.realizedVolatility20dMinPct,
    price_breakdown_5d: priceReturn5dPct <= resolved.priceReturn5dMaxPct,
    sma20_breakdown: sma20GapPct <= resolved.sma20GapMaxPct,
  };
  conditions.tail_breakdown = conditions.price_breakdown_5d || conditions.sma20_breakdown;

  return {
    available: true,
    pass: conditions.margin_crowding_weakening
      && conditions.latest_return_1d
      && conditions.max_drawdown_20d
      && conditions.realized_volatility_20d
      && conditions.tail_breakdown,
    conditions,
    metrics: {
      latest_return_1d_pct: round(latestReturn1dPct),
      price_return_5d_pct: round(priceReturn5dPct),
      sma20_gap_pct: round(sma20GapPct),
      realized_volatility_20d_pct: round(realizedVolatility20dPct),
      max_drawdown_20d_pct: round(maxDrawdown20dPct),
    },
  };
}

function enrichRound3HistoricalFactorFeatures(payload, workspaceRoot, dataAsOf, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const cutoff = compactDate(dataAsOf) || compactDate(payload?.base_trade_date);
  const priceContext = loadHistoricalPriceContext(payload, workspaceRoot, cutoff, resolved);
  const rawByCode = new Map();
  const crowdingRatios = [];

  for (const stock of stocks) {
    const code = String(stock.stock_code || '').trim();
    const rawRows = priceContext.by_code.get(code) || [];
    const rows = rawRows.at(-1)?.date === priceContext.latest_source_date ? rawRows : [];
    const marginFeatures = stock.strategy_tag_features || {};
    const crowding = calculateMarginCrowdingRaw(rows, marginFeatures, resolved);
    rawByCode.set(code, { rows, crowding });
    if (crowding.available) crowdingRatios.push(crowding.ratio);
  }

  const crowdingThreshold = crowdingRatios.length >= resolved.crowdingMinPeers
    ? percentile(crowdingRatios, resolved.crowdingPercentile)
    : null;
  let availableCount = 0;
  let matchedCount = 0;

  payload.stocks = stocks.map(stock => {
    const code = String(stock.stock_code || '').trim();
    const raw = rawByCode.get(code) || { rows: [], crowding: { available: false } };
    const crowdingAvailable = raw.crowding.available && Number.isFinite(crowdingThreshold);
    const crowdingState = {
      available: crowdingAvailable,
      pass: crowdingAvailable
        ? raw.crowding.ratio >= crowdingThreshold && raw.crowding.change_5d > 0
        : null,
    };
    const weakening = calculateCrowdingWeakening(raw.rows, crowdingState, resolved);
    const trailingRisk = computeTrailingRisk(
      raw.rows,
      raw.rows.length - 1,
      resolved.trailingRiskLookback,
    );
    const result = calculateMarginCrowdingCapitulationContinuationRisk(
      weakening,
      trailingRisk,
      resolved,
    );
    if (result.available) availableCount += 1;
    if (result.pass === true) matchedCount += 1;

    return {
      ...stock,
      strategy_tag_features: {
        ...(stock.strategy_tag_features || {}),
        margin_crowding_capitulation_continuation_risk: result.pass,
        margin_crowding_capitulation_continuation_risk_available: result.available,
        margin_crowding_capitulation_continuation_risk_conditions: result.conditions,
        margin_crowding_capitulation_continuation_risk_metrics: {
          ...result.metrics,
          margin_balance_to_volume_20d: crowdingAvailable ? round(raw.crowding.ratio) : null,
          margin_crowding_percentile_threshold: Number.isFinite(crowdingThreshold)
            ? round(crowdingThreshold)
            : null,
          margin_change_5d: raw.crowding.change_5d ?? null,
        },
        margin_crowding_capitulation_continuation_risk_latest_date: raw.rows.at(-1)?.date || null,
        margin_crowding_capitulation_continuation_risk_market_regime_used: false,
      },
    };
  });

  const total = payload.stocks.length;
  const status = availableCount === 0
    ? 'unable_to_calculate'
    : availableCount < total ? 'partial' : 'completed';
  const metadata = {
    calculation_status: status,
    calculation_message: status === 'unable_to_calculate'
      ? '缺少足夠價量、融資或全市場百分位資料，無法計算融資擁擠恐慌續跌風險。'
      : status === 'partial'
        ? '已完成融資擁擠恐慌續跌風險計算；部分股票資料不足。市場環境不影響入選。'
        : '已完成全部股票的融資擁擠恐慌續跌風險計算；市場環境不影響入選。',
    cutoff_date: cutoff || null,
    latest_source_date: priceContext.latest_source_date,
    source_files: priceContext.source_files,
    total_stock_count: total,
    available_stock_count: availableCount,
    matched_stock_count: matchedCount,
    unavailable_stock_count: total - availableCount,
    coverage_pct: total ? round((availableCount / total) * 100, 2) : null,
    thresholds: {
      margin_crowding_percentile: resolved.crowdingPercentile * 100,
      margin_crowding_min_peers: resolved.crowdingMinPeers,
      margin_crowding_ratio_threshold: Number.isFinite(crowdingThreshold)
        ? round(crowdingThreshold)
        : null,
      latest_return_1d_max_pct: resolved.latestReturn1dMaxPct,
      max_drawdown_20d_max_pct: resolved.maxDrawdown20dMaxPct,
      realized_volatility_20d_min_pct: resolved.realizedVolatility20dMinPct,
      price_return_5d_max_pct: resolved.priceReturn5dMaxPct,
      sma20_gap_max_pct: resolved.sma20GapMaxPct,
      tail_condition_operator: 'or',
    },
    usage_policy: {
      role: 'observation_only',
      affects_strategy_eligibility: false,
      affects_prediction_score: false,
      market_regime_used_for_eligibility: false,
      display_hint: '市場偏弱時宜提高警覺；市場趨勢不影響此標籤入選。',
    },
  };
  payload.strategy_tag_source_metadata = {
    ...(payload.strategy_tag_source_metadata || {}),
    historical_factors_round_3: metadata,
  };
  return metadata;
}

module.exports = {
  DEFAULT_OPTIONS,
  calculateMarginCrowdingCapitulationContinuationRisk,
  enrichRound3HistoricalFactorFeatures,
};
