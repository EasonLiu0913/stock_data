#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildSnapshot,
  finiteNumber,
  loadRegistry,
  registryFingerprint,
} = require('./strategy_tag_engine');
const { parseMarginCsv } = require('./oversold_rebound_research_lib');
const { enrichStrategyTagSources } = require('./strategy_tag_source_enrichment');
const {
  evaluateTwoStageFundamentalSignalDay,
} = require('./two_stage_fundamental_quality_signal');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MARGIN_PERIODS = 5;

function compactDate(value) {
  const normalized = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(normalized) ? normalized : '';
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function isValidPredictionSummary(file) {
  const payload = readJson(file, null);
  return Boolean(payload && Array.isArray(payload.stocks));
}

function latestPredictionDate(rootDir, workspaceRoot = ROOT) {
  const directory = path.join(workspaceRoot, rootDir);
  if (!fs.existsSync(directory)) return '';
  return fs.readdirSync(directory)
    .filter(name => /^20\d{6}$/.test(name))
    .filter(name => isValidPredictionSummary(path.join(directory, name, 'summary.json')))
    .sort()
    .at(-1) || '';
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function parseArgs(argv) {
  const options = {
    rootDir: 'data_predictions',
    date: '',
    latest: false,
    dryRun: false,
    evaluationMode: 'live_snapshot',
    dataAsOf: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') options.rootDir = argv[++index] || '';
    else if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--latest') options.latest = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--evaluation-mode') options.evaluationMode = argv[++index] || '';
    else if (arg === '--data-as-of') options.dataAsOf = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function marginFileNames(workspaceRoot) {
  const directory = path.join(workspaceRoot, 'data_twse_margin_balance');
  const listed = readJson(path.join(directory, 'files.json'), null);
  if (Array.isArray(listed)) return listed;
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory);
}

function listMarginDates(workspaceRoot, cutoff, periods = DEFAULT_MARGIN_PERIODS) {
  const normalizedCutoff = compactDate(cutoff);
  return [...new Set(marginFileNames(workspaceRoot)
    .map(name => String(name).match(/^(20\d{6})_twse_margin_balance\.csv$/)?.[1] || '')
    .filter(Boolean)
    .filter(date => !normalizedCutoff || date <= normalizedCutoff))]
    .sort()
    .slice(-periods);
}

function safeMarginMap(workspaceRoot, date) {
  const file = path.join(
    workspaceRoot,
    'data_twse_margin_balance',
    `${date}_twse_margin_balance.csv`,
  );
  try {
    return { date, map: parseMarginCsv(fs.readFileSync(file, 'utf8')), error: null };
  } catch (error) {
    return { date, map: new Map(), error: error.message };
  }
}

function earliestDataCutoff(payload, dataAsOf) {
  return [compactDate(payload?.base_trade_date), compactDate(dataAsOf)]
    .filter(Boolean)
    .sort()
    .at(0) || '';
}

function enrichMarginFeatures(payload, workspaceRoot, dataAsOf, periods = DEFAULT_MARGIN_PERIODS) {
  const cutoff = earliestDataCutoff(payload, dataAsOf);
  const selectedDates = listMarginDates(workspaceRoot, cutoff, periods);
  const dailyMaps = selectedDates.map(date => safeMarginMap(workspaceRoot, date));
  const loadedMaps = dailyMaps.filter(item => !item.error);
  const latestDate = loadedMaps.at(-1)?.date || null;
  const latestMap = loadedMaps.at(-1)?.map || new Map();
  let available1dStockCount = 0;
  let available5dStockCount = 0;

  payload.stocks = (payload.stocks || []).map(stock => {
    const code = String(stock.stock_code || '').trim();
    const current = latestMap.get(code) || null;
    const currentChange = finiteNumber(current?.margin_change);
    const currentBalance = finiteNumber(current?.margin_balance);
    const dailyChanges = loadedMaps.map(item => finiteNumber(item.map.get(code)?.margin_change));
    const validDays = dailyChanges.filter(Number.isFinite).length;
    const change5d = loadedMaps.length === periods && validDays === periods
      ? dailyChanges.reduce((sum, value) => sum + value, 0)
      : null;
    if (Number.isFinite(currentChange)) available1dStockCount += 1;
    if (Number.isFinite(change5d)) available5dStockCount += 1;
    return {
      ...stock,
      strategy_tag_features: {
        ...(stock.strategy_tag_features || {}),
        margin_change: currentChange,
        margin_change_5d: change5d,
        margin_balance: currentBalance,
        margin_valid_days: validDays,
        margin_required_days: periods,
        margin_latest_date: latestDate,
      },
    };
  });

  const totalStockCount = payload.stocks.length;
  const sourceStatus = loadedMaps.length < periods || !latestDate
    ? 'unable_to_calculate'
    : available5dStockCount < totalStockCount ? 'partial' : 'completed';
  const marginMetadata = {
    calculation_status: sourceStatus,
    calculation_message: sourceStatus === 'unable_to_calculate'
      ? `僅載入 ${loadedMaps.length}／${periods} 個融資交易日，無法完整計算。`
      : sourceStatus === 'partial'
        ? `已載入 ${periods} 個融資交易日；部分股票無融資資格或缺少紀錄。`
        : `已載入 ${periods} 個融資交易日並完成全部股票計算。`,
    cutoff_date: cutoff || null,
    selected_dates: selectedDates,
    loaded_dates: loadedMaps.map(item => item.date),
    failed_dates: dailyMaps.filter(item => item.error).map(item => ({ date: item.date, error: item.error })),
    latest_date: latestDate,
    required_days: periods,
    total_stock_count: totalStockCount,
    available_1d_stock_count: available1dStockCount,
    available_5d_stock_count: available5dStockCount,
    coverage_1d_pct: totalStockCount
      ? Math.round((available1dStockCount / totalStockCount) * 10000) / 100
      : null,
    coverage_5d_pct: totalStockCount
      ? Math.round((available5dStockCount / totalStockCount) * 10000) / 100
      : null,
  };
  payload.strategy_tag_source_metadata = {
    ...(payload.strategy_tag_source_metadata || {}),
    margin: marginMetadata,
  };
  return marginMetadata;
}

function enrichTwoStageFundamentalFeatures(payload, workspaceRoot) {
  const baseTradeDate = compactDate(payload?.base_trade_date);
  let availableStockCount = 0;
  let unavailableStockCount = 0;
  let signalStockCount = 0;
  const sourceFiles = new Set();

  payload.stocks = (payload.stocks || []).map(stock => {
    const result = evaluateTwoStageFundamentalSignalDay({
      workspaceRoot,
      stockId: stock.stock_code,
      baseTradeDate,
    });
    for (const file of result.source_files || []) sourceFiles.add(file);
    if (result.available) availableStockCount += 1;
    else unavailableStockCount += 1;
    if (result.is_signal_day === true) signalStockCount += 1;
    return {
      ...stock,
      strategy_tag_features: {
        ...(stock.strategy_tag_features || {}),
        two_stage_fundamental_signal_day: result.available ? result.is_signal_day : null,
        two_stage_fundamental_source_available: result.available === true,
        two_stage_fundamental_electronic: result.electronic ?? null,
        two_stage_fundamental_fas_total: result.fas_total ?? null,
        two_stage_fundamental_fq_score: result.fq_score ?? null,
        two_stage_fundamental_signal_month: result.signal_month ?? null,
        two_stage_fundamental_signal_date: result.signal_date ?? null,
        two_stage_fundamental_event_date: result.event_date ?? null,
        two_stage_fundamental_industry: result.industry ?? null,
        two_stage_fundamental_financial_period: result.financial_period ?? null,
        two_stage_fundamental_financial_known_date: result.financial_known_date ?? null,
        two_stage_fundamental_reason: result.reason || null,
      },
    };
  });

  const totalStockCount = payload.stocks.length;
  const status = availableStockCount === 0
    ? 'unable_to_calculate'
    : unavailableStockCount > 0 ? 'partial' : 'completed';
  const metadata = {
    calculation_status: status,
    calculation_message: status === 'unable_to_calculate'
      ? '基本面雙確認訊號來源無法計算。'
      : status === 'partial'
        ? `基本面雙確認訊號部分可計算；可計算 ${availableStockCount}／${totalStockCount} 檔。`
        : signalStockCount
          ? `已完成基本面雙確認訊號日判斷，共 ${signalStockCount} 檔。`
          : '已完成基本面雙確認訊號日判斷，當日 0 檔。',
    base_trade_date: baseTradeDate || null,
    rule_version: 1,
    universe: 'electronic FAS>=8 + latest-known FQ>=10',
    entry_policy: 'signal_day_direct_entry_baseline',
    research_status: 'current_best_total-capital baseline; timing routing not OOS validated',
    total_stock_count: totalStockCount,
    available_stock_count: availableStockCount,
    unavailable_stock_count: unavailableStockCount,
    signal_stock_count: status === 'unable_to_calculate' ? null : signalStockCount,
    coverage_pct: totalStockCount
      ? Math.round((availableStockCount / totalStockCount) * 10000) / 100
      : null,
    source_files: [...sourceFiles].sort(),
  };
  payload.strategy_tag_source_metadata = {
    ...(payload.strategy_tag_source_metadata || {}),
    two_stage_fundamental_quality: metadata,
  };
  return metadata;
}

function compactSnapshot(snapshot) {
  return {
    ...snapshot,
    stocks: (snapshot.stocks || []).map(stock => ({
      stock_code: stock.stock_code,
      stock_name: stock.stock_name || '',
      strategy_tag_features: stock.strategy_tag_features || {},
      atomic_tags: stock.atomic_tags || [],
      unavailable_atomic_tags: stock.unavailable_atomic_tags || [],
      registered_strategy_matches: stock.registered_strategy_matches || [],
      unavailable_registered_strategies: stock.unavailable_registered_strategies || [],
    })),
  };
}

function applySnapshotToPayload(payload, snapshot) {
  const byCode = new Map((snapshot.stocks || []).map(stock => [String(stock.stock_code), stock]));
  payload.strategy_tag_source_metadata = snapshot.source_metadata || {};
  payload.tag_registry = snapshot.tag_registry || [];
  payload.strategy_registry_v2 = snapshot.strategy_registry || [];
  payload.tag_classifications = snapshot.tag_classifications || {};
  payload.strategy_classifications_v2 = snapshot.strategy_classifications || {};
  payload.strategy_snapshot_metadata = {
    registry_id: snapshot.registry_id,
    registry_fingerprint: snapshot.registry_fingerprint,
    evaluation_mode: snapshot.evaluation_mode,
    data_as_of: snapshot.data_as_of,
    generated_at: snapshot.generated_at,
  };
  payload.stocks = (payload.stocks || []).map(stock => {
    const saved = byCode.get(String(stock.stock_code || ''));
    return {
      ...stock,
      strategy_tag_features: saved?.strategy_tag_features || {},
      atomic_tags: saved?.atomic_tags || [],
      unavailable_atomic_tags: saved?.unavailable_atomic_tags || [],
      registered_strategy_matches: saved?.registered_strategy_matches || [],
      unavailable_registered_strategies: saved?.unavailable_registered_strategies || [],
    };
  });
  return payload;
}

function snapshotFileFor(workspaceRoot, date, evaluationMode, fingerprint, dataAsOf) {
  const root = path.join(workspaceRoot, 'data_prediction_analysis', 'strategy-snapshots');
  if (evaluationMode === 'live_snapshot') return path.join(root, 'live_snapshot', `${date}.json`);
  const suffix = compactDate(dataAsOf) || date;
  return path.join(root, 'historical_recalculation', date, `${fingerprint}--asof-${suffix}.json`);
}

function snapshotHistoryFileFor(workspaceRoot, date, fingerprint) {
  return path.join(
    workspaceRoot,
    'data_prediction_analysis',
    'strategy-snapshots',
    'live_snapshot_history',
    date,
    `${fingerprint || 'unknown'}.json`,
  );
}

function manifestEntry(workspaceRoot, snapshotFile, snapshot) {
  return {
    file: path.relative(workspaceRoot, snapshotFile).replaceAll(path.sep, '/'),
    registry_id: snapshot.registry_id,
    registry_fingerprint: snapshot.registry_fingerprint,
    evaluation_mode: snapshot.evaluation_mode,
    data_as_of: snapshot.data_as_of,
    generated_at: snapshot.generated_at,
  };
}

function normalizeManifestDateEntry(entry = {}) {
  return {
    live_snapshot: entry.live_snapshot || null,
    live_snapshot_history: Array.isArray(entry.live_snapshot_history) ? entry.live_snapshot_history : [],
    historical_recalculations: Array.isArray(entry.historical_recalculations)
      ? entry.historical_recalculations
      : [],
  };
}

function liveSnapshotReplacementReason(existingSnapshot, registry) {
  if (!existingSnapshot) return null;
  const existingFingerprint = String(existingSnapshot.registry_fingerprint || '');
  const invalidFingerprints = new Set(registry.replace_invalid_live_fingerprints || []);
  if (invalidFingerprints.has(existingFingerprint)) return 'listed_invalid_fingerprint';
  if (!existingFingerprint || existingFingerprint !== registryFingerprint(registry)) {
    return 'registry_fingerprint_mismatch';
  }
  return null;
}

function shouldReplaceLiveSnapshot(existingSnapshot, registry) {
  return Boolean(liveSnapshotReplacementReason(existingSnapshot, registry));
}

function updateSnapshotManifest(workspaceRoot, snapshotFile, snapshot, options = {}) {
  const manifestFile = path.join(workspaceRoot, 'data_prediction_analysis', 'strategy-snapshots', 'manifest.json');
  const manifest = readJson(manifestFile, {
    schema_version: 2,
    updated_at: null,
    dates: {},
  });
  manifest.schema_version = Math.max(Number(manifest.schema_version || 1), 2);
  const date = compactDate(snapshot.forecast_date);
  manifest.dates[date] = normalizeManifestDateEntry(manifest.dates[date]);
  const before = JSON.stringify(manifest.dates[date]);
  const entry = manifestEntry(workspaceRoot, snapshotFile, snapshot);
  if (options.archivedEntry) {
    const history = manifest.dates[date].live_snapshot_history
      .filter(item => item.file !== options.archivedEntry.file);
    history.push(options.archivedEntry);
    history.sort((left, right) => String(left.generated_at).localeCompare(String(right.generated_at)));
    manifest.dates[date].live_snapshot_history = history;
  }
  if (snapshot.evaluation_mode === 'live_snapshot') {
    manifest.dates[date].live_snapshot = entry;
  } else {
    const rows = manifest.dates[date].historical_recalculations
      .filter(item => item.file !== entry.file);
    rows.push(entry);
    rows.sort((left, right) => String(left.generated_at).localeCompare(String(right.generated_at)));
    manifest.dates[date].historical_recalculations = rows;
  }
  const changed = before !== JSON.stringify(manifest.dates[date]);
  if (changed) {
    manifest.updated_at = new Date().toISOString();
    writeJsonAtomic(manifestFile, manifest);
  }
  return { manifestFile, changed };
}

function applyRegistry(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || ROOT);
  const rootDir = options.rootDir || 'data_predictions';
  const date = compactDate(options.date) || (options.latest ? latestPredictionDate(rootDir, workspaceRoot) : '');
  if (!date) throw new Error('Provide --date YYYYMMDD or --latest');
  const evaluationMode = options.evaluationMode || 'live_snapshot';
  if (!['live_snapshot', 'historical_recalculation'].includes(evaluationMode)) {
    throw new Error('evaluation mode must be live_snapshot or historical_recalculation');
  }

  const predictionDir = path.join(workspaceRoot, rootDir, date);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const payload = readJson(summaryFile, null);
  if (!payload || !Array.isArray(payload.stocks)) throw new Error(`Missing or invalid prediction summary: ${summaryFile}`);
  const registry = options.registry || loadRegistry(workspaceRoot);
  const fingerprint = registryFingerprint(registry);
  const dataAsOf = compactDate(options.dataAsOf) || compactDate(payload.base_trade_date) || date;
  const snapshotFile = snapshotFileFor(workspaceRoot, date, evaluationMode, fingerprint, dataAsOf);
  const existingSnapshot = readJson(snapshotFile, null);
  const replacementReason = evaluationMode === 'live_snapshot'
    ? liveSnapshotReplacementReason(existingSnapshot, registry)
    : null;
  const replaceExistingLive = Boolean(replacementReason);
  let archivedEntry = null;
  let archivedSnapshotFile = null;

  let snapshot = existingSnapshot;
  let reusedExistingSnapshot = Boolean(existingSnapshot) && !replaceExistingLive;
  let sourceMetadata = existingSnapshot?.source_metadata || {};
  if (!snapshot || replaceExistingLive) {
    if (replaceExistingLive) {
      archivedSnapshotFile = snapshotHistoryFileFor(
        workspaceRoot,
        date,
        existingSnapshot.registry_fingerprint,
      );
      if (!options.dryRun && !fs.existsSync(archivedSnapshotFile)) {
        writeJsonAtomic(archivedSnapshotFile, existingSnapshot);
      }
      archivedEntry = manifestEntry(workspaceRoot, archivedSnapshotFile, existingSnapshot);
    }
    const enrichedPayload = structuredClone(payload);
    enrichMarginFeatures(enrichedPayload, workspaceRoot, dataAsOf);
    enrichStrategyTagSources(enrichedPayload, workspaceRoot, {
      forecastDate: date,
      dataAsOf,
    });
    enrichTwoStageFundamentalFeatures(enrichedPayload, workspaceRoot);
    sourceMetadata = enrichedPayload.strategy_tag_source_metadata || {};
    snapshot = buildSnapshot(enrichedPayload, registry, {
      forecastDate: date,
      evaluationMode,
      dataAsOf,
    });
    reusedExistingSnapshot = false;
  }

  let manifestChanged = false;
  if (!options.dryRun) {
    if (!reusedExistingSnapshot) writeJsonAtomic(snapshotFile, compactSnapshot(snapshot));
    manifestChanged = updateSnapshotManifest(workspaceRoot, snapshotFile, snapshot, { archivedEntry }).changed;
    if (evaluationMode === 'live_snapshot') {
      writeJsonAtomic(summaryFile, applySnapshotToPayload(payload, snapshot));
    }
  }

  return {
    date,
    root_dir: rootDir,
    evaluation_mode: snapshot.evaluation_mode,
    registry_id: snapshot.registry_id,
    registry_fingerprint: snapshot.registry_fingerprint,
    tag_count: Object.keys(snapshot.tag_classifications || {}).length,
    strategy_count: Object.keys(snapshot.strategy_classifications || {}).length,
    snapshot_file: path.relative(workspaceRoot, snapshotFile).replaceAll(path.sep, '/'),
    archived_snapshot_file: archivedSnapshotFile
      ? path.relative(workspaceRoot, archivedSnapshotFile).replaceAll(path.sep, '/')
      : null,
    manifest_file: 'data_prediction_analysis/strategy-snapshots/manifest.json',
    reused_existing_snapshot: reusedExistingSnapshot,
    corrected_invalid_live_snapshot: replaceExistingLive,
    live_snapshot_replacement_reason: replacementReason,
    summary_enriched: evaluationMode === 'live_snapshot',
    manifest_changed: manifestChanged,
    source_metadata: sourceMetadata,
    dry_run: Boolean(options.dryRun),
  };
}

function main(argv = process.argv.slice(2)) {
  const result = applyRegistry(parseArgs(argv));
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
  DEFAULT_MARGIN_PERIODS,
  compactDate,
  readJson,
  isValidPredictionSummary,
  latestPredictionDate,
  writeJsonAtomic,
  parseArgs,
  marginFileNames,
  listMarginDates,
  safeMarginMap,
  earliestDataCutoff,
  enrichMarginFeatures,
  enrichTwoStageFundamentalFeatures,
  compactSnapshot,
  applySnapshotToPayload,
  snapshotFileFor,
  snapshotHistoryFileFor,
  manifestEntry,
  normalizeManifestDateEntry,
  liveSnapshotReplacementReason,
  shouldReplaceLiveSnapshot,
  updateSnapshotManifest,
  applyRegistry,
  main,
};
