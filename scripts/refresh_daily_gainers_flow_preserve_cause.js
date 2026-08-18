#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(__dirname, 'backfill_daily_gainers_research.js');
const CAUSE_DIR = path.join(ROOT, 'data_daily_gain_over_5', 'analysis');

function main(argv = process.argv.slice(2)) {
  const dates = argv.filter((value) => /^20\d{6}$/.test(value));
  if (!dates.length) {
    throw new Error('Usage: node scripts/refresh_daily_gainers_flow_preserve_cause.js YYYYMMDD [YYYYMMDD...]');
  }

  const preserved = new Map();
  for (const date of dates) {
    const file = path.join(CAUSE_DIR, `${date}.json`);
    if (fs.existsSync(file)) preserved.set(file, fs.readFileSync(file));
  }

  const result = spawnSync(process.execPath, [GENERATOR, ...dates], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`backfill_daily_gainers_research.js failed with exit code ${result.status}`);
  }

  for (const [file, content] of preserved) {
    fs.writeFileSync(file, content);
  }

  console.log(JSON.stringify({
    dates,
    preserved_cause_files: [...preserved.keys()].map((file) => path.relative(ROOT, file)),
    refreshed_flow_files: dates.map((date) => `data_daily_gain_over_5/analysis-flow/${date}.json`),
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
