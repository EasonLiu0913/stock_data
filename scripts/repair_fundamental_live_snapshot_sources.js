#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  syncMissingMonths,
} = require('./sync_mops_monthly_signal_artifacts');

const ROOT = path.resolve(__dirname, '..');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function compactDate(value) {
  const normalized = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(normalized) ? normalized : '';
}

function archiveFileFor(date, snapshot) {
  const fingerprint = String(snapshot?.registry_fingerprint || 'unknown');
  const generated = String(snapshot?.generated_at || new Date().toISOString())
    .replace(/[^0-9]/g, '')
    .slice(0, 14) || Date.now();
  return path.join(
    ROOT,
    'data_prediction_analysis',
    'strategy-snapshots',
    'live_snapshot_history',
    date,
    `${fingerprint}--source-repair-${generated}.json`,
  );
}

function manifestEntry(file, snapshot) {
  return {
    file: path.relative(ROOT, file).replaceAll(path.sep, '/'),
    registry_id: snapshot.registry_id,
    registry_fingerprint: snapshot.registry_fingerprint,
    evaluation_mode: snapshot.evaluation_mode,
    data_as_of: snapshot.data_as_of,
    generated_at: snapshot.generated_at,
    replacement_reason: 'fundamental_source_repair',
  };
}

function archiveExistingLiveSnapshot(date) {
  const liveFile = path.join(
    ROOT,
    'data_prediction_analysis',
    'strategy-snapshots',
    'live_snapshot',
    `${date}.json`,
  );
  const snapshot = readJson(liveFile, null);
  if (!snapshot) return { archived: false, live_file: path.relative(ROOT, liveFile) };

  const archiveFile = archiveFileFor(date, snapshot);
  if (!fs.existsSync(archiveFile)) writeJsonAtomic(archiveFile, snapshot);

  const manifestFile = path.join(ROOT, 'data_prediction_analysis', 'strategy-snapshots', 'manifest.json');
  const manifest = readJson(manifestFile, { schema_version: 2, updated_at: null, dates: {} });
  manifest.dates ||= {};
  const current = manifest.dates[date] || {};
  const history = Array.isArray(current.live_snapshot_history) ? [...current.live_snapshot_history] : [];
  const entry = manifestEntry(archiveFile, snapshot);
  if (!history.some(item => item.file === entry.file)) history.push(entry);
  history.sort((left, right) => String(left.generated_at || '').localeCompare(String(right.generated_at || '')));
  manifest.dates[date] = {
    ...current,
    live_snapshot: null,
    live_snapshot_history: history,
  };
  manifest.updated_at = new Date().toISOString();
  writeJsonAtomic(manifestFile, manifest);
  fs.unlinkSync(liveFile);

  return {
    archived: true,
    archived_file: path.relative(ROOT, archiveFile).replaceAll(path.sep, '/'),
    removed_live_file: path.relative(ROOT, liveFile).replaceAll(path.sep, '/'),
  };
}

function repair({ date } = {}) {
  const targetDate = compactDate(date);
  if (!targetDate) throw new Error('date must be YYYYMMDD');
  const summaryFile = path.join(ROOT, 'data_predictions', targetDate, 'summary.json');
  const summary = readJson(summaryFile, null);
  if (!summary || !Array.isArray(summary.stocks)) throw new Error(`Missing prediction summary: ${summaryFile}`);

  const sync = syncMissingMonths();
  const generatedMonths = (sync.results || []).map(item => item.month);
  if (!generatedMonths.length) {
    return {
      date: targetDate,
      repaired: false,
      reason: 'no_missing_monthly_signal_artifacts',
      generated_months: [],
      archived_live_snapshot: false,
    };
  }

  const archived = archiveExistingLiveSnapshot(targetDate);
  return {
    date: targetDate,
    repaired: true,
    reason: 'fundamental_source_artifacts_generated',
    generated_months: generatedMonths,
    archived_live_snapshot: archived.archived,
    archived_file: archived.archived_file || null,
  };
}

function parseArgs(argv) {
  let date = '';
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--date') date = argv[++index] || '';
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return { date };
}

function main(argv = process.argv.slice(2)) {
  const result = repair(parseArgs(argv));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = {
  archiveExistingLiveSnapshot,
  repair,
};
