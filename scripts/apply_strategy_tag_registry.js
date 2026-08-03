#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildSnapshot,
  loadRegistry,
  registryFingerprint,
} = require('./strategy_tag_engine');

const ROOT = path.resolve(__dirname, '..');

function compactDate(value) {
  const normalized = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(normalized) ? normalized : '';
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function isValidPredictionSummary(file) {
  const payload = readJson(file, null);
  return Boolean(payload && Array.isArray(payload.stocks));
}

function latestPredictionDate(rootDir, workspaceRoot = ROOT) {
  const directory = path.join(workspaceRoot, rootDir);
  if (!fs.existsSync(directory)) return '';
  return fs.readdirSync(directory)
    .filter(name => /^20\d{6}$/.test(name))
    .filter(name => isValidPredictionSummary(path.join(directory, name, 'summary.json')))
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

function compactSnapshot(snapshot) {
  return {
    ...snapshot,
    stocks: (snapshot.stocks || []).map(stock => ({
      stock_code: stock.stock_code,
      stock_name: stock.stock_name || '',
      atomic_tags: stock.atomic_tags || [],
      registered_strategy_matches: stock.registered_strategy_matches || [],
    })),
  };
}

function applySnapshotToPayload(payload, snapshot) {
  const byCode = new Map((snapshot.stocks || []).map(stock => [String(stock.stock_code), stock]));
  payload.tag_registry = snapshot.tag_registry || [];
  payload.strategy_registry_v2 = snapshot.strategy_registry || [];
  payload.tag_classifications = snapshot.tag_classifications || {};
  payload.strategy_classifications_v2 = snapshot.strategy_classifications || {};
  payload.strategy_snapshot_metadata = {
    registry_id: snapshot.registry_id,
    registry_fingerprint: snapshot.registry_fingerprint,
    evaluation_mode: snapshot.evaluation_mode,
    data_as_of: snapshot.data_as_of,
    generated_at: snapshot.generated_at,
  };
  payload.stocks = (payload.stocks || []).map(stock => {
    const saved = byCode.get(String(stock.stock_code || ''));
    return {
      ...stock,
      atomic_tags: saved?.atomic_tags || [],
      registered_strategy_matches: saved?.registered_strategy_matches || [],
    };
  });
  return payload;
}

function snapshotFileFor(workspaceRoot, date, evaluationMode, fingerprint, dataAsOf) {
  const root = path.join(workspaceRoot, 'data_prediction_analysis', 'strategy-snapshots');
  if (evaluationMode === 'live_snapshot') return path.join(root, 'live_snapshot', `${date}.json`);
  const suffix = compactDate(dataAsOf) || date;
  return path.join(root, 'historical_recalculation', date, `${fingerprint}--asof-${suffix}.json`);
}

function updateSnapshotManifest(workspaceRoot, snapshotFile, snapshot) {
  const manifestFile = path.join(workspaceRoot, 'data_prediction_analysis', 'strategy-snapshots', 'manifest.json');
  const manifest = readJson(manifestFile, {
    schema_version: 1,
    updated_at: null,
    dates: {},
  });
  const date = compactDate(snapshot.forecast_date);
  if (!manifest.dates[date]) {
    manifest.dates[date] = { live_snapshot: null, historical_recalculations: [] };
  }
  const before = JSON.stringify(manifest.dates[date]);
  const entry = {
    file: path.relative(workspaceRoot, snapshotFile).replaceAll(path.sep, '/'),
    registry_id: snapshot.registry_id,
    registry_fingerprint: snapshot.registry_fingerprint,
    evaluation_mode: snapshot.evaluation_mode,
    data_as_of: snapshot.data_as_of,
    generated_at: snapshot.generated_at,
  };
  if (snapshot.evaluation_mode === 'live_snapshot') {
    manifest.dates[date].live_snapshot = entry;
  } else {
    const rows = manifest.dates[date].historical_recalculations || [];
    const filtered = rows.filter(item => item.file !== entry.file);
    filtered.push(entry);
    filtered.sort((left, right) => String(left.generated_at).localeCompare(String(right.generated_at)));
    manifest.dates[date].historical_recalculations = filtered;
  }
  const changed = before !== JSON.stringify(manifest.dates[date]);
  if (changed) {
    manifest.updated_at = new Date().toISOString();
    writeJsonAtomic(manifestFile, manifest);
  }
  return { manifestFile, changed };
}

function applyRegistry(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || ROOT);
  const rootDir = options.rootDir || 'data_predictions';
  const date = compactDate(options.date) || (options.latest ? latestPredictionDate(rootDir, workspaceRoot) : '');
  if (!date) throw new Error('Provide --date YYYYMMDD or --latest');
  const evaluationMode = options.evaluationMode || 'live_snapshot';
  if (!['live_snapshot', 'historical_recalculation'].includes(evaluationMode)) {
    throw new Error('evaluation mode must be live_snapshot or historical_recalculation');
  }

  const predictionDir = path.join(workspaceRoot, rootDir, date);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const payload = readJson(summaryFile, null);
  if (!payload || !Array.isArray(payload.stocks)) throw new Error(`Missing or invalid prediction summary: ${summaryFile}`);
  const registry = options.registry || loadRegistry(workspaceRoot);
  const fingerprint = registryFingerprint(registry);
  const dataAsOf = compactDate(options.dataAsOf) || compactDate(payload.base_trade_date) || date;
  const snapshotFile = snapshotFileFor(workspaceRoot, date, evaluationMode, fingerprint, dataAsOf);

  let snapshot = readJson(snapshotFile, null);
  const reusedExistingSnapshot = Boolean(snapshot);
  if (!snapshot) {
    snapshot = buildSnapshot(structuredClone(payload), registry, {
      forecastDate: date,
      evaluationMode,
      dataAsOf,
    });
  }

  let manifestChanged = false;
  if (!options.dryRun) {
    if (!reusedExistingSnapshot) writeJsonAtomic(snapshotFile, compactSnapshot(snapshot));
    manifestChanged = updateSnapshotManifest(workspaceRoot, snapshotFile, snapshot).changed;
    if (evaluationMode === 'live_snapshot') {
      writeJsonAtomic(summaryFile, applySnapshotToPayload(payload, snapshot));
    }
  }

  return {
    date,
    root_dir: rootDir,
    evaluation_mode: snapshot.evaluation_mode,
    registry_id: snapshot.registry_id,
    registry_fingerprint: snapshot.registry_fingerprint,
    tag_count: Object.keys(snapshot.tag_classifications || {}).length,
    strategy_count: Object.keys(snapshot.strategy_classifications || {}).length,
    snapshot_file: path.relative(workspaceRoot, snapshotFile).replaceAll(path.sep, '/'),
    manifest_file: 'data_prediction_analysis/strategy-snapshots/manifest.json',
    reused_existing_snapshot: reusedExistingSnapshot,
    summary_enriched: evaluationMode === 'live_snapshot',
    manifest_changed: manifestChanged,
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
  readJson,
  isValidPredictionSummary,
  latestPredictionDate,
  writeJsonAtomic,
  parseArgs,
  compactSnapshot,
  applySnapshotToPayload,
  snapshotFileFor,
  updateSnapshotManifest,
  applyRegistry,
  main,
};
