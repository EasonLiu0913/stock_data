#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseMarginCsv } = require('./oversold_rebound_research_lib');
const { isCompleteOutput: isCompleteBrokerOutput } = require('./plan_fubon_broker_batches');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_RESEARCH_ROOT = path.join(ROOT, 'data_research', 'oversold-rebound');
const SOURCE_SPECS = Object.freeze({
  institutional: {
    lookbackDays: 10,
    files: [
      { directory: 'data_twse_investment_trust', filename: date => `${date}_twse_investment_trust.json`, type: 'institutional-json' },
      { directory: 'data_twse_dealers', filename: date => `${date}_twse_dealers.json`, type: 'institutional-json' },
    ],
  },
  margin: {
    lookbackDays: 10,
    files: [
      { directory: 'data_twse_margin_balance', filename: date => `${date}_twse_margin_balance.csv`, type: 'margin-csv' },
    ],
  },
  broker: {
    lookbackDays: 1,
    files: [
      { directory: 'data_fubon_broker_details', filename: date => `fubon_${date}_券商分點進出明細.json`, type: 'broker-json' },
    ],
  },
});

function getArg(argv, flag, fallback = null) {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function getPositiveInteger(argv, flag, fallback) {
  const value = Number(getArg(argv, flag, fallback));
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} 必須是正整數`);
  return value;
}

function normalizeDate(value, label) {
  if (!value) return null;
  const compact = String(value).replace(/[^\d]/g, '');
  if (!/^20\d{6}$/.test(compact)) throw new Error(`${label} 日期格式錯誤：${value}`);
  return compact;
}

function parseSources(value) {
  const requested = String(value || 'institutional,margin,broker')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const unique = [...new Set(requested)];
  for (const source of unique) {
    if (!SOURCE_SPECS[source]) throw new Error(`未知來源：${source}`);
  }
  return unique;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function isInstitutionalJsonComplete(file) {
  const payload = readJson(file, null);
  return Boolean(payload && Array.isArray(payload.data) && payload.data.length > 0);
}

function isMarginCsvComplete(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return parseMarginCsv(text).size > 0;
  } catch {
    return false;
  }
}

function isFileComplete(root, descriptor, date) {
  const file = path.join(root, descriptor.directory, descriptor.filename(date));
  if (!fs.existsSync(file)) return false;
  if (descriptor.type === 'institutional-json') return isInstitutionalJsonComplete(file);
  if (descriptor.type === 'margin-csv') return isMarginCsvComplete(file);
  if (descriptor.type === 'broker-json') return isCompleteBrokerOutput(file);
  return false;
}

function loadResearchDates(researchRoot) {
  const summary = readJson(path.join(researchRoot, 'summary.json'), {});
  const dates = [...new Set(summary?.data_quality?.price?.dates || [])]
    .map(String)
    .filter(date => /^20\d{6}$/.test(date))
    .sort();
  if (!dates.length) throw new Error('研究摘要沒有可用的價量交易日');
  return dates;
}

function loadEventSignalCounts(researchRoot) {
  const index = readJson(path.join(researchRoot, 'event-index.json'), {});
  const counts = new Map();
  for (const event of Array.isArray(index?.events) ? index.events : []) {
    const date = String(event?.signal_date || '');
    if (!/^20\d{6}$/.test(date)) continue;
    counts.set(date, (counts.get(date) || 0) + 1);
  }
  if (!counts.size) throw new Error('研究事件索引沒有 signal_date');
  return counts;
}

function requiredDatesForEvents(priceDates, eventCounts, lookbackDays, from, to) {
  const dateIndex = new Map(priceDates.map((date, index) => [date, index]));
  const impacts = new Map();
  for (const [eventDate, eventCount] of eventCounts) {
    if ((from && eventDate < from) || (to && eventDate > to)) continue;
    const index = dateIndex.get(eventDate);
    if (index === undefined) continue;
    const start = Math.max(0, index - lookbackDays + 1);
    for (let cursor = start; cursor <= index; cursor += 1) {
      const requiredDate = priceDates[cursor];
      impacts.set(requiredDate, (impacts.get(requiredDate) || 0) + eventCount);
    }
  }
  return impacts;
}

function sourceDateComplete(root, source, date) {
  return SOURCE_SPECS[source].files.every(descriptor => isFileComplete(root, descriptor, date));
}

function buildBatches(source, dates, batchSize) {
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('batchSize 必須是正整數');
  const chunks = [];
  for (let index = 0; index < dates.length; index += batchSize) {
    chunks.push(dates.slice(index, index + batchSize));
  }
  return chunks.map((batchDates, index) => ({
    source,
    batch_index: index + 1,
    batch_count: chunks.length,
    dates: batchDates.join(','),
    date_count: batchDates.length,
    first_date: batchDates[0],
    last_date: batchDates[batchDates.length - 1],
    has_next: index < chunks.length - 1,
  }));
}

function planSource(root, researchRoot, source, options) {
  const priceDates = loadResearchDates(researchRoot);
  const eventCounts = loadEventSignalCounts(researchRoot);
  const lookbackDays = options.lookbackDays || SOURCE_SPECS[source].lookbackDays;
  const batchSize = options.batchSize || options.maxDates || 10;
  const impacts = requiredDatesForEvents(priceDates, eventCounts, lookbackDays, options.from, options.to);
  const required = [...impacts.keys()];
  const complete = required.filter(date => sourceDateComplete(root, source, date));
  const missing = required
    .filter(date => !sourceDateComplete(root, source, date))
    .sort((left, right) => (impacts.get(right) - impacts.get(left)) || left.localeCompare(right));
  const batches = buildBatches(source, missing, batchSize);
  const selected = missing.slice(0, batchSize);
  return {
    source,
    lookback_days: lookbackDays,
    batch_size: batchSize,
    required_date_count: required.length,
    complete_date_count: complete.length,
    missing_date_count: missing.length,
    selected_date_count: selected.length,
    deferred_date_count: Math.max(0, missing.length - selected.length),
    selected_dates: selected,
    selected: selected.map(date => ({ date, impacted_events: impacts.get(date) || 0 })),
    all_missing_dates: missing,
    batch_count: batches.length,
    batches,
    matrix: { include: batches },
    estimated_date_coverage_pct: required.length ? Math.round((complete.length / required.length) * 10000) / 100 : 0,
  };
}

function buildPlan(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const researchRoot = path.resolve(options.researchRoot || DEFAULT_RESEARCH_ROOT);
  const sources = options.sources || Object.keys(SOURCE_SPECS);
  const plans = Object.fromEntries(sources.map(source => [source, planSource(root, researchRoot, source, options)]));
  return {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    research_root: path.relative(root, researchRoot).replaceAll(path.sep, '/'),
    priority: 'impacted_events_desc_then_date_asc',
    sources: plans,
  };
}

function main(argv = process.argv.slice(2)) {
  const plan = buildPlan({
    root: ROOT,
    researchRoot: getArg(argv, '--research-root', DEFAULT_RESEARCH_ROOT),
    sources: parseSources(getArg(argv, '--sources', 'institutional,margin,broker')),
    maxDates: getPositiveInteger(argv, '--max-dates', 10),
    lookbackDays: getArg(argv, '--lookback-days') ? getPositiveInteger(argv, '--lookback-days', 10) : null,
    from: normalizeDate(getArg(argv, '--from'), '--from'),
    to: normalizeDate(getArg(argv, '--to'), '--to'),
  });
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
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
  SOURCE_SPECS,
  parseSources,
  isInstitutionalJsonComplete,
  isMarginCsvComplete,
  requiredDatesForEvents,
  sourceDateComplete,
  buildBatches,
  planSource,
  buildPlan,
};
