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

const STRATEGY_ID = 'bear_market_defensive_resilience_v1';
const LEGACY_STRATEGY_IDS = Object.freeze(['post_shock_high_confidence_core_v1']);
const STRATEGY_LABEL = '熊市時防禦抗跌股';
const LEGACY_STRATEGY_LABELS = Object.freeze(['衝擊後高信心核心']);

function normalizeStockCode(value) {
  return String(value ?? '').trim();
}

function isFormalStrategyCandidate(stock) {
  if ([STRATEGY_ID, ...LEGACY_STRATEGY_IDS].includes(stock?.formal_market_strategy?.strategy_id)) return true;
  if (!Array.isArray(stock?.strategy_tags)) return false;
  return [STRATEGY_LABEL, ...LEGACY_STRATEGY_LABELS]
    .some((label) => stock.strategy_tags.includes(label));
}

function isRelativeLeader(row) {
  return row?.market_relative?.classification === 'relative_leadership';
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function evaluateFormalStrategy(predictionStocks, replayRows) {
  const predictions = Array.isArray(predictionStocks) ? predictionStocks : [];
  const rows = Array.isArray(replayRows) ? replayRows : [];
  const candidates = predictions.filter(isFormalStrategyCandidate);
  const replayByCode = new Map();

  for (const row of rows) {
    const code = normalizeStockCode(row?.stock_code);
    if (code && row?.verified) replayByCode.set(code, row);
  }

  const stocks = candidates.map((stock) => {
    const stockCode = normalizeStockCode(stock?.stock_code);
    const replay = replayByCode.get(stockCode) || null;
    return {
      stock_code: stockCode,
      stock_name: stock?.stock_name || replay?.stock_name || null,
      verified: Boolean(replay),
      relative_leadership: replay ? isRelativeLeader(replay) : null,
      market_classification: replay?.market_relative?.classification || null,
      market_percentile: finiteNumber(replay?.market_relative?.market_percentile),
      confirmation_score: finiteNumber(stock?.formal_market_strategy?.confirmation_score),
      environment_code: stock?.formal_market_strategy?.environment_code || null,
    };
  });

  const verified = stocks.filter((stock) => stock.verified);
  const hits = verified.filter((stock) => stock.relative_leadership === true);

  return {
    strategy_id: STRATEGY_ID,
    label: STRATEGY_LABEL,
    status: 'formal_label',
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

function formalStrategyReplayGroup(evaluation, replayRows) {
  const memberCodes = new Set((evaluation?.members || []).map(normalizeStockCode));
  const rows = (Array.isArray(replayRows) ? replayRows : [])
    .filter((row) => row?.verified && memberCodes.has(normalizeStockCode(row?.stock_code)));
  const obviousHits = rows.filter((row) => row.prediction_match_label === '明顯準確').length;
  const obviousMisses = rows.filter((row) => row.prediction_match_label === '明顯不準').length;
  const accurate = rows.filter((row) => String(row.prediction_match_label || '').includes('準確')).length;
  const returns = rows.map((row) => finiteNumber(row?.actual?.close_return)).filter(Number.isFinite);
  return {
    name: STRATEGY_LABEL,
    count: rows.length,
    obvious_hit_count: obviousHits,
    obvious_miss_count: obviousMisses,
    hit_rate: rows.length ? round(accurate / rows.length * 100) : null,
    obvious_miss_rate: rows.length ? round(obviousMisses / rows.length * 100) : null,
    average_close_return: returns.length
      ? round(returns.reduce((sum, value) => sum + value, 0) / returns.length)
      : null,
    average_mood_score: null,
    formal_strategy: true,
    strategy_id: STRATEGY_ID,
    evaluation_target: evaluation?.evaluation_target || 'relative_leadership',
    relative_leadership_hits: evaluation?.hits || 0,
    relative_leadership_precision: evaluation?.precision ?? null,
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

function main() {
  const args = parseArgs();
  const date = compactDate(args.get('date'), 'date');
  const predictionDir = path.join(ROOT, 'data_predictions', date);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const replayDashboardFile = path.join(predictionDir, 'replay-dashboard.json');
  const replaySummaryFile = path.join(predictionDir, 'replay-summary.json');
  const actualEnvironmentFile = path.join(ROOT, 'data_market_environment', date, 'actual_market_environment.json');

  const summary = readJson(summaryFile, null);
  const replayDashboard = readJson(replayDashboardFile, null);
  const replaySummary = readJson(replaySummaryFile, null);

  if (!Array.isArray(summary?.stocks)) {
    throw new Error(`Missing prediction summary stocks: ${path.relative(ROOT, summaryFile)}`);
  }
  if (!Array.isArray(replayDashboard?.rows)) {
    throw new Error(`Missing replay dashboard rows: ${path.relative(ROOT, replayDashboardFile)}`);
  }
  if (!replaySummary) {
    throw new Error(`Missing replay summary: ${path.relative(ROOT, replaySummaryFile)}`);
  }

  const evaluation = evaluateFormalStrategy(summary.stocks, replayDashboard.rows);
  replaySummary.by_strategy_tag = upsertFormalStrategyReplayGroup(
    replaySummary.by_strategy_tag,
    evaluation,
    replayDashboard.rows,
  );
  syncReplayDashboardFormalTags(replayDashboard, evaluation);
  const generatedAt = new Date().toISOString();
  const output = {
    schemaVersion: 1,
    generated_at: generatedAt,
    replay_date: date,
    source_files: {
      prediction_summary: path.relative(ROOT, summaryFile).replaceAll(path.sep, '/'),
      replay_dashboard: path.relative(ROOT, replayDashboardFile).replaceAll(path.sep, '/'),
      replay_summary: path.relative(ROOT, replaySummaryFile).replaceAll(path.sep, '/'),
      actual_market_environment: fs.existsSync(actualEnvironmentFile)
        ? path.relative(ROOT, actualEnvironmentFile).replaceAll(path.sep, '/')
        : null,
    },
    formal_strategy_evaluation: evaluation,
    note: '正式策略標籤以預測時已寫入的 strategy_tags / formal_market_strategy 為準；覆盤只對照收盤後的相對領漲分類。',
  };

  const outputFile = path.join(ROOT, 'data_prediction_analysis', 'formal-strategy', `${date}.json`);
  atomicWriteJson(outputFile, output);

  replaySummary.formal_strategy_evaluation = {
    source_file: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
    ...evaluation,
  };
  atomicWriteJson(replaySummaryFile, replaySummary);
  atomicWriteJson(replayDashboardFile, replayDashboard);

  const actualEnvironment = readJson(actualEnvironmentFile, null);
  if (actualEnvironment) {
    actualEnvironment.formal_strategy_evaluation = {
      source_file: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
      ...evaluation,
    };
    atomicWriteJson(actualEnvironmentFile, actualEnvironment);
  }

  console.log(JSON.stringify({
    date,
    strategy_id: STRATEGY_ID,
    candidates: evaluation.candidates,
    verified_candidates: evaluation.verified_candidates,
    hits: evaluation.hits,
    precision: evaluation.precision,
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
  isFormalStrategyCandidate,
  evaluateFormalStrategy,
  formalStrategyReplayGroup,
  upsertFormalStrategyReplayGroup,
  syncReplayDashboardFormalTags,
  main,
};
