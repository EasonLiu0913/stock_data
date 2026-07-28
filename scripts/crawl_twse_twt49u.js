#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const API_URL = 'https://www.twse.com.tw/rwd/zh/exRight/TWT49U';
const OUTPUT_DIR = path.join(__dirname, '../data_twse_twt49u');
const RATE_LIMIT_STATUS_CODES = new Set([307, 429, 503]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 90000;
const DEFAULT_MIN_ROW_RATIO = 0.5;

function getArg(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function getPositionalDate(args) {
  const flagsWithValue = new Set(['--date', '--max-retries', '--rate-limit-cooldown']);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (flagsWithValue.has(arg)) {
      index += 1;
      continue;
    }
    if (/^\d{8}$/.test(arg)) return arg;
  }
  return '';
}

function normalizeDateInput(value) {
  if (!value) return '';
  const normalized = String(value).replace(/[/-]/g, '');
  if (!/^20\d{6}$/.test(normalized)) {
    throw new Error(`Invalid date: ${value}. Expected YYYYMMDD, YYYY-MM-DD, or YYYY/MM/DD.`);
  }

  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6));
  const day = Number(normalized.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return normalized;
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

function rocDateToCompact(value) {
  const match = String(value || '').match(/(\d+)\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return '';
  return `${Number(match[1]) + 1911}${match[2].padStart(2, '0')}${match[3].padStart(2, '0')}`;
}

function buildRequestUrl(date, cacheBuster = Date.now()) {
  const params = new URLSearchParams({
    startDate: date,
    endDate: date,
    response: 'json',
    _: String(cacheBuster),
  });
  return `${API_URL}?${params.toString()}`;
}

function validatePayload(payload, targetDate) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('TWSE response is not a JSON object');
  }
  if (payload.stat !== 'OK') {
    throw new Error(`TWSE response stat is not OK: ${payload.stat || '(empty)'}`);
  }
  if (!Array.isArray(payload.fields)) {
    throw new Error('TWSE response missing array field: fields');
  }
  if (!Array.isArray(payload.data)) {
    throw new Error('TWSE response missing array field: data');
  }

  const requiredFields = ['資料日期', '股票代號', '漲停價格', '跌停價格', '開盤競價基準'];
  for (const requiredField of requiredFields) {
    if (!payload.fields.some((field) => String(field).includes(requiredField))) {
      throw new Error(`TWSE response missing required field: ${requiredField}`);
    }
  }

  const dateIndex = payload.fields.findIndex((field) => String(field).includes('資料日期'));
  for (const [index, row] of payload.data.entries()) {
    if (!Array.isArray(row)) {
      throw new Error(`TWSE response has invalid row at index ${index}`);
    }
    const responseDate = rocDateToCompact(row[dateIndex]);
    if (responseDate !== targetDate) {
      throw new Error(
        `TWSE returned row date ${responseDate || '(invalid)'} for requested ${targetDate}`,
      );
    }
  }
}

function refreshFilesJson(outputDir = OUTPUT_DIR) {
  const files = fs.readdirSync(outputDir)
    .filter((file) => /^\d{8}_twt49u\.json$/.test(file))
    .sort();
  const outputPath = path.join(outputDir, 'files.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(files, null, 2)}\n`, 'utf8');
  return outputPath;
}

function serializePayload(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function writeJsonAtomic(file, payload) {
  const temporaryFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryFile, serializePayload(payload), 'utf8');
  fs.renameSync(temporaryFile, file);
}

function verifyStoredPayload(file, targetDate, expectedSha256) {
  const content = fs.readFileSync(file, 'utf8');
  const payload = JSON.parse(content);
  validatePayload(payload, targetDate);
  const actualSha256 = sha256(content);
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Stored file SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}`,
    );
  }
}

function savePayloadSafely(file, payload, targetDate, options = {}) {
  const {
    force = false,
    minRowRatio = DEFAULT_MIN_ROW_RATIO,
  } = options;

  validatePayload(payload, targetDate);
  const newContent = serializePayload(payload);
  const newSha256 = sha256(newContent);
  const newRows = payload.data.length;

  if (!fs.existsSync(file)) {
    writeJsonAtomic(file, payload);
    verifyStoredPayload(file, targetDate, newSha256);
    return {
      status: 'created',
      oldRows: null,
      newRows,
      oldSha256: null,
      newSha256,
    };
  }

  const oldContent = fs.readFileSync(file, 'utf8');
  const oldSha256 = sha256(oldContent);
  let oldPayload;
  try {
    oldPayload = JSON.parse(oldContent);
    validatePayload(oldPayload, targetDate);
  } catch (error) {
    if (!force) {
      throw new Error(
        `Existing file is invalid and was preserved: ${error.message}. Use --force only after review.`,
      );
    }
    oldPayload = null;
  }
  const oldRows = Array.isArray(oldPayload?.data) ? oldPayload.data.length : null;

  if (oldSha256 === newSha256) {
    return {
      status: 'unchanged',
      oldRows,
      newRows,
      oldSha256,
      newSha256,
    };
  }

  if (Number.isInteger(oldRows) && oldRows > 0 && newRows === 0) {
    throw new Error(
      `Refusing to replace non-empty existing data (${oldRows} rows) with an empty response; --force cannot bypass this safeguard.`,
    );
  }

  if (
    Number.isInteger(oldRows)
    && oldRows > 0
    && newRows / oldRows < minRowRatio
    && !force
  ) {
    throw new Error(
      `New row count dropped from ${oldRows} to ${newRows} (below ${Math.round(minRowRatio * 100)}%). Existing file was preserved; review and rerun with --force if intentional.`,
    );
  }

  if (!force) {
    throw new Error(
      `Existing file differs from the new response (rows ${oldRows ?? 'unknown'} -> ${newRows}, SHA-256 ${oldSha256} -> ${newSha256}). Existing file was preserved; rerun manually with --force after review.`,
    );
  }

  writeJsonAtomic(file, payload);
  verifyStoredPayload(file, targetDate, newSha256);
  return {
    status: 'updated',
    oldRows,
    newRows,
    oldSha256,
    newSha256,
  };
}

async function fetchTwseTwt49uOnce(date, fetchImpl = fetch) {
  const url = buildRequestUrl(date);
  const response = await fetchImpl(url, {
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

  const payload = await response.json();
  validatePayload(payload, date);
  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTwseTwt49u(date, options = {}) {
  const {
    fetchImpl = fetch,
    maxRetries = DEFAULT_MAX_RETRIES,
    rateLimitCooldownMs = DEFAULT_RATE_LIMIT_COOLDOWN_MS,
  } = options;

  let attempt = 0;
  while (true) {
    try {
      return await fetchTwseTwt49uOnce(date, fetchImpl);
    } catch (error) {
      attempt += 1;
      if (!RATE_LIMIT_STATUS_CODES.has(error.status) || attempt > maxRetries) throw error;
      const cooldown = rateLimitCooldownMs * attempt;
      console.log(
        `🕒 Got ${error.status}; cooling down ${Math.round(cooldown / 1000)}s before retry ${attempt}/${maxRetries}`,
      );
      await sleep(cooldown);
    }
  }
}

function usage() {
  return [
    'Usage:',
    '  node scripts/crawl_twse_twt49u.js [--date YYYYMMDD] [--force] [--max-retries N]',
    '  node scripts/crawl_twse_twt49u.js YYYYMMDD [--force]',
    '',
    'Examples:',
    '  node scripts/crawl_twse_twt49u.js --date 20260727',
    '  npm run crawl:twse-twt49u -- --date 20260727 --force',
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return;
  }

  const targetDate = normalizeDateInput(
    getArg(argv, '--date') || getPositionalDate(argv),
  ) || getTaipeiTodayCompact();
  const force = argv.includes('--force');
  const maxRetries = getNumberArg(argv, '--max-retries', DEFAULT_MAX_RETRIES);
  const rateLimitCooldownMs = getNumberArg(
    argv,
    '--rate-limit-cooldown',
    DEFAULT_RATE_LIMIT_COOLDOWN_MS,
  );
  const payload = await fetchTwseTwt49u(targetDate, {
    maxRetries,
    rateLimitCooldownMs,
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${targetDate}_twt49u.json`);
  const result = savePayloadSafely(outputPath, payload, targetDate, { force });
  const filesPath = refreshFilesJson();

  console.log(`✅ TWT49U ${result.status}: ${payload.title || targetDate}`);
  console.log(`📁 ${outputPath}`);
  console.log(`📁 ${filesPath}`);
  console.log(`📊 Rows: ${result.oldRows ?? 'new'} -> ${result.newRows}`);
  console.log(`🔐 SHA-256: ${result.oldSha256 || 'new'} -> ${result.newSha256}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Failed to crawl TWSE TWT49U data: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildRequestUrl,
  fetchTwseTwt49uOnce,
  getTaipeiTodayCompact,
  normalizeDateInput,
  refreshFilesJson,
  rocDateToCompact,
  savePayloadSafely,
  sha256,
  validatePayload,
  verifyStoredPayload,
};
