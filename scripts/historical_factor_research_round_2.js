'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_OPTIONS = Object.freeze({
  maxFiles: 60,
  breakoutLookback: 20,
  breakoutVolumeLookback: 20,
  breakoutVolumeRatioMin: 1.5,
  pullbackStrengthWindow: 20,
  pullbackStrengthReturnMinPct: 8,
  pullbackHighLookback: 5,
  pullbackMinPct: 2,
  pullbackMaxPct: 8,
  pullbackVolumeLookback: 5,
  pullbackVolumeRatioMax: 0.8,
  marginResilienceWindow: 5,
  marginResilienceReturnMinPct: -2,
  marginResilienceSma20TolerancePct: -3,
  crowdingVolumeLookback: 20,
  crowdingPercentile: 0.9,
  crowdingMinPeers: 20,
});

function compactDate(value) {
  const normalized = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(normalized) ? normalized : '';
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values, percentileValue) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const bounded = Math.min(1, Math.max(0, Number(percentileValue)));
  const index = (sorted.length - 1) * bounded;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * (index - lower));
}

function median(values) {
  return percentile(values, 0.5);
}

function listHistoricalPriceFiles(workspaceRoot, cutoff, maxFiles = DEFAULT_OPTIONS.maxFiles) {
  const directory = path.join(workspaceRoot, 'data_fubon');
  const manifest = readJson(path.join(directory, 'files.json'), null);
  let names = Array.isArray(manifest) ? [...manifest] : [];
  try {
    names.push(...fs.readdirSync(directory));
  } catch {
    if (!names.length) return [];
  }
  const normalizedCutoff = compactDate(cutoff);
  const rows = names
    .map(file => ({ file, date: String(file).match(/^fubon_(20\d{6})_sma\.json$/)?.[1] || '' }))
    .filter(item => item.date)
    .filter(item => !normalizedCutoff || item.date <= normalizedCutoff)
    .sort((left, right) => left.date.localeCompare(right.date));
  const unique = [...new Map(rows.map(item => [item.file, item])).values()];
  return unique.slice(-Math.max(1, Number(maxFiles) || DEFAULT_OPTIONS.maxFiles));
}

function rowForFileDate(item, fileDate, cutoff) {
  if (!item || typeof item !== 'object') return null;
  const selected = Object.keys(item)
    .filter(key => /^20\d{2}[/-]\d{2}[/-]\d{2}$/.test(key))
    .map(key => ({ key, date: compactDate(key) }))
    .filter(entry => entry.date && (!cutoff || entry.date <= cutoff))
    .sort((left, right) => left.date.localeCompare(right.date))
    .find(entry => entry.date === fileDate);
  if (!selected) return null;
  const raw = item[selected.key] || {};
  const close = finiteNumber(raw.Price ?? raw.Close);
  if (!Number.isFinite(close) || close <= 0) return null;
  return {
    date: selected.date,
    close,
    high: finiteNumber(raw.High),
    volume: finiteNumber(raw.Volume),
    sma20: finiteNumber(raw.SMA20),
  };
}

function loadHistoricalPriceContext(payload, workspaceRoot, cutoff, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const targetCodes = new Set(stocks.map(stock => String(stock.stock_code || '').trim()).filter(Boolean));
  const files = listHistoricalPriceFiles(workspaceRoot, cutoff, resolved.maxFiles);
  const byCodeMaps = new Map([...targetCodes].map(code => [code, new Map()]));
  for (const item of files) {
    const source = readJson(path.join(workspaceRoot, 'data_fubon', item.file), null);
    if (!source || typeof source !== 'object') continue;
    for (const code of targetCodes) {
      const row = rowForFileDate(source[code], item.date, compactDate(cutoff));
      if (row) byCodeMaps.get(code).set(row.date, row);
    }
  }
  const byCode = new Map();
  for (const [code, dateMap] of byCodeMaps.entries()) {
    byCode.set(code, [...dateMap.values()].sort((left, right) => left.date.localeCompare(right.date)));
  }
  return {
    cutoff_date: compactDate(cutoff) || null,
    source_files: files.map(item => `data_fubon/${item.file}`),
    latest_source_date: files.at(-1)?.date || null,
    by_code: byCode,
  };
}

function periodReturn(rows, periods) {
  const usable = rows.filter(row => Number.isFinite(row.close) && row.close > 0);
  const required = Number(periods) + 1;
  if (usable.length < required) return null;
  const selected = usable.slice(-required);
  return ((selected.at(-1).close / selected[0].close) - 1) * 100;
}

function medianVolume(rows, periods, excludeLatest = false) {
  const selected = excludeLatest ? rows.slice(0, -1) : rows;
  const values = selected.slice(-periods).map(row => row.volume).filter(value => Number.isFinite(value) && value > 0);
  return values.length >= periods ? median(values) : null;
}

function calculateVolumeBreakout(rows, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const required = Math.max(resolved.breakoutLookback, resolved.breakoutVolumeLookback) + 1;
  if (rows.length < required) return { available: false, pass: null };
  const latest = rows.at(-1);
  const prior = rows.slice(-(resolved.breakoutLookback + 1), -1);
  const breakoutLevel = Math.max(...prior.map(row => Number.isFinite(row.high) && row.high > 0 ? row.high : row.close));
  const baselineVolume = medianVolume(rows, resolved.breakoutVolumeLookback, true);
  if (![latest?.close, latest?.volume, breakoutLevel, baselineVolume].every(value => Number.isFinite(value) && value > 0)) {
    return { available: false, pass: null };
  }
  const volumeRatio = latest.volume / baselineVolume;
  const closeAbovePct = ((latest.close / breakoutLevel) - 1) * 100;
  return {
    available: true,
    pass: latest.close > breakoutLevel && volumeRatio >= resolved.breakoutVolumeRatioMin,
    breakout_level: round(breakoutLevel),
    close_above_breakout_pct: round(closeAbovePct),
    volume_ratio: round(volumeRatio),
  };
}

function calculatePullbackVolumeContraction(rows, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const required = Math.max(
    resolved.pullbackStrengthWindow + 1,
    resolved.pullbackHighLookback + 1,
    resolved.pullbackVolumeLookback + 1,
  );
  if (rows.length < required) return { available: false, pass: null };
  const latest = rows.at(-1);
  const strengthReturn = periodReturn(rows, resolved.pullbackStrengthWindow);
  const priorHighRows = rows.slice(-(resolved.pullbackHighLookback + 1), -1);
  const priorHigh = Math.max(...priorHighRows.map(row => Number.isFinite(row.high) && row.high > 0 ? row.high : row.close));
  const baselineVolume = medianVolume(rows, resolved.pullbackVolumeLookback, true);
  if (![latest?.close, latest?.volume, latest?.sma20, priorHigh, baselineVolume]
    .every(value => Number.isFinite(value) && value > 0) || !Number.isFinite(strengthReturn)) {
    return { available: false, pass: null };
  }
  const pullbackPct = ((latest.close / priorHigh) - 1) * 100;
  const volumeRatio = latest.volume / baselineVolume;
  const pullbackDepth = Math.abs(Math.min(0, pullbackPct));
  return {
    available: true,
    pass: strengthReturn >= resolved.pullbackStrengthReturnMinPct
      && latest.close >= latest.sma20
      && pullbackDepth >= resolved.pullbackMinPct
      && pullbackDepth <= resolved.pullbackMaxPct
      && volumeRatio <= resolved.pullbackVolumeRatioMax,
    strength_return_20d_pct: round(strengthReturn),
    prior_high: round(priorHigh),
    pullback_pct: round(pullbackPct),
    volume_ratio: round(volumeRatio),
    latest_sma20: round(latest.sma20),
  };
}

function calculateMarginExitPriceResilience(rows, marginFeatures = {}, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const returnPct = periodReturn(rows, resolved.marginResilienceWindow);
  const latest = rows.at(-1);
  const change5d = finiteNumber(marginFeatures.margin_change_5d);
  const balance = finiteNumber(marginFeatures.margin_balance);
  const previousBalance = Number.isFinite(balance) && Number.isFinite(change5d) ? balance - change5d : null;
  const exitRatioPct = Number.isFinite(previousBalance) && previousBalance > 0
    ? (change5d / previousBalance) * 100
    : null;
  if (![returnPct, latest?.close, latest?.sma20, change5d, balance].every(Number.isFinite)) {
    return { available: false, pass: null };
  }
  const gapSma20Pct = latest.sma20 > 0 ? ((latest.close / latest.sma20) - 1) * 100 : null;
  if (!Number.isFinite(gapSma20Pct)) return { available: false, pass: null };
  return {
    available: true,
    pass: change5d < 0
      && returnPct >= resolved.marginResilienceReturnMinPct
      && gapSma20Pct >= resolved.marginResilienceSma20TolerancePct,
    margin_change_5d: change5d,
    margin_balance: balance,
    margin_exit_ratio_5d_pct: round(exitRatioPct),
    price_return_5d_pct: round(returnPct),
    gap_sma20_pct: round(gapSma20Pct),
  };
}

function calculateMarginCrowdingRaw(rows, marginFeatures = {}, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const balance = finiteNumber(marginFeatures.margin_balance);
  const change5d = finiteNumber(marginFeatures.margin_change_5d);
  const volumeMedian = medianVolume(rows, resolved.crowdingVolumeLookback, false);
  if (![balance, change5d, volumeMedian].every(Number.isFinite) || volumeMedian <= 0 || balance < 0) {
    return { available: false, ratio: null, change_5d: change5d };
  }
  return {
    available: true,
    ratio: balance / volumeMedian,
    change_5d: change5d,
    margin_balance: balance,
    median_volume_20d: volumeMedian,
  };
}

function enrichRound2HistoricalFactorFeatures(payload, workspaceRoot, dataAsOf, options = {}) {
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
    const raw = {
      rows,
      breakout: calculateVolumeBreakout(rows, resolved),
      pullback: calculatePullbackVolumeContraction(rows, resolved),
      marginResilience: calculateMarginExitPriceResilience(rows, marginFeatures, resolved),
      crowding: calculateMarginCrowdingRaw(rows, marginFeatures, resolved),
    };
    rawByCode.set(code, raw);
    if (raw.crowding.available) crowdingRatios.push(raw.crowding.ratio);
  }

  const crowdingThreshold = crowdingRatios.length >= resolved.crowdingMinPeers
    ? percentile(crowdingRatios, resolved.crowdingPercentile)
    : null;
  const counts = {
    volume_breakout_confirmation: 0,
    strong_pullback_volume_contraction: 0,
    margin_exit_price_resilience: 0,
    margin_crowding_risk: 0,
  };
  const matched = {
    volume_breakout_confirmation: 0,
    strong_pullback_volume_contraction: 0,
    margin_exit_price_resilience: 0,
    margin_crowding_risk: 0,
  };

  payload.stocks = stocks.map(stock => {
    const code = String(stock.stock_code || '').trim();
    const raw = rawByCode.get(code);
    const crowdingAvailable = raw.crowding.available && Number.isFinite(crowdingThreshold);
    const crowdingPass = crowdingAvailable
      ? raw.crowding.ratio >= crowdingThreshold && raw.crowding.change_5d > 0
      : null;
    if (raw.breakout.available) counts.volume_breakout_confirmation += 1;
    if (raw.pullback.available) counts.strong_pullback_volume_contraction += 1;
    if (raw.marginResilience.available) counts.margin_exit_price_resilience += 1;
    if (crowdingAvailable) counts.margin_crowding_risk += 1;
    if (raw.breakout.pass === true) matched.volume_breakout_confirmation += 1;
    if (raw.pullback.pass === true) matched.strong_pullback_volume_contraction += 1;
    if (raw.marginResilience.pass === true) matched.margin_exit_price_resilience += 1;
    if (crowdingPass === true) matched.margin_crowding_risk += 1;

    return {
      ...stock,
      strategy_tag_features: {
        ...(stock.strategy_tag_features || {}),
        volume_breakout_confirmation: raw.breakout.pass,
        volume_breakout_level_20d: raw.breakout.breakout_level ?? null,
        volume_breakout_close_above_pct: raw.breakout.close_above_breakout_pct ?? null,
        volume_breakout_ratio_20d: raw.breakout.volume_ratio ?? null,
        strong_pullback_volume_contraction: raw.pullback.pass,
        strong_pullback_strength_return_20d_pct: raw.pullback.strength_return_20d_pct ?? null,
        strong_pullback_from_5d_high_pct: raw.pullback.pullback_pct ?? null,
        strong_pullback_volume_ratio_5d: raw.pullback.volume_ratio ?? null,
        margin_exit_price_resilience: raw.marginResilience.pass,
        margin_exit_ratio_5d_pct: raw.marginResilience.margin_exit_ratio_5d_pct ?? null,
        margin_exit_price_return_5d_pct: raw.marginResilience.price_return_5d_pct ?? null,
        margin_exit_gap_sma20_pct: raw.marginResilience.gap_sma20_pct ?? null,
        margin_crowding_risk: crowdingPass,
        margin_balance_to_volume_20d: crowdingAvailable ? round(raw.crowding.ratio) : null,
        margin_crowding_percentile_threshold: Number.isFinite(crowdingThreshold) ? round(crowdingThreshold) : null,
        historical_factor_round_2_latest_date: raw.rows.at(-1)?.date || null,
      },
    };
  });

  const total = payload.stocks.length;
  const availableValues = Object.values(counts);
  const status = availableValues.every(value => value === 0)
    ? 'unable_to_calculate'
    : availableValues.some(value => value < total) ? 'partial' : 'completed';
  const metadata = {
    calculation_status: status,
    calculation_message: status === 'unable_to_calculate'
      ? '缺少足夠價量或融資資料，無法計算第二輪候選因子。'
      : status === 'partial'
        ? '已完成第二輪候選因子計算；部分股票因價量歷史、融資資格或跨市場門檻資料不足而不可計算。'
        : '已完成全部股票的第二輪候選因子計算。',
    cutoff_date: cutoff || null,
    latest_source_date: priceContext.latest_source_date,
    source_files: priceContext.source_files,
    total_stock_count: total,
    thresholds: {
      breakout_lookback: resolved.breakoutLookback,
      breakout_volume_lookback: resolved.breakoutVolumeLookback,
      breakout_volume_ratio_min: resolved.breakoutVolumeRatioMin,
      pullback_strength_window: resolved.pullbackStrengthWindow,
      pullback_strength_return_min_pct: resolved.pullbackStrengthReturnMinPct,
      pullback_high_lookback: resolved.pullbackHighLookback,
      pullback_depth_range_pct: [resolved.pullbackMinPct, resolved.pullbackMaxPct],
      pullback_volume_ratio_max: resolved.pullbackVolumeRatioMax,
      margin_resilience_window: resolved.marginResilienceWindow,
      margin_resilience_return_min_pct: resolved.marginResilienceReturnMinPct,
      margin_resilience_sma20_tolerance_pct: resolved.marginResilienceSma20TolerancePct,
      margin_crowding_percentile: resolved.crowdingPercentile * 100,
      margin_crowding_min_peers: resolved.crowdingMinPeers,
      margin_crowding_ratio_threshold: Number.isFinite(crowdingThreshold) ? round(crowdingThreshold) : null,
    },
    available_stock_count: counts,
    matched_stock_count: matched,
    coverage_pct: Object.fromEntries(Object.entries(counts).map(([key, value]) => [
      key,
      total ? round((value / total) * 100, 2) : null,
    ])),
  };
  payload.strategy_tag_source_metadata = {
    ...(payload.strategy_tag_source_metadata || {}),
    historical_factors_round_2: metadata,
  };
  return metadata;
}

module.exports = {
  DEFAULT_OPTIONS,
  compactDate,
  finiteNumber,
  readJson,
  round,
  percentile,
  median,
  listHistoricalPriceFiles,
  rowForFileDate,
  loadHistoricalPriceContext,
  periodReturn,
  medianVolume,
  calculateVolumeBreakout,
  calculatePullbackVolumeContraction,
  calculateMarginExitPriceResilience,
  calculateMarginCrowdingRaw,
  enrichRound2HistoricalFactorFeatures,
};
