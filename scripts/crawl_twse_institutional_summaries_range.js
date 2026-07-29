#!/usr/bin/env node
'use strict';

const {
  NON_TRADING_DAYS_FILE,
} = require('./lib/twse_fund_crawler');
const foreignInvestors = require('./crawl_twse_foreign_investors');
const investmentTrust = require('./crawl_twse_investment_trust');
const dealers = require('./crawl_twse_dealers');

const DEFAULT_MIN_DELAY_MS = 3000;
const DEFAULT_MAX_DELAY_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_COOLDOWN_MS = 90000;
const DEFAULT_MAX_DAYS = 366;
const MAX_ALLOWED_DELAY_MS = 300000;

const DATASETS = Object.freeze([
  { endpointId: 'TWT38U', label: '外資及陸資', crawler: foreignInvestors },
  { endpointId: 'TWT44U', label: '投信', crawler: investmentTrust },
  { endpointId: 'TWT43U', label: '自營商', crawler: dealers },
]);

function getArg(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function getIntegerArg(args, flag, fallback) {
  const value = getArg(args, flag);
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid ${flag}: ${value}`);
  }
  return number;
}

function compactToDate(date) {
  return new Date(Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6, 8)),
  ));
}

function dateToCompact(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
}

function enumerateDates(startDate, endDate) {
  const dates = [];
  const current = compactToDate(startDate);
  const end = compactToDate(endDate);
  while (current <= end) {
    dates.push(dateToCompact(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function validateRange(options) {
  const {
    start: startInput,
    end: endInput,
    maxDays = DEFAULT_MAX_DAYS,
    today = foreignInvestors.getTaipeiTodayCompact(),
  } = options;
  if (!startInput || !endInput) {
    throw new Error('Both --start and --end are required');
  }
  if (!Number.isInteger(maxDays) || maxDays < 1) {
    throw new Error(`Invalid --max-days: ${maxDays}`);
  }

  const start = foreignInvestors.normalizeDateInput(startInput);
  const end = foreignInvestors.normalizeDateInput(endInput);
  const normalizedToday = foreignInvestors.normalizeDateInput(today);
  if (start > end) {
    throw new Error(`Start date ${start} is after end date ${end}`);
  }
  if (end > normalizedToday) {
    throw new Error(
      `End date ${end} is after Taipei today ${normalizedToday}`,
    );
  }

  const dates = enumerateDates(start, end);
  if (dates.length > maxDays) {
    throw new Error(
      `Date range has ${dates.length} days, exceeding --max-days ${maxDays}`,
    );
  }
  return { start, end, dates };
}

function loadNonTradingDaysForRange(start, end) {
  const years = new Set();
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year += 1) {
    years.add(String(year));
  }

  const result = new Set();
  for (const year of years) {
    const dates = foreignInvestors.loadNonTradingDays(
      NON_TRADING_DAYS_FILE,
      year,
    );
    for (const date of dates) result.add(date);
  }
  return result;
}

function randomDelay(minMs, maxMs, randomFn = Math.random) {
  if (!Number.isInteger(minMs) || !Number.isInteger(maxMs)) {
    throw new Error('Delay values must be integers');
  }
  if (minMs < 0 || maxMs < minMs) {
    throw new Error(`Invalid delay range: ${minMs}-${maxMs}ms`);
  }
  if (maxMs > MAX_ALLOWED_DELAY_MS) {
    throw new Error(
      `Maximum delay ${maxMs}ms exceeds safety limit ${MAX_ALLOWED_DELAY_MS}ms`,
    );
  }
  if (maxMs === minMs) return minMs;
  return minMs + Math.floor(randomFn() * (maxMs - minMs + 1));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function crawlRange(options) {
  const {
    dates,
    nonTradingDays,
    datasets = DATASETS,
    minDelayMs = DEFAULT_MIN_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryCooldownMs = DEFAULT_RETRY_COOLDOWN_MS,
    randomFn = Math.random,
    sleepImpl = sleep,
    logger = console,
  } = options;
  randomDelay(minDelayMs, maxDelayMs, randomFn);

  const summary = {
    created: 0,
    existing: 0,
    skippedNonTradingDates: 0,
    networkRequests: 0,
    failures: [],
  };

  const beforeFetch = async ({ endpointId, targetDate }) => {
    if (summary.networkRequests > 0) {
      const delay = randomDelay(minDelayMs, maxDelayMs, randomFn);
      logger.log(
        `🕒 Waiting ${delay}ms before ${endpointId} ${targetDate}`,
      );
      await sleepImpl(delay);
    }
    summary.networkRequests += 1;
  };

  for (const targetDate of dates) {
    if (!foreignInvestors.isTradingDate(targetDate, nonTradingDays)) {
      summary.skippedNonTradingDates += 1;
      logger.log(`⏭️ Skip ${targetDate}: weekend or configured non-trading day`);
      continue;
    }

    for (const dataset of datasets) {
      try {
        const result = await dataset.crawler.crawlDate({
          targetDate,
          nonTradingDays,
          maxRetries,
          retryCooldownMs,
          beforeFetch,
        });
        if (result.status === 'created') summary.created += 1;
        if (result.status === 'skipped-existing') summary.existing += 1;
      } catch (error) {
        summary.failures.push({
          targetDate,
          endpointId: dataset.endpointId,
          label: dataset.label,
          message: error.message,
        });
        logger.error(
          `❌ ${targetDate} ${dataset.endpointId} ${dataset.label}: ${error.message}`,
        );
      }
    }
  }

  for (const dataset of datasets) {
    dataset.crawler.refreshFilesJson();
  }
  return summary;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/crawl_twse_institutional_summaries_range.js \\',
    '    --start YYYYMMDD --end YYYYMMDD',
    '',
    'Options:',
    '  --min-delay MS        Random delay minimum (default: 3000)',
    '  --max-delay MS        Random delay maximum (default: 5000)',
    '  --max-retries N       Retry count per request (default: 3)',
    '  --retry-cooldown MS   Retry cooldown base (default: 90000)',
    '  --max-days N          Maximum inclusive range (default: 366)',
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return;
  }

  const minDelayMs = getIntegerArg(
    argv,
    '--min-delay',
    DEFAULT_MIN_DELAY_MS,
  );
  const maxDelayMs = getIntegerArg(
    argv,
    '--max-delay',
    DEFAULT_MAX_DELAY_MS,
  );
  const maxRetries = getIntegerArg(
    argv,
    '--max-retries',
    DEFAULT_MAX_RETRIES,
  );
  const retryCooldownMs = getIntegerArg(
    argv,
    '--retry-cooldown',
    DEFAULT_RETRY_COOLDOWN_MS,
  );
  const maxDays = getIntegerArg(argv, '--max-days', DEFAULT_MAX_DAYS);
  randomDelay(minDelayMs, maxDelayMs);

  const range = validateRange({
    start: getArg(argv, '--start'),
    end: getArg(argv, '--end'),
    maxDays,
  });
  const nonTradingDays = loadNonTradingDaysForRange(
    range.start,
    range.end,
  );

  console.log('🚀 TWSE 三大法人買賣超區間下載');
  console.log(`📅 Range: ${range.start} ~ ${range.end}`);
  console.log(`📌 Calendar days: ${range.dates.length}`);
  console.log(`⏱️ Request delay: ${minDelayMs}-${maxDelayMs}ms`);
  console.log(
    `🔁 Retries: ${maxRetries}, retry cooldown: ${retryCooldownMs}ms`,
  );

  const summary = await crawlRange({
    dates: range.dates,
    nonTradingDays,
    minDelayMs,
    maxDelayMs,
    maxRetries,
    retryCooldownMs,
  });

  console.log('✅ Range crawl finished');
  console.log(
    `Created=${summary.created}, Existing=${summary.existing}, `
    + `SkippedDates=${summary.skippedNonTradingDates}, `
    + `Requests=${summary.networkRequests}, Failed=${summary.failures.length}`,
  );
  if (summary.failures.length) {
    const details = summary.failures.map((failure) => (
      `${failure.targetDate}/${failure.endpointId}: ${failure.message}`
    )).join('; ');
    throw new Error(
      `Range crawl completed with ${summary.failures.length} failure(s): ${details}`,
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Failed to crawl TWSE institutional range: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DATASETS,
  crawlRange,
  enumerateDates,
  loadNonTradingDaysForRange,
  main,
  randomDelay,
  validateRange,
};
