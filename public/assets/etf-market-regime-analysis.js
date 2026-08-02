(function attachEtfMarketRegimeAnalysis(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EtfMarketRegimeAnalysis = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  'use strict';

  const REGIMES = Object.freeze({
    continuous_up: Object.freeze({ id: 'continuous_up', label: '市場持續上漲', shortLabel: '持續上漲' }),
    continuous_down: Object.freeze({ id: 'continuous_down', label: '市場持續下跌', shortLabel: '持續下跌' }),
    range_bound: Object.freeze({ id: 'range_bound', label: '市場區間震盪', shortLabel: '區間震盪' }),
    gradual_up: Object.freeze({ id: 'gradual_up', label: '市場緩慢上漲', shortLabel: '緩慢上漲' }),
    gradual_down: Object.freeze({ id: 'gradual_down', label: '市場緩慢下跌', shortLabel: '緩慢下跌' })
  });

  const REGIME_ORDER = Object.freeze([
    'continuous_up',
    'gradual_up',
    'range_bound',
    'gradual_down',
    'continuous_down'
  ]);

  const DEFAULT_OPTIONS = Object.freeze({
    windowDays: 20,
    stepDays: 5,
    strongReturnPct: 5,
    slowReturnPct: 1,
    minTrendR2: 0.45,
    minDirectionalDayRatio: 0.55
  });

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function round(value, digits = 4) {
    return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
  }

  function mean(values) {
    const valid = values.filter(Number.isFinite);
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  }

  function median(values) {
    const valid = values.filter(Number.isFinite).sort((left, right) => left - right);
    if (!valid.length) return null;
    const middle = Math.floor(valid.length / 2);
    return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
  }

  function standardDeviation(values) {
    const average = mean(values);
    if (!Number.isFinite(average) || values.length < 2) return 0;
    const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1);
    return Math.sqrt(Math.max(variance, 0));
  }

  function percentile(values, ratio) {
    const valid = values.filter(Number.isFinite).sort((left, right) => left - right);
    if (!valid.length) return null;
    if (valid.length === 1) return valid[0];
    const position = Math.min(1, Math.max(0, ratio)) * (valid.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const weight = position - lower;
    return valid[lower] * (1 - weight) + valid[upper] * weight;
  }

  function dailyReturns(prices) {
    const returns = [];
    for (let index = 1; index < prices.length; index += 1) {
      const previous = prices[index - 1];
      const current = prices[index];
      if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0) continue;
      returns.push(current / previous - 1);
    }
    return returns;
  }

  function maxDrawdownPct(prices) {
    let peak = null;
    let worst = 0;
    for (const price of prices) {
      if (!Number.isFinite(price) || price <= 0) continue;
      peak = peak === null ? price : Math.max(peak, price);
      worst = Math.min(worst, price / peak - 1);
    }
    return round(worst * 100);
  }

  function linearRegression(values) {
    const pairs = values
      .map((value, index) => ({ x: index, y: Number.isFinite(value) && value > 0 ? Math.log(value) : null }))
      .filter((pair) => Number.isFinite(pair.y));
    if (pairs.length < 2) return { slope: 0, r2: 0 };
    const averageX = mean(pairs.map((pair) => pair.x));
    const averageY = mean(pairs.map((pair) => pair.y));
    let numerator = 0;
    let denominator = 0;
    for (const pair of pairs) {
      numerator += (pair.x - averageX) * (pair.y - averageY);
      denominator += (pair.x - averageX) ** 2;
    }
    const slope = denominator ? numerator / denominator : 0;
    let residual = 0;
    let total = 0;
    for (const pair of pairs) {
      const fitted = averageY + slope * (pair.x - averageX);
      residual += (pair.y - fitted) ** 2;
      total += (pair.y - averageY) ** 2;
    }
    return { slope, r2: total ? Math.max(0, Math.min(1, 1 - residual / total)) : 1 };
  }

  function getSeriesPrices(rows, field) {
    return rows.map((row) => finiteNumber(row?.[field])).filter(Number.isFinite);
  }

  function calculateHoldingMetrics(rows, field) {
    const prices = getSeriesPrices(rows, field);
    if (prices.length < 2) return null;
    const start = prices[0];
    const end = prices[prices.length - 1];
    if (!(start > 0) || !(end > 0)) return null;
    const returns = dailyReturns(prices);
    const totalReturn = end / start - 1;
    const periods = Math.max(1, returns.length);
    const averageDailyReturn = mean(returns) || 0;
    const dailyVolatility = standardDeviation(returns);
    const annualizedReturn = (end / start) ** (252 / periods) - 1;
    const annualizedVolatility = dailyVolatility * Math.sqrt(252);
    const positiveDays = returns.filter((value) => value > 0).length;
    return {
      observations: prices.length,
      startPrice: round(start),
      endPrice: round(end),
      totalReturnPct: round(totalReturn * 100),
      annualizedReturnPct: round(annualizedReturn * 100),
      annualizedVolatilityPct: round(annualizedVolatility * 100),
      maxDrawdownPct: maxDrawdownPct(prices),
      positiveDayRatePct: round(returns.length ? positiveDays / returns.length * 100 : 0),
      bestDayPct: round((returns.length ? Math.max(...returns) : 0) * 100),
      worstDayPct: round((returns.length ? Math.min(...returns) : 0) * 100),
      sharpeLike: round(dailyVolatility ? averageDailyReturn / dailyVolatility * Math.sqrt(252) : 0)
    };
  }

  function classifyMarketWindow(rows, suppliedOptions = {}) {
    const options = { ...DEFAULT_OPTIONS, ...suppliedOptions };
    const prices = getSeriesPrices(rows, 'marketClose');
    if (prices.length < 2) return null;
    const start = prices[0];
    const end = prices[prices.length - 1];
    const returns = dailyReturns(prices);
    const totalReturnPct = (end / start - 1) * 100;
    const positiveDayRatio = returns.length ? returns.filter((value) => value > 0).length / returns.length : 0.5;
    const negativeDayRatio = returns.length ? returns.filter((value) => value < 0).length / returns.length : 0.5;
    const regression = linearRegression(prices);
    const absoluteMoves = prices.slice(1).reduce((sum, price, index) => sum + Math.abs(price - prices[index]), 0);
    const pathEfficiency = absoluteMoves ? Math.abs(end - start) / absoluteMoves : 0;
    const strongUp = totalReturnPct >= options.strongReturnPct
      && regression.r2 >= options.minTrendR2
      && positiveDayRatio >= options.minDirectionalDayRatio;
    const strongDown = totalReturnPct <= -options.strongReturnPct
      && regression.r2 >= options.minTrendR2
      && negativeDayRatio >= options.minDirectionalDayRatio;

    let regime = 'range_bound';
    if (strongUp) regime = 'continuous_up';
    else if (strongDown) regime = 'continuous_down';
    else if (totalReturnPct >= options.slowReturnPct) regime = 'gradual_up';
    else if (totalReturnPct <= -options.slowReturnPct) regime = 'gradual_down';

    return {
      regime,
      label: REGIMES[regime].label,
      observations: prices.length,
      returnPct: round(totalReturnPct),
      annualizedVolatilityPct: round(standardDeviation(returns) * Math.sqrt(252) * 100),
      positiveDayRatePct: round(positiveDayRatio * 100),
      negativeDayRatePct: round(negativeDayRatio * 100),
      trendR2: round(regression.r2),
      pathEfficiencyPct: round(pathEfficiency * 100),
      maxDrawdownPct: maxDrawdownPct(prices)
    };
  }

  function normalizeOptions(suppliedOptions = {}) {
    const options = { ...DEFAULT_OPTIONS, ...suppliedOptions };
    options.windowDays = Math.max(2, Math.round(finiteNumber(options.windowDays) || DEFAULT_OPTIONS.windowDays));
    options.stepDays = Math.max(1, Math.round(finiteNumber(options.stepDays) || DEFAULT_OPTIONS.stepDays));
    options.strongReturnPct = Math.max(0.01, finiteNumber(options.strongReturnPct) || DEFAULT_OPTIONS.strongReturnPct);
    options.slowReturnPct = Math.max(0, Math.min(options.strongReturnPct, finiteNumber(options.slowReturnPct) || DEFAULT_OPTIONS.slowReturnPct));
    options.minTrendR2 = Math.min(1, Math.max(0, finiteNumber(options.minTrendR2) ?? DEFAULT_OPTIONS.minTrendR2));
    options.minDirectionalDayRatio = Math.min(1, Math.max(0.5, finiteNumber(options.minDirectionalDayRatio) ?? DEFAULT_OPTIONS.minDirectionalDayRatio));
    return options;
  }

  function buildRollingRegimeSamples(rows, etfs, suppliedOptions = {}) {
    const options = normalizeOptions(suppliedOptions);
    const samples = [];
    for (let startIndex = 0; startIndex + options.windowDays <= rows.length; startIndex += options.stepDays) {
      const windowRows = rows.slice(startIndex, startIndex + options.windowDays);
      const market = classifyMarketWindow(windowRows, options);
      if (!market) continue;
      const etfMetrics = {};
      let complete = true;
      for (const etf of etfs) {
        const metrics = calculateHoldingMetrics(windowRows, etf.adjustedCloseField);
        if (!metrics) {
          complete = false;
          break;
        }
        etfMetrics[etf.id] = metrics;
      }
      if (!complete) continue;
      samples.push({
        startDate: windowRows[0].date,
        endDate: windowRows[windowRows.length - 1].date,
        regime: market.regime,
        market,
        etfs: etfMetrics
      });
    }
    return samples;
  }

  function summarizeRegimeSamples(samples, etfs) {
    const result = {};
    for (const regime of REGIME_ORDER) {
      const selected = samples.filter((sample) => sample.regime === regime);
      const marketReturns = selected.map((sample) => sample.market.returnPct);
      const summary = {
        regime,
        label: REGIMES[regime].label,
        sampleCount: selected.length,
        marketAverageReturnPct: round(mean(marketReturns)),
        marketMedianReturnPct: round(median(marketReturns)),
        etfs: {}
      };
      for (const etf of etfs) {
        const returns = selected.map((sample) => sample.etfs?.[etf.id]?.totalReturnPct).filter(Number.isFinite);
        const drawdowns = selected.map((sample) => sample.etfs?.[etf.id]?.maxDrawdownPct).filter(Number.isFinite);
        summary.etfs[etf.id] = {
          sampleCount: returns.length,
          averageReturnPct: round(mean(returns)),
          medianReturnPct: round(median(returns)),
          winRatePct: round(returns.length ? returns.filter((value) => value > 0).length / returns.length * 100 : null),
          averageMaxDrawdownPct: round(mean(drawdowns)),
          p25ReturnPct: round(percentile(returns, 0.25)),
          p75ReturnPct: round(percentile(returns, 0.75)),
          bestReturnPct: returns.length ? round(Math.max(...returns)) : null,
          worstReturnPct: returns.length ? round(Math.min(...returns)) : null
        };
      }
      result[regime] = summary;
    }
    return result;
  }

  function filterRowsByDate(rows, fromDate, toDate) {
    const from = String(fromDate || '').replaceAll('-', '');
    const to = String(toDate || '').replaceAll('-', '');
    return rows.filter((row) => (!from || row.date >= from) && (!to || row.date <= to));
  }

  return Object.freeze({
    REGIMES,
    REGIME_ORDER,
    DEFAULT_OPTIONS,
    round,
    mean,
    median,
    maxDrawdownPct,
    calculateHoldingMetrics,
    classifyMarketWindow,
    normalizeOptions,
    buildRollingRegimeSamples,
    summarizeRegimeSamples,
    filterRowsByDate
  });
}));
