#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readJson, atomicWriteJson, round } = require('./market_environment_lib');
const { TOTAL_WEIGHT, statusBand, probabilityCalibration } = require('./oversold_beta_rebound');

function compactDate(value) {
  const compact = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nightCondition(changePercent, observedAt, sessionStatus) {
  const value = finiteNumber(changePercent);
  if (value === null) return null;
  const full = value >= 2;
  const partial = !full && value >= 0.5;
  return {
    id: 'night_futures_open_signal',
    label: '台指期夜盤 ≥ +2%',
    weight: 15,
    points: full ? 15 : partial ? (value >= 1 ? 8 : 4) : 0,
    status: full ? 'full' : partial ? 'partial' : 'unmet',
    value,
    value_label: `${round(value)}%`,
    note: `預測當下夜盤快照（${sessionStatus || 'in_progress'}），截至 ${observedAt || '未知時間'}；不是完整夜盤收盤值。`,
  };
}

function updatePayload(payload, night, latest) {
  const replacement = nightCondition(night.change_percent, night.observed_at || night.generated_at, night.session_status);
  if (!replacement) return payload;
  const conditions = [...(payload.conditions || [])];
  const index = conditions.findIndex((item) => item.id === replacement.id);
  if (index >= 0) conditions[index] = replacement;
  else conditions.push(replacement);
  const score = conditions.reduce((sum, item) => sum + (finiteNumber(item.points) ?? 0), 0);
  const effectiveWeight = conditions
    .filter((item) => item.status !== 'na')
    .reduce((sum, item) => sum + (finiteNumber(item.weight) ?? 0), 0);
  const availableSignals = conditions.filter((item) => item.status !== 'na').length;
  const band = statusBand(score);
  const probability = probabilityCalibration(score, effectiveWeight, payload.forecast_date_compact || latest.forecast_date);
  const marketDirection = score >= 60
    ? '跌深電子股順風'
    : score >= 45
      ? '跌深電子股風向逐步改善'
      : '跌深電子股環境尚未確認';
  return {
    ...payload,
    generated_at: latest.captured_at || payload.generated_at,
    score,
    status_code: band.code,
    status: band.label,
    dashboard_message: band.message,
    market_direction: marketDirection,
    probability,
    effective_data_weight: effectiveWeight,
    effective_data_ratio: round(effectiveWeight / TOTAL_WEIGHT * 100),
    available_signals: availableSignals,
    total_signals: conditions.length,
    conditions,
    inputs: {
      ...(payload.inputs || {}),
      night_futures_change_pct: round(replacement.value),
    },
    warnings: (payload.warnings || []).filter((warning) => !String(warning).includes('台指期夜盤')),
    source_files: {
      ...(payload.source_files || {}),
      night_futures: latest.night_futures_file,
      prediction_market_context: latest.manifest_file,
    },
    prediction_market_context: {
      snapshot_id: latest.snapshot_id,
      snapshot_hash: latest.snapshot_hash,
      captured_at: latest.captured_at,
      manifest_file: latest.manifest_file,
      night_futures_file: latest.night_futures_file,
      is_final: false,
    },
  };
}

function applyToRoot(date, rootDir, latest, night) {
  const summaryFile = path.join(ROOT, rootDir, date, 'summary.json');
  const summary = readJson(summaryFile, null);
  if (!summary) return { root_dir: rootDir, skipped: true, reason: 'missing_summary' };
  const outputFile = path.join(ROOT, 'data_market_environment', date, 'oversold_beta_rebound.json');
  const existing = readJson(outputFile, null) || summary.market_rebound_readiness || null;
  if (!existing) return { root_dir: rootDir, skipped: true, reason: 'missing_readiness' };
  const payload = updatePayload(existing, night, latest);
  atomicWriteJson(outputFile, payload);
  summary.market_rebound_readiness = {
    source_file: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
    ...payload,
  };
  summary.prediction_market_context = {
    snapshot_id: latest.snapshot_id,
    snapshot_hash: latest.snapshot_hash,
    captured_at: latest.captured_at,
    manifest_file: latest.manifest_file,
    immutable: true,
  };
  atomicWriteJson(summaryFile, summary);
  return { root_dir: rootDir, skipped: false, score: payload.score, status: payload.status };
}

function applyPredictionContextToReadiness({ date, roots = ['data_predictions', 'data_predictions_v2'] } = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const latest = readJson(path.join(ROOT, 'data_prediction_context', compact, 'latest.json'), null);
  if (!latest?.night_futures_file) return { date: compact, skipped: true, reason: 'missing_prediction_context' };
  const night = readJson(path.join(ROOT, latest.night_futures_file), null);
  if (!night?.available) return { date: compact, skipped: true, reason: 'night_snapshot_unavailable' };
  return {
    date: compact,
    snapshot_id: latest.snapshot_id,
    results: roots.map((rootDir) => applyToRoot(compact, rootDir, latest, night)),
  };
}

function parseArgs(argv) {
  const options = { date: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = applyPredictionContextToReadiness(parseArgs(argv));
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
  nightCondition,
  updatePayload,
  applyPredictionContextToReadiness,
  main,
};
