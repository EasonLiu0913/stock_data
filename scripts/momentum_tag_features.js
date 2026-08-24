'use strict';

const MOMENTUM_MODEL_VERSION = 1;

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getPath(object, dottedPath) {
  return String(dottedPath || '').split('.').reduce((value, key) => (
    value !== null && value !== undefined ? value[key] : undefined
  ), object);
}

function firstNumber(stock, paths = []) {
  for (const path of paths) {
    const value = finiteNumber(getPath(stock, path));
    if (value !== null) return value;
  }
  return null;
}

function firstBoolean(stock, paths = []) {
  for (const path of paths) {
    const value = getPath(stock, path);
    if (value === true || value === false) return value;
  }
  return null;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function tier(value, bands) {
  if (!Number.isFinite(value)) return 0;
  for (const [minimum, score] of bands) {
    if (value >= minimum) return score;
  }
  return 0;
}

function closePosition(stock) {
  const explicit = firstNumber(stock, [
    'strategy_tag_features.close_position',
    'features.close_position',
    'features.close_pos',
  ]);
  if (explicit !== null) return Math.max(0, Math.min(1, explicit > 1 ? explicit / 100 : explicit));
  const close = firstNumber(stock, ['close', 'price', 'features.close', 'features.price']);
  const high = firstNumber(stock, ['high', 'features.high']);
  const low = firstNumber(stock, ['low', 'features.low']);
  if (![close, high, low].every(Number.isFinite) || high <= low) return null;
  return Math.max(0, Math.min(1, (close - low) / (high - low)));
}

function priceScore(stock) {
  const return1d = firstNumber(stock, [
    'features.r1', 'features.return_1d', 'features.return_1d_pct',
    'strategy_tag_features.latest_return_1d_pct',
  ]);
  const return3d = firstNumber(stock, [
    'features.r3', 'features.return_3d', 'features.return_3d_pct',
  ]);
  const return5d = firstNumber(stock, [
    'features.r5', 'features.return_5d', 'features.return_5d_pct',
    'strategy_tag_features.price_return_5d_pct',
    'strategy_tag_features.margin_crowding_capitulation_continuation_risk_metrics.price_return_5d_pct',
  ]);
  return {
    score: tier(return1d, [[7, 10], [5, 8], [3, 5], [1, 2]])
      + tier(return3d, [[12, 10], [8, 8], [5, 6], [2, 3]])
      + tier(return5d, [[18, 10], [12, 8], [7, 6], [3, 3]]),
    return_1d_pct: return1d,
    return_3d_pct: return3d,
    return_5d_pct: return5d,
  };
}

function volumeScore(stock) {
  const ratio = firstNumber(stock, [
    'features.volume_ratio_5d',
    'strategy_tag_features.volume_ratio_5d',
    'volume_ratio_5d',
  ]);
  const position = closePosition(stock);
  return {
    score: tier(ratio, [[3, 15], [2, 12], [1.5, 8], [1.2, 4], [1, 2]])
      + tier(position, [[0.85, 5], [0.7, 3], [0.55, 1]]),
    volume_ratio_5d: ratio,
    close_position: round(position, 4),
  };
}

function trendScore(stock) {
  const alignment = firstBoolean(stock, [
    'strategy_tag_features.trend_bullish_alignment',
  ]);
  const quality = firstBoolean(stock, [
    'strategy_tag_features.trend_quality_20d',
  ]);
  const gapSma20 = firstNumber(stock, [
    'features.gap_sma20',
    'features.distance_to_sma20',
    'strategy_tag_features.sma20_gap_pct',
  ]);
  return {
    score: (alignment === true ? 10 : 0)
      + (quality === true ? 5 : 0)
      + tier(gapSma20, [[5, 5], [0, 4], [-3, 2]]),
    bullish_alignment: alignment,
    trend_quality_20d: quality,
    gap_sma20_pct: gapSma20,
  };
}

function chipScore(stock) {
  const institutional = firstNumber(stock, [
    'strategy_tag_features.chip_combined_institutional',
    'features.chip_combined_institutional',
    'features.institutional_score',
    'institutional_score',
  ]);
  const brokerAlignment = firstNumber(stock, [
    'strategy_tag_features.chip_broker_alignment',
    'features.chip_broker_alignment',
    'broker_alignment',
  ]);
  const institutionalBullish = firstBoolean(stock, [
    'strategy_tag_features.institutional_bullish',
    'features.institutional_bullish',
  ]);
  const brokerBullish = firstBoolean(stock, [
    'strategy_tag_features.broker_bullish',
    'features.broker_bullish',
  ]);
  let score = 0;
  if (Number.isFinite(institutional)) score += tier(institutional, [[8, 10], [5, 8], [2, 5], [0, 2]]);
  else if (institutionalBullish === true) score += 8;
  if (Number.isFinite(brokerAlignment)) score += tier(brokerAlignment, [[8, 10], [5, 8], [2, 5], [0, 2]]);
  else if (brokerBullish === true) score += 8;
  return {
    score: Math.min(20, score),
    institutional_signal: institutional,
    broker_alignment: brokerAlignment,
    institutional_bullish: institutionalBullish,
    broker_bullish: brokerBullish,
  };
}

function breakoutScore(stock, price, volume) {
  const confirmed = firstBoolean(stock, [
    'strategy_tag_features.volume_breakout_confirmation',
  ]);
  const marketTop20 = firstBoolean(stock, [
    'strategy_tag_features.market_relative_strength_20d_top20',
  ]);
  const industryTop20 = firstBoolean(stock, [
    'strategy_tag_features.industry_relative_strength_20d_top20',
  ]);
  const leadership = firstBoolean(stock, [
    'strategy_tag_features.leadership_persistence_7d',
  ]);
  let score = 0;
  if (confirmed === true) score += 5;
  if (marketTop20 === true) score += 2;
  if (industryTop20 === true) score += 2;
  if (leadership === true) score += 1;
  // Legacy fallback: a strong short-term rise with expanded volume is breakout-like,
  // but receives only a partial score because no explicit high-price breakout is known.
  if (confirmed === null && Number.isFinite(price.return_3d_pct) && price.return_3d_pct >= 5
      && Number.isFinite(volume.volume_ratio_5d) && volume.volume_ratio_5d >= 1.5) {
    score = Math.max(score, 4);
  }
  return {
    score: Math.min(10, score),
    volume_breakout_confirmation: confirmed,
    market_relative_strength_20d_top20: marketTop20,
    industry_relative_strength_20d_top20: industryTop20,
    leadership_persistence_7d: leadership,
  };
}

function calculateMomentumFeatures(stock) {
  const price = priceScore(stock);
  const volume = volumeScore(stock);
  const trend = trendScore(stock);
  const chip = chipScore(stock);
  const breakout = breakoutScore(stock, price, volume);
  const score = price.score + volume.score + trend.score + chip.score + breakout.score;
  const previousScore = firstNumber(stock, [
    'strategy_tag_features.previous_momentum_score',
    'strategy_tag_features.momentum_previous_score',
  ]);
  const acceleration = Number.isFinite(previousScore) ? score - previousScore : null;
  const rsi14 = firstNumber(stock, ['features.rsi14', 'rsi14']);
  const distributionRisk = Number.isFinite(volume.volume_ratio_5d)
    && volume.volume_ratio_5d >= 2.5
    && Number.isFinite(volume.close_position)
    && volume.close_position <= 0.4;
  return {
    momentum_model_version: MOMENTUM_MODEL_VERSION,
    momentum_score: score,
    momentum_grade: score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : null,
    momentum_previous_score: previousScore,
    momentum_acceleration: acceleration,
    momentum_price_score: price.score,
    momentum_volume_score: volume.score,
    momentum_trend_score: trend.score,
    momentum_chip_score: chip.score,
    momentum_breakout_score: breakout.score,
    momentum_price_volume_sync: price.score >= 15 && volume.score >= 10,
    momentum_chip_sync: chip.score >= 10,
    momentum_breakout: breakout.score >= 5 && volume.score >= 8,
    momentum_overheated: score >= 80 && Number.isFinite(rsi14) && rsi14 >= 80
      && Number.isFinite(price.return_5d_pct) && price.return_5d_pct >= 15,
    momentum_distribution_risk: distributionRisk,
    momentum_inputs: {
      ...price,
      ...volume,
      ...trend,
      ...chip,
      ...breakout,
      rsi14,
    },
  };
}

function enrichMomentumFeatures(stocks = []) {
  return stocks.map(stock => ({
    ...stock,
    strategy_tag_features: {
      ...(stock.strategy_tag_features || {}),
      ...calculateMomentumFeatures(stock),
    },
  }));
}

module.exports = {
  MOMENTUM_MODEL_VERSION,
  finiteNumber,
  getPath,
  firstNumber,
  firstBoolean,
  closePosition,
  calculateMomentumFeatures,
  enrichMomentumFeatures,
};
