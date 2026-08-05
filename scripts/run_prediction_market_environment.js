#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(__dirname, 'generate_market_environment.js');
const REBINDER = path.join(__dirname, 'rebind_prediction_market_environment.js');

function compactDate(value) {
  const compact = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${path.basename(script)} failed with exit code ${result.status}`);
}

function parseArgs(argv) {
  const options = { forecastDate: '', baseDate: '', force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--forecast-date') options.forecastDate = argv[++index] || '';
    else if (arg === '--base-date') options.baseDate = argv[++index] || '';
    else if (arg === '--force') options.force = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const forecast = compactDate(options.forecastDate);
  const base = compactDate(options.baseDate);
  if (!forecast || !base) throw new Error('forecast-date and base-date must be YYYYMMDD');

  const latestFile = path.join(ROOT, 'data_prediction_context', forecast, 'latest.json');
  const latest = readJson(latestFile);
  if (!latest?.external_market_file || !latest?.manifest_file) {
    throw new Error(`Prediction market context is missing for ${forecast}`);
  }
  const contextExternal = path.join(ROOT, latest.external_market_file);
  if (!fs.existsSync(contextExternal)) throw new Error(`Context external market file missing: ${latest.external_market_file}`);

  const overlay = path.join(ROOT, 'data_external_market', base, 'external_market_indicators.json');
  const backup = path.join(os.tmpdir(), `external-market-${base}-${process.pid}.json`);
  const overlayExisted = fs.existsSync(overlay);
  fs.mkdirSync(path.dirname(overlay), { recursive: true });
  if (overlayExisted) fs.copyFileSync(overlay, backup);
  fs.copyFileSync(contextExternal, overlay);

  try {
    const args = ['--forecast-date', forecast, '--base-date', base, '--force'];
    if (latest.external_primary_ready === true) args.push('--strict');
    runNode(GENERATOR, args);
    runNode(REBINDER, ['--forecast-date', forecast]);
  } finally {
    if (overlayExisted) fs.copyFileSync(backup, overlay);
    else fs.rmSync(overlay, { force: true });
    fs.rmSync(backup, { force: true });
    try { fs.rmdirSync(path.dirname(overlay)); } catch {}
  }

  console.log(JSON.stringify({
    forecast_date: forecast,
    base_trade_date: base,
    context_snapshot_id: latest.snapshot_id,
    context_snapshot_hash: latest.snapshot_hash,
    external_primary_ready: latest.external_primary_ready === true,
  }));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { compactDate, readJson, parseArgs, main };
