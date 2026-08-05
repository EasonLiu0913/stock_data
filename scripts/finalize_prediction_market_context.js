#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTEXT_ROOT = path.join(ROOT, 'data_prediction_context');

function compactDate(value) {
  const compact = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
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

function predictionDates() {
  if (!fs.existsSync(CONTEXT_ROOT)) return [];
  return fs.readdirSync(CONTEXT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^20\d{6}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function matchingForecastDates(externalMarketDate) {
  const marketDate = compactDate(externalMarketDate);
  return predictionDates().filter((forecast) => {
    const latest = readJson(path.join(CONTEXT_ROOT, forecast, 'latest.json'));
    return latest?.base_trade_date === marketDate;
  });
}

function updateFinalManifest(forecastDate, patch) {
  const finalDir = path.join(CONTEXT_ROOT, forecastDate, 'final');
  const manifestFile = path.join(finalDir, 'manifest.json');
  const latest = readJson(path.join(CONTEXT_ROOT, forecastDate, 'latest.json')) || {};
  const existing = readJson(manifestFile) || {
    schema_version: 1,
    forecast_date: forecastDate,
    base_trade_date: latest.base_trade_date || null,
    prediction_snapshot_id: latest.snapshot_id || null,
    prediction_snapshot_hash: latest.snapshot_hash || null,
    prediction_manifest_file: latest.manifest_file || null,
    preserves_original_prediction: true,
  };
  const updated = {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
    notes: [
      'Final market data is stored separately and must not overwrite the immutable prediction-time snapshot.',
    ],
  };
  atomicWriteJson(manifestFile, updated);
  return relative(manifestFile);
}

function finalizeNight({ forecastDate, nightFile, nightKind = 'official' }) {
  const forecast = compactDate(forecastDate);
  if (!forecast) throw new Error('forecastDate must be YYYYMMDD');
  const source = path.resolve(ROOT, nightFile);
  const payload = readJson(source);
  if (!payload?.available) {
    return { forecast_date: forecast, skipped: true, reason: 'night_data_unavailable', source_file: relative(source) };
  }
  const official = nightKind === 'official';
  const finalDir = path.join(CONTEXT_ROOT, forecast, 'final');
  const outputFile = path.join(finalDir, official ? 'night-futures-official.json' : 'night-futures-realtime-close.json');
  const output = {
    ...payload,
    final_context_recorded_at: new Date().toISOString(),
    is_final: official,
    session_status: official ? 'final' : 'closed',
    finalization_status: official ? 'official_daily_report' : 'realtime_close_snapshot',
    original_source_file: relative(source),
  };
  atomicWriteJson(outputFile, output);
  const key = official ? 'night_futures_official' : 'night_futures_realtime_close';
  const manifestFile = updateFinalManifest(forecast, {
    [key]: {
      available: true,
      is_final: official,
      change_percent: output.change_percent ?? null,
      source_file: relative(outputFile),
      source_recorded_at: output.final_context_recorded_at,
    },
  });
  return { forecast_date: forecast, skipped: false, output_file: relative(outputFile), manifest_file: manifestFile };
}

function finalizeExternalForForecast(forecast, source, payload) {
  const finalDir = path.join(CONTEXT_ROOT, forecast, 'final');
  const outputFile = path.join(finalDir, 'external-market-final.json');
  const output = {
    ...payload,
    snapshot_type: 'final_daily_market_context',
    final_context_recorded_at: new Date().toISOString(),
    is_final: true,
    original_source_file: relative(source),
  };
  atomicWriteJson(outputFile, output);
  const manifestFile = updateFinalManifest(forecast, {
    external_market_final: {
      available: true,
      is_final: true,
      market_date: output.collection_date || null,
      source_file: relative(outputFile),
      source_recorded_at: output.final_context_recorded_at,
    },
  });
  return { forecast_date: forecast, output_file: relative(outputFile), manifest_file: manifestFile };
}

function finalizeExternal({ externalMarketDate, externalFile }) {
  const marketDate = compactDate(externalMarketDate);
  if (!marketDate) throw new Error('externalMarketDate must be YYYYMMDD');
  const source = path.resolve(ROOT, externalFile);
  const payload = readJson(source);
  if (!payload || Number(payload.indicator_count) < 1) {
    return { market_date: marketDate, skipped: true, reason: 'external_data_unavailable' };
  }
  const forecasts = matchingForecastDates(marketDate);
  return {
    market_date: marketDate,
    skipped: forecasts.length === 0,
    reason: forecasts.length === 0 ? 'no_matching_prediction_context' : null,
    results: forecasts.map((forecast) => finalizeExternalForForecast(forecast, source, payload)),
  };
}

function parseArgs(argv) {
  const options = {
    forecastDate: '', nightFile: '', nightKind: 'official',
    externalMarketDate: '', externalFile: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--forecast-date') options.forecastDate = argv[++index] || '';
    else if (arg === '--night-file') options.nightFile = argv[++index] || '';
    else if (arg === '--night-kind') options.nightKind = argv[++index] || '';
    else if (arg === '--external-market-date') options.externalMarketDate = argv[++index] || '';
    else if (arg === '--external-file') options.externalFile = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  let result;
  if (options.nightFile) {
    result = finalizeNight(options);
  } else if (options.externalFile) {
    result = finalizeExternal(options);
  } else {
    throw new Error('provide --night-file or --external-file');
  }
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  compactDate,
  predictionDates,
  matchingForecastDates,
  updateFinalManifest,
  finalizeNight,
  finalizeExternal,
  main,
};
