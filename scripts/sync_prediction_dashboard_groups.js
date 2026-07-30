#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  ROOT,
  readJson,
  atomicWriteJson,
} = require('./market_environment_lib');
const {
  FORMAL_TAG,
  STRATEGY_ID,
  summarizeStocks,
} = require('./apply_formal_market_strategy_tags');

function compactDate(value) {
  const compact = String(value || '').replaceAll('-', '').replaceAll('/', '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function emptyFormalStrategySummary() {
  const summary = summarizeStocks([]);
  for (const field of [
    'average_direction_score',
    'average_completeness',
    'average_r1',
    'average_r3',
    'average_gap_sma20',
    'average_rsi14',
    'relative_strength_7d_market_return',
  ]) {
    summary[field] = null;
  }
  return summary;
}

function ensureFormalStrategyGroup(summary, groupSummary) {
  if (!summary || typeof summary !== 'object') throw new Error('summary payload is required');
  if (!Array.isArray(groupSummary?.groups)) throw new Error('group-summary groups are required');

  const existing = groupSummary.groups.find((group) => group?.group === FORMAL_TAG);
  if (existing) return existing;

  const classification = summary.formal_strategy_classifications?.[STRATEGY_ID] || {};
  const emptyGroup = {
    group: FORMAL_TAG,
    ...emptyFormalStrategySummary(),
    formal_strategy: true,
    strategy_id: STRATEGY_ID,
    environment_code: classification.environment_code || null,
    active: classification.active === true,
    changes_direction_score: false,
    members: [],
  };
  groupSummary.groups.push(emptyGroup);
  groupSummary.groups.sort((left, right) => Number(right.count || 0) - Number(left.count || 0)
    || String(left.group).localeCompare(String(right.group), 'zh-Hant'));
  return emptyGroup;
}

function syncSummaryPayload(summary, groupSummary) {
  if (!summary || typeof summary !== 'object') throw new Error('summary payload is required');
  if (!Array.isArray(groupSummary?.groups)) throw new Error('group-summary groups are required');
  ensureFormalStrategyGroup(summary, groupSummary);
  summary.group_summary = groupSummary.groups;
  summary.group_summary_source = 'group-summary.json';
  return summary;
}

function syncPredictionDashboardGroups({ rootDir = 'data_predictions', date, dryRun = false } = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');

  const predictionDir = path.join(ROOT, rootDir, compact);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const groupSummaryFile = path.join(predictionDir, 'group-summary.json');
  const summary = readJson(summaryFile, null);
  const groupSummary = readJson(groupSummaryFile, null);

  if (!summary || !Array.isArray(groupSummary?.groups)) {
    return {
      date: compact,
      root_dir: rootDir,
      skipped: true,
      reason: !summary ? 'missing_summary' : 'missing_group_summary',
      groups: 0,
    };
  }

  syncSummaryPayload(summary, groupSummary);
  if (!dryRun) {
    atomicWriteJson(groupSummaryFile, groupSummary);
    atomicWriteJson(summaryFile, summary);
  }

  return {
    date: compact,
    root_dir: rootDir,
    skipped: false,
    groups: groupSummary.groups.length,
    formal_groups: groupSummary.groups.filter((group) => group?.formal_strategy === true).map((group) => group.group),
    dry_run: dryRun,
  };
}

function parseArgs(argv) {
  const options = { date: '', rootDir: 'data_predictions', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--root') options.rootDir = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = syncPredictionDashboardGroups(parseArgs(argv));
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  compactDate,
  emptyFormalStrategySummary,
  ensureFormalStrategyGroup,
  syncSummaryPayload,
  syncPredictionDashboardGroups,
  main,
};