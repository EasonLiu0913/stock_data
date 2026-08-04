#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  cleanupRequestedStart,
  countCompleteAtStart,
  seedRequestedStart
} = require('./lib/sma_history_range_seed');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const positional = [];
  const flags = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) flags.set(key, true);
    else {
      flags.set(key, next);
      index += 1;
    }
  }
  return { positional, flags };
}

function main(argv = process.argv.slice(2)) {
  const { positional, flags } = parseArgs(argv);
  const startIndex = Number(positional[0]);
  const limit = Number(positional[1]);
  const startDate = String(flags.get('start') || '').replaceAll('/', '');
  if (!Number.isInteger(startIndex) || startIndex < 0) throw new Error('start_index is required');
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('limit is required');
  if (!/^\d{8}$/.test(startDate)) throw new Error('--start YYYYMMDD is required');

  const csvFile = path.join(ROOT, 'data_twse', 'twse_industry.csv');
  const historyDir = path.join(ROOT, 'data_history_sma');
  const stateFile = path.join(
    process.env.RUNNER_TEMP || path.join(ROOT, '.tmp'),
    `sma-range-seed-${startIndex}-${limit}.json`
  );
  const common = { csvFile, historyDir, stateFile, startDate, startIndex, limit };
  const before = countCompleteAtStart(common);
  const seeded = seedRequestedStart(common);
  console.log(JSON.stringify({ phase: 'seed', ...before, seededCount: seeded.seededCount }));

  let status = 1;
  try {
    const startSlash = `${startDate.slice(0, 4)}/${startDate.slice(4, 6)}/${startDate.slice(6, 8)}`;
    const child = spawnSync(
      process.execPath,
      [path.join(__dirname, 'crawl_history_sma.js'), String(startIndex), String(limit), '--start', startSlash],
      { cwd: ROOT, env: process.env, stdio: 'inherit' }
    );
    status = Number.isInteger(child.status) ? child.status : 1;
    if (child.error) console.error(child.error);
  } finally {
    const cleanup = cleanupRequestedStart(common);
    const after = countCompleteAtStart(common);
    console.log(JSON.stringify({ phase: 'cleanup', ...cleanup, before: before.completeCount, after: after.completeCount }));
  }

  if (status !== 0) process.exitCode = status;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Failed to run SMA history range batch: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs };
