#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { createCrawler } = require('./lib/twse_fund_crawler');

const CONFIG = Object.freeze({
  endpointId: 'TWT38U',
  apiUrl: 'https://www.twse.com.tw/rwd/zh/fund/TWT38U',
  titleText: '外資及陸資買賣超彙總表',
  outputDir: path.resolve(__dirname, '..', 'data_twse_foreign_investors'),
  fileSuffix: 'twse_foreign_investors',
  filePattern: /^\d{8}_twse_foreign_investors\.json$/,
  fieldCount: 12,
  codeIndex: 1,
  nameIndex: 2,
  numericTriples: [[3, 4, 5], [6, 7, 8], [9, 10, 11]],
  requiredGroups: [
    '外資及陸資(不含外資自營商)',
    '外資自營商',
    '外資及陸資',
  ],
  minRows: 100,
  scriptPath: 'scripts/crawl_twse_foreign_investors.js',
});

const crawler = createCrawler(CONFIG);

if (require.main === module) {
  crawler.main().catch((error) => {
    console.error(`❌ Failed to crawl TWSE TWT38U data: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  ...crawler,
  fetchTwseForeignInvestors: crawler.fetchDataset,
  fetchTwseForeignInvestorsOnce: crawler.fetchDatasetOnce,
};
