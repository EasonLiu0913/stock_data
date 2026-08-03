#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MANIFEST = path.join(
  ROOT,
  'data_prediction_analysis',
  'strategy-snapshots',
  'manifest.json',
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, payload) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function compactClassification(item = {}, kind) {
  const id = kind === 'tag' ? item.tag_id : item.strategy_id;
  return {
    [`${kind}_id`]: id || null,
    family_id: item.family_id || null,
    version: Number(item.version || 1),
    label: item.label || id || '',
    count: Number(item.count || 0),
    calculation_status: item.calculation_status || 'unknown',
    coverage_pct: item.coverage_pct ?? null,
    available_stock_count: item.available_stock_count ?? null,
    unavailable_stock_count: item.unavailable_stock_count ?? null,
  };
}

function sourceSummary(sourceMetadata = {}) {
  return Object.fromEntries(Object.entries(sourceMetadata).map(([key, value]) => [key, {
    calculation_status: value?.calculation_status || 'unknown',
    coverage_pct: value?.coverage_pct ?? value?.coverage_5d_pct ?? null,
    calculation_message: value?.calculation_message || '',
  }]));
}

function snapshotSummary(snapshot = {}) {
  const tags = Object.values(snapshot.tag_classifications || {})
    .map(item => compactClassification(item, 'tag'))
    .sort((left, right) => String(left.tag_id).localeCompare(String(right.tag_id)));
  const strategies = Object.values(snapshot.strategy_classifications || {})
    .map(item => compactClassification(item, 'strategy'))
    .sort((left, right) => String(left.strategy_id).localeCompare(String(right.strategy_id)));
  return {
    total_stock_count: Array.isArray(snapshot.stocks) ? snapshot.stocks.length : null,
    tag_count: tags.length,
    strategy_count: strategies.length,
    sources: sourceSummary(snapshot.source_metadata || {}),
    tags,
    strategies,
  };
}

function manifestEntries(manifest = {}) {
  const rows = [];
  for (const [date, dateEntry] of Object.entries(manifest.dates || {})) {
    if (dateEntry.live_snapshot) rows.push({ date, entry: dateEntry.live_snapshot });
    for (const entry of dateEntry.live_snapshot_history || []) rows.push({ date, entry });
    for (const entry of dateEntry.historical_recalculations || []) rows.push({ date, entry });
  }
  return rows;
}

function summarizeManifest(manifestFile = DEFAULT_MANIFEST, options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || ROOT);
  const manifest = readJson(manifestFile);
  let changed = false;
  let summarized = 0;
  for (const { entry } of manifestEntries(manifest)) {
    if (!entry?.file) continue;
    const snapshotFile = path.resolve(workspaceRoot, entry.file);
    if (!fs.existsSync(snapshotFile)) throw new Error(`Snapshot file missing: ${entry.file}`);
    const snapshot = readJson(snapshotFile);
    const summary = snapshotSummary(snapshot);
    if (JSON.stringify(entry.classification_summary || null) === JSON.stringify(summary)) continue;
    entry.classification_summary = summary;
    changed = true;
    summarized += 1;
  }
  if (changed && !options.dryRun) {
    manifest.updated_at = new Date().toISOString();
    writeJsonAtomic(manifestFile, manifest);
  }
  return {
    manifest_file: path.relative(workspaceRoot, manifestFile).replaceAll(path.sep, '/'),
    entry_count: manifestEntries(manifest).length,
    summarized_entry_count: summarized,
    changed,
    dry_run: Boolean(options.dryRun),
  };
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const result = summarizeManifest(DEFAULT_MANIFEST, { dryRun });
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
  ROOT,
  DEFAULT_MANIFEST,
  readJson,
  writeJsonAtomic,
  compactClassification,
  sourceSummary,
  snapshotSummary,
  manifestEntries,
  summarizeManifest,
  main,
};
