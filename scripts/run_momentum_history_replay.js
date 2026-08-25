#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  compactDate,
  readJson,
  persistMomentumHistory,
  refreshRecentReplays,
} = require('./momentum_history_replay');

const ROOT = path.resolve(__dirname, '..');

function snapshotHasCompletedMomentum(payload) {
  if (!payload || !Array.isArray(payload.stocks) || !payload.stocks.length) return false;
  if (!payload.registry_fingerprint || !payload.registry_id) return false;
  return payload.stocks.some(stock => {
    const features = stock?.strategy_tag_features || {};
    return Number(features.momentum_model_version) === 1
      && Number.isFinite(Number(features.momentum_score));
  });
}

function liveSnapshotDirectory(workspaceRoot = ROOT) {
  return path.join(workspaceRoot, 'data_prediction_analysis', 'strategy-snapshots', 'live_snapshot');
}

function liveSnapshotFile(date, workspaceRoot = ROOT) {
  return path.join(liveSnapshotDirectory(workspaceRoot), `${date}.json`);
}

function validSnapshotDate(date, workspaceRoot = ROOT) {
  const payload = readJson(liveSnapshotFile(date, workspaceRoot), null);
  return snapshotHasCompletedMomentum(payload);
}

function listPredictionDates(workspaceRoot = ROOT) {
  const directory = liveSnapshotDirectory(workspaceRoot);
  let names = [];
  try { names = fs.readdirSync(directory); } catch { return []; }
  return names
    .map(name => name.match(/^(20\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .filter(date => validSnapshotDate(date, workspaceRoot))
    .sort();
}

function parseArgs(argv) {
  const options = {
    date: '',
    latest: false,
    latestCount: 0,
    start: '',
    end: '',
    dryRun: false,
    replayLookback: 10,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = compactDate(argv[++index]);
    else if (arg === '--latest') options.latest = true;
    else if (arg === '--latest-count') options.latestCount = Math.max(1, Number(argv[++index]) || 1);
    else if (arg === '--start') options.start = compactDate(argv[++index]);
    else if (arg === '--end') options.end = compactDate(argv[++index]);
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--replay-lookback') options.replayLookback = Math.max(1, Number(argv[++index]) || 10);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function resolveDates(options, workspaceRoot = ROOT) {
  const dates = listPredictionDates(workspaceRoot);
  if (options.date) return dates.includes(options.date) ? [options.date] : [];
  if (options.latestCount > 0) return dates.slice(-options.latestCount);
  if (options.latest) return dates.length ? [dates.at(-1)] : [];
  if (options.start || options.end) {
    return dates.filter(date => (!options.start || date >= options.start) && (!options.end || date <= options.end));
  }
  return dates.length ? [dates.at(-1)] : [];
}

function run(options = {}, workspaceRoot = ROOT) {
  const dates = resolveDates(options, workspaceRoot);
  if (!dates.length) throw new Error('No completed momentum live snapshot matched the requested date range');
  const histories = [];
  for (const predictionDate of dates) {
    const payload = readJson(liveSnapshotFile(predictionDate, workspaceRoot), null);
    if (!snapshotHasCompletedMomentum(payload)) continue;
    const result = persistMomentumHistory(payload, {
      workspaceRoot,
      dryRun: options.dryRun,
    });
    histories.push({
      prediction_date: predictionDate,
      signal_date: result.history.signal_date,
      previous_signal_date: result.history.previous_signal_date,
      stock_count: result.history.stock_count,
      grade_counts: result.history.grade_counts,
      source_registry_fingerprint: result.history.source_registry_fingerprint,
      file: path.relative(workspaceRoot, result.file).replaceAll(path.sep, '/'),
    });
  }
  const replays = options.dryRun ? [] : refreshRecentReplays(workspaceRoot, {
    lookbackDates: options.replayLookback || 10,
  }).map(item => ({
    ...item,
    file: path.relative(workspaceRoot, item.file).replaceAll(path.sep, '/'),
  }));
  return {
    schema_version: 1,
    source: 'strategy-snapshots/live_snapshot',
    dry_run: Boolean(options.dryRun),
    processed_prediction_dates: dates,
    histories,
    refreshed_replays: replays,
  };
}

function main(argv = process.argv.slice(2)) {
  const result = run(parseArgs(argv));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  snapshotHasCompletedMomentum,
  liveSnapshotDirectory,
  liveSnapshotFile,
  validSnapshotDate,
  listPredictionDates,
  parseArgs,
  resolveDates,
  run,
  main,
};
