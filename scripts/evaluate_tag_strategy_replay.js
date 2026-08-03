#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  readJson,
  atomicWriteJson,
  round,
} = require('./market_environment_lib');
const {
  loadRegistry,
  buildTagStrategySnapshot,
  compactDate,
} = require('./prediction_tag_strategy_engine');

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function median(values) {
  const valid = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

function rowReturn(row) {
  return finiteNumber(row?.actual?.close_return);
}

function hitForTarget(row, target) {
  if (!row?.verified) return null;
  if (target === 'relative_leadership') return row?.market_relative?.classification === 'relative_leadership';
  if (target === 'close_return_gt_5') {
    const value = rowReturn(row);
    return Number.isFinite(value) ? value > 5 : null;
  }
  return null;
}

function annotateDispositionInMemory(summary, date) {
  if (!Array.isArray(summary?.stocks)) return { calculation_status: 'unable_to_calculate', active_stock_count: null };
  const file = path.join(ROOT, 'data_market_constraints', date, 'disposition.json');
  const disposition = readJson(file, null);
  const complete = disposition?.complete_market_coverage === true;
  const activeCodes = new Set(complete ? (disposition.active_stock_codes || []).map(String) : []);
  for (const stock of summary.stocks) {
    stock.is_disposition_stock = complete && activeCodes.has(String(stock.stock_code));
    stock.disposition_stock_status = complete ? 'completed' : disposition ? 'incomplete' : 'unavailable';
  }
  return {
    calculation_status: complete ? 'completed' : disposition ? 'incomplete' : 'unable_to_calculate',
    active_stock_count: complete ? activeCodes.size : null,
    source_file: disposition ? path.relative(ROOT, file).replaceAll(path.sep, '/') : null,
  };
}

function evaluateStrategyClassification(definition, classification, replayRows, actualEnvironment = null) {
  const memberCodes = new Set((classification?.members || []).map(String));
  const replayByCode = new Map((Array.isArray(replayRows) ? replayRows : [])
    .filter(row => row?.verified)
    .map(row => [String(row.stock_code), row]));
  const marketReturn = finiteNumber(actualEnvironment?.actual_environment?.metrics?.equal_weight_market_return);
  const stocks = [...memberCodes].map(code => {
    const row = replayByCode.get(code) || null;
    const closeReturn = rowReturn(row);
    const hit = hitForTarget(row, definition.evaluation_target);
    return {
      stock_code: code,
      stock_name: row?.stock_name || row?.prediction?.stock_name || null,
      verified: hit !== null,
      hit,
      close_return: closeReturn,
      market_excess_return: Number.isFinite(closeReturn) && Number.isFinite(marketReturn)
        ? round(closeReturn - marketReturn)
        : null,
      market_classification: row?.market_relative?.classification || null,
    };
  });
  const verified = stocks.filter(item => item.verified);
  const hits = verified.filter(item => item.hit === true);
  const misses = verified.filter(item => item.hit === false);
  const returns = verified.map(item => item.close_return).filter(Number.isFinite);
  const excess = verified.map(item => item.market_excess_return).filter(Number.isFinite);
  return {
    strategy_id: definition.strategy_id,
    strategy_family_id: definition.family_id,
    strategy_version: definition.version,
    label: definition.label,
    description: definition.description || '',
    source_mode: definition.source_mode || 'tag_expression',
    evaluation_target: definition.evaluation_target || null,
    evaluation_mode: classification?.evaluation_mode || 'live_snapshot',
    calculation_status: classification?.calculation_status || 'completed',
    candidates: classification?.count ?? null,
    verified_candidates: verified.length,
    hits: hits.length,
    misses: misses.length,
    hit_rate: verified.length ? round(hits.length / verified.length * 100) : null,
    missing_replay_candidates: memberCodes.size - verified.length,
    average_return: round(average(returns)),
    median_return: round(median(returns)),
    average_market_excess_return: round(average(excess)),
    members: [...memberCodes],
    hit_members: hits.map(item => item.stock_code),
    miss_members: misses.map(item => item.stock_code),
    stocks,
  };
}

function replayGroup(evaluation) {
  return {
    name: evaluation.label,
    strategy_id: evaluation.strategy_id,
    strategy_family_id: evaluation.strategy_family_id,
    strategy_version: evaluation.strategy_version,
    registered_strategy: true,
    fixed_display: true,
    source_mode: evaluation.source_mode,
    calculation_status: evaluation.calculation_status,
    evaluation_target: evaluation.evaluation_target,
    count: evaluation.verified_candidates,
    candidate_count: evaluation.candidates,
    verified_candidate_count: evaluation.verified_candidates,
    hit_count: evaluation.hits,
    miss_count: evaluation.misses,
    hit_rate: evaluation.hit_rate,
    average_close_return: evaluation.average_return,
    median_close_return: evaluation.median_return,
    average_market_excess_return: evaluation.average_market_excess_return,
    members: evaluation.members,
    hit_members: evaluation.hit_members,
    miss_members: evaluation.miss_members,
  };
}

function syncReplayRows(replayDashboard, summary) {
  const byCode = new Map((summary?.stocks || []).map(stock => [String(stock.stock_code), stock]));
  for (const row of replayDashboard?.rows || []) {
    const prediction = byCode.get(String(row.stock_code));
    if (!prediction) continue;
    if (!row.prediction) row.prediction = {};
    row.prediction.prediction_tags = [...(prediction.prediction_tags || [])];
    row.prediction.prediction_strategies = [...(prediction.prediction_strategies || [])];
    row.prediction.prediction_strategy_details = prediction.prediction_strategy_details || {};
  }
  return replayDashboard;
}

function evaluateSnapshot({ summary, replayDashboard, actualEnvironment, snapshot, registry }) {
  const definitions = new Map(registry.strategies.map(item => [item.strategy_id, item]));
  const evaluations = {};
  for (const [strategyId, classification] of Object.entries(snapshot.strategy_classifications || {})) {
    const definition = definitions.get(strategyId);
    if (!definition) continue;
    evaluations[strategyId] = evaluateStrategyClassification(
      definition,
      { ...classification, evaluation_mode: snapshot.evaluation_mode },
      replayDashboard?.rows || [],
      actualEnvironment,
    );
  }
  return evaluations;
}

function applyTagStrategyReplay({
  date,
  rootDir = 'data_predictions',
  dryRun = false,
  evaluationMode = 'live_snapshot',
  strategyId = '',
} = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const predictionDir = path.join(ROOT, rootDir, compact);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const replayDashboardFile = path.join(predictionDir, 'replay-dashboard.json');
  const replaySummaryFile = path.join(predictionDir, 'replay-summary.json');
  const snapshotFile = path.join(predictionDir, 'tag-strategy-snapshot.json');
  const actualEnvironmentFile = path.join(ROOT, 'data_market_environment', compact, 'actual_market_environment.json');

  const summary = readJson(summaryFile, null);
  const replayDashboard = readJson(replayDashboardFile, null);
  const replaySummary = readJson(replaySummaryFile, null);
  const actualEnvironment = readJson(actualEnvironmentFile, null);
  if (!Array.isArray(summary?.stocks)) throw new Error(`Missing summary stocks: ${path.relative(ROOT, summaryFile)}`);
  if (!Array.isArray(replayDashboard?.rows)) throw new Error(`Missing replay rows: ${path.relative(ROOT, replayDashboardFile)}`);
  if (!replaySummary) throw new Error(`Missing replay summary: ${path.relative(ROOT, replaySummaryFile)}`);

  const dispositionAnnotation = annotateDispositionInMemory(summary, compact);
  const registry = loadRegistry();
  let snapshot = evaluationMode === 'live_snapshot' ? readJson(snapshotFile, null) : null;
  if (!snapshot) snapshot = buildTagStrategySnapshot(summary, { registry, evaluationMode });
  if (strategyId) {
    snapshot = {
      ...snapshot,
      strategy_classifications: Object.fromEntries(
        Object.entries(snapshot.strategy_classifications || {}).filter(([id]) => id === strategyId),
      ),
    };
  }
  const evaluations = evaluateSnapshot({ summary, replayDashboard, actualEnvironment, snapshot, registry });
  syncReplayRows(replayDashboard, summary);

  const newDefinitions = new Map(registry.strategies
    .filter(item => item.source_mode !== 'legacy_bridge')
    .map(item => [item.strategy_id, item]));
  const replacedIds = new Set(Object.keys(evaluations).filter(id => newDefinitions.has(id)));
  replaySummary.by_strategy_tag = (Array.isArray(replaySummary.by_strategy_tag) ? replaySummary.by_strategy_tag : [])
    .filter(group => !replacedIds.has(group?.strategy_id));
  for (const strategyIdValue of replacedIds) replaySummary.by_strategy_tag.push(replayGroup(evaluations[strategyIdValue]));
  replaySummary.by_strategy_tag.sort((left, right) => Number(right.count || 0) - Number(left.count || 0)
    || String(left.name).localeCompare(String(right.name), 'zh-Hant'));
  replaySummary.tag_strategy_evaluations = evaluations;

  const generatedAt = new Date().toISOString();
  const output = {
    schema_version: 1,
    generated_at: generatedAt,
    replay_date: compact,
    evaluation_mode: evaluationMode,
    data_as_of: compactDate(summary.base_trade_date),
    registry: snapshot.registry,
    disposition_annotation: dispositionAnnotation,
    evaluations,
    source_files: {
      prediction_summary: path.relative(ROOT, summaryFile).replaceAll(path.sep, '/'),
      replay_dashboard: path.relative(ROOT, replayDashboardFile).replaceAll(path.sep, '/'),
      replay_summary: path.relative(ROOT, replaySummaryFile).replaceAll(path.sep, '/'),
      tag_strategy_snapshot: fs.existsSync(snapshotFile)
        ? path.relative(ROOT, snapshotFile).replaceAll(path.sep, '/')
        : null,
    },
    note: evaluationMode === 'live_snapshot'
      ? '候選資格使用預測當時保存的標籤與策略快照。'
      : '候選資格使用指定策略版本，以各歷史日期當時可得資料重新計算；不覆蓋 live snapshot。',
  };
  const outputRoot = evaluationMode === 'live_snapshot'
    ? path.join(ROOT, 'data_prediction_analysis', 'tag-strategy')
    : path.join(ROOT, 'data_prediction_analysis', 'tag-strategy-recalculation');
  const outputFile = strategyId
    ? path.join(outputRoot, strategyId, `${compact}.json`)
    : path.join(outputRoot, `${compact}.json`);

  if (!dryRun) {
    atomicWriteJson(outputFile, output);
    if (evaluationMode === 'live_snapshot') {
      atomicWriteJson(replaySummaryFile, replaySummary);
      atomicWriteJson(replayDashboardFile, replayDashboard);
    }
  }
  return {
    date: compact,
    evaluation_mode: evaluationMode,
    strategies: Object.fromEntries(Object.entries(evaluations).map(([id, item]) => [id, {
      candidates: item.candidates,
      verified_candidates: item.verified_candidates,
      hits: item.hits,
      hit_rate: item.hit_rate,
    }])),
    output_file: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
    dry_run: dryRun,
  };
}

function parseArgs(argv) {
  const options = { date: '', rootDir: 'data_predictions', dryRun: false, evaluationMode: 'live_snapshot', strategyId: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--root') options.rootDir = argv[++index] || '';
    else if (arg === '--mode') options.evaluationMode = argv[++index] || '';
    else if (arg === '--strategy') options.strategyId = argv[++index] || '';
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = applyTagStrategyReplay(parseArgs(argv));
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
  finiteNumber,
  average,
  median,
  rowReturn,
  hitForTarget,
  annotateDispositionInMemory,
  evaluateStrategyClassification,
  replayGroup,
  syncReplayRows,
  evaluateSnapshot,
  applyTagStrategyReplay,
  main,
};
