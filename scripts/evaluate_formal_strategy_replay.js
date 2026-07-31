#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  parseArgs,
  compactDate,
  readJson,
  atomicWriteJson,
  round,
} = require('./market_environment_lib');
const {
  STRATEGY_ID,
  LEGACY_STRATEGY_IDS,
  FORMAL_TAG: STRATEGY_LABEL,
  LEGACY_FORMAL_TAGS: LEGACY_STRATEGY_LABELS,
  OVERSOLD_ELECTRONICS_STRATEGY_ID,
  OVERSOLD_ELECTRONICS_TAG,
  FORMAL_STRATEGY_REGISTRY,
} = require('./apply_formal_market_strategy_tags');
const {
  READINESS_ID,
  READINESS_LABEL,
} = require('./oversold_beta_rebound');

function normalizeStockCode(value) {
  return String(value ?? '').trim();
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function median(values) {
  const valid = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

function definitionFor(strategyId) {
  return FORMAL_STRATEGY_REGISTRY.find((definition) => definition.strategy_id === strategyId) || null;
}

function isStrategyCandidate(stock, definition) {
  if (!stock || !definition) return false;
  const ids = [definition.strategy_id, ...(definition.legacy_strategy_ids || [])];
  const labels = [definition.label, ...(definition.legacy_labels || [])];
  if (ids.includes(stock?.formal_market_strategy?.strategy_id)) return true;
  if (ids.some((strategyId) => Boolean(stock?.formal_market_strategies?.[strategyId]))) return true;
  return Array.isArray(stock.strategy_tags) && labels.some((label) => stock.strategy_tags.includes(label));
}

function isFormalStrategyCandidate(stock) {
  return isStrategyCandidate(stock, definitionFor(STRATEGY_ID));
}

function isRelativeLeader(row) {
  return row?.market_relative?.classification === 'relative_leadership';
}

function replayReturn(row) {
  return finiteNumber(row?.actual?.close_return);
}

function marketReturnFromActualEnvironment(actualEnvironment) {
  return finiteNumber(actualEnvironment?.actual_environment?.metrics?.equal_weight_market_return);
}

function candidateMetadata(stock, strategyId) {
  return stock?.formal_market_strategies?.[strategyId]
    || (stock?.formal_market_strategy?.strategy_id === strategyId ? stock.formal_market_strategy : null)
    || null;
}

function evaluateFormalStrategy(predictionStocks, replayRows) {
  const definition = definitionFor(STRATEGY_ID);
  const predictions = Array.isArray(predictionStocks) ? predictionStocks : [];
  const rows = Array.isArray(replayRows) ? replayRows : [];
  const candidates = predictions.filter((stock) => isStrategyCandidate(stock, definition));
  const replayByCode = new Map();

  for (const row of rows) {
    const code = normalizeStockCode(row?.stock_code);
    if (code && row?.verified) replayByCode.set(code, row);
  }

  const stocks = candidates.map((stock) => {
    const stockCode = normalizeStockCode(stock?.stock_code);
    const replay = replayByCode.get(stockCode) || null;
    const metadata = candidateMetadata(stock, STRATEGY_ID);
    return {
      stock_code: stockCode,
      stock_name: stock?.stock_name || replay?.stock_name || null,
      verified: Boolean(replay),
      relative_leadership: replay ? isRelativeLeader(replay) : null,
      market_classification: replay?.market_relative?.classification || null,
      market_percentile: finiteNumber(replay?.market_relative?.market_percentile),
      confirmation_score: finiteNumber(metadata?.confirmation_score),
      environment_code: metadata?.environment_code || null,
    };
  });

  const verified = stocks.filter((stock) => stock.verified);
  const hits = verified.filter((stock) => stock.relative_leadership === true);

  return {
    strategy_id: STRATEGY_ID,
    label: STRATEGY_LABEL,
    status: 'formal_label',
    calculation_status: 'completed',
    changes_direction_score: false,
    evaluation_target: 'relative_leadership',
    candidates: candidates.length,
    verified_candidates: verified.length,
    hits: hits.length,
    precision: verified.length ? round(hits.length / verified.length * 100) : null,
    missing_replay_candidates: candidates.length - verified.length,
    members: stocks.map((stock) => stock.stock_code),
    hit_members: hits.map((stock) => stock.stock_code),
    stocks,
  };
}

function evaluateOversoldElectronicsStrategy(predictionStocks, replayRows, actualEnvironment = null) {
  const definition = definitionFor(OVERSOLD_ELECTRONICS_STRATEGY_ID);
  const predictions = Array.isArray(predictionStocks) ? predictionStocks : [];
  const rows = Array.isArray(replayRows) ? replayRows : [];
  const classification = predictions.length
    ? null
    : null;
  const candidates = predictions.filter((stock) => isStrategyCandidate(stock, definition));
  const replayByCode = new Map();
  for (const row of rows) {
    const code = normalizeStockCode(row?.stock_code);
    if (code && row?.verified) replayByCode.set(code, row);
  }
  const marketReturn = marketReturnFromActualEnvironment(actualEnvironment);
  const stocks = candidates.map((stock) => {
    const stockCode = normalizeStockCode(stock?.stock_code);
    const replay = replayByCode.get(stockCode) || null;
    const closeReturn = replayReturn(replay);
    const metadata = candidateMetadata(stock, OVERSOLD_ELECTRONICS_STRATEGY_ID);
    return {
      stock_code: stockCode,
      stock_name: stock?.stock_name || replay?.stock_name || null,
      verified: Boolean(replay && Number.isFinite(closeReturn)),
      close_return: closeReturn,
      hit: Number.isFinite(closeReturn) ? closeReturn > 5 : null,
      market_equal_weight_return: marketReturn,
      market_excess_return: Number.isFinite(closeReturn) && Number.isFinite(marketReturn)
        ? round(closeReturn - marketReturn)
        : null,
      candidate_score: finiteNumber(metadata?.candidate_score),
      risk_warnings: metadata?.risk_warnings || [],
      industry: stock?.industry || null,
    };
  });
  const verified = stocks.filter((stock) => stock.verified);
  const hits = verified.filter((stock) => stock.hit === true);
  const misses = verified.filter((stock) => stock.hit === false);
  const returns = verified.map((stock) => stock.close_return);
  const excessReturns = verified.map((stock) => stock.market_excess_return);

  return {
    strategy_id: OVERSOLD_ELECTRONICS_STRATEGY_ID,
    label: OVERSOLD_ELECTRONICS_TAG,
    status: 'formal_label',
    calculation_status: 'completed',
    changes_direction_score: false,
    evaluation_target: 'close_return_gt_5',
    hit_rule: '當日收盤報酬嚴格大於 5.00%',
    candidates: candidates.length,
    verified_candidates: verified.length,
    hits: hits.length,
    hit_rate: verified.length ? round(hits.length / verified.length * 100) : null,
    precision: verified.length ? round(hits.length / verified.length * 100) : null,
    missing_replay_candidates: candidates.length - verified.length,
    average_return: round(average(returns)),
    median_return: round(median(returns)),
    average_market_excess_return: round(average(excessReturns)),
    members: stocks.map((stock) => stock.stock_code),
    hit_members: hits.map((stock) => stock.stock_code),
    miss_members: misses.map((stock) => stock.stock_code),
    hit_stocks: hits,
    miss_stocks: misses,
    stocks,
  };
}

function formalStrategyReplayGroup(evaluation, replayRows) {
  const memberCodes = new Set((evaluation?.members || []).map(normalizeStockCode));
  const rows = (Array.isArray(replayRows) ? replayRows : [])
    .filter((row) => row?.verified && memberCodes.has(normalizeStockCode(row?.stock_code)));
  const obviousHits = rows.filter((row) => row.prediction_match_label === '明顯準確').length;
  const obviousMisses = rows.filter((row) => row.prediction_match_label === '明顯不準').length;
  const accurate = rows.filter((row) => String(row.prediction_match_label || '').includes('準確')).length;
  const returns = rows.map((row) => replayReturn(row)).filter(Number.isFinite);
  return {
    name: STRATEGY_LABEL,
    count: rows.length,
    obvious_hit_count: obviousHits,
    obvious_miss_count: obviousMisses,
    hit_rate: rows.length ? round(accurate / rows.length * 100) : null,
    obvious_miss_rate: rows.length ? round(obviousMisses / rows.length * 100) : null,
    average_close_return: returns.length ? round(average(returns)) : null,
    average_mood_score: null,
    formal_strategy: true,
    fixed_display: true,
    strategy_id: STRATEGY_ID,
    evaluation_target: evaluation?.evaluation_target || 'relative_leadership',
    relative_leadership_hits: evaluation?.hits || 0,
    relative_leadership_precision: evaluation?.precision ?? null,
  };
}

function oversoldElectronicsReplayGroup(evaluation) {
  return {
    name: OVERSOLD_ELECTRONICS_TAG,
    count: evaluation?.verified_candidates || 0,
    candidate_count: evaluation?.candidates ?? null,
    verified_candidate_count: evaluation?.verified_candidates || 0,
    hit_count: evaluation?.hits || 0,
    hit_rate: evaluation?.hit_rate ?? null,
    average_close_return: evaluation?.average_return ?? null,
    median_close_return: evaluation?.median_return ?? null,
    average_market_excess_return: evaluation?.average_market_excess_return ?? null,
    formal_strategy: true,
    fixed_display: true,
    strategy_id: OVERSOLD_ELECTRONICS_STRATEGY_ID,
    evaluation_target: 'close_return_gt_5',
    hit_rule: '當日收盤報酬嚴格大於 5.00%',
    hit_members: evaluation?.hit_members || [],
    miss_members: evaluation?.miss_members || [],
  };
}

function upsertFormalStrategyReplayGroup(groups, evaluation, replayRows) {
  const strategyLabels = new Set([STRATEGY_LABEL, ...LEGACY_STRATEGY_LABELS]);
  const strategyIds = new Set([STRATEGY_ID, ...LEGACY_STRATEGY_IDS]);
  const output = (Array.isArray(groups) ? groups : [])
    .filter((group) => !strategyIds.has(group?.strategy_id) && !strategyLabels.has(group?.name));
  output.push(formalStrategyReplayGroup(evaluation, replayRows));
  output.sort((left, right) => Number(right.count || 0) - Number(left.count || 0)
    || String(left.name).localeCompare(String(right.name), 'zh-Hant'));
  return output;
}

function upsertRegisteredStrategyReplayGroups(groups, evaluations, replayRows) {
  const registeredIds = new Set(FORMAL_STRATEGY_REGISTRY.flatMap((definition) => [definition.strategy_id, ...(definition.legacy_strategy_ids || [])]));
  const registeredLabels = new Set(FORMAL_STRATEGY_REGISTRY.flatMap((definition) => [definition.label, ...(definition.legacy_labels || [])]));
  const output = (Array.isArray(groups) ? groups : [])
    .filter((group) => !registeredIds.has(group?.strategy_id) && !registeredLabels.has(group?.name));
  output.push(formalStrategyReplayGroup(evaluations[STRATEGY_ID], replayRows));
  output.push(oversoldElectronicsReplayGroup(evaluations[OVERSOLD_ELECTRONICS_STRATEGY_ID]));
  output.sort((left, right) => Number(right.count || 0) - Number(left.count || 0)
    || String(left.name).localeCompare(String(right.name), 'zh-Hant'));
  return output;
}

function syncReplayDashboardFormalTags(replayDashboard, evaluation) {
  const memberCodes = new Set((evaluation?.members || []).map(normalizeStockCode));
  const strategyLabels = new Set([STRATEGY_LABEL, ...LEGACY_STRATEGY_LABELS]);
  for (const row of replayDashboard?.rows || []) {
    if (!row?.prediction) continue;
    const tags = (Array.isArray(row.prediction.strategy_tags) ? row.prediction.strategy_tags : [])
      .filter((tag) => !strategyLabels.has(tag));
    if (memberCodes.has(normalizeStockCode(row.stock_code))) tags.unshift(STRATEGY_LABEL);
    row.prediction.strategy_tags = tags;
  }
  return replayDashboard;
}

function syncReplayDashboardRegisteredTags(replayDashboard, evaluations) {
  const allLabels = new Set(FORMAL_STRATEGY_REGISTRY.flatMap((definition) => [definition.label, ...(definition.legacy_labels || [])]));
  const membersByStrategy = new Map(FORMAL_STRATEGY_REGISTRY.map((definition) => [
    definition.strategy_id,
    new Set((evaluations[definition.strategy_id]?.members || []).map(normalizeStockCode)),
  ]));
  for (const row of replayDashboard?.rows || []) {
    if (!row?.prediction) continue;
    const code = normalizeStockCode(row.stock_code);
    const tags = (Array.isArray(row.prediction.strategy_tags) ? row.prediction.strategy_tags : [])
      .filter((tag) => !allLabels.has(tag));
    for (const definition of [...FORMAL_STRATEGY_REGISTRY].reverse()) {
      if (membersByStrategy.get(definition.strategy_id)?.has(code)) tags.unshift(definition.label);
    }
    row.prediction.strategy_tags = [...new Set(tags)];
  }
  return replayDashboard;
}

function evaluateMarketReboundReadiness(readiness, actualEnvironment) {
  const equalWeightReturn = finiteNumber(actualEnvironment?.actual_environment?.metrics?.equal_weight_market_return);
  const upRatio = finiteNumber(actualEnvironment?.actual_environment?.metrics?.up_ratio);
  const verified = Number.isFinite(equalWeightReturn) && Number.isFinite(upRatio);
  const hit = verified ? equalWeightReturn >= 2 && upRatio >= 65 : null;
  return {
    strategy_id: READINESS_ID,
    label: READINESS_LABEL,
    score: finiteNumber(readiness?.score),
    status: readiness?.status || null,
    effective_data_weight: finiteNumber(readiness?.effective_data_weight),
    probability: readiness?.probability || null,
    verified,
    market_rebound_day: hit,
    actual_equal_weight_return: equalWeightReturn,
    actual_advancing_issue_ratio: upRatio,
    rule: '次日全市場等權重報酬 >= +2% 且上漲家數比例 >= 65%',
  };
}

function main() {
  const args = parseArgs();
  const date = compactDate(args.get('date'), 'date');
  const predictionDir = path.join(ROOT, 'data_predictions', date);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const replayDashboardFile = path.join(predictionDir, 'replay-dashboard.json');
  const replaySummaryFile = path.join(predictionDir, 'replay-summary.json');
  const actualEnvironmentFile = path.join(ROOT, 'data_market_environment', date, 'actual_market_environment.json');
  const readinessFile = path.join(ROOT, 'data_market_environment', date, 'oversold_beta_rebound.json');

  const summary = readJson(summaryFile, null);
  const replayDashboard = readJson(replayDashboardFile, null);
  const replaySummary = readJson(replaySummaryFile, null);
  const actualEnvironment = readJson(actualEnvironmentFile, null);
  const readiness = readJson(readinessFile, summary?.market_rebound_readiness || null);

  if (!Array.isArray(summary?.stocks)) throw new Error(`Missing prediction summary stocks: ${path.relative(ROOT, summaryFile)}`);
  if (!Array.isArray(replayDashboard?.rows)) throw new Error(`Missing replay dashboard rows: ${path.relative(ROOT, replayDashboardFile)}`);
  if (!replaySummary) throw new Error(`Missing replay summary: ${path.relative(ROOT, replaySummaryFile)}`);

  const evaluations = {
    [STRATEGY_ID]: evaluateFormalStrategy(summary.stocks, replayDashboard.rows),
    [OVERSOLD_ELECTRONICS_STRATEGY_ID]: evaluateOversoldElectronicsStrategy(summary.stocks, replayDashboard.rows, actualEnvironment),
  };
  replaySummary.by_strategy_tag = upsertRegisteredStrategyReplayGroups(
    replaySummary.by_strategy_tag,
    evaluations,
    replayDashboard.rows,
  );
  syncReplayDashboardRegisteredTags(replayDashboard, evaluations);

  const generatedAt = new Date().toISOString();
  const readinessEvaluation = evaluateMarketReboundReadiness(readiness, actualEnvironment);
  const output = {
    schemaVersion: 2,
    generated_at: generatedAt,
    replay_date: date,
    source_files: {
      prediction_summary: path.relative(ROOT, summaryFile).replaceAll(path.sep, '/'),
      replay_dashboard: path.relative(ROOT, replayDashboardFile).replaceAll(path.sep, '/'),
      replay_summary: path.relative(ROOT, replaySummaryFile).replaceAll(path.sep, '/'),
      actual_market_environment: fs.existsSync(actualEnvironmentFile)
        ? path.relative(ROOT, actualEnvironmentFile).replaceAll(path.sep, '/')
        : null,
      oversold_beta_rebound: fs.existsSync(readinessFile)
        ? path.relative(ROOT, readinessFile).replaceAll(path.sep, '/')
        : null,
    },
    formal_strategy_evaluation: evaluations[STRATEGY_ID],
    formal_strategy_evaluations: evaluations,
    market_rebound_readiness_evaluation: readinessEvaluation,
    note: '所有個股候選資格均以預測時已寫入的 strategy_tags / formal_market_strategies 為準；覆盤不使用當日收盤資料重新篩選。',
  };

  const outputFile = path.join(ROOT, 'data_prediction_analysis', 'formal-strategy', `${date}.json`);
  const readinessOutputFile = path.join(ROOT, 'data_prediction_analysis', 'oversold-beta-rebound', `${date}.json`);
  atomicWriteJson(outputFile, output);
  atomicWriteJson(readinessOutputFile, {
    schemaVersion: 1,
    generated_at: generatedAt,
    replay_date: date,
    score: readinessEvaluation.score,
    status: readinessEvaluation.status,
    effective_data_weight: readinessEvaluation.effective_data_weight,
    market_rebound_day: readinessEvaluation.market_rebound_day,
    actual_equal_weight_return: readinessEvaluation.actual_equal_weight_return,
    actual_advancing_issue_ratio: readinessEvaluation.actual_advancing_issue_ratio,
    rule: readinessEvaluation.rule,
    source_files: output.source_files,
  });

  replaySummary.formal_strategy_evaluation = {
    source_file: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
    ...evaluations[STRATEGY_ID],
  };
  replaySummary.formal_strategy_evaluations = Object.fromEntries(Object.entries(evaluations).map(([strategyId, evaluation]) => [
    strategyId,
    { source_file: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'), ...evaluation },
  ]));
  replaySummary.market_rebound_readiness_evaluation = {
    source_file: path.relative(ROOT, readinessOutputFile).replaceAll(path.sep, '/'),
    ...readinessEvaluation,
  };
  atomicWriteJson(replaySummaryFile, replaySummary);
  atomicWriteJson(replayDashboardFile, replayDashboard);

  if (actualEnvironment) {
    actualEnvironment.formal_strategy_evaluation = {
      source_file: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
      ...evaluations[STRATEGY_ID],
    };
    actualEnvironment.formal_strategy_evaluations = evaluations;
    actualEnvironment.market_rebound_readiness_evaluation = {
      source_file: path.relative(ROOT, readinessOutputFile).replaceAll(path.sep, '/'),
      ...readinessEvaluation,
    };
    atomicWriteJson(actualEnvironmentFile, actualEnvironment);
  }

  console.log(JSON.stringify({
    date,
    strategies: Object.fromEntries(Object.entries(evaluations).map(([strategyId, evaluation]) => [strategyId, {
      candidates: evaluation.candidates,
      verified_candidates: evaluation.verified_candidates,
      hits: evaluation.hits,
      precision: evaluation.precision,
    }])),
    market_rebound_day: readinessEvaluation.market_rebound_day,
    output: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
  }));
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
  STRATEGY_ID,
  LEGACY_STRATEGY_IDS,
  STRATEGY_LABEL,
  LEGACY_STRATEGY_LABELS,
  normalizeStockCode,
  finiteNumber,
  median,
  isFormalStrategyCandidate,
  isStrategyCandidate,
  evaluateFormalStrategy,
  evaluateOversoldElectronicsStrategy,
  formalStrategyReplayGroup,
  oversoldElectronicsReplayGroup,
  upsertFormalStrategyReplayGroup,
  upsertRegisteredStrategyReplayGroups,
  syncReplayDashboardFormalTags,
  syncReplayDashboardRegisteredTags,
  evaluateMarketReboundReadiness,
  main,
};
