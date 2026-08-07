#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateMiIndexFile } = require('./plan_twse_mi_index_range_backfill');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'data_twse_mi_index');

function parseDates(value) {
  const dates = String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  if (!dates.length || dates.some(date => !/^20\d{6}$/.test(date))) {
    throw new Error('--dates must be a comma-separated YYYYMMDD list');
  }
  return dates;
}

function main(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--dates');
  const dates = parseDates(index >= 0 ? argv[index + 1] : '');
  const results = [];
  for (const date of dates) {
    const file = path.join(OUTPUT_DIR, `${date}_twse_mi_index.json`);
    const beforeErrors = validateMiIndexFile(file, date);
    if (!beforeErrors.length) {
      results.push({ date, status: 'reuse' });
      continue;
    }
    const child = spawnSync(process.execPath, [
      path.join(__dirname, 'crawl_twse_mi_index.js'),
      '--date', date,
      '--type', 'ALL',
      '--max-retries', '3',
      '--min-delay', '1500',
      '--max-delay', '3000',
      '--mismatch-cooldown', '30000',
      '--rate-limit-cooldown', '30000',
    ], { cwd: ROOT, stdio: 'inherit', env: process.env });
    if (child.status !== 0) throw new Error(`MI_INDEX crawl failed for ${date}`);
    const afterErrors = validateMiIndexFile(file, date);
    if (afterErrors.length) throw new Error(`MI_INDEX validation failed for ${date}: ${afterErrors.join(',')}`);
    results.push({ date, status: 'generated' });
  }
  console.log(JSON.stringify({ total: results.length, generated: results.filter(r => r.status === 'generated').length, reused: results.filter(r => r.status === 'reuse').length, results }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
