#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function compactDate(value) {
  const compact = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function rebindPredictionMarketRisk(baseDate) {
  const base = compactDate(baseDate);
  if (!base) throw new Error('baseDate must be YYYYMMDD');
  const forecast = compactDate(process.env.FORECAST_TARGET_DATE);
  if (!forecast) throw new Error('FORECAST_TARGET_DATE is required');

  const latestFile = path.join(ROOT, 'data_prediction_context', forecast, 'latest.json');
  const latest = readJson(latestFile, null);
  if (!latest?.external_market_file || !latest?.manifest_file) {
    throw new Error(`Missing prediction market context for ${forecast}`);
  }

  const riskFile = path.join(ROOT, 'data_market_risk', base, 'market_risk_snapshot.json');
  const risk = readJson(riskFile, null);
  if (!risk) throw new Error(`Missing market risk snapshot: ${riskFile}`);

  const external = readJson(path.join(ROOT, latest.external_market_file), null);
  const primaryReady = external?.primary_ready === true;
  const payload = {
    ...risk,
    generated_at: latest.captured_at || risk.generated_at,
    source_files: {
      ...(risk.source_files || {}),
      external_market: latest.external_market_file,
      prediction_market_context: latest.manifest_file,
    },
    prediction_market_context: {
      snapshot_id: latest.snapshot_id,
      snapshot_hash: latest.snapshot_hash,
      captured_at: latest.captured_at,
      immutable: true,
      is_final: false,
      external_market_file: latest.external_market_file,
      manifest_file: latest.manifest_file,
      external_primary_ready: primaryReady,
    },
    data_freshness: {
      status: primaryReady ? 'intraday_live' : 'intraday_partial',
      source_mode: 'prediction_intraday_snapshot',
      is_final: false,
    },
    notes: [
      ...(risk.notes || []).filter((note) => !String(note).includes('prediction-time external market')),
      'External-market risk was calculated from the immutable prediction-time external market snapshot.',
      'Later final external-market data must not overwrite this prediction-time risk snapshot.',
    ],
  };
  atomicWriteJson(riskFile, payload);
  return {
    forecast_date: forecast,
    base_trade_date: base,
    risk_file: path.relative(ROOT, riskFile).replaceAll(path.sep, '/'),
    context_snapshot_hash: latest.snapshot_hash,
    data_freshness_status: payload.data_freshness.status,
  };
}

function main(argv = process.argv.slice(2)) {
  const dateIndex = argv.indexOf('--date');
  const baseDate = dateIndex >= 0 ? argv[dateIndex + 1] : process.env.FORECAST_BASE_DATE;
  const result = rebindPredictionMarketRisk(baseDate);
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
  readJson,
  atomicWriteJson,
  rebindPredictionMarketRisk,
  main,
};
