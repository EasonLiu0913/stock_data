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

function isRelativeLeader(row) {
  return row?.market_relative?.classification === 'relative_leadership';
}

function predictionFeatures(row) {
  return row?.prediction || {};
}

function candidateRule(row) {
  const prediction = predictionFeatures(row);
  const volume5 = Number(prediction?.features?.volume_ratio_5d);
  const rsi = Number(prediction?.features?.rsi14);
  return Number.isFinite(volume5) && volume5 >= 1.5 && Number.isFinite(rsi) && rsi >= 70;
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
  const summaryFile = path.join(replayDir, 'replay-summary.json');
  const dashboardFile = path.join(replayDir, 'replay-dashboard.json');
  const summary = readJson(summaryFile);
  const dashboard = readJson(dashboardFile, { rows: [] });
  if (!summary?.market_breadth) throw new Error(`Missing replay market breadth: ${path.relative(ROOT, summaryFile)}`);

  const expectedPreviousDate = compactDate(summary.base_trade_date || addDays(date, -1), 'base trade date');
  const latestPrevious = latestActualEnvironment(expectedPreviousDate);
  const previous = latestPrevious?.date === expectedPreviousDate ? latestPrevious : null;
  const previousCode = previous?.payload?.actual_environment?.code || null;
  const actualCode = classifyActual(summary.market_breadth, previousCode);
  const labels = {
    normal: '一般環境',
    market_stress: '市場壓力',
    systemic_selloff_first_day: '首日系統性賣壓',
    post_shock_stress: '衝擊後壓力',
  };

  const predictedFile = path.join(ROOT, 'data_market_environment', date, 'market_environment.json');
  const predicted = readJson(predictedFile, null);
  const predictedCode = predicted?.environment?.code || null;
  const rows = (dashboard.rows || []).filter((row) => row.verified);
  const candidates = rows.filter(candidateRule);
  const hits = candidates.filter(isRelativeLeader);
  const disabled = predicted?.strategy_policy?.relative_leadership_momentum === 'disabled_shadow';
  const policyCandidates = disabled ? [] : candidates;

  const generatedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    generated_at: generatedAt,
    replay_date: date,
    source_files: {
      replay_summary: path.relative(ROOT, summaryFile).replaceAll(path.sep, '/'),
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
        sample_count: summary.market_breadth.sample_count,
        up_ratio: round(summary.market_breadth.up_ratio),
        down_ratio: round(summary.market_breadth.down_ratio),
        equal_weight_market_return: round(summary.market_breadth.equal_weight_market_return ?? summary.market_breadth.average_return),
        weighted_index_return: round(summary.market_breadth.weighted_index_return),
        p90_return: round(summary.market_breadth.p90_return),
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
      raw_candidates: candidates.length,
      raw_hits: hits.length,
      raw_precision: candidates.length ? round(hits.length / candidates.length * 100) : null,
      policy_state: predicted?.strategy_policy?.relative_leadership_momentum || null,
      policy_candidates: policyCandidates.length,
      avoided_false_positives: disabled ? candidates.length - hits.length : 0,
      suppressed_true_positives: disabled ? hits.length : 0,
      note: 'Shadow mode 僅比較政策效果，未改動正式清單。',
    },
  };

  const outputDir = environmentOutputDir(date);
  const outputFile = path.join(outputDir, 'actual_market_environment.json');
  atomicWriteJson(outputFile, payload);
  refreshEnvironmentIndexes(generatedAt);

  summary.market_environment_evaluation = {
    source_file: `data_market_environment/${date}/actual_market_environment.json`,
    predicted_environment: predictedCode,
    actual_environment: actualCode,
    match: payload.prediction_evaluation.match,
    relative_leadership_shadow_policy: payload.relative_leadership_shadow_policy,
  };
  atomicWriteJson(summaryFile, summary);

  console.log(JSON.stringify({
    date,
    predicted: predictedCode,
    actual: actualCode,
    match: payload.prediction_evaluation.match,
    raw_candidates: candidates.length,
    raw_hits: hits.length,
    output: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
  }));
}

if (require.main === module) main();

module.exports = { main, classifyActual, predictedMatchesActual, candidateRule };
