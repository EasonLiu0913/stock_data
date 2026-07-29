#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const NON_TRADING_DAYS_FILE = path.join(
  ROOT_DIR,
  'data_history_sma',
  'non_trading_days.json',
);
const RATE_LIMIT_STATUS_CODES = new Set([307, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_COOLDOWN_MS = 90000;

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
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  const normalized = trimmed.replace(/[/-]/g, '');
  if (!/^20\d{6}$/.test(normalized)) {
    throw new Error(
      `Invalid date: ${trimmed}. Expected YYYYMMDD, YYYY-MM-DD, or YYYY/MM/DD.`,
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
    throw new Error(`Invalid calendar date: ${trimmed}`);
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
    console.warn(
      `⚠️ Non-trading-day calendar is missing; API validation remains active: ${file}`,
    );
    return new Set();
  }
  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) {
    console.warn(
      `⚠️ Non-trading-day calendar is empty; API validation remains active: ${file}`,
    );
    return new Set();
  }

  let calendar;
  try {
    calendar = JSON.parse(content);
  } catch (error) {
    console.warn(
      `⚠️ Non-trading-day calendar is invalid; API validation remains active: ${file}`,
    );
    return new Set();
  }
  const dates = Array.isArray(calendar)
    ? calendar
    : Object.values(calendar).flatMap((value) => (
      Array.isArray(value) ? value : []
    ));
  if (
    targetYear
    && !dates.some((date) => String(date).startsWith(targetYear))
  ) {
    console.warn(
      `⚠️ Non-trading-day calendar does not cover ${targetYear}; requests will rely on API date validation`,
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

function buildRequestUrl(config, date, cacheBuster = Date.now()) {
  const params = new URLSearchParams({
    date,
    response: 'json',
    _: String(cacheBuster),
  });
  return `${config.apiUrl}?${params.toString()}`;
}

function mismatchError(message) {
  const error = new Error(message);
  error.code = 'DATE_MISMATCH';
  return error;
}

function parseNumericCell(value, rowIndex, columnIndex) {
  const number = Number(String(value ?? '').replaceAll(',', '').trim());
  if (!Number.isFinite(number)) {
    throw new Error(
      `TWSE response has invalid numeric value at row ${rowIndex}, column ${columnIndex}`,
    );
  }
  return number;
}

function validatePayload(config, payload, targetDate, options = {}) {
  const minRows = options.minRows ?? config.minRows;
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
  for (const key of ['fields', 'data']) {
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
  if (!String(payload.title).includes(config.titleText)) {
    throw new Error(`Unexpected TWSE title: ${payload.title || '(empty)'}`);
  }

  if (config.requiredGroups.length) {
    if (!Array.isArray(payload.groups)) {
      throw new Error('TWSE response missing array field: groups');
    }
    for (const title of config.requiredGroups) {
      if (!payload.groups.some((group) => group?.title === title)) {
        throw new Error(`TWSE response missing required group: ${title}`);
      }
    }
  }

  if (payload.fields.length < config.fieldCount) {
    throw new Error(`TWSE response has too few fields: ${payload.fields.length}`);
  }
  if (payload.data.length < minRows) {
    throw new Error(
      `TWSE response has too few rows: ${payload.data.length} (minimum ${minRows})`,
    );
  }

  for (const [rowIndex, row] of payload.data.entries()) {
    if (!Array.isArray(row) || row.length < config.fieldCount) {
      throw new Error(`TWSE response has invalid row at index ${rowIndex}`);
    }
    if (
      !String(row[config.codeIndex] || '').trim()
      || !String(row[config.nameIndex] || '').trim()
    ) {
      throw new Error(`TWSE response has empty stock code/name at row ${rowIndex}`);
    }
    for (const [buyColumn, sellColumn, netColumn] of config.numericTriples) {
      const buy = parseNumericCell(row[buyColumn], rowIndex, buyColumn);
      const sell = parseNumericCell(row[sellColumn], rowIndex, sellColumn);
      const net = parseNumericCell(row[netColumn], rowIndex, netColumn);
      if (buy - sell !== net) {
        throw new Error(
          `TWSE response has inconsistent buy/sell/net values at row ${rowIndex}`,
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

function refreshFilesJson(config, outputDir = config.outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = fs.readdirSync(outputDir)
    .filter((file) => config.filePattern.test(file))
    .sort();
  const outputPath = path.join(outputDir, 'files.json');
  const temporaryFile = `${outputPath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(
      temporaryFile,
      JSON.stringify(files, null, 2),
      'utf8',
    );
    fs.renameSync(temporaryFile, outputPath);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
  return outputPath;
}

function validateExistingFile(config, file, targetDate, options = {}) {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    validatePayload(config, payload, targetDate, options);
  } catch (error) {
    throw new Error(
      `Existing file is invalid and was preserved without fetching: ${error.message}`,
    );
  }
  return payload;
}

async function fetchDatasetOnce(config, date, options = {}) {
  const {
    fetchImpl = fetch,
    cacheBuster = Date.now(),
    minRows = config.minRows,
  } = options;
  const url = buildRequestUrl(config, date, cacheBuster);
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
  validatePayload(config, payload, date, { minRows });
  return payload;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchDataset(config, date, options = {}) {
  const {
    fetchImpl = fetch,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryCooldownMs = DEFAULT_RETRY_COOLDOWN_MS,
    minRows = config.minRows,
  } = options;
  let attempt = 0;

  while (true) {
    try {
      return await fetchDatasetOnce(config, date, {
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
        `🕒 Retryable TWSE ${config.endpointId} response; waiting ${Math.round(cooldown / 1000)}s before retry ${attempt}/${maxRetries}`,
      );
      await sleep(cooldown);
    }
  }
}

async function crawlDate(config, options) {
  const {
    targetDate: inputDate,
    outputDir = config.outputDir,
    nonTradingDays = loadNonTradingDays(),
    fetchImpl = fetch,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryCooldownMs = DEFAULT_RETRY_COOLDOWN_MS,
    minRows = config.minRows,
    beforeFetch = null,
  } = options;
  const targetDate = normalizeDateInput(inputDate);

  if (!isTradingDate(targetDate, nonTradingDays)) {
    console.log(`⏭️ Skip ${targetDate}: weekend or configured non-trading day`);
    return { status: 'skipped-non-trading', targetDate };
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `${targetDate}_${config.fileSuffix}.json`,
  );
  if (fs.existsSync(outputPath)) {
    const payload = validateExistingFile(
      config,
      outputPath,
      targetDate,
      { minRows },
    );
    const filesPath = refreshFilesJson(config, outputDir);
    console.log(`⏭️ Skip fetch: valid file already exists: ${outputPath}`);
    return {
      status: 'skipped-existing',
      targetDate,
      rows: payload.data.length,
      outputPath,
      filesPath,
    };
  }

  if (beforeFetch) {
    await beforeFetch({
      endpointId: config.endpointId,
      targetDate,
      outputPath,
    });
  }
  const payload = await fetchDataset(config, targetDate, {
    fetchImpl,
    maxRetries,
    retryCooldownMs,
    minRows,
  });
  writeJsonAtomic(outputPath, payload);
  validateExistingFile(config, outputPath, targetDate, { minRows });
  const filesPath = refreshFilesJson(config, outputDir);
  return {
    status: 'created',
    targetDate,
    rows: payload.data.length,
    outputPath,
    filesPath,
  };
}

function usage(config) {
  return [
    'Usage:',
    `  node ${config.scriptPath} [--date YYYYMMDD]`,
    `  node ${config.scriptPath} YYYYMMDD`,
    '',
    'The crawler skips weekends, configured non-trading days, and valid existing files.',
  ].join('\n');
}

async function runMain(config, argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage(config));
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
  const result = await crawlDate(config, {
    targetDate,
    nonTradingDays,
    maxRetries,
    retryCooldownMs,
  });

  if (result.status === 'created') {
    console.log(
      `✅ Saved ${targetDate} TWSE ${config.endpointId} (${result.rows} rows)`,
    );
    console.log(`📁 ${result.outputPath}`);
    console.log(`📁 ${result.filesPath}`);
  }
}

function createCrawler(config) {
  return {
    buildRequestUrl: (date, cacheBuster) => (
      buildRequestUrl(config, date, cacheBuster)
    ),
    compactToIso,
    crawlDate: (options) => crawlDate(config, options),
    fetchDataset: (date, options) => fetchDataset(config, date, options),
    fetchDatasetOnce: (date, options) => (
      fetchDatasetOnce(config, date, options)
    ),
    getTaipeiTodayCompact,
    isTradingDate,
    loadNonTradingDays,
    main: (argv) => runMain(config, argv),
    normalizeDateInput,
    refreshFilesJson: (outputDir) => refreshFilesJson(config, outputDir),
    rocDateToCompact,
    validateExistingFile: (file, targetDate, options) => (
      validateExistingFile(config, file, targetDate, options)
    ),
    validatePayload: (payload, targetDate, options) => (
      validatePayload(config, payload, targetDate, options)
    ),
  };
}

module.exports = {
  NON_TRADING_DAYS_FILE,
  createCrawler,
};
