#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { createCrawler } = require('./lib/twse_fund_crawler');

const CONFIG = Object.freeze({
  endpointId: 'TWT44U',
  apiUrl: 'https://www.twse.com.tw/rwd/zh/fund/TWT44U',
  titleText: '投信買賣超彙總表',
  outputDir: path.resolve(__dirname, '..', 'data_twse_investment_trust'),
  fileSuffix: 'twse_investment_trust',
  filePattern: /^\d{8}_twse_investment_trust\.json$/,
  fieldCount: 6,
  codeIndex: 1,
  nameIndex: 2,
  numericTriples: [[3, 4, 5]],
  requiredGroups: [],
  minRows: 50,
  scriptPath: 'scripts/crawl_twse_investment_trust.js',
});

const crawler = createCrawler(CONFIG);

if (require.main === module) {
  crawler.main().catch((error) => {
    console.error(`❌ Failed to crawl TWSE TWT44U data: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  ...crawler,
  fetchTwseInvestmentTrust: crawler.fetchDataset,
  fetchTwseInvestmentTrustOnce: crawler.fetchDatasetOnce,
};
