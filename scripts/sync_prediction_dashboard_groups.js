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
  LEGACY_FORMAL_TAGS,
  STRATEGY_ID,
  LEGACY_STRATEGY_IDS,
  FORMAL_STRATEGY_REGISTRY,
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

function definitionMatchesGroup(definition, group) {
  if (!group) return false;
  return group.strategy_id === definition.strategy_id
    || (definition.legacy_strategy_ids || []).includes(group.strategy_id)
    || group.group === definition.label
    || (definition.legacy_labels || []).includes(group.group);
}

function classificationFor(summary, definition) {
  const classifications = summary?.formal_strategy_classifications || {};
  return classifications[definition.strategy_id]
    || (definition.legacy_strategy_ids || []).map((strategyId) => classifications[strategyId]).find(Boolean)
    || {};
}

function normalizeRegisteredGroup(group, definition, classification = {}) {
  group.group = definition.label;
  group.formal_strategy = true;
  group.strategy_id = definition.strategy_id;
  group.fixed_display = true;
  group.changes_direction_score = false;
  group.evaluation_target = definition.evaluation_target;
  group.criteria = [...(definition.criteria || [])];
  group.calculation_status = group.calculation_status || classification.calculation_status || 'completed';
  if (!Array.isArray(group.members)) group.members = [];
  if (group.calculation_status === 'unable_to_calculate') {
    group.count = null;
    group.status_label = classification.status_label || group.status_label || '無法計算';
    group.missing_sources = classification.missing_sources || group.missing_sources || [];
  } else {
    if (!Number.isFinite(Number(group.count))) group.count = group.members.length;
    group.status_label = group.status_label || classification.status_label
      || (Number(group.count) === 0 ? '已完成計算，當日 0 筆' : '已完成計算');
  }
  return group;
}

function buildEmptyRegisteredGroup(summary, definition) {
  const classification = classificationFor(summary, definition);
  const calculationStatus = classification.calculation_status || 'completed';
  const base = {
    group: definition.label,
    ...emptyFormalStrategySummary(),
    formal_strategy: true,
    strategy_id: definition.strategy_id,
    fixed_display: true,
    changes_direction_score: false,
    evaluation_target: definition.evaluation_target,
    criteria: [...(definition.criteria || [])],
    calculation_status: calculationStatus,
    active: classification.active === true,
    environment_code: classification.environment_code || null,
    members: [],
    warnings: classification.warnings || [],
    missing_sources: classification.missing_sources || [],
  };
  if (calculationStatus === 'unable_to_calculate') {
    base.count = null;
    base.status_label = classification.status_label || '無法計算';
  } else {
    base.status_label = classification.status_label || '已完成計算，當日 0 筆';
  }
  return base;
}

function ensureRegisteredStrategyGroups(summary, groupSummary) {
  if (!summary || typeof summary !== 'object') throw new Error('summary payload is required');
  if (!Array.isArray(groupSummary?.groups)) throw new Error('group-summary groups are required');

  const output = groupSummary.groups;
  for (const definition of FORMAL_STRATEGY_REGISTRY) {
    const matchingIndexes = output
      .map((group, index) => definitionMatchesGroup(definition, group) ? index : -1)
      .filter((index) => index >= 0);
    let group;
    if (matchingIndexes.length) {
      group = output[matchingIndexes[0]];
      for (let index = matchingIndexes.length - 1; index >= 1; index -= 1) {
        output.splice(matchingIndexes[index], 1);
      }
      normalizeRegisteredGroup(group, definition, classificationFor(summary, definition));
    } else {
      group = buildEmptyRegisteredGroup(summary, definition);
      output.push(group);
    }
  }
  output.sort((left, right) => Number(right.count || 0) - Number(left.count || 0)
    || String(left.group).localeCompare(String(right.group), 'zh-Hant'));
  return output.filter((group) => group?.formal_strategy === true);
}

function ensureFormalStrategyGroup(summary, groupSummary) {
  if (!summary || typeof summary !== 'object') throw new Error('summary payload is required');
  if (!Array.isArray(groupSummary?.groups)) throw new Error('group-summary groups are required');
  const definition = FORMAL_STRATEGY_REGISTRY.find((item) => item.strategy_id === STRATEGY_ID);
  const matchingIndexes = groupSummary.groups
    .map((group, index) => definitionMatchesGroup(definition, group) ? index : -1)
    .filter((index) => index >= 0);
  let group;
  if (matchingIndexes.length) {
    group = groupSummary.groups[matchingIndexes[0]];
    for (let index = matchingIndexes.length - 1; index >= 1; index -= 1) {
      groupSummary.groups.splice(matchingIndexes[index], 1);
    }
    normalizeRegisteredGroup(group, definition, classificationFor(summary, definition));
  } else {
    group = buildEmptyRegisteredGroup(summary, definition);
    groupSummary.groups.push(group);
  }
  return group;
}

function syncSummaryPayload(summary, groupSummary) {
  if (!summary || typeof summary !== 'object') throw new Error('summary payload is required');
  if (!Array.isArray(groupSummary?.groups)) throw new Error('group-summary groups are required');
  ensureRegisteredStrategyGroups(summary, groupSummary);
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

  const formalGroups = ensureRegisteredStrategyGroups(summary, groupSummary);
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
    formal_groups: formalGroups.map((group) => group.group),
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
  definitionMatchesGroup,
  classificationFor,
  normalizeRegisteredGroup,
  buildEmptyRegisteredGroup,
  ensureRegisteredStrategyGroups,
  ensureFormalStrategyGroup,
  syncSummaryPayload,
  syncPredictionDashboardGroups,
  main,
};
