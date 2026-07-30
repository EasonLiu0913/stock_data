#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  parseArgs,
  compactDate,
  readJson,
  sha256,
} = require('./market_environment_lib');

function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`, 'utf8');
}

function main() {
  const args = parseArgs();
  const forecastDate = compactDate(args.get('forecast-date') || process.env.FORECAST_TARGET_DATE, 'forecast date');
  const baseDate = compactDate(args.get('base-date') || process.env.FORECAST_BASE_DATE, 'base date');
  const allowHistorical = args.has('allow-historical-reconstruction');
  const file = path.join(ROOT, 'data_market_environment', forecastDate, 'market_environment.json');
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`Missing market environment snapshot: ${path.relative(ROOT, file)}`);
  const payload = readJson(file, {});
  if (payload.forecast_date_compact !== forecastDate) throw new Error('Market environment forecast date mismatch');
  if (payload.base_trade_date_compact !== baseDate) throw new Error('Market environment base date mismatch');
  if (payload.mode !== 'shadow') throw new Error(`Unsupported environment mode: ${payload.mode}`);
  if (payload.environment?.code === 'data_invalid') throw new Error('Market environment is marked data_invalid');
  if (!['fresh', 'holiday_adjusted'].includes(payload.data_freshness?.status)) {
    throw new Error(`Market environment freshness is not acceptable: ${payload.data_freshness?.status}`);
  }
  if (payload.historical_reconstruction && !allowHistorical) {
    throw new Error('Historical reconstruction cannot be used as a live immutable snapshot without explicit allowance');
  }
  const { snapshot_hash: storedHash, ...withoutHash } = payload;
  const actualHash = sha256(withoutHash);
  if (!storedHash || storedHash !== actualHash) throw new Error('Market environment snapshot hash mismatch');

  writeOutput('environment_code', payload.environment.code);
  writeOutput('environment_label', payload.environment.label);
  writeOutput('snapshot_hash', payload.snapshot_hash);
  writeOutput('environment_file', path.relative(ROOT, file).replaceAll(path.sep, '/'));
  console.log(JSON.stringify({
    valid: true,
    forecast_date: forecastDate,
    base_date: baseDate,
    environment: payload.environment.code,
    freshness: payload.data_freshness.status,
    snapshot_hash: payload.snapshot_hash,
  }));
}

main();
