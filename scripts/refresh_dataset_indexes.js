#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ROOT, parseArgs, readJson, writeJsonAtomic } = require('./lib/range_backfill');

const CNN_SOURCE_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';

const DATASETS = {
  external_market: {
    root: 'data_external_market',
    file: 'external_market_indicators.json',
    manifest: ({ dates, generatedAt }) => ({
      schemaVersion: 1,
      generated_at: generatedAt,
      latest_date: dates.at(-1) || null,
      latest_file: dates.length ? `data_external_market/${dates.at(-1)}/external_market_indicators.json` : null,
      available_dates: dates
    })
  },
  market_risk: {
    root: 'data_market_risk',
    file: 'market_risk_snapshot.json',
    manifest: ({ dates, generatedAt }) => ({
      schemaVersion: 1,
      generated_at: generatedAt,
      latest_date: dates.at(-1) || null,
      latest_file: dates.length ? `data_market_risk/${dates.at(-1)}/market_risk_snapshot.json` : null,
      available_dates: dates
    })
  },
  cnn_fear_and_greed: {
    root: 'data_cnn_fear_and_greed',
    file: 'cnn_fear_and_greed.json',
    manifest: ({ dates }) => {
      const latestDate = dates.at(-1) || null;
      const latestPayload = latestDate
        ? readJson(path.join(ROOT, 'data_cnn_fear_and_greed', latestDate, 'cnn_fear_and_greed.json'), {})
        : {};
      return {
        schemaVersion: 1,
        source_url: CNN_SOURCE_URL,
        latest_date: latestDate,
        latest_file: latestDate ? `data_cnn_fear_and_greed/${latestDate}/cnn_fear_and_greed.json` : null,
        latest_timestamp: latestPayload?.fear_and_greed?.timestamp || null,
        available_dates: dates
      };
    }
  },
  vix: {
    root: 'data_vix',
    file: 'vix.json',
    manifest: ({ dates, generatedAt }) => ({
      schemaVersion: 1,
      generated_at: generatedAt,
      symbol: '^VIX',
      source: 'yahoo_finance_chart',
      latest_date: dates.at(-1) || null,
      latest_file: dates.length ? `data_vix/${dates.at(-1)}/vix.json` : null,
      available_dates: dates
    })
  }
};

function refreshDataset(name, now = new Date().toISOString()) {
  const config = DATASETS[name];
  if (!config) throw new Error(`Unknown dataset: ${name}`);
  const root = path.join(ROOT, config.root);
  fs.mkdirSync(root, { recursive: true });
  const dates = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^20\d{6}$/.test(entry.name))
    .filter((entry) => fs.existsSync(path.join(root, entry.name, config.file)))
    .map((entry) => entry.name)
    .sort();
  writeJsonAtomic(path.join(root, 'files.json'), dates.map((date) => `${date}/${config.file}`));
  writeJsonAtomic(path.join(root, 'manifest.json'), config.manifest({ dates, generatedAt: now }));
  return { name, count: dates.length, latestDate: dates.at(-1) || null };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const requested = String(args.get('datasets') || args.get('dataset') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!requested.length) throw new Error('--datasets is required');
  const result = requested.map((name) => refreshDataset(name));
  console.log(JSON.stringify(result));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Failed to refresh dataset indexes: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { DATASETS, refreshDataset };
