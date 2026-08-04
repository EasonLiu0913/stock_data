#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildRequestUrl,
  normalizeDateInput,
  refreshFilesJson,
  savePayloadSafely,
  validatePayload,
} = require('./crawl_twse_twt49u');

const OUTPUT_DIR = path.join(__dirname, '../data_twse_twt49u');
const RATE_LIMIT_STATUS_CODES = new Set([307, 429, 503]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 90000;
const EMPTY_FIELDS = [
  '資料日期',
  '股票代號',
  '股票名稱',
  '除權息前收盤價',
  '除權息參考價',
  '權值+息值',
  '權/息',
  '漲停價格',
  '跌停價格',
  '開盤競價基準',
  '減除股利參考價',
  '詳細資料',
  '最近一次申報資料 季別/日期',
  '最近一次申報每股 (單位)淨值',
  '最近一次申報每股 (單位)盈餘',
];

function getArg(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function getNumberArg(args, flag, fallback) {
  const value = getArg(args, flag);
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid ${flag}: ${value}`);
  }
  return number;
}

function getTaipeiTodayCompact(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}`;
}

function isNoMatchingDataStat(value) {
  return /沒有符合條件的資料/.test(String(value || ''));
}

function formatEmptyTitle(targetDate) {
  const year = Number(targetDate.slice(0, 4)) - 1911;
  const month = targetDate.slice(4, 6);
  const day = targetDate.slice(6, 8);
  const dateText = `${year}年${month}月${day}日`;
  return `${dateText} 至 ${dateText} 除權除息計算結果表（無符合條件資料）`;
}

function normalizeResponsePayload(payload, targetDate) {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.stat === 'OK') return payload;
  if (!isNoMatchingDataStat(payload.stat)) return payload;

  const originalStat = String(payload.stat);
  return {
    ...payload,
    stat: 'OK',
    title: payload.title || formatEmptyTitle(targetDate),
    fields: Array.isArray(payload.fields) && payload.fields.length
      ? payload.fields
      : EMPTY_FIELDS,
    data: [],
    extraNotes: Array.isArray(payload.extraNotes) ? payload.extraNotes : [],
    notes: Array.isArray(payload.notes) ? payload.notes : [],
    formula: Array.isArray(payload.formula) ? payload.formula : [],
    strDate: payload.strDate || targetDate,
    endDate: payload.endDate || targetDate,
    noData: true,
    sourceStat: originalStat,
    normalization: {
      type: 'twse_no_matching_records',
      requestedDate: targetDate,
      note: 'TWSE returned no matching TWT49U records; stored as a valid empty snapshot.',
    },
  };
}

async function fetchTwt49uSafeOnce(date, fetchImpl = fetch) {
  const response = await fetchImpl(buildRequestUrl(date), {
    headers: {
      accept: 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    const error = new Error(`TWSE request failed: ${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  const rawPayload = await response.json();
  const payload = normalizeResponsePayload(rawPayload, date);
  validatePayload(payload, date);
  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTwt49uSafe(date, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxRetries = Number.isInteger(options.maxRetries)
    ? options.maxRetries
    : DEFAULT_MAX_RETRIES;
  const cooldownMs = Number.isInteger(options.rateLimitCooldownMs)
    ? options.rateLimitCooldownMs
    : DEFAULT_RATE_LIMIT_COOLDOWN_MS;

  let attempt = 0;
  while (true) {
    try {
      return await fetchTwt49uSafeOnce(date, fetchImpl);
    } catch (error) {
      attempt += 1;
      if (!RATE_LIMIT_STATUS_CODES.has(error.status) || attempt > maxRetries) throw error;
      const waitMs = cooldownMs * attempt;
      console.log(`🕒 Got ${error.status}; cooling down ${Math.round(waitMs / 1000)}s before retry ${attempt}/${maxRetries}`);
      await sleep(waitMs);
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  const targetDate = normalizeDateInput(getArg(argv, '--date')) || getTaipeiTodayCompact();
  const force = argv.includes('--force');
  const maxRetries = getNumberArg(argv, '--max-retries', DEFAULT_MAX_RETRIES);
  const rateLimitCooldownMs = getNumberArg(
    argv,
    '--rate-limit-cooldown',
    DEFAULT_RATE_LIMIT_COOLDOWN_MS,
  );

  const payload = await fetchTwt49uSafe(targetDate, {
    maxRetries,
    rateLimitCooldownMs,
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${targetDate}_twt49u.json`);
  const result = savePayloadSafely(outputPath, payload, targetDate, { force });
  const filesPath = refreshFilesJson();

  console.log(`✅ TWT49U ${result.status}: ${payload.title || targetDate}`);
  if (payload.noData === true) {
    console.log(`🟦 ${targetDate}: TWSE confirmed no matching TWT49U records; archived as data: []`);
  }
  console.log(`📁 ${outputPath}`);
  console.log(`📁 ${filesPath}`);
  console.log(`📊 Rows: ${result.oldRows ?? 'new'} -> ${result.newRows}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Failed to crawl TWSE TWT49U data: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  EMPTY_FIELDS,
  fetchTwt49uSafe,
  fetchTwt49uSafeOnce,
  formatEmptyTitle,
  isNoMatchingDataStat,
  normalizeResponsePayload,
};
