#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  parseArgs,
  compactDate,
  readJson,
  atomicWriteJson,
} = require('./market_environment_lib');
const {
  applyFormalMarketStrategyTags,
} = require('./apply_formal_market_strategy_tags');
const {
  annotatePredictionDispositionStocks,
} = require('./annotate_prediction_disposition_stocks');
const {
  applyTagStrategySnapshot,
} = require('./prediction_tag_strategy_engine');
const {
  syncPredictionDashboardGroups,
} = require('./sync_prediction_dashboard_groups');
const {
  annotatePredictionDataLineage,
} = require('./annotate_prediction_data_lineage');

function loadPredictionDataReadiness(date) {
  const candidates = [
    path.join(ROOT, '.prediction-data-readiness.json'),
    path.join(ROOT, 'data_predictions', date, 'prediction-data-readiness.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) continue;
    const payload = readJson(file, null);
    if (!payload) continue;
    if (payload.forecast_date !== date) {
      throw new Error(`Prediction readiness forecast date mismatch: expected=${date}, actual=${payload.forecast_date}`);
    }
    if (payload.ready !== true) throw new Error('Prediction readiness is not ready');
    if (payload.stale_fallback_allowed !== false) throw new Error('Prediction readiness must explicitly forbid stale fallback');
    return payload;
  }
  throw new Error(`Missing prediction data readiness report for ${date}`);
}

function readinessLineage(readiness, rootDir, date) {
  const sourceDates = {};
  const sourceStatuses = {};
  for (const [id, source] of Object.entries(readiness.sources || {})) {
    sourceDates[id] = source.actual_date ?? null;
    sourceStatuses[id] = source.status ?? null;
  }
  return {
    data_readiness: 'ready',
    prediction_data_readiness: `${rootDir}/${date}/prediction-data-readiness.json`,
    base_trade_date_compact: readiness.base_trade_date,
    stale_fallback_allowed: false,
    source_dates: sourceDates,
    source_statuses: sourceStatuses,
  };
}

function attach(rootDir, date, environment, readiness) {
  const dir = path.join(ROOT, rootDir, date);
  if (!fs.existsSync(dir)) return 0;

  const readinessFile = path.join(dir, 'prediction-data-readiness.json');
  atomicWriteJson(readinessFile, readiness);

  const targets = ['summary.json', 'manifest.json'];
  let changed = 0;
  for (const filename of targets) {
    const file = path.join(dir, filename);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) continue;
    const payload = readJson(file, {});
    payload.market_environment = {
      source_file: `data_market_environment/${date}/market_environment.json`,
      snapshot_hash: environment.snapshot_hash,
      code: environment.environment?.code,
      label: environment.environment?.label,
      score: environment.environment?.score,
      mode: environment.mode,
      data_freshness: environment.data_freshness,
      strategy_policy: environment.strategy_policy,
    };
    payload.prediction_input_lineage = readinessLineage(readiness, rootDir, date);
    atomicWriteJson(file, payload);
    changed += 1;
  }
  return changed;
}

function main() {
  const args = parseArgs();
  const date = compactDate(args.get('date') || process.env.FORECAST_TARGET_DATE, 'date');
  const version = String(args.get('version') || 'all').toLowerCase();
  const environmentFile = path.join(ROOT, 'data_market_environment', date, 'market_environment.json');
  const environment = readJson(environmentFile);
  if (!environment) throw new Error(`Missing environment snapshot: ${path.relative(ROOT, environmentFile)}`);
  const readiness = loadPredictionDataReadiness(date);
  if (environment.base_trade_date_compact && environment.base_trade_date_compact !== readiness.base_trade_date) {
    throw new Error(`Environment/readiness base date mismatch: environment=${environment.base_trade_date_compact}, readiness=${readiness.base_trade_date}`);
  }
  const roots = version === 'v1' ? ['data_predictions'] : version === 'v2' ? ['data_predictions_v2'] : ['data_predictions', 'data_predictions_v2'];
  const changed = roots.reduce((total, rootDir) => total + attach(rootDir, date, environment, readiness), 0);
  const formalStrategy = roots.includes('data_predictions')
    ? applyFormalMarketStrategyTags({ rootDir: 'data_predictions', date, environment })
    : null;
  const dispositionAnnotation = roots.includes('data_predictions')
    ? annotatePredictionDispositionStocks({ rootDir: 'data_predictions', date })
    : null;
  const tagStrategy = roots.includes('data_predictions')
    ? applyTagStrategySnapshot({ rootDir: 'data_predictions', date, evaluationMode: 'live_snapshot' })
    : null;
  const dashboardGroupSync = roots.includes('data_predictions')
    ? syncPredictionDashboardGroups({ rootDir: 'data_predictions', date })
    : null;
  const dataLineage = roots.includes('data_predictions')
    ? annotatePredictionDataLineage({ rootDir: 'data_predictions', date, strict: true })
    : null;
  console.log(JSON.stringify({
    date,
    version,
    changed,
    snapshot_hash: environment.snapshot_hash,
    prediction_data_readiness: {
      ready: readiness.ready,
      base_trade_date: readiness.base_trade_date,
      stale_fallback_allowed: readiness.stale_fallback_allowed,
      source_dates: Object.fromEntries(Object.entries(readiness.sources || {}).map(([id, source]) => [id, source.actual_date ?? null])),
    },
    formal_strategy: formalStrategy,
    disposition_annotation: dispositionAnnotation,
    tag_strategy: tagStrategy,
    dashboard_group_sync: dashboardGroupSync,
    data_lineage: dataLineage,
  }));
}

main();
