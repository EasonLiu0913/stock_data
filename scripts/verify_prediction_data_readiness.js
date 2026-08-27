#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolveForecastDates } = require('./resolve_forecast_dates');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, '.prediction-data-readiness.json');

function compact(value) {
  const normalized = String(value || '').replace(/[^\d]/g, '');
  if (!/^20\d{6}$/.test(normalized)) throw new Error(`Invalid compact date: ${value}`);
  return normalized;
}

function iso(value) {
  const c = compact(value);
  return `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;
}

function readJson(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  const text = fs.readFileSync(absolute, 'utf8').trim();
  if (!text) throw new Error(`empty JSON: ${relativePath}`);
  return JSON.parse(text);
}

function usable(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  try {
    const stat = fs.statSync(absolute);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function normalizePayloadDate(value) {
  if (!value) return null;
  const digits = String(value).replace(/[^\d]/g, '');
  return /^20\d{6}$/.test(digits) ? digits : null;
}

function detectJsonDate(relativePath, candidates = []) {
  const payload = readJson(relativePath);
  for (const key of candidates) {
    const parts = key.split('.');
    let value = payload;
    for (const part of parts) value = value?.[part];
    const date = normalizePayloadDate(value);
    if (date) return date;
  }
  return null;
}

function sourceDefinitions(baseDate) {
  return [
    {
      id: 'price_sma',
      label: '個股價格與技術指標',
      required: true,
      expected_date: baseDate,
      path: `data_fubon/fubon_${baseDate}_sma.json`,
    },
    {
      id: 'institutional',
      label: '三大法人',
      required: true,
      expected_date: baseDate,
      path: `data_twse_institutional_investors/${baseDate}_twse_institutional_investors.json`,
      json_date_fields: ['date', 'trade_date', 'data_date'],
    },
    {
      id: 'margin',
      label: '融資融券',
      required: true,
      expected_date: baseDate,
      path: `data_twse_margin_balance/${baseDate}_twse_margin_balance.csv`,
    },
    {
      id: 'broker',
      label: '券商分點',
      required: true,
      expected_date: baseDate,
      path: `data_fubon_broker_details/fubon_${baseDate}_券商分點進出明細.json`,
      json_date_fields: ['date', 'tradeDate', 'trade_date'],
    },
    {
      id: 'twse_index',
      label: '大盤指數',
      required: true,
      expected_date: baseDate,
      path: `data_twse_mi_index/${baseDate}_twse_mi_index.json`,
      json_date_fields: ['date', 'trade_date'],
    },
    {
      id: 'market_news',
      label: '市場新聞',
      required: true,
      expected_date: baseDate,
      path: `data_market_news/${baseDate}/market_news.json`,
      json_date_fields: ['date', 'target_date', 'data_date'],
    },
  ];
}

function inspectSource(definition) {
  const result = {
    id: definition.id,
    label: definition.label,
    required: definition.required,
    expected_date: definition.expected_date,
    actual_date: null,
    path: definition.path,
    status: 'missing',
    reason: null,
  };

  if (!usable(definition.path)) {
    result.reason = 'required file missing or empty';
    return result;
  }

  const filenameDate = normalizePayloadDate(definition.path.match(/20\d{6}/)?.[0]);
  let payloadDate = null;
  if (definition.json_date_fields?.length) {
    try {
      payloadDate = detectJsonDate(definition.path, definition.json_date_fields);
    } catch (error) {
      result.status = 'invalid';
      result.reason = `invalid JSON: ${error.message}`;
      return result;
    }
  }

  result.actual_date = payloadDate || filenameDate;
  if (!result.actual_date) {
    result.status = 'invalid';
    result.reason = 'unable to determine source date';
    return result;
  }
  if (result.actual_date !== definition.expected_date) {
    result.status = result.actual_date < definition.expected_date ? 'stale' : 'future';
    result.reason = `expected ${definition.expected_date}, got ${result.actual_date}`;
    return result;
  }

  result.status = 'fresh';
  return result;
}

function writeSummary(report) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const rows = Object.values(report.sources).map((source) =>
    `| ${source.label} | ${source.expected_date} | ${source.actual_date || '-'} | ${source.status} |`
  );
  const lines = [
    '## 預測資料日期契約',
    '',
    `- 預測交易日：\`${report.forecast_date}\``,
    `- 必須使用的基準交易日：\`${report.base_trade_date}\``,
    `- 正式預測是否允許：**${report.ready ? 'YES' : 'NO'}**`,
    `- 過期資料自動 fallback：**禁止**`,
    '',
    '| 資料來源 | 預期日期 | 實際日期 | 狀態 |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const resolved = resolveForecastDates();
  const baseDate = compact(process.env.FORECAST_BASE_DATE || resolved.base_trade_date_compact);
  const forecastDate = compact(process.env.FORECAST_TARGET_DATE || resolved.forecast_date_compact);
  const sourceList = sourceDefinitions(baseDate).map(inspectSource);
  const blocking = sourceList.filter((source) => source.required && source.status !== 'fresh');

  const report = {
    schema_version: 1,
    checked_at: new Date().toISOString(),
    forecast_date: forecastDate,
    forecast_date_iso: iso(forecastDate),
    base_trade_date: baseDate,
    base_trade_date_iso: iso(baseDate),
    ready: blocking.length === 0,
    stale_fallback_allowed: false,
    sources: Object.fromEntries(sourceList.map((source) => [source.id, source])),
    blocking_sources: blocking.map((source) => source.id),
  };

  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeSummary(report);
  console.log(JSON.stringify(report, null, 2));

  if (!report.ready) {
    const details = blocking.map((source) => `${source.label}: ${source.status} (${source.reason || source.path})`).join('; ');
    throw new Error(`Prediction data readiness failed: ${details}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { inspectSource, sourceDefinitions };
