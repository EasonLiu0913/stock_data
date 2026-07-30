#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  parseArgs,
  compactDate,
  addDays,
  readJson,
  atomicWriteJson,
  round,
  environmentOutputDir,
  refreshEnvironmentIndexes,
  latestActualEnvironment,
} = require('./market_environment_lib');

function normalizeStockCode(value) {
  return String(value ?? '').trim();
}

function isRelativeLeader(row) {
  return row?.market_relative?.classification === 'relative_leadership';
}

function predictionFeatures(row) {
  return row?.features || row?.prediction?.features || {};
}

function candidateRule(row) {
  const features = predictionFeatures(row);
  const volume5 = Number(features.volume_ratio_5d);
  const rsi = Number(features.rsi14);
  return Number.isFinite(volume5) && volume5 >= 1.5 && Number.isFinite(rsi) && rsi >= 70;
}

function evaluateRelativeLeadershipShadow(predictionStocks, replayRows, disabled) {
  const predictions = Array.isArray(predictionStocks) ? predictionStocks : [];
  const rows = Array.isArray(replayRows) ? replayRows : [];
  const predictionByCode = new Map();
  for (const prediction of predictions) {
    const code = normalizeStockCode(prediction?.stock_code);
    if (code) predictionByCode.set(code, prediction);
  }

  const verifiedRows = rows.filter((row) => row?.verified);
  const verifiedReplayCodes = new Set();
  const matched = [];
  let replayWithoutPrediction = 0;

  for (const replay of verifiedRows) {
    const code = normalizeStockCode(replay?.stock_code);
    if (code) verifiedReplayCodes.add(code);
    const prediction = predictionByCode.get(code);
    if (!prediction) {
      replayWithoutPrediction += 1;
      continue;
    }
    matched.push({ code, prediction, replay });
  }

  const predictionWithoutVerifiedReplay = [...predictionByCode.keys()]
    .filter((code) => !verifiedReplayCodes.has(code)).length;
  const candidates = matched.filter((item) => candidateRule(item.prediction));
  const hits = candidates.filter((item) => isRelativeLeader(item.replay));
  const avoidedFalsePositives = disabled ? candidates.length - hits.length : 0;
  const suppressedTruePositives = disabled ? hits.length : 0;

  return {
    raw_candidates: candidates.length,
    raw_hits: hits.length,
    raw_precision: candidates.length ? round(hits.length / candidates.length * 100) : null,
    policy_candidates: disabled ? 0 : candidates.length,
    avoided_false_positives: avoidedFalsePositives,
    suppressed_true_positives: suppressedTruePositives,
    net_avoided_errors: avoidedFalsePositives - suppressedTruePositives,
    candidate_stocks: candidates.map((item) => ({
      stock_code: item.code,
      stock_name: item.prediction?.stock_name || item.replay?.stock_name || null,
      volume_ratio_5d: Number(item.prediction?.features?.volume_ratio_5d),
      rsi14: Number(item.prediction?.features?.rsi14),
      relative_leadership: isRelativeLeader(item.replay),
      market_percentile: Number.isFinite(Number(item.replay?.market_relative?.market_percentile))
        ? Number(item.replay.market_relative.market_percentile)
        : null,
    })),
    data_quality: {
      prediction_stock_count: predictions.length,
      verified_replay_rows: verifiedRows.length,
      matched_rows: matched.length,
      replay_without_prediction: replayWithoutPrediction,
      prediction_without_verified_replay: predictionWithoutVerifiedReplay,
    },
  };
}

function classifyActual(market, previousCode) {
  const downRatio = Number(market.down_ratio);
  const equalWeight = Number(market.equal_weight_market_return ?? market.average_return);
  const p90 = Number(market.p90_return);
  const systemic = downRatio >= 80 && equalWeight <= -2.5 && p90 <= 0.5;
  const stress = downRatio >= 70 && equalWeight <= -1.5;
  if (systemic && !['systemic_selloff_first_day', 'post_shock_stress'].includes(previousCode)) return 'systemic_selloff_first_day';
  if (systemic || (stress && ['systemic_selloff_first_day', 'post_shock_stress'].includes(previousCode))) return 'post_shock_stress';
  if (stress) return 'market_stress';
  return 'normal';
}

function predictedMatchesActual(predicted, actual) {
  if (predicted === 'shock_first_day_warning') return actual === 'systemic_selloff_first_day';
  if (predicted === 'post_shock_day_1' || predicted === 'post_shock_day_2') return actual === 'post_shock_stress' || actual === 'market_stress';
  if (predicted === 'risk_warning') return actual !== 'normal';
  if (predicted === 'normal') return actual === 'normal';
  return false;
}

function main() {
  const args = parseArgs();
  const date = compactDate(args.get('date'), 'date');
  const replayDir = path.join(ROOT, 'data_predictions', date);
  const replaySummaryFile = path.join(replayDir, 'replay-summary.json');
  const predictionSummaryFile = path.join(replayDir, 'summary.json');
  const dashboardFile = path.join(replayDir, 'replay-dashboard.json');
  const replaySummary = readJson(replaySummaryFile);
  const predictionSummary = readJson(predictionSummaryFile, null);
  const dashboard = readJson(dashboardFile, { rows: [] });
  if (!replaySummary?.market_breadth) throw new Error(`Missing replay market breadth: ${path.relative(ROOT, replaySummaryFile)}`);
  if (!Array.isArray(predictionSummary?.stocks) || predictionSummary.stocks.length === 0) {
    throw new Error(`Missing prediction-time stock features: ${path.relative(ROOT, predictionSummaryFile)}`);
  }

  const expectedPreviousDate = compactDate(replaySummary.base_trade_date || addDays(date, -1), 'base trade date');
  const latestPrevious = latestActualEnvironment(expectedPreviousDate);
  const previous = latestPrevious?.date === expectedPreviousDate ? latestPrevious : null;
  const previousCode = previous?.payload?.actual_environment?.code || null;
  const actualCode = classifyActual(replaySummary.market_breadth, previousCode);
  const labels = {
    normal: '一般環境',
    market_stress: '市場壓力',
    systemic_selloff_first_day: '首日系統性賣壓',
    post_shock_stress: '衝擊後壓力',
  };

  const predictedFile = path.join(ROOT, 'data_market_environment', date, 'market_environment.json');
  const predicted = readJson(predictedFile, null);
  const predictedCode = predicted?.environment?.code || null;
  const disabled = predicted?.strategy_policy?.relative_leadership_momentum === 'disabled_shadow';
  const shadowEvaluation = evaluateRelativeLeadershipShadow(predictionSummary.stocks, dashboard.rows, disabled);
  if (shadowEvaluation.data_quality.verified_replay_rows > 0 && shadowEvaluation.data_quality.matched_rows === 0) {
    throw new Error(`Prediction/replay stock-code join produced zero rows for ${date}`);
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 2,
    generated_at: generatedAt,
    replay_date: date,
    source_files: {
      prediction_summary: path.relative(ROOT, predictionSummaryFile).replaceAll(path.sep, '/'),
      replay_summary: path.relative(ROOT, replaySummaryFile).replaceAll(path.sep, '/'),
      replay_dashboard: path.relative(ROOT, dashboardFile).replaceAll(path.sep, '/'),
      predicted_environment: fs.existsSync(predictedFile) ? path.relative(ROOT, predictedFile).replaceAll(path.sep, '/') : null,
      previous_actual_environment: previous ? path.relative(ROOT, previous.file).replaceAll(path.sep, '/') : null,
    },
    actual_environment: {
      code: actualCode,
      label: labels[actualCode],
      rules: {
        systemic_selloff_first_day: 'down_ratio >= 80 && equal_weight_return <= -2.5 && p90_return <= 0.5',
        market_stress: 'down_ratio >= 70 && equal_weight_return <= -1.5',
      },
      metrics: {
        sample_count: replaySummary.market_breadth.sample_count,
        up_ratio: round(replaySummary.market_breadth.up_ratio),
        down_ratio: round(replaySummary.market_breadth.down_ratio),
        equal_weight_market_return: round(replaySummary.market_breadth.equal_weight_market_return ?? replaySummary.market_breadth.average_return),
        weighted_index_return: round(replaySummary.market_breadth.weighted_index_return),
        p90_return: round(replaySummary.market_breadth.p90_return),
      },
    },
    prediction_evaluation: {
      predicted_environment: predictedCode,
      actual_environment: actualCode,
      match: predictedCode ? predictedMatchesActual(predictedCode, actualCode) : null,
      snapshot_hash: predicted?.snapshot_hash || null,
    },
    relative_leadership_shadow_policy: {
      rule: 'volume_ratio_5d >= 1.5 && rsi14 >= 70',
      policy_state: predicted?.strategy_policy?.relative_leadership_momentum || null,
      ...shadowEvaluation,
      note: '事前特徵取自 summary.json，實際相對領漲結果取自 replay-dashboard.json；Shadow mode 未改動正式清單。',
    },
  };

  const outputDir = environmentOutputDir(date);
  const outputFile = path.join(outputDir, 'actual_market_environment.json');
  atomicWriteJson(outputFile, payload);
  refreshEnvironmentIndexes(generatedAt);

  replaySummary.market_environment_evaluation = {
    source_file: `data_market_environment/${date}/actual_market_environment.json`,
    predicted_environment: predictedCode,
    actual_environment: actualCode,
    match: payload.prediction_evaluation.match,
    relative_leadership_shadow_policy: payload.relative_leadership_shadow_policy,
  };
  atomicWriteJson(replaySummaryFile, replaySummary);

  console.log(JSON.stringify({
    date,
    predicted: predictedCode,
    actual: actualCode,
    match: payload.prediction_evaluation.match,
    raw_candidates: shadowEvaluation.raw_candidates,
    raw_hits: shadowEvaluation.raw_hits,
    matched_rows: shadowEvaluation.data_quality.matched_rows,
    output: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
  }));
}

if (require.main === module) main();

module.exports = {
  main,
  classifyActual,
  predictedMatchesActual,
  candidateRule,
  evaluateRelativeLeadershipShadow,
};
