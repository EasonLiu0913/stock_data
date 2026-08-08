#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateMiIndexFile } = require('./plan_twse_mi_index_range_backfill');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'data_twse_mi_index');
const DEFAULT_MIN_REQUEST_DELAY_MS = 6000;
const DEFAULT_MAX_REQUEST_DELAY_MS = 10000;

function parseDates(value) {
  const dates = String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  if (!dates.length || dates.some(date => !/^20\d{6}$/.test(date))) {
    throw new Error('--dates must be a comma-separated YYYYMMDD list');
  }
  return dates;
}

function sleepSync(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.floor(ms));
}

function randomDelay(minMs = DEFAULT_MIN_REQUEST_DELAY_MS, maxMs = DEFAULT_MAX_REQUEST_DELAY_MS) {
  if (maxMs <= minMs) return minMs;
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

function main(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--dates');
  const dates = parseDates(index >= 0 ? argv[index + 1] : '');
  const results = [];
  let generatedRequestCount = 0;

  for (const date of dates) {
    const file = path.join(OUTPUT_DIR, `${date}_twse_mi_index.json`);
    const beforeErrors = validateMiIndexFile(file, date);
    if (!beforeErrors.length) {
      results.push({ date, status: 'reuse' });
      continue;
    }

    // Historical MI_INDEX requests are deliberately paced even when the
    // previous request succeeded. Without this gap, a batch of dates can hit
    // TWSE's temporary 307 throttling window before the crawler's retry logic
    // has a chance to recover.
    if (generatedRequestCount > 0) {
      const delay = randomDelay();
      console.log(`🕒 Pacing historical MI_INDEX requests: waiting ${Math.round(delay / 1000)}s before ${date}`);
      sleepSync(delay);
    }
    generatedRequestCount += 1;

    const child = spawnSync(process.execPath, [
      path.join(__dirname, 'crawl_twse_mi_index.js'),
      '--date', date,
      '--type', 'ALL',
      '--max-retries', '4',
      '--min-delay', '3000',
      '--max-delay', '6000',
      '--mismatch-cooldown', '60000',
      '--rate-limit-cooldown', '90000',
    ], { cwd: ROOT, stdio: 'inherit', env: process.env });
    if (child.status !== 0) throw new Error(`MI_INDEX crawl failed for ${date}`);
    const afterErrors = validateMiIndexFile(file, date);
    if (afterErrors.length) throw new Error(`MI_INDEX validation failed for ${date}: ${afterErrors.join(',')}`);
    results.push({ date, status: 'generated' });
  }

  console.log(JSON.stringify({
    total: results.length,
    generated: results.filter(r => r.status === 'generated').length,
    reused: results.filter(r => r.status === 'reuse').length,
    results,
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = {
  DEFAULT_MAX_REQUEST_DELAY_MS,
  DEFAULT_MIN_REQUEST_DELAY_MS,
  main,
  parseDates,
  randomDelay,
  sleepSync,
};
