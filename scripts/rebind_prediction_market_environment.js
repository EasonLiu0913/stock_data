#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readJson, atomicWriteJson, sha256 } = require('./market_environment_lib');

function compactDate(value) {
  const compact = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function parseArgs(argv) {
  const options = { forecastDate: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--forecast-date') options.forecastDate = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function rebindPredictionMarketEnvironment(forecastDate) {
  const forecast = compactDate(forecastDate);
  if (!forecast) throw new Error('forecastDate must be YYYYMMDD');
  const latestFile = path.join(ROOT, 'data_prediction_context', forecast, 'latest.json');
  const latest = readJson(latestFile, null);
  if (!latest?.manifest_file || !latest?.external_market_file) throw new Error(`Missing prediction context for ${forecast}`);
  const manifest = readJson(path.join(ROOT, latest.manifest_file), null);
  if (!manifest) throw new Error(`Missing context manifest: ${latest.manifest_file}`);
  const environmentFile = path.join(ROOT, 'data_market_environment', forecast, 'market_environment.json');
  const environment = readJson(environmentFile, null);
  if (!environment) throw new Error(`Missing market environment: ${environmentFile}`);

  const primaryReady = latest.external_primary_ready === true;
  const { snapshot_hash: ignored, ...withoutOldHash } = environment;
  const rebound = {
    ...withoutOldHash,
    generated_at: manifest.captured_at || environment.generated_at,
    information_cutoff: manifest.captured_at || environment.information_cutoff,
    source_files: {
      ...(environment.source_files || {}),
      external_market: latest.external_market_file,
      prediction_market_context: latest.manifest_file,
      prediction_night_futures: latest.night_futures_file || null,
    },
    prediction_market_context: {
      snapshot_id: latest.snapshot_id,
      snapshot_hash: latest.snapshot_hash,
      captured_at: latest.captured_at,
      prediction_stage: 'live_snapshot',
      immutable: true,
      manifest_file: latest.manifest_file,
      external_market_file: latest.external_market_file,
      night_futures_file: latest.night_futures_file || null,
      external_primary_ready: primaryReady,
    },
    data_freshness: {
      ...(environment.data_freshness || {}),
      status: primaryReady ? 'intraday_live' : 'intraday_partial',
      reason: primaryReady
        ? 'prediction_time_primary_indicators_available'
        : 'prediction_time_partial_or_preopen_indicators',
      source_mode: 'prediction_intraday_snapshot',
      source_snapshot_id: latest.snapshot_id,
      source_snapshot_hash: latest.snapshot_hash,
      is_final: false,
    },
    notes: [
      ...(environment.notes || []).filter((note) => !String(note).includes('prediction-time market context')),
      'External market metrics are bound to the immutable prediction-time market context; later final data must not overwrite this snapshot.',
      primaryReady
        ? 'Five primary external indicators were available at prediction time.'
        : 'Some external indicators were pre-open or partial at prediction time; available values were preserved without treating them as final closes.',
    ],
  };
  const payload = { ...rebound, snapshot_hash: sha256(rebound) };
  atomicWriteJson(environmentFile, payload);
  return {
    forecast_date: forecast,
    environment_file: path.relative(ROOT, environmentFile).replaceAll(path.sep, '/'),
    environment_hash: payload.snapshot_hash,
    context_snapshot_hash: latest.snapshot_hash,
    data_freshness_status: payload.data_freshness.status,
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = rebindPredictionMarketEnvironment(options.forecastDate);
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { compactDate, parseArgs, rebindPredictionMarketEnvironment, main };
