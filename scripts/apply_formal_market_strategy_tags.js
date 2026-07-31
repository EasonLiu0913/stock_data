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

function compactDate(value) {
  const date = String(value || '').replaceAll('-', '').replaceAll('/', '');
  return /^20\d{6}$/.test(date) ? date : '';
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

function buildFormalStrategyClassification(environment, selected, generatedAt) {
  const stocks = Array.isArray(selected) ? selected : [];
  const environmentCode = environment?.environment?.code || null;
  return {
    label: FORMAL_TAG,
    status: 'formal_label',
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
    strategy_id: STRATEGY_ID,
    environment_code: environmentCode,
    active: POST_SHOCK_CODES.has(environmentCode),
    changes_direction_score: false,
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

function updateStockTag(stock, environment) {
  const existingTags = Array.isArray(stock.strategy_tags) ? stock.strategy_tags : [];
  const strategyTags = new Set([FORMAL_TAG, ...LEGACY_FORMAL_TAGS]);
  stock.strategy_tags = [...new Set(existingTags.filter((tag) => !strategyTags.has(tag)))];
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
  return true;
}

function applyFormalMarketStrategyTags({ rootDir = 'data_predictions', date, environment = null, dryRun = false } = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const predictionDir = path.join(ROOT, rootDir, compact);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const groupSummaryFile = path.join(predictionDir, 'group-summary.json');
  const environmentFile = path.join(ROOT, 'data_market_environment', compact, 'market_environment.json');
  const env = environment || readJson(environmentFile, null);
  const summary = readJson(summaryFile, null);
  if (!env || !Array.isArray(summary?.stocks)) {
    return { date: compact, root_dir: rootDir, skipped: true, reason: !env ? 'missing_environment' : 'missing_summary', tagged: 0 };
  }

  const selected = [];
  for (const stock of summary.stocks) {
    if (updateStockTag(stock, env)) selected.push(stock);
  }

  const generatedAt = new Date().toISOString();
  const formalStrategyClassifications = { ...(summary.formal_strategy_classifications || {}) };
  for (const legacyId of LEGACY_STRATEGY_IDS) delete formalStrategyClassifications[legacyId];
  formalStrategyClassifications[STRATEGY_ID] = buildFormalStrategyClassification(env, selected, generatedAt);
  summary.formal_strategy_classifications = formalStrategyClassifications;

  const groupSummary = readJson(groupSummaryFile, {
    generated_at: summary.generated_at || generatedAt,
    forecast_date: summary.forecast_date,
    base_trade_date: summary.base_trade_date,
    groups: [],
  });
  const strategyTags = new Set([FORMAL_TAG, ...LEGACY_FORMAL_TAGS]);
  const strategyIds = new Set([STRATEGY_ID, ...LEGACY_STRATEGY_IDS]);
  const groups = (Array.isArray(groupSummary.groups) ? groupSummary.groups : [])
    .filter((group) => !strategyIds.has(group?.strategy_id) && !strategyTags.has(group?.group));
  groups.push(buildFormalStrategyGroup(env, selected));
  groups.sort((left, right) => Number(right.count || 0) - Number(left.count || 0) || String(left.group).localeCompare(String(right.group), 'zh-Hant'));
  groupSummary.generated_at = generatedAt;
  groupSummary.forecast_date = summary.forecast_date;
  groupSummary.base_trade_date = summary.base_trade_date;
  groupSummary.groups = groups;

  if (!dryRun) {
    atomicWriteJson(summaryFile, summary);
    atomicWriteJson(groupSummaryFile, groupSummary);
  }

  return {
    date: compact,
    root_dir: rootDir,
    skipped: false,
    environment_code: env.environment?.code || null,
    tagged: selected.length,
    members: selected.map((stock) => stock.stock_code),
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
  summarizeStocks,
  buildFormalStrategyClassification,
  buildFormalStrategyGroup,
  formalPostShockDecision,
  updateStockTag,
  applyFormalMarketStrategyTags,
  main,
};
