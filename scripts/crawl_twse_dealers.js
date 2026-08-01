#!/usr/bin/env node
'use strict';

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

const crawler = createCrawler(CONFIG);

if (require.main === module) {
  crawler.main().catch((error) => {
    console.error(`❌ Failed to crawl TWSE TWT43U data: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  ...crawler,
  fetchTwseDealers: crawler.fetchDataset,
  fetchTwseDealersOnce: crawler.fetchDatasetOnce,
};
