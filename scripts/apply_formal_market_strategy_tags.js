#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  readJson,
  atomicWriteJson,
  round,
} = require('./market_environment_lib');
const {
  candidateRule,
  policyBucket,
} = require('./generate_actual_market_environment');
const {
  generateOversoldBetaRebound,
} = require('./oversold_beta_rebound');

const FORMAL_TAG = '熊市時防禦抗跌股';
const LEGACY_FORMAL_TAGS = Object.freeze(['衝擊後高信心核心']);
const STRATEGY_ID = 'bear_market_defensive_resilience_v1';
const LEGACY_STRATEGY_IDS = Object.freeze(['post_shock_high_confidence_core_v1']);
const POST_SHOCK_CODES = new Set(['post_shock_day_1', 'post_shock_day_2']);
const FORMAL_CRITERIA = Object.freeze([
  '5 日量比 >= 1.5',
  'RSI14 >= 70',
  '確認分數 >= 7',
  '7 日相對強勢 >= 8',
  'SMA20 乖離 <= 10%',
]);

const OVERSOLD_ELECTRONICS_STRATEGY_ID = 'oversold_electronics_rebound_v1';
const OVERSOLD_ELECTRONICS_TAG = '跌深反彈電子股';
const ELECTRONICS_INDUSTRIES = Object.freeze([
  '半導體業',
  '電子零組件業',
  '電腦及週邊設備業',
  '光電業',
  '通信網路業',
  '其他電子業',
  '電子通路業',
]);
const OVERSOLD_ELECTRONICS_CRITERIA = Object.freeze([
  'RSI14 <= 35',
  '三日報酬 <= -8%',
  '距 SMA20 <= -10%',
  '指定電子產業',
  '資料完整度 >= 80%',
  'RSI14、三日報酬、SMA20 乖離均為有效數值',
  '至少 20 個有效交易日且二十日成交值中位數高於全市場第 30 百分位',
  '處置股資料接入後才啟用硬排除',
]);

const FORMAL_STRATEGY_REGISTRY = Object.freeze([
  Object.freeze({
    strategy_id: STRATEGY_ID,
    label: FORMAL_TAG,
    legacy_strategy_ids: LEGACY_STRATEGY_IDS,
    legacy_labels: LEGACY_FORMAL_TAGS,
    fixed_display: true,
    changes_direction_score: false,
    evaluation_target: 'relative_leadership',
    criteria: FORMAL_CRITERIA,
  }),
  Object.freeze({
    strategy_id: OVERSOLD_ELECTRONICS_STRATEGY_ID,
    label: OVERSOLD_ELECTRONICS_TAG,
    legacy_strategy_ids: Object.freeze([]),
    legacy_labels: Object.freeze([]),
    fixed_display: true,
    changes_direction_score: false,
    evaluation_target: 'close_return_gt_5',
    criteria: OVERSOLD_ELECTRONICS_CRITERIA,
  }),
]);

function compactDate(value) {
  const date = String(value || '').replaceAll('-', '').replaceAll('/', '');
  return /^20\d{6}$/.test(date) ? date : '';
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(number) ? number : null;
}

function isBullish(label) {
  return String(label || '').includes('偏多');
}

function isBearish(label) {
  return String(label || '').includes('偏空');
}

function chipBias(stock) {
  return stock?.chip_bias || '中性或不足';
}

function average(stocks, getter) {
  const values = stocks.map(getter).map(Number).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function ratio(stocks, predicate) {
  return stocks.length ? stocks.filter(predicate).length / stocks.length * 100 : 0;
}

function summarizeStocks(stocks) {
  const directions = {};
  const risks = {};
  const marketContextRisks = {};
  const completenessBands = { '高完整度': 0, '中完整度': 0, '低完整度': 0 };
  for (const stock of stocks) {
    directions[stock.final_direction_label] = (directions[stock.final_direction_label] || 0) + 1;
    risks[stock.risk_label] = (risks[stock.risk_label] || 0) + 1;
    marketContextRisks[stock.market_context_risk_label] = (marketContextRisks[stock.market_context_risk_label] || 0) + 1;
    if (stock.data_completeness >= 80) completenessBands['高完整度'] += 1;
    else if (stock.data_completeness >= 50) completenessBands['中完整度'] += 1;
    else completenessBands['低完整度'] += 1;
  }
  return {
    count: stocks.length,
    average_direction_score: round(average(stocks, (stock) => stock.direction_score)),
    average_completeness: round(average(stocks, (stock) => stock.data_completeness)),
    average_r1: round(average(stocks, (stock) => stock.features?.r1)),
    average_r3: round(average(stocks, (stock) => stock.features?.r3)),
    average_gap_sma20: round(average(stocks, (stock) => stock.features?.gap_sma20)),
    average_rsi14: round(average(stocks, (stock) => stock.features?.rsi14)),
    bullish_ratio: round(ratio(stocks, (stock) => isBullish(stock.final_direction_label))),
    bearish_ratio: round(ratio(stocks, (stock) => isBearish(stock.final_direction_label))),
    high_risk_ratio: round(ratio(stocks, (stock) => stock.risk_label === '高風險')),
    market_high_risk_ratio: round(ratio(stocks, (stock) => stock.market_context_risk_label === '高風險')),
    low_completeness_ratio: round(ratio(stocks, (stock) => stock.data_completeness < 50)),
    volume_expansion_ratio: round(ratio(stocks, (stock) => Number(stock.features?.volume_ratio_1d) >= 1.2)),
    overheated_ratio: round(ratio(stocks, (stock) => Number(stock.features?.rsi14) >= 70)),
    oversold_ratio: round(ratio(stocks, (stock) => Number(stock.features?.rsi14) <= 30)),
    chip_bullish_ratio: round(ratio(stocks, (stock) => chipBias(stock) === '偏多')),
    chip_bearish_ratio: round(ratio(stocks, (stock) => chipBias(stock) === '偏空')),
    reversal_ratio: round(ratio(stocks, (stock) => (stock.reversal_signals?.tags || []).length > 0)),
    reclaim_sma20_ratio: round(ratio(stocks, (stock) => stock.reversal_signals?.crossed_sma20 === true)),
    reclaim_sma60_ratio: round(ratio(stocks, (stock) => stock.reversal_signals?.crossed_sma60 === true)),
    macd_bullish_ratio: round(ratio(stocks, (stock) => stock.reversal_signals?.macd_bullish_cross === true || stock.reversal_signals?.macd_histogram_positive_turn === true)),
    kd_bullish_ratio: round(ratio(stocks, (stock) => stock.reversal_signals?.kd_bullish_cross === true || stock.reversal_signals?.kd_oversold_turn === true)),
    relative_strength_7d_ratio: round(ratio(stocks, (stock) => stock.relative_strength_7d?.relative_strength_strong === true)),
    relative_strength_7d_market_return: round(stocks.find((stock) => Number.isFinite(Number(stock.relative_strength_7d?.market_return_7d)))?.relative_strength_7d?.market_return_7d),
    directions,
    risks,
    market_context_risks: marketContextRisks,
    completeness_bands: completenessBands,
  };
}

function emptySummaryAsUnavailable(summary) {
  const output = { ...summary };
  for (const key of Object.keys(output)) {
    if (key === 'directions' || key === 'risks' || key === 'market_context_risks' || key === 'completeness_bands') continue;
    if (key === 'count') output[key] = null;
    else if (typeof output[key] === 'number' || output[key] === null) output[key] = null;
  }
  return output;
}

function buildFormalStrategyClassification(environment, selected, generatedAt) {
  const stocks = Array.isArray(selected) ? selected : [];
  const environmentCode = environment?.environment?.code || null;
  return {
    label: FORMAL_TAG,
    status: 'formal_label',
    calculation_status: 'completed',
    fixed_display: true,
    changes_direction_score: false,
    environment_code: environmentCode,
    active: POST_SHOCK_CODES.has(environmentCode),
    count: stocks.length,
    members: stocks.map((stock) => stock.stock_code),
    criteria: [...FORMAL_CRITERIA],
    generated_at: generatedAt,
  };
}

function buildFormalStrategyGroup(environment, selected) {
  const stocks = Array.isArray(selected) ? selected : [];
  const environmentCode = environment?.environment?.code || null;
  return {
    group: FORMAL_TAG,
    ...summarizeStocks(stocks),
    formal_strategy: true,
    fixed_display: true,
    strategy_id: STRATEGY_ID,
    environment_code: environmentCode,
    active: POST_SHOCK_CODES.has(environmentCode),
    calculation_status: 'completed',
    changes_direction_score: false,
    evaluation_target: 'relative_leadership',
    criteria: [...FORMAL_CRITERIA],
    members: stocks.map((stock) => stock.stock_code),
  };
}

function formalPostShockDecision(stock, environment) {
  const environmentCode = environment?.environment?.code || null;
  const policyState = environment?.strategy_policy?.relative_leadership_momentum || null;
  if (!POST_SHOCK_CODES.has(environmentCode) || policyState !== 'restricted_shadow') {
    return { matched: false, environment_code: environmentCode, policy_state: policyState, decision: null };
  }
  if (!candidateRule(stock)) {
    return { matched: false, environment_code: environmentCode, policy_state: policyState, decision: null };
  }
  const decision = policyBucket(stock, policyState);
  return {
    matched: decision.bucket === 'core',
    environment_code: environmentCode,
    policy_state: policyState,
    decision,
  };
}

function removeDefinitionTags(stock, definition) {
  const labels = new Set([definition.label, ...(definition.legacy_labels || [])]);
  const existingTags = Array.isArray(stock.strategy_tags) ? stock.strategy_tags : [];
  stock.strategy_tags = existingTags.filter((tag) => !labels.has(tag));
  if (stock.formal_market_strategies && typeof stock.formal_market_strategies === 'object') {
    delete stock.formal_market_strategies[definition.strategy_id];
    for (const legacyId of definition.legacy_strategy_ids || []) delete stock.formal_market_strategies[legacyId];
    if (!Object.keys(stock.formal_market_strategies).length) delete stock.formal_market_strategies;
  }
}

function updateStockTag(stock, environment) {
  const definition = FORMAL_STRATEGY_REGISTRY[0];
  removeDefinitionTags(stock, definition);
  delete stock.formal_market_strategy;

  const result = formalPostShockDecision(stock, environment);
  if (!result.matched) return false;

  stock.strategy_tags.unshift(FORMAL_TAG);
  stock.formal_market_strategy = {
    strategy_id: STRATEGY_ID,
    label: FORMAL_TAG,
    status: 'formal_label',
    changes_direction_score: false,
    environment_code: result.environment_code,
    policy_state: result.policy_state,
    bucket: result.decision.bucket,
    confirmation_score: result.decision.profile.score,
    confirmation_signals: result.decision.profile.signals,
    criteria: [...FORMAL_CRITERIA],
  };
  stock.formal_market_strategies = {
    ...(stock.formal_market_strategies || {}),
    [STRATEGY_ID]: stock.formal_market_strategy,
  };
  return true;
}

function percentile(values, percentileValue) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function median(values) {
  return percentile(values, 0.5);
}

function loadLiquidityContext(stocks, baseTradeDate) {
  const cutoff = compactDate(baseTradeDate);
  const stockCodes = new Set((stocks || []).map((stock) => String(stock.stock_code)));
  const priceDir = path.join(ROOT, 'data_fubon');
  let files = [];
  try {
    files = fs.readdirSync(priceDir)
      .filter((file) => /^fubon_20\d{6}_sma\.json$/.test(file))
      .filter((file) => !cutoff || file.slice(6, 14) <= cutoff)
      .sort()
      .slice(-45);
  } catch {
    return {
      available: false,
      reason: 'missing_price_history_directory',
      threshold_percentile: 30,
      threshold_value: null,
      by_code: new Map(),
      warnings: ['缺少 data_fubon 歷史價格與成交量，無法執行流動性檢查。'],
    };
  }

  const history = new Map();
  for (const file of files) {
    const payload = readJson(path.join(priceDir, file), {});
    for (const [code, item] of Object.entries(payload || {})) {
      if (!stockCodes.has(String(code))) continue;
      const dateKeys = Object.keys(item || {}).filter((key) => /^20\d{2}[/-]\d{2}[/-]\d{2}$/.test(key)).sort();
      for (const dateKey of dateKeys) {
        const row = item[dateKey] || {};
        const rowDate = compactDate(dateKey);
        if (cutoff && rowDate > cutoff) continue;
        const close = finiteNumber(row.Price ?? row.Close);
        const volume = finiteNumber(row.Volume);
        if (close === null || volume === null || close <= 0) continue;
        if (!history.has(code)) history.set(code, new Map());
        history.get(code).set(rowDate, { date: rowDate, close, volume, traded_value: close * volume });
      }
    }
  }

  const raw = new Map();
  const medians = [];
  for (const stock of stocks || []) {
    const code = String(stock.stock_code);
    const rows = [...(history.get(code)?.values() || [])]
      .sort((left, right) => left.date.localeCompare(right.date))
      .filter((row) => Number.isFinite(row.traded_value) && row.traded_value >= 0)
      .slice(-20);
    const medianValue = rows.length >= 20 ? median(rows.map((row) => row.traded_value)) : null;
    const latestVolume = rows.at(-1)?.volume ?? null;
    if (Number.isFinite(medianValue)) medians.push(medianValue);
    raw.set(code, {
      valid_days: rows.length,
      median_traded_value_20d: medianValue,
      latest_volume: latestVolume,
      latest_date: rows.at(-1)?.date || null,
    });
  }

  const threshold = percentile(medians, 0.3);
  const byCode = new Map();
  for (const [code, item] of raw.entries()) {
    const pass = item.valid_days >= 20
      && Number.isFinite(item.latest_volume)
      && item.latest_volume > 0
      && Number.isFinite(item.median_traded_value_20d)
      && Number.isFinite(threshold)
      && item.median_traded_value_20d >= threshold;
    byCode.set(code, {
      ...item,
      pass,
      threshold_percentile: 30,
      threshold_value: threshold,
      reason: item.valid_days < 20
        ? 'less_than_20_valid_days'
        : !Number.isFinite(item.latest_volume) || item.latest_volume <= 0
          ? 'latest_volume_zero_or_missing'
          : !Number.isFinite(threshold)
            ? 'cross_section_threshold_unavailable'
            : pass ? 'passed' : 'below_market_30th_percentile',
    });
  }

  return {
    available: Number.isFinite(threshold),
    reason: Number.isFinite(threshold) ? 'completed' : 'insufficient_cross_section_history',
    threshold_percentile: 30,
    threshold_value: round(threshold),
    valid_cross_section_count: medians.length,
    covered_stock_count: [...byCode.values()].filter((item) => item.valid_days >= 20).length,
    total_stock_count: stocks?.length || 0,
    source_files: files.map((file) => `data_fubon/${file}`),
    by_code: byCode,
    warnings: Number.isFinite(threshold) ? [] : ['可計算二十日成交值中位數的股票不足，無法建立全市場第 30 百分位門檻。'],
  };
}

function boundedScore(value, min, max, points) {
  if (!Number.isFinite(value)) return 0;
  if (value >= min && value <= max) return points;
  return 0;
}

function oversoldCandidateScore(stock, readiness) {
  const rsi = finiteNumber(stock.features?.rsi14);
  const r3 = finiteNumber(stock.features?.r3);
  const gap = finiteNumber(stock.features?.gap_sma20);
  const volumeRatio = finiteNumber(stock.features?.volume_ratio_1d);
  const tags = stock.reversal_signals?.tags || [];
  const marketScore = finiteNumber(readiness?.score) ?? 0;
  let score = 0;

  if (rsi !== null) {
    if (rsi >= 20 && rsi <= 35) score += 20;
    else if (rsi >= 10) score += 10;
    else score += 4;
  }
  if (r3 !== null) score += r3 >= -20 ? boundedScore(r3, -20, -8, 20) : 8;
  if (gap !== null) score += gap >= -25 ? boundedScore(gap, -25, -10, 20) : 8;
  if (volumeRatio !== null && volumeRatio >= 1.2) score += 10;
  else if (volumeRatio !== null && volumeRatio >= 0.8) score += 5;
  if (tags.some((tag) => tag.includes('KD') || tag.includes('MACD'))) score += 10;
  if (chipBias(stock) === '偏多') score += 8;
  else if (chipBias(stock) !== '偏空') score += 4;
  if (stock.industry === '半導體業'
    && ((finiteNumber(readiness?.inputs?.sox_change_1d_pct) ?? 0) >= 2
      || (finiteNumber(readiness?.inputs?.tsm_adr_change_1d_pct) ?? 0) >= 1.5)) score += 7;
  else if (((finiteNumber(readiness?.inputs?.nasdaq_change_1d_pct) ?? 0) >= 0.5)) score += 5;
  score += Math.min(10, marketScore / 10);
  return round(Math.min(100, score), 1);
}

function oversoldElectronicsDecision(stock, context = {}) {
  const rsi = finiteNumber(stock?.features?.rsi14);
  const r3 = finiteNumber(stock?.features?.r3);
  const gap = finiteNumber(stock?.features?.gap_sma20);
  const liquidity = context.liquidity?.by_code?.get(String(stock?.stock_code)) || null;
  const missingCore = [rsi, r3, gap].some((value) => value === null);
  const reasons = [];
  if (!ELECTRONICS_INDUSTRIES.includes(stock?.industry)) reasons.push('industry_not_in_scope');
  if (!(finiteNumber(stock?.data_completeness) >= 80)) reasons.push('data_completeness_below_80');
  if (missingCore) reasons.push('missing_core_indicator');
  if (rsi !== null && rsi > 35) reasons.push('rsi_above_35');
  if (r3 !== null && r3 > -8) reasons.push('three_day_return_above_minus_8');
  if (gap !== null && gap > -10) reasons.push('sma20_gap_above_minus_10');
  if (!context.liquidity?.available) reasons.push('liquidity_context_unavailable');
  else if (!liquidity?.pass) reasons.push(liquidity?.reason || 'liquidity_check_failed');

  const matched = reasons.length === 0;
  const riskWarnings = [];
  if (rsi !== null && rsi < 10) riskWarnings.push('極端超賣');
  if (r3 !== null && r3 < -20) riskWarnings.push('連續重挫');
  if (gap !== null && gap < -30) riskWarnings.push('遠離均線');
  if (liquidity && !liquidity.pass) riskWarnings.push('量能不足：反彈成交承接存疑');
  riskWarnings.push('處置股資料未接入，無法完成此項排除。');

  return {
    matched,
    reasons,
    rsi14: rsi,
    r3,
    gap_sma20: gap,
    liquidity,
    candidate_score: matched ? oversoldCandidateScore(stock, context.readiness) : null,
    risk_warnings: [...new Set(riskWarnings)],
  };
}

function updateOversoldElectronicsTag(stock, context = {}) {
  const definition = FORMAL_STRATEGY_REGISTRY[1];
  removeDefinitionTags(stock, definition);
  delete stock.oversold_electronics_rebound;
  const decision = oversoldElectronicsDecision(stock, context);
  if (!decision.matched) return false;

  stock.strategy_tags.unshift(OVERSOLD_ELECTRONICS_TAG);
  const metadata = {
    strategy_id: OVERSOLD_ELECTRONICS_STRATEGY_ID,
    label: OVERSOLD_ELECTRONICS_TAG,
    status: 'formal_label',
    fixed_display: true,
    changes_direction_score: false,
    environment_gate_required: false,
    market_readiness_score: finiteNumber(context.readiness?.score),
    market_readiness_status: context.readiness?.status || null,
    candidate_score: decision.candidate_score,
    criteria: [...OVERSOLD_ELECTRONICS_CRITERIA],
    metrics: {
      rsi14: decision.rsi14,
      r3: decision.r3,
      gap_sma20: decision.gap_sma20,
      volume_ratio_1d: finiteNumber(stock.features?.volume_ratio_1d),
      liquidity_median_traded_value_20d: round(decision.liquidity?.median_traded_value_20d),
      liquidity_threshold_value: round(decision.liquidity?.threshold_value),
    },
    risk_warnings: decision.risk_warnings,
  };
  stock.oversold_electronics_rebound = metadata;
  stock.formal_market_strategies = {
    ...(stock.formal_market_strategies || {}),
    [OVERSOLD_ELECTRONICS_STRATEGY_ID]: metadata,
  };
  return true;
}

function definitionFor(strategyId) {
  return FORMAL_STRATEGY_REGISTRY.find((item) => item.strategy_id === strategyId) || null;
}

function buildRegisteredStrategyClassification(definition, context, selected, generatedAt) {
  const stocks = Array.isArray(selected) ? selected : [];
  if (definition.strategy_id === STRATEGY_ID) {
    return buildFormalStrategyClassification(context.environment, stocks, generatedAt);
  }
  const available = context.liquidity?.available === true;
  return {
    label: definition.label,
    status: 'formal_label',
    calculation_status: available ? 'completed' : 'unable_to_calculate',
    calculation_message: available
      ? stocks.length ? `已完成計算，共 ${stocks.length} 筆。` : '已完成計算，當日 0 筆。'
      : '流動性資料不足，無法計算。',
    fixed_display: true,
    changes_direction_score: false,
    active: true,
    environment_gate_required: false,
    market_readiness_score: finiteNumber(context.readiness?.score),
    market_readiness_status: context.readiness?.status || null,
    count: available ? stocks.length : null,
    members: available ? stocks.map((stock) => stock.stock_code) : [],
    criteria: [...definition.criteria],
    generated_at: generatedAt,
    liquidity: {
      status: available ? 'completed' : 'unavailable',
      threshold_percentile: context.liquidity?.threshold_percentile ?? 30,
      threshold_value: context.liquidity?.threshold_value ?? null,
      valid_cross_section_count: context.liquidity?.valid_cross_section_count ?? 0,
      covered_stock_count: context.liquidity?.covered_stock_count ?? 0,
      total_stock_count: context.liquidity?.total_stock_count ?? 0,
    },
    data_warnings: [
      ...(context.liquidity?.warnings || []),
      '處置股資料未接入，無法完成此項排除。',
    ],
  };
}

function buildRegisteredStrategyGroup(definition, context, selected) {
  const stocks = Array.isArray(selected) ? selected : [];
  if (definition.strategy_id === STRATEGY_ID) return buildFormalStrategyGroup(context.environment, stocks);
  const available = context.liquidity?.available === true;
  const aggregate = available ? summarizeStocks(stocks) : emptySummaryAsUnavailable(summarizeStocks([]));
  const scores = stocks
    .map((stock) => finiteNumber(stock?.oversold_electronics_rebound?.candidate_score))
    .filter((value) => value !== null);
  return {
    group: definition.label,
    ...aggregate,
    formal_strategy: true,
    fixed_display: true,
    strategy_id: definition.strategy_id,
    active: true,
    calculation_status: available ? 'completed' : 'unable_to_calculate',
    calculation_message: available
      ? stocks.length ? `已完成計算，共 ${stocks.length} 筆。` : '已完成計算，當日 0 筆。'
      : '流動性資料不足，無法計算。',
    changes_direction_score: false,
    environment_gate_required: false,
    evaluation_target: definition.evaluation_target,
    candidate_score_average: scores.length ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length, 1) : null,
    market_readiness_score: finiteNumber(context.readiness?.score),
    market_readiness_status: context.readiness?.status || null,
    criteria: [...definition.criteria],
    members: available
      ? [...stocks]
        .sort((left, right) => (finiteNumber(right?.oversold_electronics_rebound?.candidate_score) ?? -Infinity)
          - (finiteNumber(left?.oversold_electronics_rebound?.candidate_score) ?? -Infinity))
        .map((stock) => stock.stock_code)
      : [],
    data_warnings: [
      ...(context.liquidity?.warnings || []),
      '處置股資料未接入，無法完成此項排除。',
    ],
  };
}

function applyFormalMarketStrategyTags({ rootDir = 'data_predictions', date, environment = null, dryRun = false } = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const predictionDir = path.join(ROOT, rootDir, compact);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const groupSummaryFile = path.join(predictionDir, 'group-summary.json');
  const environmentFile = path.join(ROOT, 'data_market_environment', compact, 'market_environment.json');
  const env = environment || readJson(environmentFile, null);
  let summary = readJson(summaryFile, null);
  if (!Array.isArray(summary?.stocks)) {
    return { date: compact, root_dir: rootDir, skipped: true, reason: 'missing_summary', tagged: 0 };
  }

  let readinessResult = null;
  if (rootDir === 'data_predictions') {
    try {
      readinessResult = generateOversoldBetaRebound({ rootDir, date: compact, environment: env, dryRun });
      if (!dryRun) summary = readJson(summaryFile, summary);
    } catch (error) {
      readinessResult = { skipped: true, reason: 'readiness_generation_failed', error: error.message };
    }
  }
  const readinessFile = path.join(ROOT, 'data_market_environment', compact, 'oversold_beta_rebound.json');
  const readiness = summary.market_rebound_readiness || readJson(readinessFile, null);
  const liquidity = loadLiquidityContext(summary.stocks, summary.base_trade_date);
  const context = { environment: env, readiness, liquidity };
  const selectedByStrategy = new Map(FORMAL_STRATEGY_REGISTRY.map((definition) => [definition.strategy_id, []]));

  for (const stock of summary.stocks) {
    if (!Array.isArray(stock.strategy_tags)) stock.strategy_tags = [];
    if (updateStockTag(stock, env)) selectedByStrategy.get(STRATEGY_ID).push(stock);
    if (updateOversoldElectronicsTag(stock, context)) {
      selectedByStrategy.get(OVERSOLD_ELECTRONICS_STRATEGY_ID).push(stock);
    }
    stock.strategy_tags = [...new Set(stock.strategy_tags)];
  }

  const generatedAt = new Date().toISOString();
  const formalStrategyClassifications = { ...(summary.formal_strategy_classifications || {}) };
  for (const definition of FORMAL_STRATEGY_REGISTRY) {
    delete formalStrategyClassifications[definition.strategy_id];
    for (const legacyId of definition.legacy_strategy_ids || []) delete formalStrategyClassifications[legacyId];
    formalStrategyClassifications[definition.strategy_id] = buildRegisteredStrategyClassification(
      definition,
      context,
      selectedByStrategy.get(definition.strategy_id),
      generatedAt,
    );
  }
  summary.formal_strategy_classifications = formalStrategyClassifications;
  summary.formal_strategy_registry = FORMAL_STRATEGY_REGISTRY.map((definition) => ({
    strategy_id: definition.strategy_id,
    label: definition.label,
    fixed_display: definition.fixed_display,
    changes_direction_score: definition.changes_direction_score,
    evaluation_target: definition.evaluation_target,
  }));

  const groupSummary = readJson(groupSummaryFile, {
    generated_at: summary.generated_at || generatedAt,
    forecast_date: summary.forecast_date,
    base_trade_date: summary.base_trade_date,
    groups: [],
  });
  const strategyTags = new Set(FORMAL_STRATEGY_REGISTRY.flatMap((definition) => [definition.label, ...(definition.legacy_labels || [])]));
  const strategyIds = new Set(FORMAL_STRATEGY_REGISTRY.flatMap((definition) => [definition.strategy_id, ...(definition.legacy_strategy_ids || [])]));
  const groups = (Array.isArray(groupSummary.groups) ? groupSummary.groups : [])
    .filter((group) => !strategyIds.has(group?.strategy_id) && !strategyTags.has(group?.group));
  for (const definition of FORMAL_STRATEGY_REGISTRY) {
    groups.push(buildRegisteredStrategyGroup(definition, context, selectedByStrategy.get(definition.strategy_id)));
  }
  groups.sort((left, right) => Number(right.count || 0) - Number(left.count || 0)
    || String(left.group).localeCompare(String(right.group), 'zh-Hant'));
  groupSummary.generated_at = generatedAt;
  groupSummary.forecast_date = summary.forecast_date;
  groupSummary.base_trade_date = summary.base_trade_date;
  groupSummary.groups = groups;

  if (!dryRun) {
    atomicWriteJson(summaryFile, summary);
    atomicWriteJson(groupSummaryFile, groupSummary);
  }

  const defensiveSelected = selectedByStrategy.get(STRATEGY_ID) || [];
  const oversoldSelected = selectedByStrategy.get(OVERSOLD_ELECTRONICS_STRATEGY_ID) || [];
  return {
    date: compact,
    root_dir: rootDir,
    skipped: false,
    environment_code: env?.environment?.code || null,
    tagged: defensiveSelected.length,
    members: defensiveSelected.map((stock) => stock.stock_code),
    strategies: {
      [STRATEGY_ID]: {
        count: defensiveSelected.length,
        members: defensiveSelected.map((stock) => stock.stock_code),
      },
      [OVERSOLD_ELECTRONICS_STRATEGY_ID]: {
        calculation_status: liquidity.available ? 'completed' : 'unable_to_calculate',
        count: liquidity.available ? oversoldSelected.length : null,
        members: liquidity.available ? oversoldSelected.map((stock) => stock.stock_code) : [],
      },
    },
    readiness: readinessResult,
    dry_run: dryRun,
  };
}

function parseCliArgs(argv) {
  const options = { date: '', rootDir: 'data_predictions', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--root') options.rootDir = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  const result = applyFormalMarketStrategyTags(options);
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  FORMAL_TAG,
  LEGACY_FORMAL_TAGS,
  STRATEGY_ID,
  LEGACY_STRATEGY_IDS,
  POST_SHOCK_CODES,
  FORMAL_CRITERIA,
  OVERSOLD_ELECTRONICS_STRATEGY_ID,
  OVERSOLD_ELECTRONICS_TAG,
  ELECTRONICS_INDUSTRIES,
  OVERSOLD_ELECTRONICS_CRITERIA,
  FORMAL_STRATEGY_REGISTRY,
  summarizeStocks,
  buildFormalStrategyClassification,
  buildFormalStrategyGroup,
  formalPostShockDecision,
  updateStockTag,
  percentile,
  median,
  loadLiquidityContext,
  oversoldCandidateScore,
  oversoldElectronicsDecision,
  updateOversoldElectronicsTag,
  definitionFor,
  buildRegisteredStrategyClassification,
  buildRegisteredStrategyGroup,
  applyFormalMarketStrategyTags,
  main,
};
