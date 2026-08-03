#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildSnapshot,
  loadRegistry,
} = require('./strategy_tag_engine');

const ROOT = path.resolve(__dirname, '..');

function compactDate(value) {
  const normalized = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(normalized) ? normalized : '';
}

function latestPredictionDate(rootDir) {
  const directory = path.join(ROOT, rootDir);
  return fs.readdirSync(directory)
    .filter(name => /^20\d{6}$/.test(name))
    .filter(name => fs.existsSync(path.join(directory, name, 'summary.json')))
    .sort()
    .at(-1) || '';
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function parseArgs(argv) {
  const options = {
    rootDir: 'data_predictions',
    date: '',
    latest: false,
    dryRun: false,
    evaluationMode: 'live_snapshot',
    dataAsOf: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') options.rootDir = argv[++index] || '';
    else if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--latest') options.latest = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--evaluation-mode') options.evaluationMode = argv[++index] || '';
    else if (arg === '--data-as-of') options.dataAsOf = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function applyRegistry(options = {}) {
  const rootDir = options.rootDir || 'data_predictions';
  const date = compactDate(options.date) || (options.latest ? latestPredictionDate(rootDir) : '');
  if (!date) throw new Error('Provide --date YYYYMMDD or --latest');
  if (!['live_snapshot', 'historical_recalculation'].includes(options.evaluationMode || 'live_snapshot')) {
    throw new Error('evaluation mode must be live_snapshot or historical_recalculation');
  }

  const predictionDir = path.join(ROOT, rootDir, date);
  const summaryFile = path.join(predictionDir, 'summary.json');
  if (!fs.existsSync(summaryFile)) throw new Error(`Missing prediction summary: ${summaryFile}`);
  const payload = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  const registry = loadRegistry(ROOT);
  const snapshot = buildSnapshot(payload, registry, {
    forecastDate: date,
    evaluationMode: options.evaluationMode || 'live_snapshot',
    dataAsOf: compactDate(options.dataAsOf) || payload.base_trade_date || null,
  });

  payload.tag_registry = snapshot.tag_registry;
  payload.strategy_registry_v2 = snapshot.strategy_registry;
  payload.tag_classifications = snapshot.tag_classifications;
  payload.strategy_classifications_v2 = snapshot.strategy_classifications;
  payload.stocks = snapshot.stocks;

  const snapshotFile = path.join(
    ROOT,
    'data_prediction_analysis',
    'strategy-snapshots',
    options.evaluationMode || 'live_snapshot',
    `${date}.json`,
  );

  if (!options.dryRun) {
    writeJsonAtomic(summaryFile, payload);
    writeJsonAtomic(snapshotFile, {
      ...snapshot,
      stocks: snapshot.stocks.map(stock => ({
        stock_code: stock.stock_code,
        stock_name: stock.stock_name || '',
        atomic_tags: stock.atomic_tags || [],
        registered_strategy_matches: stock.registered_strategy_matches || [],
      })),
    });
  }

  return {
    date,
    root_dir: rootDir,
    evaluation_mode: snapshot.evaluation_mode,
    tag_count: Object.keys(snapshot.tag_classifications).length,
    strategy_count: Object.keys(snapshot.strategy_classifications).length,
    snapshot_file: path.relative(ROOT, snapshotFile).replaceAll(path.sep, '/'),
    dry_run: Boolean(options.dryRun),
  };
}

function main(argv = process.argv.slice(2)) {
  const result = applyRegistry(parseArgs(argv));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  compactDate,
  latestPredictionDate,
  writeJsonAtomic,
  parseArgs,
  applyRegistry,
  main,
};
