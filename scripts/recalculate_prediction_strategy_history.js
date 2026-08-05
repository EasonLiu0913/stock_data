#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  atomicWriteJson,
  round,
} = require('./market_environment_lib');
const {
  compactDate,
} = require('./prediction_tag_strategy_engine');
const {
  applyTagStrategyReplay,
  loadHistoricalRegistry,
  registryFingerprint,
  registryNamespace,
} = require('./evaluate_tag_strategy_replay');

const DEFAULT_REGISTRY_FILE = path.join(ROOT, 'config', 'strategy-tag-registry.json');

function resolveStrategy(registry, options) {
  if (options.strategyId) {
    const strategy = registry.strategies.find(item => item.strategy_id === options.strategyId);
    if (!strategy) throw new Error(`Unknown strategy: ${options.strategyId}`);
    return strategy;
  }
  if (!options.familyId) throw new Error('Provide --strategy or --family');
  const candidates = registry.strategies
    .filter(item => item.family_id === options.familyId && item.enabled !== false)
    .sort((left, right) => Number(right.version || 0) - Number(left.version || 0));
  if (!candidates.length) throw new Error(`Unknown strategy family: ${options.familyId}`);
  return candidates[0];
}

function listReplayDates(rootDir, from, to, workspaceRoot = ROOT) {
  const root = path.join(workspaceRoot, rootDir);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter(name => /^20\d{6}$/.test(name))
    .filter(date => (!from || date >= from) && (!to || date <= to))
    .filter(date => fs.existsSync(path.join(root, date, 'summary.json'))
      && fs.existsSync(path.join(root, date, 'replay-dashboard.json'))
      && fs.existsSync(path.join(root, date, 'replay-summary.json')))
    .sort();
}

function recalculateHistory(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || ROOT);
  const registryFile = options.registryFile || DEFAULT_REGISTRY_FILE;
  const registry = options.registryOverride
    || loadHistoricalRegistry(registryFile, workspaceRoot);
  const strategy = resolveStrategy(registry, options);
  const from = compactDate(options.from);
  const to = compactDate(options.to);
  const rootDir = options.rootDir || 'data_predictions';
  const dates = listReplayDates(rootDir, from, to, workspaceRoot);
  const fingerprint = registryFingerprint(registry);
  const namespace = registryNamespace(registry);
  const results = [];
  const failures = [];

  for (const date of dates) {
    try {
      const result = applyTagStrategyReplay({
        date,
        rootDir,
        evaluationMode: 'historical_recalculation',
        strategyId: strategy.strategy_id,
        registryFile,
        registryOverride: registry,
        workspaceRoot,
        dryRun: Boolean(options.dryRun),
      });
      const metrics = result.strategies[strategy.strategy_id] || {};
      results.push({
        date,
        registry_id: result.registry_id,
        registry_fingerprint: result.registry_fingerprint,
        ...metrics,
        output_file: result.output_file,
      });
    } catch (error) {
      failures.push({ date, error: error.message });
    }
  }

  const totals = results.reduce((aggregate, row) => ({
    candidates: aggregate.candidates + Number(row.candidates || 0),
    verified_candidates: aggregate.verified_candidates + Number(row.verified_candidates || 0),
    hits: aggregate.hits + Number(row.hits || 0),
  }), { candidates: 0, verified_candidates: 0, hits: 0 });
  const summary = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    evaluation_mode: 'historical_recalculation',
    registry_id: registry.registry_id || null,
    registry_fingerprint: fingerprint,
    registry_namespace: namespace,
    registry_file: path.relative(workspaceRoot, path.resolve(workspaceRoot, registryFile)).replaceAll(path.sep, '/'),
    strategy_id: strategy.strategy_id,
    strategy_family_id: strategy.family_id,
    strategy_version: strategy.version,
    label: strategy.label,
    expression: strategy.expression,
    evaluation_target: strategy.evaluation_target,
    requested_range: { from: from || null, to: to || null },
    processed_dates: results.length,
    failed_dates: failures.length,
    totals: {
      ...totals,
      hit_rate: totals.verified_candidates
        ? round(totals.hits / totals.verified_candidates * 100)
        : null,
    },
    dates: results,
    failures,
    note: '此結果以指定 registry 與策略版本全面回算歷史；輸出依 registry ID 與 fingerprint 隔離，不覆蓋其他版本或當時 live snapshot。',
  };
  const outputFile = path.join(
    workspaceRoot,
    'data_prediction_analysis',
    'tag-strategy-recalculation',
    namespace,
    strategy.strategy_id,
    'summary.json',
  );
  if (!options.dryRun) atomicWriteJson(outputFile, summary);
  return {
    ...summary,
    output_file: path.relative(workspaceRoot, outputFile).replaceAll(path.sep, '/'),
    dry_run: Boolean(options.dryRun),
  };
}

function parseArgs(argv) {
  const options = {
    strategyId: '',
    familyId: '',
    from: '',
    to: '',
    rootDir: 'data_predictions',
    registryFile: DEFAULT_REGISTRY_FILE,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--strategy') options.strategyId = argv[++index] || '';
    else if (arg === '--family') options.familyId = argv[++index] || '';
    else if (arg === '--from') options.from = argv[++index] || '';
    else if (arg === '--to') options.to = argv[++index] || '';
    else if (arg === '--root') options.rootDir = argv[++index] || '';
    else if (arg === '--registry') options.registryFile = argv[++index] || '';
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = recalculateHistory(parseArgs(argv));
  console.log(JSON.stringify({
    registry_id: result.registry_id,
    registry_fingerprint: result.registry_fingerprint,
    strategy_id: result.strategy_id,
    processed_dates: result.processed_dates,
    failed_dates: result.failed_dates,
    totals: result.totals,
    output_file: result.output_file,
    dry_run: result.dry_run,
  }, null, 2));
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
  DEFAULT_REGISTRY_FILE,
  resolveStrategy,
  listReplayDates,
  recalculateHistory,
  main,
};
