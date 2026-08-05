'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_OPTIONS = Object.freeze({
  maxFiles: 40,
  trendWindow: 20,
  trendR2Min: 0.6,
  relativeWindow: 20,
  relativeTopPercentile: 0.8,
  leadershipWindow: 7,
  leadershipMinWins: 5,
  alignmentSlopeLookback: 5,
  industryMinPeers: 5,
  marketMinPeers: 20,
  preferredBenchmarkCode: '0050',
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

function percentileRank(values, target) {
  const usable = values.filter(Number.isFinite);
  if (!usable.length || !Number.isFinite(target)) return null;
  const below = usable.filter(value => value < target).length;
  const equal = usable.filter(value => value === target).length;
  return ((below + (equal * 0.5)) / usable.length) * 100;
}

function linearRegression(values) {
  const usable = values.map(Number);
  if (usable.length < 2 || usable.some(value => !Number.isFinite(value))) return null;
  const count = usable.length;
  const meanX = (count - 1) / 2;
  const meanY = usable.reduce((sum, value) => sum + value, 0) / count;
  let covariance = 0;
  let varianceX = 0;
  for (let index = 0; index < count; index += 1) {
    covariance += (index - meanX) * (usable[index] - meanY);
    varianceX += (index - meanX) ** 2;
  }
  if (varianceX === 0) return null;
  const slope = covariance / varianceX;
  const intercept = meanY - (slope * meanX);
  let residual = 0;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const estimated = intercept + (slope * index);
    residual += (usable[index] - estimated) ** 2;
    total += (usable[index] - meanY) ** 2;
  }
  const r2 = total === 0 ? (residual === 0 ? 1 : 0) : 1 - (residual / total);
  return { slope, intercept, r2 };
}

function normalizeIndustry(stock) {
  return String(
    stock?.industry
    || stock?.industry_name
    || stock?.twse_industry
    || stock?.stock_industry
    || '',
  ).trim();
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
    .map(file => ({
      file,
      date: String(file).match(/^fubon_(20\d{6})_sma\.json$/)?.[1] || '',
    }))
    .filter(item => item.date)
    .filter(item => !normalizedCutoff || item.date <= normalizedCutoff)
    .sort((left, right) => left.date.localeCompare(right.date));
  const unique = [...new Map(rows.map(item => [item.file, item])).values()];
  return unique.slice(-Math.max(1, Number(maxFiles) || DEFAULT_OPTIONS.maxFiles));
}

function rowForFileDate(item, fileDate, cutoff) {
  if (!item || typeof item !== 'object') return null;
  const keys = Object.keys(item)
    .filter(key => /^20\d{2}[/-]\d{2}[/-]\d{2}$/.test(key))
    .map(key => ({ key, date: compactDate(key) }))
    .filter(entry => entry.date)
    .filter(entry => !cutoff || entry.date <= cutoff)
    .sort((left, right) => left.date.localeCompare(right.date));
  const selected = keys.find(entry => entry.date === fileDate) || keys.at(-1);
  if (!selected) return null;
  const raw = item[selected.key] || {};
  const close = finiteNumber(raw.Price ?? raw.Close);
  if (!Number.isFinite(close) || close <= 0) return null;
  return {
    date: selected.date,
    close,
    open: finiteNumber(raw.Open),
    high: finiteNumber(raw.High),
    low: finiteNumber(raw.Low),
    volume: finiteNumber(raw.Volume),
    sma20: finiteNumber(raw.SMA20),
    sma60: finiteNumber(raw.SMA60),
  };
}

function loadHistoricalPriceContext(payload, workspaceRoot, cutoff, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const targetCodes = new Set(stocks.map(stock => String(stock.stock_code || '').trim()).filter(Boolean));
  targetCodes.add(resolved.preferredBenchmarkCode);
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

function dailyReturnMap(rows) {
  const result = new Map();
  const usable = rows.filter(row => Number.isFinite(row.close) && row.close > 0);
  for (let index = 1; index < usable.length; index += 1) {
    result.set(usable[index].date, ((usable[index].close / usable[index - 1].close) - 1) * 100);
  }
  return result;
}

function calculateTrendQuality(rows, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const selected = rows.filter(row => Number.isFinite(row.close) && row.close > 0).slice(-resolved.trendWindow);
  if (selected.length < resolved.trendWindow) {
    return {
      available: false,
      valid_days: selected.length,
      slope_pct_per_day: null,
      r2: null,
      pass: null,
    };
  }
  const regression = linearRegression(selected.map(row => Math.log(row.close)));
  if (!regression) {
    return {
      available: false,
      valid_days: selected.length,
      slope_pct_per_day: null,
      r2: null,
      pass: null,
    };
  }
  const slopePct = (Math.exp(regression.slope) - 1) * 100;
  return {
    available: true,
    valid_days: selected.length,
    slope_pct_per_day: round(slopePct, 6),
    r2: round(regression.r2, 6),
    pass: slopePct > 0 && regression.r2 >= resolved.trendR2Min,
  };
}

function calculateBullishAlignment(rows, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const lookback = Math.max(1, Number(resolved.alignmentSlopeLookback));
  if (rows.length < lookback + 1) {
    return {
      available: false,
      pass: null,
      sma20_change_pct: null,
      sma60_change_pct: null,
    };
  }
  const latest = rows.at(-1);
  const previous = rows.at(-(lookback + 1));
  const required = [latest?.close, latest?.sma20, latest?.sma60, previous?.sma20, previous?.sma60];
  if (required.some(value => !Number.isFinite(value) || value <= 0)) {
    return {
      available: false,
      pass: null,
      sma20_change_pct: null,
      sma60_change_pct: null,
    };
  }
  const sma20Change = ((latest.sma20 / previous.sma20) - 1) * 100;
  const sma60Change = ((latest.sma60 / previous.sma60) - 1) * 100;
  return {
    available: true,
    pass: latest.close > latest.sma20
      && latest.sma20 > latest.sma60
      && sma20Change > 0
      && sma60Change > 0,
    latest_close: round(latest.close),
    latest_sma20: round(latest.sma20),
    latest_sma60: round(latest.sma60),
    sma20_change_pct: round(sma20Change),
    sma60_change_pct: round(sma60Change),
  };
}

function buildBenchmarkContext(stocks, priceContext, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const expectedLatestDate = priceContext.latest_source_date;
  const rawPreferredRows = priceContext.by_code.get(resolved.preferredBenchmarkCode) || [];
  const preferredRows = rawPreferredRows.at(-1)?.date === expectedLatestDate ? rawPreferredRows : [];
  const preferredDaily = dailyReturnMap(preferredRows);
  const returns20dByCode = new Map();
  const dailyByCode = new Map();
  for (const stock of stocks) {
    const code = String(stock.stock_code || '').trim();
    const rawRows = priceContext.by_code.get(code) || [];
    const rows = rawRows.at(-1)?.date === expectedLatestDate ? rawRows : [];
    returns20dByCode.set(code, periodReturn(rows, resolved.relativeWindow));
    dailyByCode.set(code, dailyReturnMap(rows));
  }
  const crossSection20d = [...returns20dByCode.values()].filter(Number.isFinite);
  const preferred20d = periodReturn(preferredRows, resolved.relativeWindow);
  const marketReturn20d = Number.isFinite(preferred20d) ? preferred20d : median(crossSection20d);
  const marketReturn20dSource = Number.isFinite(preferred20d)
    ? resolved.preferredBenchmarkCode
    : Number.isFinite(marketReturn20d) ? 'cross_section_median' : null;

  const dailyCrossSection = new Map();
  for (const map of dailyByCode.values()) {
    for (const [date, value] of map.entries()) {
      if (!dailyCrossSection.has(date)) dailyCrossSection.set(date, []);
      dailyCrossSection.get(date).push(value);
    }
  }
  const benchmarkDaily = new Map();
  let preferredDailyDays = 0;
  let fallbackDailyDays = 0;
  for (const [date, values] of dailyCrossSection.entries()) {
    if (Number.isFinite(preferredDaily.get(date))) {
      benchmarkDaily.set(date, preferredDaily.get(date));
      preferredDailyDays += 1;
    } else {
      const fallback = median(values);
      if (Number.isFinite(fallback)) {
        benchmarkDaily.set(date, fallback);
        fallbackDailyDays += 1;
      }
    }
  }
  return {
    market_return_20d_pct: marketReturn20d,
    market_return_20d_source: marketReturn20dSource,
    returns_20d_by_code: returns20dByCode,
    daily_by_code: dailyByCode,
    benchmark_daily: benchmarkDaily,
    preferred_daily_days: preferredDailyDays,
    fallback_daily_days: fallbackDailyDays,
  };
}

function calculateLeadershipPersistence(code, benchmarkContext, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const stockDaily = benchmarkContext.daily_by_code.get(code) || new Map();
  const comparisons = [...stockDaily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-resolved.leadershipWindow)
    .map(([date, stockReturn]) => ({
      date,
      stock_return: stockReturn,
      benchmark_return: benchmarkContext.benchmark_daily.get(date),
    }))
    .filter(item => Number.isFinite(item.stock_return) && Number.isFinite(item.benchmark_return));
  if (comparisons.length < resolved.leadershipWindow) {
    return {
      available: false,
      valid_days: comparisons.length,
      wins: null,
      pass: null,
    };
  }
  const wins = comparisons.filter(item => item.stock_return > item.benchmark_return).length;
  return {
    available: true,
    valid_days: comparisons.length,
    wins,
    pass: wins >= resolved.leadershipMinWins,
  };
}

function enrichHistoricalFactorFeatures(payload, workspaceRoot, dataAsOf, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const cutoff = compactDate(dataAsOf) || compactDate(payload?.base_trade_date);
  const priceContext = loadHistoricalPriceContext(payload, workspaceRoot, cutoff, resolved);
  const benchmark = buildBenchmarkContext(stocks, priceContext, resolved);

  const marketExcessByCode = new Map();
  for (const stock of stocks) {
    const code = String(stock.stock_code || '').trim();
    const stockReturn = benchmark.returns_20d_by_code.get(code);
    marketExcessByCode.set(code, Number.isFinite(stockReturn) && Number.isFinite(benchmark.market_return_20d_pct)
      ? stockReturn - benchmark.market_return_20d_pct
      : null);
  }
  const marketExcessValues = [...marketExcessByCode.values()].filter(Number.isFinite);
  const marketThreshold = marketExcessValues.length >= resolved.marketMinPeers
    ? percentile(marketExcessValues, resolved.relativeTopPercentile)
    : null;

  const industryGroups = new Map();
  for (const stock of stocks) {
    const code = String(stock.stock_code || '').trim();
    const industry = normalizeIndustry(stock);
    const stockReturn = benchmark.returns_20d_by_code.get(code);
    if (!industry || !Number.isFinite(stockReturn)) continue;
    if (!industryGroups.has(industry)) industryGroups.set(industry, []);
    industryGroups.get(industry).push({ code, stockReturn });
  }
  const industryContext = new Map();
  for (const [industry, members] of industryGroups.entries()) {
    if (members.length < resolved.industryMinPeers) continue;
    const industryMedian = median(members.map(item => item.stockReturn));
    const excessValues = members.map(item => item.stockReturn - industryMedian);
    const threshold = percentile(excessValues, resolved.relativeTopPercentile);
    const byCode = new Map(members.map(item => [item.code, item.stockReturn - industryMedian]));
    industryContext.set(industry, { median: industryMedian, threshold, excessValues, byCode, peers: members.length });
  }

  const counts = {
    trend_quality: 0,
    bullish_alignment: 0,
    market_relative_strength: 0,
    industry_relative_strength: 0,
    leadership_persistence: 0,
  };

  payload.stocks = stocks.map(stock => {
    const code = String(stock.stock_code || '').trim();
    const rawRows = priceContext.by_code.get(code) || [];
    const rows = rawRows.at(-1)?.date === priceContext.latest_source_date ? rawRows : [];
    const trend = calculateTrendQuality(rows, resolved);
    const alignment = calculateBullishAlignment(rows, resolved);
    const stockReturn = benchmark.returns_20d_by_code.get(code);
    const marketExcess = marketExcessByCode.get(code);
    const marketAvailable = Number.isFinite(marketExcess) && Number.isFinite(marketThreshold);
    const marketRank = marketAvailable ? percentileRank(marketExcessValues, marketExcess) : null;
    const industry = normalizeIndustry(stock);
    const group = industryContext.get(industry);
    const industryExcess = group?.byCode.get(code);
    const industryAvailable = Number.isFinite(industryExcess) && Number.isFinite(group?.threshold);
    const industryRank = industryAvailable ? percentileRank(group.excessValues, industryExcess) : null;
    const leadership = calculateLeadershipPersistence(code, benchmark, resolved);

    if (trend.available) counts.trend_quality += 1;
    if (alignment.available) counts.bullish_alignment += 1;
    if (marketAvailable) counts.market_relative_strength += 1;
    if (industryAvailable) counts.industry_relative_strength += 1;
    if (leadership.available) counts.leadership_persistence += 1;

    return {
      ...stock,
      strategy_tag_features: {
        ...(stock.strategy_tag_features || {}),
        trend_quality_20d: trend.pass,
        trend_quality_20d_valid_days: trend.valid_days,
        trend_quality_20d_slope_pct_per_day: trend.slope_pct_per_day,
        trend_quality_20d_r2: trend.r2,
        trend_bullish_alignment: alignment.pass,
        trend_alignment_latest_close: alignment.latest_close ?? null,
        trend_alignment_latest_sma20: alignment.latest_sma20 ?? null,
        trend_alignment_latest_sma60: alignment.latest_sma60 ?? null,
        trend_alignment_sma20_change_5d_pct: alignment.sma20_change_pct,
        trend_alignment_sma60_change_5d_pct: alignment.sma60_change_pct,
        market_return_20d_pct: Number.isFinite(stockReturn) ? round(stockReturn) : null,
        market_benchmark_return_20d_pct: Number.isFinite(benchmark.market_return_20d_pct)
          ? round(benchmark.market_return_20d_pct)
          : null,
        market_relative_strength_20d: marketAvailable ? round(marketExcess) : null,
        market_relative_strength_20d_percentile: marketAvailable ? round(marketRank, 2) : null,
        market_relative_strength_20d_top20: marketAvailable ? marketExcess >= marketThreshold : null,
        industry_return_20d_median_pct: industryAvailable ? round(group.median) : null,
        industry_relative_strength_20d: industryAvailable ? round(industryExcess) : null,
        industry_relative_strength_20d_percentile: industryAvailable ? round(industryRank, 2) : null,
        industry_relative_strength_20d_top20: industryAvailable
          ? industryExcess >= group.threshold
          : null,
        leadership_persistence_7d: leadership.pass,
        leadership_persistence_7d_wins: leadership.wins,
        leadership_persistence_7d_valid_days: leadership.valid_days,
        historical_factor_latest_date: rows.at(-1)?.date || null,
      },
    };
  });

  const total = payload.stocks.length;
  const maximumAvailable = Math.max(...Object.values(counts), 0);
  const minimumAvailable = Math.min(...Object.values(counts), maximumAvailable);
  const status = maximumAvailable === 0
    ? 'unable_to_calculate'
    : minimumAvailable < total ? 'partial' : 'completed';
  const metadata = {
    calculation_status: status,
    calculation_message: status === 'unable_to_calculate'
      ? '缺少足夠的價量歷史，無法計算第一輪歷史因子。'
      : status === 'partial'
        ? '已完成第一輪歷史因子計算；部分股票因上市天數、產業同儕數或缺值而不可計算。'
        : '已完成全部股票的第一輪歷史因子計算。',
    cutoff_date: cutoff || null,
    source_files: priceContext.source_files,
    total_stock_count: total,
    thresholds: {
      trend_window: resolved.trendWindow,
      trend_r2_min: resolved.trendR2Min,
      relative_window: resolved.relativeWindow,
      relative_top_percentile: resolved.relativeTopPercentile * 100,
      leadership_window: resolved.leadershipWindow,
      leadership_min_wins: resolved.leadershipMinWins,
      alignment_slope_lookback: resolved.alignmentSlopeLookback,
      industry_min_peers: resolved.industryMinPeers,
      market_min_peers: resolved.marketMinPeers,
    },
    benchmark: {
      preferred_code: resolved.preferredBenchmarkCode,
      return_20d_source: benchmark.market_return_20d_source,
      return_20d_pct: Number.isFinite(benchmark.market_return_20d_pct)
        ? round(benchmark.market_return_20d_pct)
        : null,
      preferred_daily_days: benchmark.preferred_daily_days,
      cross_section_fallback_daily_days: benchmark.fallback_daily_days,
    },
    latest_source_date: priceContext.latest_source_date,
    market_top20_threshold: Number.isFinite(marketThreshold) ? round(marketThreshold) : null,
    available_stock_count: counts,
    coverage_pct: Object.fromEntries(Object.entries(counts).map(([key, value]) => [
      key,
      total ? round((value / total) * 100, 2) : null,
    ])),
    industry_group_count: industryContext.size,
  };
  payload.strategy_tag_source_metadata = {
    ...(payload.strategy_tag_source_metadata || {}),
    historical_factors_round_1: metadata,
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
  percentileRank,
  linearRegression,
  normalizeIndustry,
  listHistoricalPriceFiles,
  rowForFileDate,
  loadHistoricalPriceContext,
  periodReturn,
  dailyReturnMap,
  calculateTrendQuality,
  calculateBullishAlignment,
  buildBenchmarkContext,
  calculateLeadershipPersistence,
  enrichHistoricalFactorFeatures,
};
