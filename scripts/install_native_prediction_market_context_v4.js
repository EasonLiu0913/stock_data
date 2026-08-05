#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scriptsDir = __dirname;
const sourceFile = path.join(scriptsDir, 'install_native_prediction_market_context_v3.js');
const temporaryFile = path.join(scriptsDir, '.install_native_prediction_market_context_v3_fixed.js');

function main() {
  if (!fs.existsSync(sourceFile)) throw new Error(`Missing source migration: ${sourceFile}`);
  const source = fs.readFileSync(sourceFile, 'utf8');
  fs.writeFileSync(temporaryFile, `${source}\n}\n`, 'utf8');
  const check = spawnSync(process.execPath, ['--check', temporaryFile], { encoding: 'utf8' });
  if (check.status !== 0) throw new Error(check.stderr || check.stdout || 'Corrected migration syntax check failed');
  const run = spawnSync(process.execPath, [temporaryFile], {
    cwd: path.resolve(scriptsDir, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  fs.rmSync(temporaryFile, { force: true });
  fs.rmSync(__filename, { force: true });
  if (run.status !== 0) throw new Error(`Corrected migration failed with exit code ${run.status}`);
}

try {
  main();
} catch (error) {
  fs.rmSync(temporaryFile, { force: true });
  console.error(`Error: ${error.stack || error.message}`);
  process.exitCode = 1;
}
