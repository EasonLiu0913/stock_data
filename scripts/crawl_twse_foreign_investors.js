#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const API_URL = 'https://www.twse.com.tw/rwd/zh/fund/TWT38U';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data_twse_foreign_investors');
const NON_TRADING_DAYS_FILE = path.join(
  ROOT_DIR,
  'data_history_sma',
  'non_trading_days.json',
);
const RATE_LIMIT_STATUS_CODES = new Set([307, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_COOLDOWN_MS = 90000;
const DEFAULT_MIN_ROWS = 100;

function getArg(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function getPositionalDate(args) {
  const flagsWithValue = new Set([
    '--date',
    '--max-retries',
    '--retry-cooldown',
  ]);
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
    throw new Error(
      `Invalid date: ${value}. Expected YYYYMMDD, YYYY-MM-DD, or YYYY/MM/DD.`,
    );
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

function compactToIso(date) {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function loadNonTradingDays(file = NON_TRADING_DAYS_FILE, targetYear = '') {
  if (!fs.existsSync(file)) {
    throw new Error(`Non-trading-day calendar is missing: ${file}`);
  }
  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) {
    throw new Error(`Non-trading-day calendar is empty: ${file}`);
  }

  const calendar = JSON.parse(content);
  if (
    targetYear
    && !Array.isArray(calendar)
    && !Array.isArray(calendar?.[targetYear])
  ) {
    throw new Error(
      `Non-trading-day calendar does not cover year ${targetYear}: ${file}`,
    );
  }
  const dates = Array.isArray(calendar)
    ? calendar
    : Object.values(calendar).flatMap((value) => (
      Array.isArray(value) ? value : []
    ));
  if (
    targetYear
    && Array.isArray(calendar)
    && !dates.some((date) => String(date).startsWith(targetYear))
  ) {
    throw new Error(
      `Non-trading-day calendar does not cover year ${targetYear}: ${file}`,
    );
  }
  return new Set(dates.map((date) => String(date).replaceAll('-', '/')));
}

function isTradingDate(date, nonTradingDays) {
  const isoDate = compactToIso(date);
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  if (day === 0 || day === 6) return false;
  return !nonTradingDays.has(isoDate.replaceAll('-', '/'));
}

function rocDateToCompact(value) {
  const match = String(value || '').match(
    /(\d+)\D+(\d{1,2})\D+(\d{1,2})/,
  );
  if (!match) return '';
  return `${Number(match[1]) + 1911}${match[2].padStart(2, '0')}${match[3].padStart(2, '0')}`;
}

function buildRequestUrl(date, cacheBuster = Date.now()) {
  const params = new URLSearchParams({
    date,
    response: 'json',
    _: String(cacheBuster),
  });
  return `${API_URL}?${params.toString()}`;
}

function mismatchError(message) {
  const error = new Error(message);
  error.code = 'DATE_MISMATCH';
  return error;
}

function validatePayload(payload, targetDate, options = {}) {
  const minRows = options.minRows ?? DEFAULT_MIN_ROWS;
  if (!payload || typeof payload !== 'object') {
    throw new Error('TWSE response is not a JSON object');
  }
  if (payload.stat !== 'OK') {
    throw new Error(`TWSE response stat is not OK: ${payload.stat || '(empty)'}`);
  }
  if (payload.date !== targetDate) {
    throw mismatchError(
      `TWSE returned payload date ${payload.date || '(empty)'} for requested ${targetDate}`,
    );
  }

  for (const key of ['fields', 'groups', 'data']) {
    if (!Array.isArray(payload[key])) {
      throw new Error(`TWSE response missing array field: ${key}`);
    }
  }

  const titleDate = rocDateToCompact(payload.title);
  if (titleDate !== targetDate) {
    throw mismatchError(
      `TWSE returned title date ${titleDate || '(invalid)'} for requested ${targetDate}`,
    );
  }
  if (!String(payload.title).includes('外資及陸資買賣超彙總表')) {
    throw new Error(`Unexpected TWSE title: ${payload.title || '(empty)'}`);
  }

  const requiredGroups = [
    '外資及陸資(不含外資自營商)',
    '外資自營商',
    '外資及陸資',
  ];
  for (const title of requiredGroups) {
    if (!payload.groups.some((group) => group?.title === title)) {
      throw new Error(`TWSE response missing required group: ${title}`);
    }
  }

  if (payload.fields.length < 12) {
    throw new Error(`TWSE response has too few fields: ${payload.fields.length}`);
  }
  if (payload.data.length < minRows) {
    throw new Error(
      `TWSE response has too few rows: ${payload.data.length} (minimum ${minRows})`,
    );
  }

  for (const [index, row] of payload.data.entries()) {
    if (!Array.isArray(row) || row.length < 12) {
      throw new Error(`TWSE response has invalid row at index ${index}`);
    }
    if (!String(row[1] || '').trim() || !String(row[2] || '').trim()) {
      throw new Error(`TWSE response has empty stock code/name at row ${index}`);
    }
    for (let column = 3; column <= 11; column += 1) {
      const value = Number(String(row[column] ?? '').replaceAll(',', '').trim());
      if (!Number.isFinite(value)) {
        throw new Error(
          `TWSE response has invalid numeric value at row ${index}, column ${column}`,
        );
      }
    }
  }
}

function serializePayload(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function writeJsonAtomic(file, payload) {
  const temporaryFile = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporaryFile, serializePayload(payload), 'utf8');
    fs.renameSync(temporaryFile, file);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

function refreshFilesJson(outputDir = OUTPUT_DIR) {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = fs.readdirSync(outputDir)
    .filter((file) => /^\d{8}_twse_foreign_investors\.json$/.test(file))
    .sort();
  const outputPath = path.join(outputDir, 'files.json');
  const temporaryFile = `${outputPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryFile, JSON.stringify(files, null, 2), 'utf8');
  fs.renameSync(temporaryFile, outputPath);
  return outputPath;
}

function validateExistingFile(file, targetDate, options = {}) {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    validatePayload(payload, targetDate, options);
  } catch (error) {
    throw new Error(
      `Existing file is invalid and was preserved without fetching: ${error.message}`,
    );
  }
  return payload;
}

async function fetchTwseForeignInvestorsOnce(
  date,
  options = {},
) {
  const {
    fetchImpl = fetch,
    cacheBuster = Date.now(),
    minRows = DEFAULT_MIN_ROWS,
  } = options;
  const url = buildRequestUrl(date, cacheBuster);
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    const error = new Error(
      `TWSE request failed: ${response.status} ${response.statusText || ''}`.trim(),
    );
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  validatePayload(payload, date, { minRows });
  return payload;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchTwseForeignInvestors(date, options = {}) {
  const {
    fetchImpl = fetch,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryCooldownMs = DEFAULT_RETRY_COOLDOWN_MS,
    minRows = DEFAULT_MIN_ROWS,
  } = options;
  let attempt = 0;

  while (true) {
    try {
      return await fetchTwseForeignInvestorsOnce(date, {
        fetchImpl,
        minRows,
      });
    } catch (error) {
      attempt += 1;
      const retryable = (
        RATE_LIMIT_STATUS_CODES.has(error.status)
        || error.code === 'DATE_MISMATCH'
      );
      if (!retryable || attempt > maxRetries) throw error;

      const cooldown = retryCooldownMs * attempt;
      console.log(
        `🕒 Retryable TWSE response; waiting ${Math.round(cooldown / 1000)}s before retry ${attempt}/${maxRetries}`,
      );
      await sleep(cooldown);
    }
  }
}

async function crawlDate(options) {
  const {
    targetDate,
    outputDir = OUTPUT_DIR,
    nonTradingDays = loadNonTradingDays(),
    fetchImpl = fetch,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryCooldownMs = DEFAULT_RETRY_COOLDOWN_MS,
    minRows = DEFAULT_MIN_ROWS,
  } = options;

  if (!isTradingDate(targetDate, nonTradingDays)) {
    console.log(`⏭️ Skip ${targetDate}: weekend or configured non-trading day`);
    return { status: 'skipped-non-trading', targetDate };
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `${targetDate}_twse_foreign_investors.json`,
  );
  if (fs.existsSync(outputPath)) {
    const payload = validateExistingFile(outputPath, targetDate, { minRows });
    const filesPath = refreshFilesJson(outputDir);
    console.log(`⏭️ Skip fetch: valid file already exists: ${outputPath}`);
    return {
      status: 'skipped-existing',
      targetDate,
      rows: payload.data.length,
      outputPath,
      filesPath,
    };
  }

  const payload = await fetchTwseForeignInvestors(targetDate, {
    fetchImpl,
    maxRetries,
    retryCooldownMs,
    minRows,
  });
  writeJsonAtomic(outputPath, payload);
  validateExistingFile(outputPath, targetDate, { minRows });
  const filesPath = refreshFilesJson(outputDir);
  return {
    status: 'created',
    targetDate,
    rows: payload.data.length,
    outputPath,
    filesPath,
  };
}

function usage() {
  return [
    'Usage:',
    '  node scripts/crawl_twse_foreign_investors.js [--date YYYYMMDD]',
    '  node scripts/crawl_twse_foreign_investors.js YYYYMMDD',
    '',
    'The crawler skips weekends, configured non-trading days, and valid existing files.',
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
  const maxRetries = getNumberArg(
    argv,
    '--max-retries',
    DEFAULT_MAX_RETRIES,
  );
  const retryCooldownMs = getNumberArg(
    argv,
    '--retry-cooldown',
    DEFAULT_RETRY_COOLDOWN_MS,
  );
  const nonTradingDays = loadNonTradingDays(
    NON_TRADING_DAYS_FILE,
    targetDate.slice(0, 4),
  );
  const result = await crawlDate({
    targetDate,
    nonTradingDays,
    maxRetries,
    retryCooldownMs,
  });

  if (result.status === 'created') {
    console.log(`✅ Saved ${targetDate} TWSE TWT38U (${result.rows} rows)`);
    console.log(`📁 ${result.outputPath}`);
    console.log(`📁 ${result.filesPath}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Failed to crawl TWSE TWT38U data: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildRequestUrl,
  compactToIso,
  crawlDate,
  fetchTwseForeignInvestors,
  fetchTwseForeignInvestorsOnce,
  getTaipeiTodayCompact,
  isTradingDate,
  loadNonTradingDays,
  normalizeDateInput,
  refreshFilesJson,
  rocDateToCompact,
  validateExistingFile,
  validatePayload,
};
