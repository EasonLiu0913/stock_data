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

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function candidateRule(row) {
  const features = predictionFeatures(row);
  const volume5 = finiteNumber(features.volume_ratio_5d);
  const rsi = finiteNumber(features.rsi14);
  return volume5 !== null && volume5 >= 1.5 && rsi !== null && rsi >= 70;
}

function confirmationProfile(row) {
  const features = predictionFeatures(row);
  const volume5 = finiteNumber(features.volume_ratio_5d);
  const rsi = finiteNumber(features.rsi14);
  const r1 = finiteNumber(features.r1);
  const gapSma20 = finiteNumber(features.gap_sma20);
  const relativeStrength7d = finiteNumber(
    row?.relative_strength_7d?.relative_strength_7d
      ?? features.relative_strength_7d
      ?? features.relative_strength,
  );
  const chipBullish = String(row?.chip_bias || '').includes('偏多');
  const directionBullish = String(row?.final_direction_label || row?.raw_direction_label || '').includes('偏多');
  const breakoutMatched = row?.breakout_precursor?.matched === true;

  const signals = {
    volume_ratio_5d_at_least_2: volume5 !== null && volume5 >= 2,
    rsi14_at_least_75: rsi !== null && rsi >= 75,
    relative_strength_7d_at_least_8: relativeStrength7d !== null && relativeStrength7d >= 8,
    previous_day_non_negative: r1 !== null && r1 >= 0,
    gap_sma20_at_most_10: gapSma20 !== null && gapSma20 <= 10,
    chip_bias_bullish: chipBullish,
    predicted_direction_bullish: directionBullish,
    breakout_precursor: breakoutMatched,
  };

  const score =
    Number(signals.volume_ratio_5d_at_least_2) +
    Number(signals.rsi14_at_least_75) +
    Number(signals.relative_strength_7d_at_least_8) * 2 +
    Number(signals.previous_day_non_negative) +
    Number(signals.chip_bias_bullish) +
    Number(signals.predicted_direction_bullish) +
    Number(signals.breakout_precursor);

  return {
    score,
    signals,
    metrics: {
      volume_ratio_5d: volume5,
      rsi14: rsi,
      r1,
      gap_sma20: gapSma20,
      relative_strength_7d: relativeStrength7d,
    },
  };
}

function normalizePolicyState(policyState) {
  if (policyState === true) return 'disabled_shadow';
  if (policyState === false || policyState == null) return 'normal';
  return String(policyState);
}

function policyRuleDescription(policyState) {
  policyState = normalizePolicyState(policyState);
  if (policyState === 'disabled_shadow') {
    return '首日衝擊：Shadow 停用全部量價動能候選。';
  }
  if (policyState === 'reduced_shadow') {
    return '風險警告：確認分數至少 3 分列入核心，2 分列入觀察；相對強勢 7 日達 8 分計 2 分。';
  }
  if (policyState === 'restricted_shadow') {
    return '熊市時防禦抗跌股：確認分數至少 7、7 日相對強勢至少 8、SMA20 乖離不超過 10%；其餘確認分數至少 3 者列入觀察。';
  }
  if (policyState === 'unavailable') {
    return '環境資料無效：不評估政策後清單。';
  }
  return '一般環境：保留全部原始候選。';
}

function policyBucket(row, policyState) {
  policyState = normalizePolicyState(policyState);
  const profile = confirmationProfile(row);
  if (policyState === 'disabled_shadow') return { bucket: 'excluded', profile };
  if (policyState === 'unavailable') return { bucket: 'unassessed', profile };
  if (policyState === 'reduced_shadow') {
    if (profile.score >= 3) return { bucket: 'core', profile };
    if (profile.score >= 2) return { bucket: 'watchlist', profile };
    return { bucket: 'excluded', profile };
  }
  if (policyState === 'restricted_shadow') {
    const highConfidence =
      profile.score >= 7 &&
      profile.signals.relative_strength_7d_at_least_8 &&
      profile.signals.gap_sma20_at_most_10;
    if (highConfidence) return { bucket: 'core', profile };
    if (profile.score >= 3) return { bucket: 'watchlist', profile };
    return { bucket: 'excluded', profile };
  }
  return { bucket: 'core', profile };
}

function stockOutput(item) {
  const decision = item.policy_decision;
  return {
    stock_code: item.code,
    stock_name: item.prediction?.stock_name || item.replay?.stock_name || null,
    volume_ratio_5d: finiteNumber(predictionFeatures(item.prediction).volume_ratio_5d),
    rsi14: finiteNumber(predictionFeatures(item.prediction).rsi14),
    r1: finiteNumber(predictionFeatures(item.prediction).r1),
    gap_sma20: decision.profile.metrics.gap_sma20,
    relative_strength_7d: decision.profile.metrics.relative_strength_7d,
    confirmation_score: decision.profile.score,
    confirmation_signals: decision.profile.signals,
    policy_bucket: decision.bucket,
    relative_leadership: isRelativeLeader(item.replay),
    market_percentile: finiteNumber(item.replay?.market_relative?.market_percentile),
  };
}

function evaluateRelativeLeadershipShadow(predictionStocks, replayRows, policyState = 'normal') {
  policyState = normalizePolicyState(policyState);
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
  const candidates = matched
    .filter((item) => candidateRule(item.prediction))
    .map((item) => ({
      ...item,
      policy_decision: policyBucket(item.prediction, policyState),
    }));
  const rawHits = candidates.filter((item) => isRelativeLeader(item.replay));
  const policyAssessed = policyState !== 'unavailable';
  const policyCandidates = policyAssessed
    ? candidates.filter((item) => item.policy_decision.bucket === 'core')
    : [];
  const watchlist = policyAssessed
    ? candidates.filter((item) => item.policy_decision.bucket === 'watchlist')
    : [];
  const excluded = policyAssessed
    ? candidates.filter((item) => item.policy_decision.bucket === 'excluded')
    : [];
  const policyHits = policyCandidates.filter((item) => isRelativeLeader(item.replay));
  const rawFalsePositives = candidates.length - rawHits.length;
  const policyFalsePositives = policyCandidates.length - policyHits.length;
  const avoidedFalsePositives = policyAssessed ? rawFalsePositives - policyFalsePositives : null;
  const suppressedTruePositives = policyAssessed ? rawHits.length - policyHits.length : null;
  const rawPrecision = candidates.length ? round(rawHits.length / candidates.length * 100) : null;
  const policyPrecision = policyCandidates.length
    ? round(policyHits.length / policyCandidates.length * 100)
    : null;

  return {
    policy_rule: policyRuleDescription(policyState),
    raw_candidates: candidates.length,
    raw_hits: rawHits.length,
    raw_precision: rawPrecision,
    policy_assessed: policyAssessed,
    policy_candidates: policyAssessed ? policyCandidates.length : null,
    policy_hits: policyAssessed ? policyHits.length : null,
    policy_precision: policyPrecision,
    policy_precision_delta: rawPrecision !== null && policyPrecision !== null
      ? round(policyPrecision - rawPrecision)
      : null,
    watchlist_candidates: policyAssessed ? watchlist.length : null,
    excluded_candidates: policyAssessed ? excluded.length : null,
    avoided_false_positives: avoidedFalsePositives,
    suppressed_true_positives: suppressedTruePositives,
    net_avoided_errors: policyAssessed
      ? avoidedFalsePositives - suppressedTruePositives
      : null,
    candidate_stocks: candidates.map(stockOutput),
    policy_candidate_stocks: policyCandidates.map(stockOutput),
    watchlist_stocks: watchlist.map(stockOutput),
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
  const policyState = predicted?.strategy_policy?.relative_leadership_momentum || 'normal';
  const shadowEvaluation = evaluateRelativeLeadershipShadow(
    predictionSummary.stocks,
    dashboard.rows,
    policyState,
  );
  if (shadowEvaluation.data_quality.verified_replay_rows > 0 && shadowEvaluation.data_quality.matched_rows === 0) {
    throw new Error(`Prediction/replay stock-code join produced zero rows for ${date}`);
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 4,
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
      policy_state: policyState,
      ...shadowEvaluation,
      note: '所有政策分層只使用 summary.json 的事前欄位；熊市時防禦抗跌股為探索規則，原候選保留於觀察清單。Shadow mode 未改動正式清單。',
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
    policy_state: policyState,
    policy_candidates: shadowEvaluation.policy_candidates,
    policy_hits: shadowEvaluation.policy_hits,
    policy_precision: shadowEvaluation.policy_precision,
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
  confirmationProfile,
  policyBucket,
  normalizePolicyState,
  evaluateRelativeLeadershipShadow,
};
