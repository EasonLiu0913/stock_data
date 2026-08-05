#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { fetchRealtimeTxNight } = require('./taifex_realtime_night_futures');
const { captureExternalMarketSnapshot } = require('./external_market_intraday_snapshot');

const ROOT = path.resolve(__dirname, '..');
const CONTEXT_ROOT = path.join(ROOT, 'data_prediction_context');

function compactDate(value) {
  const compact = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function snapshotId(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}T${values.hour}${values.minute}${values.second}+0800`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function writeGitHubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`, 'utf8');
}

async function capturePredictionMarketContext({ forecastDate, baseDate, observedAt = new Date(), rootDir = CONTEXT_ROOT } = {}) {
  const forecast = compactDate(forecastDate);
  const base = compactDate(baseDate);
  if (!forecast || !base) throw new Error('forecastDate and baseDate must be YYYYMMDD');

  const id = snapshotId(observedAt);
  const snapshotDir = path.join(rootDir, forecast, 'snapshots', id);
  const [nightFutures, externalMarket] = await Promise.all([
    fetchRealtimeTxNight({ forecastDate: forecast, observedAt, sessionStatus: 'in_progress' }),
    captureExternalMarketSnapshot({ expectedMarketDate: base, observedAt }),
  ]);

  const nightFile = path.join(snapshotDir, 'night-futures.json');
  const externalFile = path.join(snapshotDir, 'external-market.json');
  atomicWriteJson(nightFile, nightFutures);
  atomicWriteJson(externalFile, externalMarket);

  const manifestWithoutHash = {
    schema_version: 1,
    snapshot_id: id,
    snapshot_type: 'prediction_time_market_context',
    prediction_stage: 'live_snapshot',
    forecast_date: forecast,
    base_trade_date: base,
    captured_at: observedAt.toISOString(),
    immutable: true,
    is_final: false,
    night_futures: {
      available: nightFutures.available === true,
      session_status: nightFutures.session_status || null,
      trading_date: nightFutures.trading_date || forecast,
      change_percent: nightFutures.change_percent ?? null,
      quote_timestamp: nightFutures.quote_timestamp || null,
      source_file: relative(nightFile),
    },
    external_market: {
      available: externalMarket.indicator_count > 0,
      primary_ready: externalMarket.primary_ready === true,
      expected_market_date: externalMarket.expected_market_date || base,
      primary_indicator_agreement: externalMarket.primary_indicator_agreement || null,
      source_file: relative(externalFile),
    },
  };
  const manifest = { ...manifestWithoutHash, snapshot_hash: sha256(manifestWithoutHash) };
  const manifestFile = path.join(snapshotDir, 'manifest.json');
  atomicWriteJson(manifestFile, manifest);

  const latestFile = path.join(rootDir, forecast, 'latest.json');
  atomicWriteJson(latestFile, {
    schema_version: 1,
    forecast_date: forecast,
    base_trade_date: base,
    snapshot_id: id,
    snapshot_hash: manifest.snapshot_hash,
    captured_at: manifest.captured_at,
    manifest_file: relative(manifestFile),
    night_futures_file: relative(nightFile),
    external_market_file: relative(externalFile),
    external_primary_ready: manifest.external_market.primary_ready,
  });

  writeGitHubOutput('snapshot_id', id);
  writeGitHubOutput('snapshot_hash', manifest.snapshot_hash);
  writeGitHubOutput('manifest_file', relative(manifestFile));
  writeGitHubOutput('night_futures_file', relative(nightFile));
  writeGitHubOutput('external_market_file', relative(externalFile));
  writeGitHubOutput('external_primary_ready', manifest.external_market.primary_ready ? 'true' : 'false');

  return {
    forecast_date: forecast,
    base_trade_date: base,
    snapshot_id: id,
    snapshot_hash: manifest.snapshot_hash,
    manifest_file: relative(manifestFile),
    night_futures_file: relative(nightFile),
    external_market_file: relative(externalFile),
    external_primary_ready: manifest.external_market.primary_ready,
  };
}

function parseArgs(argv) {
  const options = { forecastDate: '', baseDate: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--forecast-date') options.forecastDate = argv[++index] || '';
    else if (arg === '--base-date') options.baseDate = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const result = await capturePredictionMarketContext(parseArgs(argv));
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONTEXT_ROOT,
  compactDate,
  atomicWriteJson,
  snapshotId,
  sha256,
  capturePredictionMarketContext,
  main,
};
