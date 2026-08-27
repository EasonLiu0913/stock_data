#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  parseArgs,
  compactDate,
  readJson,
  sha256,
} = require('./market_environment_lib');

const SENTINEL_STOCKS = ['1101', '2330', '2317', '2882'];
const PRIMARY_EXTERNAL_IDS = ['nasdaq', 'sp500', 'dow', 'sox', 'tsm_adr'];
const REQUIRED_METRICS = [
  'sox_change_1d_pct',
  'sox_return_3d_pct',
  'tsm_adr_change_1d_pct',
  'twse_change_1d_pct',
  'twse_return_3d_pct',
  'twse_minus_sox_3d_pct_points',
  'foreign_futures_net_contracts',
  'foreign_futures_net_change_contracts',
  'market_risk_score',
  'adr_sox_nasdaq_market_risk',
];

function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`, 'utf8');
}

function compactDatesIn(value) {
  return String(value || '').match(/20\d{6}/g) || [];
}

function assertFiniteNumber(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`${label} must be a finite number; got ${value}`);
  return numeric;
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a non-empty object`);
}

function assertExistingNonEmptyFile(relativePath, label) {
  if (!relativePath || typeof relativePath !== 'string') throw new Error(`${label} source path is missing`);
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`${label} source file is missing: ${relativePath}`);
  if (fs.statSync(absolutePath).size === 0) throw new Error(`${label} source file is empty: ${relativePath}`);
  return absolutePath;
}

function assertDateInFilename(relativePath, expectedDate, label, { allowEarlier = false } = {}) {
  const dates = compactDatesIn(relativePath);
  if (dates.length === 0) throw new Error(`${label} source filename/path does not contain a YYYYMMDD date: ${relativePath}`);
  const sourceDate = dates.at(-1);
  if (allowEarlier) {
    if (sourceDate > expectedDate) throw new Error(`${label} source date exceeds base trade date: ${sourceDate} > ${expectedDate}`);
  } else if (sourceDate !== expectedDate) {
    throw new Error(`${label} source date mismatch: expected ${expectedDate}, got ${sourceDate}`);
  }
  return sourceDate;
}

function assertSnapshotRequiredFields(payload) {
  const required = [
    ['schemaVersion', payload.schemaVersion],
    ['generated_at', payload.generated_at],
    ['forecast_date', payload.forecast_date],
    ['forecast_date_compact', payload.forecast_date_compact],
    ['base_trade_date', payload.base_trade_date],
    ['base_trade_date_compact', payload.base_trade_date_compact],
    ['information_cutoff', payload.information_cutoff],
    ['mode', payload.mode],
    ['data_freshness.status', payload.data_freshness?.status],
    ['data_freshness.expected_us_market_date', payload.data_freshness?.expected_us_market_date],
    ['data_freshness.actual_us_market_date', payload.data_freshness?.actual_us_market_date],
    ['environment.code', payload.environment?.code],
    ['environment.label', payload.environment?.label],
    ['environment.score', payload.environment?.score],
    ['snapshot_hash', payload.snapshot_hash],
  ];
  for (const [label, value] of required) {
    if (value === undefined || value === null || value === '') throw new Error(`Required market environment field is missing: ${label}`);
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Required market environment field is not finite: ${label}`);
  }
  assertObject(payload.source_files, 'source_files');
  assertObject(payload.metrics, 'metrics');
  assertObject(payload.environment, 'environment');
}

function validateSnapshotMetrics(payload) {
  for (const key of REQUIRED_METRICS) assertFiniteNumber(payload.metrics?.[key], `metrics.${key}`);

  for (const key of [
    'sox_change_1d_pct', 'sox_return_3d_pct', 'tsm_adr_change_1d_pct',
    'twse_change_1d_pct', 'twse_return_3d_pct', 'twse_minus_sox_3d_pct_points',
  ]) {
    const value = Number(payload.metrics[key]);
    if (Math.abs(value) > 50) throw new Error(`metrics.${key} is outside the sanity range ±50%: ${value}`);
  }

  for (const key of ['market_risk_score', 'adr_sox_nasdaq_market_risk']) {
    const value = Number(payload.metrics[key]);
    if (value < 0 || value > 100) throw new Error(`metrics.${key} is outside the expected 0-100 range: ${value}`);
  }

  for (const key of ['foreign_futures_net_contracts', 'foreign_futures_net_change_contracts']) {
    const value = Number(payload.metrics[key]);
    if (Math.abs(value) > 2000000) throw new Error(`metrics.${key} is implausibly large: ${value}`);
  }
}

function validateExternalMarket(payload, baseDate) {
  const relativePath = payload.source_files?.external_market;
  const absolutePath = assertExistingNonEmptyFile(relativePath, 'external_market');
  assertDateInFilename(relativePath, baseDate, 'external_market', { allowEarlier: true });
  const external = readJson(absolutePath, null);
  assertObject(external, 'external_market payload');

  if (!Array.isArray(external.indicators)) throw new Error('external_market indicators must be an array');
  if (external.indicators.length < 5) throw new Error(`external_market indicator count is too small: ${external.indicators.length}`);
  if (Number(external.error_count) !== 0) throw new Error(`external_market error_count must be 0; got ${external.error_count}`);

  const actualDate = String(payload.data_freshness?.actual_us_market_date || '');
  for (const id of PRIMARY_EXTERNAL_IDS) {
    const indicator = external.indicators.find((item) => item?.id === id);
    if (!indicator) throw new Error(`external_market primary indicator is missing: ${id}`);
    if (String(indicator.market_date || '') !== actualDate) {
      throw new Error(`external_market ${id} date mismatch: expected ${actualDate}, got ${indicator.market_date}`);
    }
    const open = assertFiniteNumber(indicator.open, `external_market ${id}.open`);
    const high = assertFiniteNumber(indicator.high, `external_market ${id}.high`);
    const low = assertFiniteNumber(indicator.low, `external_market ${id}.low`);
    const close = assertFiniteNumber(indicator.close, `external_market ${id}.close`);
    const changePercent = assertFiniteNumber(indicator.change_percent, `external_market ${id}.change_percent`);
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) throw new Error(`external_market ${id} contains non-positive OHLC values`);
    if (high < low || high < open || high < close || low > open || low > close) throw new Error(`external_market ${id} OHLC relationship is invalid`);
    if (Math.abs(changePercent) > 50) throw new Error(`external_market ${id} change_percent is implausible: ${changePercent}`);
    if (!Array.isArray(indicator.rows) || indicator.rows.length < 3) throw new Error(`external_market ${id} history is incomplete`);
  }

  if (external.indicator_count !== undefined && Number(external.indicator_count) !== external.indicators.length) {
    throw new Error(`external_market indicator_count mismatch: declared ${external.indicator_count}, actual ${external.indicators.length}`);
  }
}

function validateMarketRisk(payload, baseDate) {
  const relativePath = payload.source_files?.market_risk;
  const absolutePath = assertExistingNonEmptyFile(relativePath, 'market_risk');
  assertDateInFilename(relativePath, baseDate, 'market_risk', { allowEarlier: true });
  const risk = readJson(absolutePath, null);
  assertObject(risk, 'market_risk payload');
  if (risk.date && String(risk.date) > baseDate) throw new Error(`market_risk payload date exceeds base trade date: ${risk.date}`);
  const score = assertFiniteNumber(risk.market_risk_score, 'market_risk.market_risk_score');
  if (score < 0 || score > 100) throw new Error(`market_risk.market_risk_score is outside 0-100: ${score}`);
  if (risk.news?.article_count !== undefined) {
    const articles = assertFiniteNumber(risk.news.article_count, 'market_risk.news.article_count');
    if (articles < 0) throw new Error(`market_risk.news.article_count cannot be negative: ${articles}`);
  }
}

function validateReferencedSources(payload, baseDate) {
  for (const key of ['twse_index', 'foreign_futures']) {
    const relativePath = payload.source_files?.[key];
    assertExistingNonEmptyFile(relativePath, key);
    assertDateInFilename(relativePath, baseDate, key);
  }
}

function validateStockUniverse(baseDate) {
  const relativePath = `data_fubon/fubon_${baseDate}_sma.json`;
  const absolutePath = assertExistingNonEmptyFile(relativePath, 'price_sma');
  const sma = readJson(absolutePath, null);
  assertObject(sma, 'price_sma payload');

  const stockCodes = Object.keys(sma).filter((code) => /^\d{4,6}$/.test(code));
  if (stockCodes.length < 900) throw new Error(`price_sma stock universe is too small: ${stockCodes.length} < 900`);

  const dateKey = `${baseDate.slice(0, 4)}/${baseDate.slice(4, 6)}/${baseDate.slice(6, 8)}`;
  let validBaseDateRows = 0;
  for (const code of stockCodes) {
    const row = sma[code]?.[dateKey];
    if (!row) continue;
    const values = ['Price', 'Open', 'High', 'Low', 'Volume'].map((key) => Number(row[key]));
    if (values.every(Number.isFinite)) validBaseDateRows += 1;
  }
  if (validBaseDateRows < 900) throw new Error(`price_sma valid base-date rows are too few: ${validBaseDateRows} < 900`);

  for (const code of SENTINEL_STOCKS) {
    const stock = sma[code];
    if (!stock) throw new Error(`price_sma sentinel stock is missing: ${code}`);
    const row = stock[dateKey];
    if (!row) throw new Error(`price_sma sentinel ${code} is missing base-date row ${dateKey}`);
    const price = assertFiniteNumber(row.Price, `price_sma ${code}.Price`);
    const open = assertFiniteNumber(row.Open, `price_sma ${code}.Open`);
    const high = assertFiniteNumber(row.High, `price_sma ${code}.High`);
    const low = assertFiniteNumber(row.Low, `price_sma ${code}.Low`);
    const volume = assertFiniteNumber(row.Volume, `price_sma ${code}.Volume`);
    if (price <= 0 || open <= 0 || high <= 0 || low <= 0 || volume < 0) throw new Error(`price_sma sentinel ${code} has invalid price/volume values`);
    if (high < low || high < open || high < price || low > open || low > price) throw new Error(`price_sma sentinel ${code} has invalid OHLC relationship`);
  }
}

function assertPostCutoffSnapshotIsLeakageSafe(payload, forecastDate, baseDate) {
  if (baseDate >= forecastDate) {
    throw new Error(`Post-cutoff current-day snapshot requires a prior base trade date: base=${baseDate}, forecast=${forecastDate}`);
  }

  const sourceFiles = payload.source_files || {};
  for (const [source, file] of Object.entries(sourceFiles)) {
    if (!file) continue;
    const futureDates = compactDatesIn(file).filter((date) => date > baseDate);
    if (futureDates.length > 0) {
      throw new Error(`Post-cutoff snapshot source exceeds base trade date: ${source}=${file}`);
    }
  }

  const freshness = payload.data_freshness || {};
  for (const [field, value] of [
    ['actual_us_market_date', freshness.actual_us_market_date],
    ['source_directory_date', freshness.source_directory_date],
  ]) {
    if (value && (!/^20\d{6}$/.test(String(value)) || String(value) > baseDate)) {
      throw new Error(`Post-cutoff snapshot ${field} exceeds base trade date: ${value}`);
    }
  }
}

function main() {
  const args = parseArgs();
  const forecastDate = compactDate(args.get('forecast-date') || process.env.FORECAST_TARGET_DATE, 'forecast date');
  const baseDate = compactDate(args.get('base-date') || process.env.FORECAST_BASE_DATE, 'base date');
  const allowHistorical = args.has('allow-historical-reconstruction');
  const file = path.join(ROOT, 'data_market_environment', forecastDate, 'market_environment.json');
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`Missing market environment snapshot: ${path.relative(ROOT, file)}`);
  const payload = readJson(file, {});

  assertSnapshotRequiredFields(payload);
  if (payload.forecast_date_compact !== forecastDate) throw new Error('Market environment forecast date mismatch');
  if (payload.base_trade_date_compact !== baseDate) throw new Error('Market environment base date mismatch');
  if (payload.mode !== 'shadow') throw new Error(`Unsupported environment mode: ${payload.mode}`);
  if (payload.environment?.code === 'data_invalid') throw new Error('Market environment is marked data_invalid');
  if (!['fresh', 'holiday_adjusted'].includes(payload.data_freshness?.status)) {
    throw new Error(`Market environment freshness is not acceptable: ${payload.data_freshness?.status}`);
  }
  if (payload.historical_reconstruction && !allowHistorical) {
    throw new Error('Historical reconstruction cannot be used as a live immutable snapshot without explicit allowance');
  }

  validateSnapshotMetrics(payload);
  validateExternalMarket(payload, baseDate);
  validateMarketRisk(payload, baseDate);
  validateReferencedSources(payload, baseDate);
  validateStockUniverse(baseDate);

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).replaceAll('-', '');
  if (forecastDate === today && !allowHistorical) {
    const cutoff = Date.parse(`${forecastDate.slice(0, 4)}-${forecastDate.slice(4, 6)}-${forecastDate.slice(6, 8)}T09:00:00+08:00`);
    const generatedAt = Date.parse(payload.generated_at || '');
    if (!Number.isFinite(generatedAt)) {
      throw new Error('Current-day market environment snapshot has an invalid generated_at timestamp');
    }
    if (generatedAt > cutoff) {
      assertPostCutoffSnapshotIsLeakageSafe(payload, forecastDate, baseDate);
      console.warn(`Current-day snapshot was generated after 09:00 Taipei (${payload.generated_at}); accepted because all dated sources are capped at base trade date ${baseDate}`);
    }
  }

  const { snapshot_hash: storedHash, ...withoutHash } = payload;
  const actualHash = sha256(withoutHash);
  if (!storedHash || storedHash !== actualHash) throw new Error('Market environment snapshot hash mismatch');

  writeOutput('environment_code', payload.environment.code);
  writeOutput('environment_label', payload.environment.label);
  writeOutput('snapshot_hash', payload.snapshot_hash);
  writeOutput('environment_file', path.relative(ROOT, file).replaceAll(path.sep, '/'));
  writeOutput('integrity_valid', 'true');
  console.log(JSON.stringify({
    valid: true,
    forecast_date: forecastDate,
    base_date: baseDate,
    environment: payload.environment.code,
    freshness: payload.data_freshness.status,
    stock_universe_minimum: 900,
    sentinel_stocks: SENTINEL_STOCKS,
    snapshot_hash: payload.snapshot_hash,
  }));
}

if (require.main === module) main();

module.exports = {
  main,
  validateSnapshotMetrics,
  validateExternalMarket,
  validateMarketRisk,
  validateReferencedSources,
  validateStockUniverse,
};
