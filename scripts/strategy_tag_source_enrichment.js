'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  confirmationProfile,
  normalizePolicyState,
} = require('./generate_actual_market_environment');
const { enrichHistoricalFactorFeatures } = require('./historical_factor_research');

const POST_SHOCK_CODES = new Set(['post_shock_day_1', 'post_shock_day_2']);

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

function percentile(values, percentileValue) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function median(values) {
  return percentile(values, 0.5);
}

function earliestCutoff(payload, dataAsOf) {
  return [compactDate(payload?.base_trade_date), compactDate(dataAsOf)]
    .filter(Boolean)
    .sort()
    .at(0) || '';
}

function loadLiquidityContext(payload, workspaceRoot, dataAsOf) {
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const cutoff = earliestCutoff(payload, dataAsOf);
  const stockCodes = new Set(stocks.map(stock => String(stock.stock_code || '')));
  const priceDirectory = path.join(workspaceRoot, 'data_fubon');
  let files = [];
  try {
    files = fs.readdirSync(priceDirectory)
      .filter(file => /^fubon_20\d{6}_sma\.json$/.test(file))
      .filter(file => !cutoff || file.slice(6, 14) <= cutoff)
      .sort()
      .slice(-45);
  } catch {
    return {
      calculation_status: 'unable_to_calculate',
      calculation_message: '缺少 data_fubon 歷史價格與成交量。',
      cutoff_date: cutoff || null,
      threshold_percentile: 30,
      threshold_value: null,
      valid_cross_section_count: 0,
      total_stock_count: stocks.length,
      available_stock_count: 0,
      coverage_pct: stocks.length ? 0 : null,
      source_files: [],
      by_code: new Map(),
    };
  }

  const history = new Map();
  for (const file of files) {
    const payloadFile = readJson(path.join(priceDirectory, file), {});
    for (const [code, item] of Object.entries(payloadFile || {})) {
      if (!stockCodes.has(String(code))) continue;
      const dateKeys = Object.keys(item || {})
        .filter(key => /^20\d{2}[/-]\d{2}[/-]\d{2}$/.test(key))
        .sort();
      for (const dateKey of dateKeys) {
        const rowDate = compactDate(dateKey);
        if (cutoff && rowDate > cutoff) continue;
        const row = item[dateKey] || {};
        const close = finiteNumber(row.Price ?? row.Close);
        const volume = finiteNumber(row.Volume);
        if (close === null || volume === null || close <= 0) continue;
        if (!history.has(String(code))) history.set(String(code), new Map());
        history.get(String(code)).set(rowDate, {
          date: rowDate,
          close,
          volume,
          traded_value: close * volume,
        });
      }
    }
  }

  const raw = new Map();
  const medians = [];
  for (const stock of stocks) {
    const code = String(stock.stock_code || '');
    const rows = [...(history.get(code)?.values() || [])]
      .sort((left, right) => left.date.localeCompare(right.date))
      .filter(row => Number.isFinite(row.traded_value) && row.traded_value >= 0)
      .slice(-20);
    const medianValue = rows.length >= 20 ? median(rows.map(row => row.traded_value)) : null;
    const latestVolume = rows.at(-1)?.volume ?? null;
    if (Number.isFinite(medianValue)) medians.push(medianValue);
    raw.set(code, {
      valid_days: rows.length,
      median_traded_value_20d: medianValue,
      latest_volume: latestVolume,
      latest_date: rows.at(-1)?.date || null,
    });
  }

  const threshold = percentile(medians, 0.3);
  const available = Number.isFinite(threshold);
  const byCode = new Map();
  for (const [code, item] of raw.entries()) {
    const pass = available
      && item.valid_days >= 20
      && Number.isFinite(item.latest_volume)
      && item.latest_volume > 0
      && Number.isFinite(item.median_traded_value_20d)
      && item.median_traded_value_20d >= threshold;
    byCode.set(code, {
      ...item,
      pass: available ? pass : null,
      reason: !available
        ? 'cross_section_threshold_unavailable'
        : item.valid_days < 20
          ? 'less_than_20_valid_days'
          : !Number.isFinite(item.latest_volume) || item.latest_volume <= 0
            ? 'latest_volume_zero_or_missing'
            : pass ? 'passed' : 'below_market_30th_percentile',
    });
  }

  const availableStockCount = available ? byCode.size : 0;
  return {
    calculation_status: available ? 'completed' : 'unable_to_calculate',
    calculation_message: available
      ? '已依二十日成交值中位數與全市場第 30 百分位完成流動性判斷。'
      : '可計算二十日成交值中位數的股票不足，無法建立全市場門檻。',
    cutoff_date: cutoff || null,
    threshold_percentile: 30,
    threshold_value: available ? Math.round(threshold * 100) / 100 : null,
    valid_cross_section_count: medians.length,
    total_stock_count: stocks.length,
    available_stock_count: availableStockCount,
    qualified_stock_count: available
      ? [...byCode.values()].filter(item => item.pass === true).length
      : null,
    coverage_pct: stocks.length
      ? Math.round((availableStockCount / stocks.length) * 10000) / 100
      : null,
    source_files: files.map(file => `data_fubon/${file}`),
    by_code: byCode,
  };
}

function enrichLiquidityFeatures(payload, workspaceRoot, dataAsOf) {
  const context = loadLiquidityContext(payload, workspaceRoot, dataAsOf);
  payload.stocks = (payload.stocks || []).map(stock => {
    const code = String(stock.stock_code || '');
    const detail = context.by_code.get(code) || null;
    return {
      ...stock,
      strategy_tag_features: {
        ...(stock.strategy_tag_features || {}),
        liquidity_qualified: context.calculation_status === 'completed'
          ? detail?.pass === true
          : null,
        liquidity_valid_days: detail?.valid_days ?? 0,
        liquidity_median_traded_value_20d: detail?.median_traded_value_20d ?? null,
        liquidity_threshold_value: context.threshold_value,
        liquidity_latest_date: detail?.latest_date ?? null,
        liquidity_reason: detail?.reason || context.calculation_status,
      },
    };
  });
  const { by_code: ignored, ...metadata } = context;
  payload.strategy_tag_source_metadata = {
    ...(payload.strategy_tag_source_metadata || {}),
    liquidity: metadata,
  };
  return metadata;
}

function enrichDispositionFeatures(payload, workspaceRoot, forecastDate) {
  const date = compactDate(forecastDate || payload?.forecast_date);
  const sourceFile = date
    ? path.join(workspaceRoot, 'data_market_constraints', date, 'disposition.json')
    : '';
  const source = sourceFile ? readJson(sourceFile, null) : null;
  const sourceDate = compactDate(source?.target_date);
  const complete = source?.complete_market_coverage === true && sourceDate === date;
  const activeCodes = new Set(complete ? (source.active_stock_codes || []).map(String) : []);
  let matchedStockCount = 0;
  payload.stocks = (payload.stocks || []).map(stock => {
    const active = complete ? activeCodes.has(String(stock.stock_code || '')) : null;
    if (active === true) matchedStockCount += 1;
    return {
      ...stock,
      strategy_tag_features: {
        ...(stock.strategy_tag_features || {}),
        disposition_stock: active,
        disposition_source_date: complete ? sourceDate : null,
      },
    };
  });
  const metadata = {
    calculation_status: complete ? 'completed' : 'unable_to_calculate',
    calculation_message: complete
      ? 'TWSE 與 TPEx 官方處置資料完整，所有股票均可判定。'
      : source
        ? '處置資料存在，但市場覆蓋不完整或日期不一致。'
        : '缺少指定預測日期的官方處置資料。',
    target_date: date || null,
    source_file: source ? `data_market_constraints/${date}/disposition.json` : null,
    complete_market_coverage: complete,
    active_stock_count: complete ? activeCodes.size : null,
    matched_prediction_stock_count: complete ? matchedStockCount : null,
    total_stock_count: payload.stocks.length,
    available_stock_count: complete ? payload.stocks.length : 0,
    coverage_pct: payload.stocks.length ? (complete ? 100 : 0) : null,
  };
  payload.strategy_tag_source_metadata = {
    ...(payload.strategy_tag_source_metadata || {}),
    disposition: metadata,
  };
  return metadata;
}

function enrichBearMarketFeatures(payload, workspaceRoot, forecastDate) {
  const date = compactDate(forecastDate || payload?.forecast_date);
  const sourceFile = date
    ? path.join(workspaceRoot, 'data_market_environment', date, 'market_environment.json')
    : '';
  const source = sourceFile ? readJson(sourceFile, null) : null;
  const environmentCode = source?.environment?.code || null;
  const policyState = source
    ? normalizePolicyState(source?.strategy_policy?.relative_leadership_momentum)
    : null;
  const complete = Boolean(source && environmentCode && policyState);
  const active = complete
    ? POST_SHOCK_CODES.has(environmentCode) && policyState === 'restricted_shadow'
    : null;

  payload.stocks = (payload.stocks || []).map(stock => {
    const profile = confirmationProfile(stock);
    return {
      ...stock,
      strategy_tag_features: {
        ...(stock.strategy_tag_features || {}),
        market_environment_code: complete ? environmentCode : null,
        relative_leadership_policy_state: complete ? policyState : null,
        bear_market_environment_active: active,
        bear_market_confirmation_score: profile.score,
        bear_market_confirmation_signals: profile.signals,
        relative_strength_7d: profile.metrics.relative_strength_7d,
      },
    };
  });

  const metadata = {
    calculation_status: complete ? 'completed' : 'unable_to_calculate',
    calculation_message: complete
      ? active
        ? '市場環境符合衝擊後限制模式，已啟用熊市防禦標籤。'
        : '市場環境資料完整，但目前不是衝擊後限制模式。'
      : '缺少指定預測日期的市場環境或策略政策資料。',
    target_date: date || null,
    source_file: source ? `data_market_environment/${date}/market_environment.json` : null,
    environment_code: complete ? environmentCode : null,
    policy_state: complete ? policyState : null,
    active,
    total_stock_count: payload.stocks.length,
    available_stock_count: complete ? payload.stocks.length : 0,
    coverage_pct: payload.stocks.length ? (complete ? 100 : 0) : null,
  };
  payload.strategy_tag_source_metadata = {
    ...(payload.strategy_tag_source_metadata || {}),
    market_environment: metadata,
  };
  return metadata;
}

function enrichStrategyTagSources(payload, workspaceRoot, options = {}) {
  const historicalFactors = enrichHistoricalFactorFeatures(
    payload,
    workspaceRoot,
    options.dataAsOf,
  );
  const marketEnvironment = enrichBearMarketFeatures(
    payload,
    workspaceRoot,
    options.forecastDate,
  );
  const liquidity = enrichLiquidityFeatures(payload, workspaceRoot, options.dataAsOf);
  const disposition = enrichDispositionFeatures(payload, workspaceRoot, options.forecastDate);
  return {
    historical_factors_round_1: historicalFactors,
    market_environment: marketEnvironment,
    liquidity,
    disposition,
  };
}

module.exports = {
  compactDate,
  finiteNumber,
  readJson,
  percentile,
  median,
  earliestCutoff,
  loadLiquidityContext,
  enrichLiquidityFeatures,
  enrichDispositionFeatures,
  enrichBearMarketFeatures,
  enrichStrategyTagSources,
};
