#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'data_wantgoo_margin');
const ENDPOINTS = Object.freeze({
  financingAmount: 'https://www.wantgoo.com/stock/-ETFA/margin-trading/historical-lending-balance',
  financingLots: 'https://www.wantgoo.com/stock/-ETF/margin-trading/historical-lending-balance',
  shortLots: 'https://www.wantgoo.com/stock/-ETF/margin-trading/historical-borrowing-balance',
});
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 15000;

function getArg(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : '';
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

function taipeiDateCompact(value = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}`;
}

function timestampToTaipeiDate(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error(`Invalid Wantgoo timestamp: ${value}`);
  }
  return taipeiDateCompact(new Date(timestamp));
}

function requireFiniteNumber(record, field, sourceName) {
  const value = Number(record?.[field]);
  if (!Number.isFinite(value)) {
    throw new Error(`${sourceName} latest record has invalid ${field}`);
  }
  return value;
}

function validateHistory(payload, sourceName, requiredFields) {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`${sourceName} response must be a non-empty array`);
  }
  const latest = payload[0];
  if (!latest || typeof latest !== 'object' || Array.isArray(latest)) {
    throw new Error(`${sourceName} latest record is not an object`);
  }
  timestampToTaipeiDate(latest.date);
  for (const field of requiredFields) requireFiniteNumber(latest, field, sourceName);
  return latest;
}

function normalizeObservation(raw) {
  const financingAmount = validateHistory(
    raw.financingAmount,
    'financingAmount',
    ['date', 'lendingBalance', 'lastLendingBalance', 'marginRatio'],
  );
  const financingLots = validateHistory(
    raw.financingLots,
    'financingLots',
    ['date', 'lendingBalance', 'lastLendingBalance'],
  );
  const shortLots = validateHistory(
    raw.shortLots,
    'shortLots',
    ['date', 'borrowingBalance', 'lastBorrowingBalance'],
  );

  const dates = {
    financingAmount: timestampToTaipeiDate(financingAmount.date),
    financingLots: timestampToTaipeiDate(financingLots.date),
    shortLots: timestampToTaipeiDate(shortLots.date),
  };
  if (new Set(Object.values(dates)).size !== 1) {
    throw new Error(`Wantgoo source dates do not match: ${JSON.stringify(dates)}`);
  }

  const financingBalanceRaw = Number(financingAmount.lendingBalance);
  const previousFinancingBalanceRaw = Number(financingAmount.lastLendingBalance);
  const financingBalanceLots = Number(financingLots.lendingBalance);
  const previousFinancingBalanceLots = Number(financingLots.lastLendingBalance);
  const shortBalanceLots = Number(shortLots.borrowingBalance);
  const previousShortBalanceLots = Number(shortLots.lastBorrowingBalance);

  return {
    date: dates.financingAmount,
    observedAt: new Date().toISOString(),
    metrics: {
      marginMaintenanceRatePercent: Number(financingAmount.marginRatio) * 100,
      financingBalance100M: financingBalanceRaw / 100000,
      financingChange100M: (financingBalanceRaw - previousFinancingBalanceRaw) / 100000,
      financingBalanceLots,
      financingChangeLots: financingBalanceLots - previousFinancingBalanceLots,
      shortBalanceLots,
      shortChangeLots: shortBalanceLots - previousShortBalanceLots,
      shortFinancingRatioPercent: financingBalanceLots === 0
        ? null
        : (shortBalanceLots / financingBalanceLots) * 100,
    },
    formulaCandidates: {
      marginMaintenanceRatePercent: 'financingAmount.marginRatio * 100',
      financingBalance100M: 'financingAmount.lendingBalance / 100000',
      financingChange100M: '(lendingBalance - lastLendingBalance) / 100000',
      shortFinancingRatioPercent: 'shortLots.borrowingBalance / financingLots.lendingBalance * 100',
    },
    sourceDates: dates,
    sourceEndpoints: ENDPOINTS,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, options = {}) {
  const {
    fetchImpl = fetch,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = options;
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/json, text/plain, */*',
        referer: 'https://www.wantgoo.com/stock/margin-trading/exclude-etf/taiex',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      },
    });
    if (response.ok) return response.json();
    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt >= maxRetries) {
      throw new Error(`Wantgoo request failed: ${response.status} ${response.statusText}`);
    }
    await sleep(retryDelayMs * (attempt + 1));
  }
}

async function fetchObservationOnce(options = {}) {
  const {
    navigationTimeoutMs = 120000,
    responseTimeoutMs = 120000,
  } = options;
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const payloads = {};
  const responseErrors = [];
  const responseStatuses = {};

  function sourceNameFromUrl(value) {
    const pathname = new URL(value).pathname.toLowerCase();
    if (pathname.endsWith('/stock/-etfa/margin-trading/historical-lending-balance')) {
      return 'financingAmount';
    }
    if (pathname.endsWith('/stock/-etf/margin-trading/historical-lending-balance')) {
      return 'financingLots';
    }
    if (pathname.endsWith('/stock/-etf/margin-trading/historical-borrowing-balance')) {
      return 'shortLots';
    }
    return '';
  }

  page.on('response', async (response) => {
    const sourceName = sourceNameFromUrl(response.url());
    if (!sourceName) return;
    responseStatuses[sourceName] = response.status();
    try {
      if (!response.ok()) {
        throw new Error(`${response.status()} ${response.statusText()}`);
      }
      payloads[sourceName] = await response.json();
    } catch (error) {
      responseErrors.push(`${sourceName}: ${error.message}`);
    }
  });

  try {
    const pageResponse = await page.goto(
      'https://www.wantgoo.com/stock/margin-trading/exclude-etf/taiex',
      { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs },
    );
    console.log(
      `🌐 Wantgoo page: ${pageResponse?.status() || 'unknown'} ${page.url()} (${await page.title()})`,
    );

    const deadline = Date.now() + responseTimeoutMs;
    while (Object.keys(payloads).length < 3 && Date.now() < deadline) {
      await page.waitForTimeout(500);
    }

    if (Object.keys(payloads).length < 3) {
      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      if (/cloudflare|checking your browser|verify you are human|請確認您是人類/i.test(bodyText)) {
        responseErrors.push('Cloudflare challenge page detected');
      }
    }
  } finally {
    await browser.close();
  }

  const missing = Object.keys(ENDPOINTS).filter((name) => !payloads[name]);
  if (missing.length > 0) {
    const details = [
      `captured=${Object.keys(payloads).join(',') || 'none'}`,
      `statuses=${JSON.stringify(responseStatuses)}`,
      responseErrors.length > 0 ? `errors=${responseErrors.join('; ')}` : '',
    ].filter(Boolean).join(' ');
    throw new Error(
      `Browser did not capture Wantgoo sources within ${responseTimeoutMs}ms: ${missing.join(', ')} (${details})`,
    );
  }
  return payloads;
}

async function fetchObservation(options = {}) {
  const {
    maxBrowserAttempts = 3,
    minAttemptDelayMs = 20000,
    maxAttemptDelayMs = 40000,
  } = options;
  let lastError;

  for (let attempt = 1; attempt <= maxBrowserAttempts; attempt += 1) {
    try {
      console.log(`🔎 Wantgoo browser attempt ${attempt}/${maxBrowserAttempts}`);
      return await fetchObservationOnce(options);
    } catch (error) {
      lastError = error;
      console.error(`⚠️ Wantgoo browser attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxBrowserAttempts) break;
      const delay = minAttemptDelayMs + Math.floor(
        Math.random() * (Math.max(minAttemptDelayMs, maxAttemptDelayMs) - minAttemptDelayMs + 1),
      );
      console.log(`🕒 Recreating browser context in ${Math.round(delay / 1000)} seconds`);
      await sleep(delay);
    }
  }

  throw lastError;
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeAtomic(file, value) {
  const temporaryFile = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryFile, serialize(value), 'utf8');
  fs.renameSync(temporaryFile, file);
}

function validateStoredPair(rawFile, normalizedFile, expectedDate) {
  const raw = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
  const stored = JSON.parse(fs.readFileSync(normalizedFile, 'utf8'));
  const recalculated = normalizeObservation(raw);
  if (stored.date !== expectedDate || recalculated.date !== expectedDate) {
    throw new Error(`Stored observation date does not match ${expectedDate}`);
  }
  if (JSON.stringify(stored.metrics) !== JSON.stringify(recalculated.metrics)) {
    throw new Error('Stored normalized metrics do not match the raw source');
  }
}

function refreshFilesJson(outputDir = OUTPUT_DIR) {
  const normalizedDir = path.join(outputDir, 'normalized');
  const files = fs.existsSync(normalizedDir)
    ? fs.readdirSync(normalizedDir).filter((file) => /^\d{8}_wantgoo_margin\.json$/.test(file)).sort()
    : [];
  writeAtomic(path.join(outputDir, 'files.json'), files);
}

function saveObservation(raw, normalized, options = {}) {
  const { outputDir = OUTPUT_DIR, force = false } = options;
  const rawDir = path.join(outputDir, 'raw');
  const normalizedDir = path.join(outputDir, 'normalized');
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(normalizedDir, { recursive: true });
  const rawFile = path.join(rawDir, `${normalized.date}_wantgoo_margin_raw.json`);
  const normalizedFile = path.join(normalizedDir, `${normalized.date}_wantgoo_margin.json`);

  if (fs.existsSync(rawFile) || fs.existsSync(normalizedFile)) {
    if (!fs.existsSync(rawFile) || !fs.existsSync(normalizedFile)) {
      throw new Error('Only one file in the observation pair exists; refusing an incomplete overwrite');
    }
    validateStoredPair(rawFile, normalizedFile, normalized.date);
    const sameRaw = sha256(fs.readFileSync(rawFile, 'utf8')) === sha256(serialize(raw));
    if (!force) {
      return { status: sameRaw ? 'unchanged' : 'preserved', rawFile, normalizedFile };
    }
  }

  writeAtomic(rawFile, raw);
  writeAtomic(normalizedFile, normalized);
  validateStoredPair(rawFile, normalizedFile, normalized.date);
  refreshFilesJson(outputDir);
  return { status: 'saved', rawFile, normalizedFile };
}

async function main(args = process.argv.slice(2)) {
  const expectedDate = normalizeDateInput(getArg(args, '--date')) || taipeiDateCompact();
  const force = args.includes('--force');
  const raw = await fetchObservation();
  const normalized = normalizeObservation(raw);

  if (normalized.date !== expectedDate) {
    console.log(`⏳ Wantgoo latest date is ${normalized.date}; expected ${expectedDate}. No file written.`);
    return;
  }

  const result = saveObservation(raw, normalized, { force });
  console.log(`✅ Wantgoo margin observation ${result.status}: ${normalized.date}`);
  console.log(`📁 ${result.rawFile}`);
  console.log(`📁 ${result.normalizedFile}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Failed to crawl Wantgoo margin observation: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  ENDPOINTS,
  fetchObservation,
  fetchObservationOnce,
  fetchJsonWithRetry,
  normalizeDateInput,
  normalizeObservation,
  saveObservation,
  taipeiDateCompact,
  timestampToTaipeiDate,
  validateHistory,
  validateStoredPair,
};
