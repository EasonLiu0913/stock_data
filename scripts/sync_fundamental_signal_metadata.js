#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const STRATEGY_ID = 'two_stage_fundamental_quality_direct_entry_v1';
const DISPLAY_LABEL = '財報品質訊號';

function compactDate(value) {
  const compact = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function isoDate(value) {
  const compact = compactDate(value);
  return compact ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}` : null;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function strategyIds(stock) {
  return (stock?.registered_strategy_matches || [])
    .map(item => typeof item === 'string' ? item : item?.strategy_id)
    .filter(Boolean);
}

function signalMetadata(stock, summary) {
  if (!strategyIds(stock).includes(STRATEGY_ID)) return null;
  const features = stock?.strategy_tag_features || {};
  const signalDate = isoDate(features.two_stage_fundamental_signal_date || summary?.base_trade_date);
  const executionDate = isoDate(summary?.forecast_date);
  if (!signalDate || !executionDate) return null;
  return {
    strategy_id: STRATEGY_ID,
    label: DISPLAY_LABEL,
    signal_date: signalDate,
    execution_date: executionDate,
    fas_score: Number.isFinite(Number(features.two_stage_fundamental_fas_total))
      ? Number(features.two_stage_fundamental_fas_total)
      : null,
    fq_score: Number.isFinite(Number(features.two_stage_fundamental_fq_score))
      ? Number(features.two_stage_fundamental_fq_score)
      : null,
    financial_period: features.two_stage_fundamental_financial_period || null,
    source: 'summary.strategy_tag_features',
  };
}

function relabelDirectEntryStrategy(summary, groupSummary) {
  let changed = false;
  for (const definition of summary?.strategy_registry_v2 || []) {
    if (definition?.strategy_id !== STRATEGY_ID || definition.label === DISPLAY_LABEL) continue;
    definition.label = DISPLAY_LABEL;
    changed = true;
  }
  const classification = summary?.strategy_classifications_v2?.[STRATEGY_ID];
  if (classification && classification.label !== DISPLAY_LABEL) {
    classification.label = DISPLAY_LABEL;
    changed = true;
  }
  for (const group of summary?.group_summary || []) {
    if (group?.strategy_id !== STRATEGY_ID || group.group === DISPLAY_LABEL) continue;
    group.group = DISPLAY_LABEL;
    changed = true;
  }
  for (const group of groupSummary?.groups || []) {
    if (group?.strategy_id !== STRATEGY_ID || group.group === DISPLAY_LABEL) continue;
    group.group = DISPLAY_LABEL;
    changed = true;
  }
  return changed;
}

function syncFundamentalSignalMetadata({ date, rootDir = 'data_predictions', workspaceRoot = ROOT, dryRun = false } = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const predictionDir = path.join(workspaceRoot, rootDir, compact);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const groupSummaryFile = path.join(predictionDir, 'group-summary.json');
  const summary = readJson(summaryFile, null);
  const groupSummary = readJson(groupSummaryFile, null);
  if (!summary || !Array.isArray(summary.stocks)) throw new Error(`Missing summary: ${summaryFile}`);

  let matched = 0;
  let updatedStockFiles = 0;
  let missingStockFiles = 0;
  let summaryChanged = relabelDirectEntryStrategy(summary, groupSummary);

  summary.stocks = summary.stocks.map(stock => {
    const metadata = signalMetadata(stock, summary);
    if (metadata) matched += 1;
    const before = JSON.stringify(stock.fundamental_signal ?? null);
    const after = JSON.stringify(metadata);
    if (before !== after) summaryChanged = true;
    return { ...stock, fundamental_signal: metadata };
  });

  for (const stock of summary.stocks) {
    const code = String(stock.stock_code || '').trim();
    if (!code) continue;
    const stockFile = path.join(predictionDir, `${code}.json`);
    const payload = readJson(stockFile, null);
    if (!payload) {
      missingStockFiles += 1;
      continue;
    }
    const metadata = stock.fundamental_signal || null;
    if (JSON.stringify(payload.fundamental_signal ?? null) === JSON.stringify(metadata)) continue;
    payload.fundamental_signal = metadata;
    if (!dryRun) writeJsonAtomic(stockFile, payload);
    updatedStockFiles += 1;
  }

  if (!dryRun) {
    if (summaryChanged) writeJsonAtomic(summaryFile, summary);
    if (groupSummary && Array.isArray(groupSummary.groups)) writeJsonAtomic(groupSummaryFile, groupSummary);
  }

  return {
    date: compact,
    root_dir: rootDir,
    strategy_id: STRATEGY_ID,
    label: DISPLAY_LABEL,
    matched_stocks: matched,
    summary_changed: summaryChanged,
    updated_stock_files: updatedStockFiles,
    missing_stock_files: missingStockFiles,
    dry_run: Boolean(dryRun),
  };
}

function parseArgs(argv) {
  const options = { date: '', rootDir: 'data_predictions', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--root') options.rootDir = argv[++index] || '';
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = syncFundamentalSignalMetadata(parseArgs(argv));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  STRATEGY_ID,
  DISPLAY_LABEL,
  compactDate,
  isoDate,
  strategyIds,
  signalMetadata,
  relabelDirectEntryStrategy,
  syncFundamentalSignalMetadata,
  parseArgs,
  main,
};
