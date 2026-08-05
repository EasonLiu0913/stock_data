#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  readJson,
  atomicWriteJson,
  round,
} = require('./market_environment_lib');
const {
  loadRegistry: loadLegacyRegistry,
  buildTagStrategySnapshot,
  compactDate,
} = require('./prediction_tag_strategy_engine');
const {
  buildSnapshot: buildVersionedSnapshot,
  loadRegistry: loadVersionedRegistry,
  registryFingerprint: versionedRegistryFingerprint,
} = require('./strategy_tag_engine');
const {
  enrichMarginFeatures,
} = require('./apply_strategy_tag_registry');
const {
  enrichStrategyTagSources,
} = require('./strategy_tag_source_enrichment');
const {
  SAME_DAY_REBOUND_STRATEGY_IDS,
  isSameDayReboundStrategy,
  policyForDate,
  policyForTarget,
  hitForCloseReturn,
} = require('../public/rebound-evaluation-policy');

const VERSIONED_SNAPSHOT_MANIFEST = path.join(
  ROOT,
  'data_prediction_analysis',
  'strategy-snapshots',
  'manifest.json',
);
const DEFAULT_VERSIONED_REGISTRY_FILE = path.join(ROOT, 'config', 'strategy-tag-registry.json');
const SAME_DAY_REBOUND_TAG = '跌深反彈';

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

function normalizedEvaluationTarget(definition = {}, replayDate = '') {
  if (isSameDayReboundStrategy(definition.strategy_id)) {
    return policyForDate(replayDate).evaluation_target;
  }
  return definition.evaluation_target || null;
}

function addSameDayReboundTag(row, hit) {
  if (!row?.actual || hit !== true) return;
  const tags = new Set(Array.isArray(row.actual.pattern_tags) ? row.actual.pattern_tags : []);
  tags.add(SAME_DAY_REBOUND_TAG);
  row.actual.pattern_tags = [...tags];
}

function hitForTarget(row, target, replayDate = '') {
  if (target === 'intraday_rebound_5d_10pct') {
    const status = String(row?.actual?.max_return_5d_status || '');
    const value = finiteNumber(row?.actual?.max_return_5d);
    if (!status.startsWith('completed') || !Number.isFinite(value)) return null;
    return value >= 10;
  }
  if (!row?.verified) return null;
  if (target === 'relative_leadership') {
    return row?.market_relative?.classification === 'relative_leadership';
  }
  const reboundPolicy = policyForTarget(target);
  if (reboundPolicy) return hitForCloseReturn(rowReturn(row), reboundPolicy);
  if (target === 'close_return_gte_4') {
    return hitForCloseReturn(rowReturn(row), policyForDate(replayDate));
  }
  return null;
}

function annotateDispositionInMemory(summary, date, workspaceRoot = ROOT) {
  if (!Array.isArray(summary?.stocks)) {
    return { calculation_status: 'unable_to_calculate', active_stock_count: null };
  }
  const file = path.join(workspaceRoot, 'data_market_constraints', date, 'disposition.json');
  const disposition = readJson(file, null);
  const complete = disposition?.complete_market_coverage === true;
  const activeCodes = new Set(complete ? (disposition.active_stock_codes || []).map(String) : []);
  for (const stock of summary.stocks) {
    stock.is_disposition_stock = complete && activeCodes.has(String(stock.stock_code));
    stock.disposition_data_complete = complete ? 1 : null;
    stock.disposition_stock_status = complete ? 'completed' : disposition ? 'incomplete' : 'unavailable';
  }
  return {
    calculation_status: complete ? 'completed' : disposition ? 'incomplete' : 'unable_to_calculate',
    active_stock_count: complete ? activeCodes.size : null,
    source_file: disposition ? path.relative(workspaceRoot, file).replaceAll(path.sep, '/') : null,
  };
}

function evaluateStrategyClassification(
  definition,
  classification,
  replayRows,
  actualEnvironment = null,
  replayDate = '',
) {
  const memberCodes = new Set((classification?.members || []).map(String));
  const replayByCode = new Map((Array.isArray(replayRows) ? replayRows : [])
    .map(row => [String(row.stock_code), row]));
  const marketReturn = finiteNumber(actualEnvironment?.actual_environment?.metrics?.equal_weight_market_return);
  const evaluationTarget = normalizedEvaluationTarget(definition, replayDate);
  const sameDayReboundStrategy = isSameDayReboundStrategy(definition.strategy_id);
  const evaluationPolicy = sameDayReboundStrategy ? policyForDate(replayDate) : null;
  const stocks = [...memberCodes].map(code => {
    const row = replayByCode.get(code) || null;
    const closeReturn = rowReturn(row);
    const hit = hitForTarget(row, evaluationTarget, replayDate);
    if (sameDayReboundStrategy) addSameDayReboundTag(row, hit);
    return {
      stock_code: code,
      stock_name: row?.stock_name || row?.prediction?.stock_name || null,
      verified: hit !== null,
      hit,
      verification_label: hit === true ? '明顯準確' : hit === false ? '明顯不準' : '尚未驗證',
      outcome_tags: sameDayReboundStrategy && hit === true ? [SAME_DAY_REBOUND_TAG] : [],
      close_return: closeReturn,
      max_return_5d: finiteNumber(row?.actual?.max_return_5d),
      max_return_5d_status: row?.actual?.max_return_5d_status || null,
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
  const excessReturns = verified.map(item => item.market_excess_return).filter(Number.isFinite);
  const calculationStatus = sameDayReboundStrategy && memberCodes.size
    ? 'completed'
    : classification?.calculation_status || 'completed';
  return {
    strategy_id: definition.strategy_id,
    strategy_family_id: definition.family_id,
    strategy_version: definition.version,
    label: definition.label,
    description: definition.description || '',
    source_mode: definition.source_mode || 'tag_expression',
    evaluation_target: evaluationTarget,
    evaluation_policy_id: evaluationPolicy?.policy_id || null,
    evaluation_policy_version: evaluationPolicy?.version || null,
    evaluation_operator: evaluationPolicy?.operator || null,
    evaluation_threshold_percent: evaluationPolicy?.threshold_percent ?? null,
    evaluation_target_label: evaluationPolicy?.label || null,
    evaluation_mode: classification?.evaluation_mode || 'live_snapshot',
    calculation_status: calculationStatus,
    candidates: classification?.count ?? null,
    verified_candidates: verified.length,
    hits: hits.length,
    misses: misses.length,
    hit_rate: verified.length ? round(hits.length / verified.length * 100) : null,
    missing_replay_candidates: memberCodes.size - verified.length,
    average_return: round(average(returns)),
    median_return: round(median(returns)),
    average_market_excess_return: round(average(excessReturns)),
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
    evaluation_policy_id: evaluation.evaluation_policy_id,
    evaluation_policy_version: evaluation.evaluation_policy_version,
    evaluation_operator: evaluation.evaluation_operator,
    evaluation_threshold_percent: evaluation.evaluation_threshold_percent,
    evaluation_target_label: evaluation.evaluation_target_label,
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
    const atomicTags = [...(prediction.atomic_tags || prediction.prediction_tags || [])];
    const registeredStrategies = [...(
      prediction.registered_strategy_matches
      || prediction.prediction_strategies
      || []
    )];
    row.prediction.atomic_tags = atomicTags;
    row.prediction.unavailable_atomic_tags = [...(prediction.unavailable_atomic_tags || [])];
    row.prediction.registered_strategy_matches = registeredStrategies;
    row.prediction.unavailable_registered_strategies = [
      ...(prediction.unavailable_registered_strategies || []),
    ];
    row.prediction.prediction_tags = atomicTags;
    row.prediction.prediction_strategies = registeredStrategies;
    row.prediction.prediction_strategy_details = prediction.prediction_strategy_details || {};
  }
  return replayDashboard;
}

function normalizeSnapshotRegistry(snapshot) {
  if (Array.isArray(snapshot?.registry?.strategies)) return snapshot.registry;
  if (Array.isArray(snapshot?.strategy_registry)) {
    return {
      schema_version: snapshot.schema_version || null,
      registry_id: snapshot.registry_id || null,
      registry_fingerprint: snapshot.registry_fingerprint || null,
      tags: Array.isArray(snapshot.tag_registry) ? snapshot.tag_registry : [],
      strategies: snapshot.strategy_registry,
    };
  }
  return null;
}

function safeSnapshotPath(workspaceRoot, relativeFile) {
  const resolved = path.resolve(workspaceRoot, String(relativeFile || ''));
  const relative = path.relative(workspaceRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid versioned tag strategy snapshot path: ${relativeFile}`);
  }
  return resolved;
}

function registryFingerprint(registry) {
  try {
    return versionedRegistryFingerprint(registry);
  } catch {
    return crypto.createHash('sha256').update(JSON.stringify(registry || {})).digest('hex').slice(0, 16);
  }
}

function registryNamespace(registry) {
  const registryId = String(registry?.registry_id || 'unknown_registry')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `${registryId}--${registryFingerprint(registry)}`;
}

function isVersionedRegistry(registry) {
  return Number(registry?.schema_version || 0) >= 2
    && (registry?.tags || []).some(tag => tag.rule || tag.expression);
}

function loadHistoricalRegistry(registryFile = '', workspaceRoot = ROOT) {
  if (!registryFile) return loadVersionedRegistry(workspaceRoot);
  const resolved = path.isAbsolute(registryFile)
    ? registryFile
    : path.resolve(workspaceRoot, registryFile);
  const registry = readJson(resolved, null);
  if (!registry || !Array.isArray(registry.tags) || !Array.isArray(registry.strategies)) {
    throw new Error(`Invalid historical registry: ${registryFile}`);
  }
  return registry;
}

function validateVersionedSnapshot({ date, entry, snapshot, snapshotFile }) {
  if (!snapshot) {
    throw new Error(`Versioned live tag strategy snapshot is missing or invalid: ${entry.file}`);
  }
  if (compactDate(snapshot.forecast_date) !== date) {
    throw new Error(
      `Versioned live tag strategy snapshot date mismatch: expected ${date}, received ${snapshot.forecast_date || '(missing)'}`,
    );
  }
  if (snapshot.evaluation_mode !== 'live_snapshot') {
    throw new Error(
      `Versioned tag strategy snapshot is not live_snapshot: ${snapshot.evaluation_mode || '(missing)'}`,
    );
  }
  if (entry.registry_fingerprint && snapshot.registry_fingerprint !== entry.registry_fingerprint) {
    throw new Error(
      `Versioned live tag strategy snapshot fingerprint mismatch: manifest=${entry.registry_fingerprint}, snapshot=${snapshot.registry_fingerprint || '(missing)'}`,
    );
  }
  const registry = normalizeSnapshotRegistry(snapshot);
  if (!registry) {
    throw new Error(`Versioned live tag strategy snapshot has no strategy registry: ${entry.file}`);
  }
  return {
    snapshot: { ...snapshot, registry },
    registry,
    snapshotFile,
    snapshotFormat: 'versioned_registry_v2',
  };
}

function resolveLiveSnapshot({
  date,
  legacySnapshotFile,
  workspaceRoot = ROOT,
} = {}) {
  const manifestFile = path.join(
    workspaceRoot,
    'data_prediction_analysis',
    'strategy-snapshots',
    'manifest.json',
  );
  const manifest = readJson(manifestFile, null);
  const entry = manifest?.dates?.[date]?.live_snapshot || null;
  if (entry?.file) {
    const snapshotFile = safeSnapshotPath(workspaceRoot, entry.file);
    const snapshot = readJson(snapshotFile, null);
    return validateVersionedSnapshot({ date, entry, snapshot, snapshotFile });
  }

  const legacySnapshot = readJson(legacySnapshotFile, null);
  if (legacySnapshot) {
    const registry = normalizeSnapshotRegistry(legacySnapshot) || loadLegacyRegistry();
    return {
      snapshot: { ...legacySnapshot, registry },
      registry,
      snapshotFile: legacySnapshotFile,
      snapshotFormat: 'prediction_directory_v1_fallback',
    };
  }

  throw new Error(
    `Missing live tag strategy snapshot for ${date}: checked ${path.relative(workspaceRoot, manifestFile)} and ${path.relative(workspaceRoot, legacySnapshotFile)}`,
  );
}

function buildHistoricalSnapshot({
  summary,
  date,
  registry,
  workspaceRoot = ROOT,
} = {}) {
  const dataAsOf = compactDate(summary?.base_trade_date) || date;
  const payload = structuredClone(summary);
  if (isVersionedRegistry(registry)) {
    enrichMarginFeatures(payload, workspaceRoot, dataAsOf);
    enrichStrategyTagSources(payload, workspaceRoot, {
      forecastDate: date,
      dataAsOf,
    });
    return {
      registry,
      snapshot: buildVersionedSnapshot(payload, registry, {
        forecastDate: date,
        evaluationMode: 'historical_recalculation',
        dataAsOf,
      }),
      snapshotFormat: 'historical_recalculation_v2',
      dispositionAnnotation: payload.strategy_tag_source_metadata?.disposition || null,
    };
  }

  const dispositionAnnotation = annotateDispositionInMemory(payload, date, workspaceRoot);
  const snapshot = buildTagStrategySnapshot(payload, {
    registry,
    evaluationMode: 'historical_recalculation',
  });
  snapshot.registry_id = snapshot.registry_id || registry.registry_id || null;
  snapshot.registry_fingerprint = snapshot.registry_fingerprint || registryFingerprint(registry);
  return {
    registry,
    snapshot,
    snapshotFormat: 'historical_recalculation_v1',
    dispositionAnnotation,
  };
}

function evaluateSnapshot({ replayDashboard, actualEnvironment, snapshot, registry, replayDate = '' }) {
  const definitions = new Map((registry?.strategies || []).map(item => [item.strategy_id, item]));
  const evaluations = {};
  for (const [strategyId, classification] of Object.entries(snapshot.strategy_classifications || {})) {
    const definition = definitions.get(strategyId);
    if (!definition) continue;
    evaluations[strategyId] = evaluateStrategyClassification(
      definition,
      { ...classification, evaluation_mode: snapshot.evaluation_mode },
      replayDashboard?.rows || [],
      actualEnvironment,
      replayDate,
    );
  }
  return evaluations;
}

function filterSnapshotToStrategy(snapshot, strategyId) {
  if (!strategyId) return snapshot;
  return {
    ...snapshot,
    strategy_classifications: Object.fromEntries(
      Object.entries(snapshot.strategy_classifications || {}).filter(([id]) => id === strategyId),
    ),
  };
}

function historicalOutputRoot(registry, workspaceRoot = ROOT) {
  return path.join(
    workspaceRoot,
    'data_prediction_analysis',
    'tag-strategy-recalculation',
    registryNamespace(registry),
  );
}

function applyTagStrategyReplay({
  date,
  rootDir = 'data_predictions',
  dryRun = false,
  evaluationMode = 'live_snapshot',
  strategyId = '',
  registryFile = '',
  registryOverride = null,
  workspaceRoot = ROOT,
} = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  if (!['live_snapshot', 'historical_recalculation'].includes(evaluationMode)) {
    throw new Error(`Unsupported evaluation mode: ${evaluationMode}`);
  }

  const predictionDir = path.join(workspaceRoot, rootDir, compact);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const replayDashboardFile = path.join(predictionDir, 'replay-dashboard.json');
  const replaySummaryFile = path.join(predictionDir, 'replay-summary.json');
  const legacySnapshotFile = path.join(predictionDir, 'tag-strategy-snapshot.json');
  const actualEnvironmentFile = path.join(workspaceRoot, 'data_market_environment', compact, 'actual_market_environment.json');

  const summary = readJson(summaryFile, null);
  const replayDashboard = readJson(replayDashboardFile, null);
  const replaySummary = readJson(replaySummaryFile, null);
  const actualEnvironment = readJson(actualEnvironmentFile, null);
  if (!Array.isArray(summary?.stocks)) throw new Error(`Missing summary stocks: ${path.relative(workspaceRoot, summaryFile)}`);
  if (!Array.isArray(replayDashboard?.rows)) throw new Error(`Missing replay rows: ${path.relative(workspaceRoot, replayDashboardFile)}`);
  if (!replaySummary) throw new Error(`Missing replay summary: ${path.relative(workspaceRoot, replaySummaryFile)}`);

  let registry;
  let snapshot;
  let resolvedSnapshotFile = null;
  let snapshotFormat = null;
  let dispositionAnnotation = summary.disposition_stock_annotation || null;
  if (evaluationMode === 'live_snapshot') {
    const resolved = resolveLiveSnapshot({
      date: compact,
      legacySnapshotFile,
      workspaceRoot,
    });
    snapshot = resolved.snapshot;
    registry = resolved.registry;
    resolvedSnapshotFile = resolved.snapshotFile;
    snapshotFormat = resolved.snapshotFormat;
  } else {
    registry = registryOverride || loadHistoricalRegistry(registryFile, workspaceRoot);
    const historical = buildHistoricalSnapshot({
      summary,
      date: compact,
      registry,
      workspaceRoot,
    });
    snapshot = historical.snapshot;
    snapshotFormat = historical.snapshotFormat;
    dispositionAnnotation = historical.dispositionAnnotation;
  }
  snapshot = filterSnapshotToStrategy(snapshot, strategyId);
  const evaluations = evaluateSnapshot({
    replayDashboard,
    actualEnvironment,
    snapshot,
    registry,
    replayDate: compact,
  });

  if (evaluationMode === 'live_snapshot') {
    syncReplayRows(replayDashboard, summary);
    const newStrategyIds = new Set((registry.strategies || [])
      .filter(item => item.source_mode !== 'legacy_bridge')
      .map(item => item.strategy_id));
    const replacedIds = new Set(Object.keys(evaluations).filter(id => newStrategyIds.has(id)));
    replaySummary.by_strategy_tag = (Array.isArray(replaySummary.by_strategy_tag) ? replaySummary.by_strategy_tag : [])
      .filter(group => !replacedIds.has(group?.strategy_id));
    for (const id of replacedIds) replaySummary.by_strategy_tag.push(replayGroup(evaluations[id]));
    replaySummary.by_strategy_tag.sort((left, right) => Number(right.count || 0) - Number(left.count || 0)
      || String(left.name).localeCompare(String(right.name), 'zh-Hant'));
    replaySummary.tag_strategy_evaluations = evaluations;
    replaySummary.tag_strategy_snapshot = {
      format: snapshotFormat,
      source_file: resolvedSnapshotFile
        ? path.relative(workspaceRoot, resolvedSnapshotFile).replaceAll(path.sep, '/')
        : null,
      registry_id: snapshot.registry_id || registry.registry_id || null,
      registry_fingerprint: snapshot.registry_fingerprint || registryFingerprint(registry),
      evaluation_mode: snapshot.evaluation_mode,
      rebound_evaluation_policy: policyForDate(compact),
    };
  }

  const generatedAt = new Date().toISOString();
  const output = {
    schema_version: 3,
    generated_at: generatedAt,
    replay_date: compact,
    evaluation_mode: evaluationMode,
    data_as_of: compactDate(snapshot.data_as_of || summary.base_trade_date),
    registry_id: snapshot.registry_id || registry.registry_id || null,
    registry_fingerprint: snapshot.registry_fingerprint || registryFingerprint(registry),
    registry,
    rebound_evaluation_policy: policyForDate(compact),
    snapshot_format: snapshotFormat,
    disposition_annotation: dispositionAnnotation,
    evaluations,
    source_files: {
      prediction_summary: path.relative(workspaceRoot, summaryFile).replaceAll(path.sep, '/'),
      replay_dashboard: path.relative(workspaceRoot, replayDashboardFile).replaceAll(path.sep, '/'),
      replay_summary: path.relative(workspaceRoot, replaySummaryFile).replaceAll(path.sep, '/'),
      registry_file: evaluationMode === 'historical_recalculation'
        ? path.relative(
          workspaceRoot,
          registryFile
            ? (path.isAbsolute(registryFile) ? registryFile : path.resolve(workspaceRoot, registryFile))
            : path.join(workspaceRoot, 'config', 'strategy-tag-registry.json'),
        ).replaceAll(path.sep, '/')
        : null,
      tag_strategy_snapshot: resolvedSnapshotFile
        ? path.relative(workspaceRoot, resolvedSnapshotFile).replaceAll(path.sep, '/')
        : null,
      strategy_snapshot_manifest: fs.existsSync(path.join(
        workspaceRoot,
        'data_prediction_analysis',
        'strategy-snapshots',
        'manifest.json',
      )) ? 'data_prediction_analysis/strategy-snapshots/manifest.json' : null,
    },
    note: evaluationMode === 'live_snapshot'
      ? '候選資格優先使用預測當時保存的版本化標籤與策略快照；僅在版本化快照不存在時回退 legacy snapshot。'
      : '候選資格使用指定 registry 與策略版本重新計算；輸出依 registry ID 與 fingerprint 隔離，不覆蓋其他版本或 live snapshot。',
  };
  const outputRoot = evaluationMode === 'live_snapshot'
    ? path.join(workspaceRoot, 'data_prediction_analysis', 'tag-strategy')
    : historicalOutputRoot(registry, workspaceRoot);
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
    registry_id: output.registry_id,
    registry_fingerprint: output.registry_fingerprint,
    rebound_evaluation_policy: policyForDate(compact),
    snapshot_format: snapshotFormat,
    snapshot_file: resolvedSnapshotFile
      ? path.relative(workspaceRoot, resolvedSnapshotFile).replaceAll(path.sep, '/')
      : null,
    strategies: Object.fromEntries(Object.entries(evaluations).map(([id, item]) => [id, {
      candidates: item.candidates,
      verified_candidates: item.verified_candidates,
      hits: item.hits,
      hit_rate: item.hit_rate,
    }])),
    output_file: path.relative(workspaceRoot, outputFile).replaceAll(path.sep, '/'),
    dry_run: dryRun,
  };
}

function parseArgs(argv) {
  const options = {
    date: '',
    rootDir: 'data_predictions',
    dryRun: false,
    evaluationMode: 'live_snapshot',
    strategyId: '',
    registryFile: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--root') options.rootDir = argv[++index] || '';
    else if (arg === '--mode') options.evaluationMode = argv[++index] || '';
    else if (arg === '--strategy') options.strategyId = argv[++index] || '';
    else if (arg === '--registry') options.registryFile = argv[++index] || '';
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
  VERSIONED_SNAPSHOT_MANIFEST,
  DEFAULT_VERSIONED_REGISTRY_FILE,
  SAME_DAY_REBOUND_STRATEGY_IDS,
  SAME_DAY_REBOUND_TAG,
  finiteNumber,
  average,
  median,
  rowReturn,
  normalizedEvaluationTarget,
  addSameDayReboundTag,
  hitForTarget,
  annotateDispositionInMemory,
  evaluateStrategyClassification,
  replayGroup,
  syncReplayRows,
  normalizeSnapshotRegistry,
  safeSnapshotPath,
  registryFingerprint,
  registryNamespace,
  isVersionedRegistry,
  loadHistoricalRegistry,
  validateVersionedSnapshot,
  resolveLiveSnapshot,
  buildHistoricalSnapshot,
  evaluateSnapshot,
  filterSnapshotToStrategy,
  historicalOutputRoot,
  applyTagStrategyReplay,
  main,
};
