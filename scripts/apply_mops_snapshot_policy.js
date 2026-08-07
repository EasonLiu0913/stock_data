#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  monthOutputDir,
  normalizeRevenueMonth,
  readJson,
  writeJson,
} = require('./crawl_mops_monthly_revenue');

function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function snapshotFiles(month) {
  const dir = path.join(monthOutputDir(month), 'snapshots');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^\d{8}_\d{6}\.json$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

function sourceHash(file) {
  return readJson(file, null)?.source?.sha256 || null;
}

function applySnapshotPolicy(revenueMonth, { forceNewSnapshot = false } = {}) {
  const month = normalizeRevenueMonth(revenueMonth);
  let files = snapshotFiles(month);
  let removed = null;
  let reason = forceNewSnapshot ? 'force_new_snapshot' : 'source_changed_or_first_snapshot';

  if (!forceNewSnapshot && files.length >= 2) {
    const latest = files.at(-1);
    const previous = files.at(-2);
    const latestHash = sourceHash(latest);
    const previousHash = sourceHash(previous);
    if (latestHash && previousHash && latestHash === previousHash) {
      fs.unlinkSync(latest);
      removed = latest;
      reason = 'duplicate_source_sha256';
      files = snapshotFiles(month);
    }
  }

  const outputFile = path.join(monthOutputDir(month), 'monthly_revenue.json');
  const payload = readJson(outputFile, null);
  if (!payload) throw new Error(`Missing monthly revenue payload: ${outputFile}`);
  payload.collection = {
    ...payload.collection,
    snapshot_count: files.length,
  };
  writeJson(outputFile, payload);

  return {
    revenue_month: month,
    force_new_snapshot: forceNewSnapshot,
    snapshot_count: files.length,
    removed_duplicate_snapshot: removed ? path.relative(process.cwd(), removed).replaceAll(path.sep, '/') : null,
    reason,
  };
}

function main() {
  const args = parseArgs();
  const month = normalizeRevenueMonth(args.get('month'));
  const forceNewSnapshot = args.has('force-new-snapshot');
  console.log(JSON.stringify(applySnapshotPolicy(month, { forceNewSnapshot }), null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { applySnapshotPolicy, snapshotFiles, sourceHash };
