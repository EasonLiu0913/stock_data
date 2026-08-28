#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
} = require('./market_environment_lib');
const {
  isTradingDate,
  loadHolidaySet,
  nextTradingDate,
  previousTradingDate,
} = require('./resolve_forecast_dates');

const SMA_DIR = path.join(ROOT, 'data_fubon');

function taipeiParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    isoDate: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function compact(iso) {
  return String(iso).replaceAll('-', '');
}

function requiredCoreFiles(baseDate) {
  return [
    'data_twse/twse_industry_Stock.json',
    'data_history_sma/non_trading_days.json',
    'public/index.html',
    'config/stock_news_aliases.json',
    `data_fubon/fubon_${baseDate}_sma.json`,
    `data_twse_institutional_investors/${baseDate}_twse_institutional_investors.json`,
    `data_twse_margin_balance/${baseDate}_twse_margin_balance.csv`,
    `data_fubon_broker_details/fubon_${baseDate}_券商分點進出明細.json`,
    `data_twse_mi_index/${baseDate}_twse_mi_index.json`,
    `data_market_news/${baseDate}/market_news.json`,
  ];
}

function fileIsUsable(relativePath) {
  try {
    const stat = fs.statSync(path.join(ROOT, relativePath));
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function inspectCoreFiles(baseDate) {
  const files = requiredCoreFiles(baseDate);
  const missing = files.filter((file) => !fileIsUsable(file));
  return { complete: missing.length === 0, files, missing };
}

function latestEligibleBaseDate(now = new Date(), holidays = loadHolidaySet(), options = {}) {
  const parts = taipeiParts(now);

  // Scheduled daily prediction runs are logically pre-open runs. GitHub Actions can
  // start a scheduled job hours late, so never let runner queue delay move the base
  // date from the previous completed trading day to the current trading day.
  if (options.scheduledBeforeOpen === true) {
    return previousTradingDate(parts.isoDate, holidays, false);
  }

  const todayIsTrading = isTradingDate(parts.isoDate, holidays);
  const marketDataReadyMinutes = 15 * 60 + 30;
  const minutes = parts.hour * 60 + parts.minute;

  if (todayIsTrading && minutes >= marketDataReadyMinutes) return parts.isoDate;
  return previousTradingDate(parts.isoDate, holidays, !todayIsTrading);
}

function candidateSmaDates(maxCompactDate, holidays = loadHolidaySet()) {
  let names = [];
  try {
    names = fs.readdirSync(SMA_DIR);
  } catch {
    return [];
  }
  const dates = new Set();
  for (const name of names) {
    const match = name.match(/^fubon_(20\d{6})_sma\.json$/);
    if (!match) continue;
    const date = match[1];
    if (date > maxCompactDate) continue;
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    if (isTradingDate(iso, holidays)) dates.add(date);
  }
  return [...dates].sort((a, b) => b.localeCompare(a));
}

function resolveLatestCompletePredictionBase(now = new Date(), holidays = loadHolidaySet(), options = {}) {
  const expectedBaseIso = latestEligibleBaseDate(now, holidays, options);
  const expectedBaseCompact = compact(expectedBaseIso);
  const inspection = inspectCoreFiles(expectedBaseCompact);

  if (!inspection.complete) {
    const details = inspection.missing.map((file) => `- ${file}`).join('\n');
    throw new Error(
      `最新應有預測基準日 ${expectedBaseCompact} 的必要資料尚未完整；為避免使用過期資料，禁止自動退回更早交易日。` +
      `${details ? `\n缺少：\n${details}` : ''}`
    );
  }

  const forecastIso = nextTradingDate(expectedBaseIso, holidays, false);
  return {
    mode: options.scheduledBeforeOpen === true
      ? 'auto_scheduled_before_open_base'
      : 'auto_exact_latest_eligible_base',
    base_trade_date: expectedBaseCompact,
    forecast_target_date: compact(forecastIso),
    latest_eligible_base_date: expectedBaseCompact,
    checked_candidates: 1,
    skipped_incomplete_candidates: [],
    stale_fallback_allowed: false,
    schedule_delay_safe: options.scheduledBeforeOpen === true,
  };
}

function main() {
  const scheduledBeforeOpen = process.argv.includes('--scheduled-before-open');
  const result = resolveLatestCompletePredictionBase(
    new Date(),
    loadHolidaySet(),
    { scheduledBeforeOpen },
  );
  const json = process.argv.includes('--json');
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${result.forecast_target_date}\n`);
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

module.exports = {
  candidateSmaDates,
  inspectCoreFiles,
  latestEligibleBaseDate,
  requiredCoreFiles,
  resolveLatestCompletePredictionBase,
};
