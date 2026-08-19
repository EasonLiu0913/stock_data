#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createCrawler } = require('./lib/twse_fund_crawler');

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_COOLDOWN_MS = 90000;

const CONFIG = Object.freeze({
  endpointId: 'TWT43U',
  apiUrl: 'https://www.twse.com.tw/rwd/zh/fund/TWT43U',
  titleText: '自營商買賣超彙總表',
  outputDir: path.resolve(__dirname, '..', 'data_twse_dealers'),
  fileSuffix: 'twse_dealers',
  filePattern: /^\d{8}_twse_dealers\.json$/,
  fieldCount: 11,
  codeIndex: 0,
  nameIndex: 1,
  numericTriples: [[2, 3, 4], [5, 6, 7], [8, 9, 10]],
  requiredGroups: [
    '自營商(自行買賣)',
    '自營商(避險)',
    '自營商',
  ],
  minRows: 100,
  scriptPath: 'scripts/crawl_twse_dealers.js',
});

function createInvalidReplacingCrawlDate(baseCrawler, config = CONFIG) {
  return async function crawlDateReplacingInvalid(options = {}) {
    const targetDate = baseCrawler.normalizeDateInput(options.targetDate);
    const outputDir = path.resolve(options.outputDir || config.outputDir);
    const outputPath = path.join(outputDir, `${targetDate}_${config.fileSuffix}.json`);

    if (!fs.existsSync(outputPath)) return baseCrawler.crawlDate(options);

    try {
      baseCrawler.validateExistingFile(outputPath, targetDate, {
        minRows: options.minRows ?? config.minRows,
      });
      return baseCrawler.crawlDate(options);
    } catch (invalidError) {
      const backupPath = `${outputPath}.invalid-backup-${process.pid}-${Date.now()}`;
      console.warn(`⚠️ Replace invalid TWSE ${config.endpointId} file: ${outputPath}`);
      fs.renameSync(outputPath, backupPath);

      try {
        const result = await baseCrawler.crawlDate({
          ...options,
          targetDate,
          outputDir,
        });
        fs.rmSync(backupPath, { force: true });
        return {
          ...result,
          replaced_invalid_existing: true,
          invalid_existing_reason: invalidError.message,
        };
      } catch (error) {
        fs.rmSync(outputPath, { force: true });
        if (fs.existsSync(backupPath)) fs.renameSync(backupPath, outputPath);
        throw error;
      }
    }
  };
}

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

function getNumberArg(args, flag, fallback) {
  const value = getArg(args, flag);
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid ${flag}: ${value}`);
  }
  return number;
}

const baseCrawler = createCrawler(CONFIG);
const crawlDate = createInvalidReplacingCrawlDate(baseCrawler, CONFIG);
const crawler = { ...baseCrawler, crawlDate };

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log([
      'Usage:',
      `  node ${CONFIG.scriptPath} [--date YYYYMMDD]`,
      `  node ${CONFIG.scriptPath} YYYYMMDD`,
      '',
      'Valid existing files are skipped; invalid/empty existing files are replaced by a fresh crawl.',
    ].join('\n'));
    return;
  }

  const targetDate = baseCrawler.normalizeDateInput(
    getArg(argv, '--date') || getPositionalDate(argv),
  ) || baseCrawler.getTaipeiTodayCompact();
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
  const nonTradingDays = baseCrawler.loadNonTradingDays(
    undefined,
    targetDate.slice(0, 4),
  );

  const result = await crawlDate({
    targetDate,
    nonTradingDays,
    maxRetries,
    retryCooldownMs,
  });

  if (result.status === 'created') {
    console.log(`✅ Saved ${targetDate} TWSE ${CONFIG.endpointId} (${result.rows} rows)`);
    console.log(`📁 ${result.outputPath}`);
    console.log(`📁 ${result.filesPath}`);
  }
  if (result.replaced_invalid_existing) {
    console.log(`♻️ Replaced invalid existing TWSE ${CONFIG.endpointId} file for ${targetDate}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Failed to crawl TWSE TWT43U data: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  ...crawler,
  createInvalidReplacingCrawlDate,
  main,
  fetchTwseDealers: baseCrawler.fetchDataset,
  fetchTwseDealersOnce: baseCrawler.fetchDatasetOnce,
};
