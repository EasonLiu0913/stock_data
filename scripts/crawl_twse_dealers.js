#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createCrawler } = require('./lib/twse_fund_crawler');

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

const baseCrawler = createCrawler(CONFIG);
const crawlDate = createInvalidReplacingCrawlDate(baseCrawler, CONFIG);
const crawler = { ...baseCrawler, crawlDate };

if (require.main === module) {
  baseCrawler.main().catch((error) => {
    console.error(`❌ Failed to crawl TWSE TWT43U data: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  ...crawler,
  createInvalidReplacingCrawlDate,
  fetchTwseDealers: baseCrawler.fetchDataset,
  fetchTwseDealersOnce: baseCrawler.fetchDatasetOnce,
};
