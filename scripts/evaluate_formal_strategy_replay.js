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

const STRATEGY_ID = 'post_shock_high_confidence_core_v1';
const STRATEGY_LABEL = '衝擊後高信心核心';

function normalizeStockCode(value) {
  return String(value ?? '').trim();
}

function isFormalStrategyCandidate(stock) {
  if (stock?.formal_market_strategy?.strategy_id === STRATEGY_ID) return true;
  return Array.isArray(stock?.strategy_tags) && stock.strategy_tags.includes(STRATEGY_LABEL);
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
  STRATEGY_LABEL,
  normalizeStockCode,
  isFormalStrategyCandidate,
  evaluateFormalStrategy,
  main,
};
