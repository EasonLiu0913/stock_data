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
  resolveLiveSnapshot,
  registryFingerprint,
} = require('./evaluate_tag_strategy_replay');
const {
  WINDOW_SIZE,
  compactDate,
  finiteNumber,
  fiveDayWindow,
  loadWindowSnapshots,
  parseFubonRow,
  corporateActionDates,
} = require('./backfill_prediction_replay_5d_outcomes');

const OBSERVATION_TAG_ID = 'margin_crowding_capitulation_continuation_risk_v1';
const OUTPUT_DIR = path.join(ROOT, 'data_prediction_analysis', 'observation-tag');

function median(values) {
  const usable = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
}

function buildFiveDayCloseOutcomes(replayRows, predictionDate, workspaceRoot = ROOT) {
  const date = compactDate(predictionDate);
  const dates = fiveDayWindow(date, workspaceRoot);
  if (dates.length < WINDOW_SIZE || dates[0] !== date) {
    return {
      status: 'pending_five_trading_days',
      window_dates: dates,
      benchmark_source: null,
      benchmark_return_5d_pct: null,
      by_code: new Map(),
    };
  }

  const snapshots = loadWindowSnapshots(dates, workspaceRoot);
  const actions = corporateActionDates(workspaceRoot);
  const finalDate = dates.at(-1);
  const rows = Array.isArray(replayRows) ? replayRows : [];
  const outcomes = new Map();

  for (const row of rows) {
    const code = String(row?.stock_code || '').trim();
    const referencePrice = finiteNumber(row?.actual?.official_or_adjusted_reference_price);
    const corporateActionDate = dates.find(item => actions.byCode.get(code)?.has(item)) || null;
    const finalRow = parseFubonRow(snapshots.get(finalDate)?.[code], finalDate);
    let status = 'completed';
    let return5d = null;
    if (!Number.isFinite(referencePrice) || referencePrice <= 0) status = 'reference_price_unavailable';
    else if (corporateActionDate) status = 'corporate_action_in_window';
    else if (!Number.isFinite(finalRow?.close) || finalRow.close <= 0) status = 'final_close_unavailable';
    else return5d = round(((finalRow.close / referencePrice) - 1) * 100);
    outcomes.set(code, {
      stock_code: code,
      stock_name: row?.stock_name || row?.prediction?.stock_name || null,
      status,
      return_5d_pct: return5d,
      reference_price: referencePrice,
      final_close: finalRow?.close ?? null,
      final_date: finalDate,
      corporate_action_date: corporateActionDate,
    });
  }

  const completed = [...outcomes.values()].filter(item => item.status === 'completed');
  const benchmark0050 = outcomes.get('0050');
  const benchmarkReturn = benchmark0050?.status === 'completed'
    ? benchmark0050.return_5d_pct
    : median(completed.map(item => item.return_5d_pct));
  const benchmarkSource = benchmark0050?.status === 'completed'
    ? '0050'
    : Number.isFinite(benchmarkReturn) ? 'cross_section_median' : null;

  for (const outcome of outcomes.values()) {
    outcome.market_excess_return_5d_pct = outcome.status === 'completed' && Number.isFinite(benchmarkReturn)
      ? round(outcome.return_5d_pct - benchmarkReturn)
      : null;
  }

  return {
    status: Number.isFinite(benchmarkReturn) ? 'completed' : 'unable_to_calculate',
    window_dates: dates,
    benchmark_source: benchmarkSource,
    benchmark_return_5d_pct: round(benchmarkReturn),
    by_code: outcomes,
  };
}

function evaluateObservationTag(definition, classification, outcomes) {
  const members = [...new Set((classification?.members || []).map(String))];
  const stocks = members.map(code => {
    const outcome = outcomes?.by_code?.get(code) || null;
    const verified = outcome?.status === 'completed'
      && Number.isFinite(outcome?.market_excess_return_5d_pct);
    const hit = verified ? outcome.market_excess_return_5d_pct < 0 : null;
    return {
      stock_code: code,
      stock_name: outcome?.stock_name || null,
      verified,
      hit,
      verification_label: hit === true
        ? '風險印證'
        : hit === false ? '風險未印證' : '尚未驗證',
      return_5d_pct: outcome?.return_5d_pct ?? null,
      market_excess_return_5d_pct: outcome?.market_excess_return_5d_pct ?? null,
      outcome_status: outcome?.status || outcomes?.status || 'unavailable',
      corporate_action_date: outcome?.corporate_action_date || null,
    };
  });
  const verified = stocks.filter(item => item.verified);
  const hits = verified.filter(item => item.hit === true);
  const misses = verified.filter(item => item.hit === false);
  const calculationStatus = outcomes?.status === 'pending_five_trading_days'
    ? 'pending'
    : classification?.calculation_status === 'unable_to_calculate'
      ? 'unable_to_calculate'
      : verified.length || members.length === 0 ? 'completed' : 'unable_to_calculate';
  return {
    tag_id: definition?.tag_id || OBSERVATION_TAG_ID,
    family_id: definition?.family_id || 'margin_crowding_capitulation_continuation_risk',
    version: definition?.version || 1,
    label: definition?.label || '融資擁擠恐慌續跌風險',
    usage_role: 'observation_only',
    affects_strategy_eligibility: false,
    affects_prediction_score: false,
    evaluation_target: 'market_relative_underperformance_5d',
    evaluation_rule: 'market_excess_return_5d_pct < 0',
    calculation_status: calculationStatus,
    candidates: classification?.count ?? null,
    verified_candidates: verified.length,
    hits: hits.length,
    misses: misses.length,
    hit_rate: verified.length ? round((hits.length / verified.length) * 100) : null,
    members,
    hit_members: hits.map(item => item.stock_code),
    miss_members: misses.map(item => item.stock_code),
    stocks,
    display_hint: definition?.display_hint
      || '市場偏弱時宜提高警覺；市場趨勢不影響此標籤入選。',
  };
}

function applyObservationTagReplay({
  date,
  rootDir = 'data_predictions',
  dryRun = false,
  workspaceRoot = ROOT,
} = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const predictionDir = path.join(workspaceRoot, rootDir, compact);
  const replayDashboardFile = path.join(predictionDir, 'replay-dashboard.json');
  const replaySummaryFile = path.join(predictionDir, 'replay-summary.json');
  const legacySnapshotFile = path.join(predictionDir, 'tag-strategy-snapshot.json');
  const replayDashboard = readJson(replayDashboardFile, null);
  const replaySummary = readJson(replaySummaryFile, null);
  if (!Array.isArray(replayDashboard?.rows)) {
    throw new Error(`Missing replay rows: ${path.relative(workspaceRoot, replayDashboardFile)}`);
  }
  if (!replaySummary) {
    throw new Error(`Missing replay summary: ${path.relative(workspaceRoot, replaySummaryFile)}`);
  }

  const resolved = resolveLiveSnapshot({
    date: compact,
    legacySnapshotFile,
    workspaceRoot,
  });
  const snapshot = resolved.snapshot;
  const registry = resolved.registry;
  const definition = (registry.tags || []).find(item => item.tag_id === OBSERVATION_TAG_ID) || null;
  const classification = snapshot.tag_classifications?.[OBSERVATION_TAG_ID] || {
    count: null,
    members: [],
    calculation_status: 'unable_to_calculate',
  };
  const outcomes = buildFiveDayCloseOutcomes(replayDashboard.rows, compact, workspaceRoot);
  const evaluation = evaluateObservationTag(definition, classification, outcomes);
  const generatedAt = new Date().toISOString();
  const output = {
    schema_version: 1,
    generated_at: generatedAt,
    replay_date: compact,
    evaluation_mode: 'live_snapshot',
    registry_id: snapshot.registry_id || registry.registry_id || null,
    registry_fingerprint: snapshot.registry_fingerprint || registryFingerprint(registry),
    snapshot_file: path.relative(workspaceRoot, resolved.snapshotFile).replaceAll(path.sep, '/'),
    market_regime_used_for_eligibility: false,
    market_regime_used_for_evaluation: false,
    benchmark: {
      source: outcomes.benchmark_source,
      return_5d_pct: outcomes.benchmark_return_5d_pct,
      window_dates: outcomes.window_dates,
    },
    evaluations: {
      [OBSERVATION_TAG_ID]: evaluation,
    },
    note: '此為觀察型風險標籤覆盤；市場環境不影響候選資格，亦不計入任何策略準確率或預測分數。',
  };
  const outputFile = path.join(workspaceRoot, 'data_prediction_analysis', 'observation-tag', `${compact}.json`);

  if (!dryRun) {
    atomicWriteJson(outputFile, output);
    replaySummary.observation_tag_evaluations = output.evaluations;
    replaySummary.observation_tag_snapshot = {
      source_file: path.relative(workspaceRoot, outputFile).replaceAll(path.sep, '/'),
      registry_fingerprint: output.registry_fingerprint,
      generated_at: generatedAt,
      market_regime_used_for_eligibility: false,
    };
    atomicWriteJson(replaySummaryFile, replaySummary);
  }

  return {
    date: compact,
    status: evaluation.calculation_status,
    candidates: evaluation.candidates,
    verified_candidates: evaluation.verified_candidates,
    hits: evaluation.hits,
    hit_rate: evaluation.hit_rate,
    benchmark_source: outcomes.benchmark_source,
    benchmark_return_5d_pct: outcomes.benchmark_return_5d_pct,
    output_file: path.relative(workspaceRoot, outputFile).replaceAll(path.sep, '/'),
    dry_run: dryRun,
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
  const result = applyObservationTagReplay(parseArgs(argv));
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
  OBSERVATION_TAG_ID,
  OUTPUT_DIR,
  median,
  buildFiveDayCloseOutcomes,
  evaluateObservationTag,
  applyObservationTagReplay,
  parseArgs,
  main,
};
