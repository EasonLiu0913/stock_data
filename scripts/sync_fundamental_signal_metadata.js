#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  summarizeStocks,
} = require('./apply_formal_market_strategy_tags');
const {
  evaluateTwoStageFundamentalSignalDay,
} = require('./two_stage_fundamental_quality_signal');
const {
  loadHolidaySet,
  nextTradingDate,
} = require('./resolve_forecast_dates');

const ROOT = path.resolve(__dirname, '..');
const STRATEGY_ID = 'two_stage_fundamental_quality_direct_entry_v1';
const DISPLAY_LABEL = '財報品質訊號';
const MONTHLY_POOL_ID = 'monthly_fundamental_quality_active_pool_v1';
const MONTHLY_POOL_LABEL = '本月有效財報品質池';

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

function monthlyPredictionDates({ date, rootDir = 'data_predictions', workspaceRoot = ROOT } = {}) {
  const compact = compactDate(date);
  if (!compact) return [];
  const month = compact.slice(0, 6);
  const root = path.join(workspaceRoot, rootDir);
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^20\d{6}$/.test(entry.name))
      .map(entry => entry.name)
      .filter(target => target.startsWith(month) && target <= compact)
      .sort();
  } catch {
    return [];
  }
}

function monthlySignalEvents({ workspaceRoot = ROOT } = {}) {
  const signalRoot = path.join(
    workspaceRoot,
    'data_prediction_analysis',
    'monthly-revenue',
    'monthly-signals',
  );
  let files = [];
  try {
    files = fs.readdirSync(signalRoot)
      .filter(name => /^20\d{4}\.json$/.test(name))
      .sort();
  } catch {
    return [];
  }

  const events = [];
  for (const file of files) {
    const payload = readJson(path.join(signalRoot, file), null);
    for (const event of payload?.events || []) {
      events.push({ month: file.slice(0, 6), event });
    }
  }
  return events;
}

function collectMonthlyFundamentalPool({ date, rootDir = 'data_predictions', workspaceRoot = ROOT } = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const month = compact.slice(0, 6);
  const targetSummary = readJson(path.join(workspaceRoot, rootDir, compact, 'summary.json'), null);
  const signalCutoff = compactDate(targetSummary?.base_trade_date);
  if (!signalCutoff) return [];

  const holidays = loadHolidaySet();
  const byStock = new Map();
  for (const { event } of monthlySignalEvents({ workspaceRoot })) {
    const stockCode = String(event?.stock_code || '').trim();
    const signalDate = compactDate(event?.base_trading_date);
    if (!stockCode || !signalDate || signalDate > signalCutoff) continue;

    const executionIso = nextTradingDate(isoDate(signalDate), holidays, false);
    const executionDate = compactDate(executionIso);
    if (!executionDate || !executionDate.startsWith(month) || executionDate > compact) continue;

    const evaluation = evaluateTwoStageFundamentalSignalDay({
      workspaceRoot,
      stockId: stockCode,
      baseTradeDate: signalDate,
    });
    if (evaluation?.is_signal_day !== true) continue;

    const signalIso = isoDate(signalDate);
    const existing = byStock.get(stockCode);
    const record = existing || {
      stock_code: stockCode,
      stock_name: event.stock_name || '',
      first_signal_date: signalIso,
      latest_signal_date: signalIso,
      execution_date: isoDate(executionDate),
      fas_score: evaluation.fas_total ?? null,
      fq_score: evaluation.fq_score ?? null,
      financial_period: evaluation.financial_period || null,
    };

    if (signalIso && (!record.first_signal_date || signalIso < record.first_signal_date)) {
      record.first_signal_date = signalIso;
    }
    if (signalIso && (!record.latest_signal_date || signalIso > record.latest_signal_date)) {
      record.latest_signal_date = signalIso;
    }
    if (!existing || executionDate >= compactDate(record.execution_date || '')) {
      record.execution_date = isoDate(executionDate);
      record.fas_score = evaluation.fas_total ?? record.fas_score;
      record.fq_score = evaluation.fq_score ?? record.fq_score;
      record.financial_period = evaluation.financial_period || record.financial_period;
      if (event.stock_name) record.stock_name = event.stock_name;
    }
    byStock.set(stockCode, record);
  }

  return [...byStock.values()].sort((left, right) => left.stock_code.localeCompare(right.stock_code));
}

function monthlyPoolGroup(summary, records) {
  const members = records.map(record => record.stock_code);
  const memberSet = new Set(members);
  const matchedStocks = (summary?.stocks || []).filter(stock => memberSet.has(String(stock.stock_code || '')));
  const metrics = summarizeStocks(matchedStocks);
  return {
    ...metrics,
    group: MONTHLY_POOL_LABEL,
    strategy_id: MONTHLY_POOL_ID,
    strategy_family: 'monthly_fundamental_quality_active_pool',
    strategy_version: 1,
    fixed_display: true,
    monthly_pool: true,
    changes_direction_score: false,
    count: members.length,
    members,
    member_metadata: records,
    calculation_status: 'completed',
    status_label: members.length === 0
      ? '已完成計算，本月 0 筆'
      : `本月累積 ${members.length} 筆有效財報品質訊號`,
    evaluation_target: '當月截至目標日曾觸發財報品質訊號且已到可執行日的上市電子股聯集',
    criteria: [
      `來源策略：${DISPLAY_LABEL}`,
      '依原始 monthly-signal artifact 逐日重建，不依賴歷史 Dashboard 是否曾成功產生',
      '僅納入同月份且可執行日不晚於目前預測日的正式訊號',
      '同一股票當月只保留一筆，並保存首次／最近訊號日與 FAS、FQ',
    ],
  };
}

function upsertMonthlyPool(summary, groupSummary, records) {
  if (!groupSummary || !Array.isArray(groupSummary.groups)) return false;
  const nextGroup = monthlyPoolGroup(summary, records);
  const indexes = groupSummary.groups
    .map((group, index) => group?.strategy_id === MONTHLY_POOL_ID || group?.group === MONTHLY_POOL_LABEL ? index : -1)
    .filter(index => index >= 0);

  if (indexes.length) {
    groupSummary.groups[indexes[0]] = nextGroup;
    for (let index = indexes.length - 1; index >= 1; index -= 1) {
      groupSummary.groups.splice(indexes[index], 1);
    }
  } else {
    groupSummary.groups.push(nextGroup);
  }
  groupSummary.groups.sort((left, right) => Number(right.count || 0) - Number(left.count || 0)
    || String(left.group || '').localeCompare(String(right.group || ''), 'zh-Hant'));
  summary.group_summary = groupSummary.groups;
  summary.group_summary_source = 'group-summary.json';
  return true;
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

  const monthlyPool = collectMonthlyFundamentalPool({
    date: compact,
    rootDir,
    workspaceRoot,
  });
  if (upsertMonthlyPool(summary, groupSummary, monthlyPool)) summaryChanged = true;

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
    monthly_pool_id: MONTHLY_POOL_ID,
    monthly_pool_label: MONTHLY_POOL_LABEL,
    monthly_pool_count: monthlyPool.length,
    monthly_pool_members: monthlyPool.map(item => item.stock_code),
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
  MONTHLY_POOL_ID,
  MONTHLY_POOL_LABEL,
  compactDate,
  isoDate,
  strategyIds,
  signalMetadata,
  relabelDirectEntryStrategy,
  monthlyPredictionDates,
  monthlySignalEvents,
  collectMonthlyFundamentalPool,
  monthlyPoolGroup,
  upsertMonthlyPool,
  syncFundamentalSignalMetadata,
  parseArgs,
  main,
};
