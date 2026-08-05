#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  DEFAULT_OPTIONS: ROUND1_OPTIONS,
  compactDate,
  readJson,
  round,
  normalizeIndustry,
  loadHistoricalPriceContext,
  periodReturn,
  calculateTrendQuality,
  calculateBullishAlignment,
} = require('./historical_factor_research');
const {
  DEFAULT_OPTIONS: ROUND2_OPTIONS,
  calculateVolumeBreakout,
  calculatePullbackVolumeContraction,
  calculateMarginExitPriceResilience,
  calculateMarginCrowdingRaw,
} = require('./historical_factor_research_round_2');
const {
  loadMarginResearchContext,
  marginFeaturesAt,
  forwardReturn,
} = require('./generate_round_2_factor_research');
const {
  latestPredictionDate,
  writeJsonAtomic,
  loadCandidateRegistry,
  sourceDatesFromContext,
  indexRowsByDate,
  benchmarkAtDate,
  enrichRelativeStates,
  enrichLeadershipStates,
  crowdingThresholdAtDate,
  stateDetail,
  candidateStatesForItem,
  signalForDefinition,
} = require('./generate_round_3_candidate_research');
const {
  minimumHistoryDays,
  buildBaseEvent,
} = require('./generate_round_4_walk_forward_research');
const {
  median,
  classifyMarketRegime,
  deduplicateEvents,
} = require('./round_3_candidate_research_lib');
const {
  computeTrailingRisk,
  computeForwardExcursion,
  evaluateSelector,
  buildWalkForwardFolds,
  summarizeTailRiskGroup,
  summarizeCandidateWalkForward,
  evaluateWalkForwardPromotion,
} = require('./round_4_walk_forward_research_lib');
const {
  computeBreadthSnapshot,
  breadthForIndustry,
  buildAblationComparison,
  buildBreadthVariantComparison,
  evaluateRound5Promotion,
  buildCompactSummary,
} = require('./round_5_factor_refinement_lib');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_REGISTRY_FILE = path.join(
  ROOT,
  'config',
  'strategy-candidate-registry-round-5.json',
);

function parseArgs(argv) {
  const options = {
    predictionDate: '',
    cutoff: '',
    maxFiles: 160,
    output: '',
    summaryOutput: '',
    registry: '',
    baseRegistry: '',
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prediction-date') options.predictionDate = argv[++index] || '';
    else if (arg === '--cutoff') options.cutoff = argv[++index] || '';
    else if (arg === '--max-files') options.maxFiles = Number(argv[++index] || 0);
    else if (arg === '--output') options.output = argv[++index] || '';
    else if (arg === '--summary-output') options.summaryOutput = argv[++index] || '';
    else if (arg === '--registry') options.registry = argv[++index] || '';
    else if (arg === '--base-registry') options.baseRegistry = argv[++index] || '';
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function loadRound5Registry(file = DEFAULT_REGISTRY_FILE) {
  const registry = readJson(file, null);
  if (!registry || registry.status !== 'research_only') {
    throw new Error(`Invalid fifth-round research registry: ${file}`);
  }
  const definitions = Array.isArray(registry.candidate_definitions)
    ? registry.candidate_definitions.filter(item => item?.enabled !== false)
    : [];
  if (!definitions.length) throw new Error('Fifth-round registry has no candidate definitions');
  const ids = definitions.map(item => item.candidate_id);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error('Fifth-round registry contains missing or duplicate candidate_id');
  }
  for (const definition of definitions) {
    if (!definition.base_candidate_id) {
      throw new Error(`Base candidate is missing: ${definition.candidate_id}`);
    }
    if (!definition.selector || !definition.promotion_gate) {
      throw new Error(`Selector or promotion gate is missing: ${definition.candidate_id}`);
    }
  }
  return { registry, definitions };
}

function extendedStateDetail(item, crowdingThreshold, weakening) {
  return {
    ...stateDetail(item, crowdingThreshold, weakening),
    breakout_close_above_pct: item.breakout?.close_above_breakout_pct ?? null,
    breakout_level: item.breakout?.breakout_level ?? null,
    pullback_from_high_pct: item.pullback?.pullback_pct ?? null,
    pullback_strength_return_20d_pct: item.pullback?.strength_return_20d_pct ?? null,
  };
}

function candidateSignal(baseSignal, target, definition) {
  if (baseSignal === null || baseSignal === undefined) return null;
  if (baseSignal === false) return false;
  return evaluateSelector(target, definition);
}

function buildRound5ResearchFromContext(
  payload,
  priceContext,
  marginContext,
  baseRegistry,
  round5Registry,
  options = {},
) {
  const resolvedRound1 = { ...ROUND1_OPTIONS, ...options };
  const resolvedRound2 = { ...ROUND2_OPTIONS, ...options };
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const stockByCode = new Map(stocks.map(stock => [String(stock.stock_code || '').trim(), stock]));
  const sourceDates = sourceDatesFromContext(priceContext);
  const minimumHistory = minimumHistoryDays(resolvedRound1, resolvedRound2);
  const eligibleDates = sourceDates.slice(
    minimumHistory - 1,
    Math.max(minimumHistory - 1, sourceDates.length - 5),
  );
  const folds = buildWalkForwardFolds(eligibleDates, round5Registry.walk_forward || {});
  if (!folds.length) throw new Error('Insufficient dates for fifth-round rolling walk-forward folds');

  const dateIndexByCode = indexRowsByDate(priceContext);
  const preferredCode = resolvedRound1.preferredBenchmarkCode || '0050';
  const preferredRows = priceContext.by_code.get(preferredCode) || [];
  const preferredDateIndex = dateIndexByCode.get(preferredCode) || new Map();
  const baseDefinitions = [
    ...(Array.isArray(baseRegistry.candidate_tags) ? baseRegistry.candidate_tags : []),
    ...(Array.isArray(baseRegistry.candidate_strategies) ? baseRegistry.candidate_strategies : []),
  ].filter(item => item.enabled !== false);
  const baseDefinitionById = new Map(baseDefinitions.map(item => [item.candidate_id, item]));
  const definitions = round5Registry.candidate_definitions.filter(item => item.enabled !== false);
  for (const definition of definitions) {
    if (!baseDefinitionById.has(definition.base_candidate_id)) {
      throw new Error(`Unknown base candidate ${definition.base_candidate_id} for ${definition.candidate_id}`);
    }
  }

  const rawEvents = [];
  const rawBaseEvents = [];
  const rawSignalCount = Object.fromEntries(definitions.map(item => [item.candidate_id, 0]));
  const availabilityCount = Object.fromEntries(definitions.map(item => [item.candidate_id, 0]));
  const baseIds = [...new Set(definitions.map(item => item.base_candidate_id))];
  const baseSignalCount = Object.fromEntries(baseIds.map(id => [id, 0]));
  const regimeCounts = { bull: 0, sideways: 0, bear: 0, unknown: 0 };
  const tailOptions = round5Registry.tail_risk || {};
  const breadthOptions = round5Registry.breadth || {};

  for (const date of eligibleDates) {
    const rawRecords = [];
    for (const [code, stock] of stockByCode.entries()) {
      const rows = priceContext.by_code.get(code) || [];
      const index = dateIndexByCode.get(code)?.get(date);
      if (!Number.isInteger(index) || index < minimumHistory - 1 || index + 5 >= rows.length) continue;
      const history = rows.slice(0, index + 1);
      const outcomes = {
        1: forwardReturn(rows, index, 1),
        3: forwardReturn(rows, index, 3),
        5: forwardReturn(rows, index, 5),
      };
      if (![outcomes[1], outcomes[3], outcomes[5]].every(Number.isFinite)) continue;
      const margin = marginFeaturesAt(code, date, marginContext, 5);
      rawRecords.push({
        code,
        stock,
        industry: normalizeIndustry(stock),
        rows,
        index,
        history,
        outcomes,
        margin,
        return20d: periodReturn(history, resolvedRound1.relativeWindow),
        trend: calculateTrendQuality(history, resolvedRound1),
        alignment: calculateBullishAlignment(history, resolvedRound1),
        breakout: calculateVolumeBreakout(history, resolvedRound2),
        pullback: calculatePullbackVolumeContraction(history, resolvedRound2),
        resilience: calculateMarginExitPriceResilience(history, margin, resolvedRound2),
        crowding: calculateMarginCrowdingRaw(history, margin, resolvedRound2),
      });
    }

    const benchmark = benchmarkAtDate(
      rawRecords,
      preferredRows,
      preferredDateIndex.get(date),
      resolvedRound1,
    );
    enrichRelativeStates(rawRecords, benchmark, resolvedRound1);
    enrichLeadershipStates(rawRecords, benchmark, date, resolvedRound1);
    const crowdingThreshold = crowdingThresholdAtDate(rawRecords, resolvedRound2);
    const breadthSnapshot = computeBreadthSnapshot(rawRecords, {
      minimumIndustryPeers: Number(breadthOptions.minimum_industry_peers || 5),
    });
    const futureBenchmark = {
      1: median(rawRecords.map(item => item.outcomes[1])),
      3: median(rawRecords.map(item => item.outcomes[3])),
      5: median(rawRecords.map(item => item.outcomes[5])),
    };
    const regime = classifyMarketRegime(benchmark.marketReturn20d, {
      bullMinReturnPct: Number(round5Registry.market_regime?.bull_min_return_pct ?? 3),
      bearMaxReturnPct: Number(round5Registry.market_regime?.bear_max_return_pct ?? -3),
    });
    regimeCounts[regime] += 1;

    for (const item of rawRecords) {
      item.marketReturn20d = benchmark.marketReturn20d;
      const stateResult = candidateStatesForItem(item, crowdingThreshold, baseRegistry);
      const details = extendedStateDetail(item, crowdingThreshold, stateResult.weakening);
      const risk = computeTrailingRisk(
        item.rows,
        item.index,
        Number(tailOptions.signal_lookback_days || 20),
      );
      const excursion = computeForwardExcursion(
        item.rows,
        item.index,
        Number(tailOptions.outcome_horizon_days || 5),
      );
      const breadth = breadthForIndustry(breadthSnapshot, item.industry);
      const target = {
        market_regime: regime,
        signal: { metrics: details, risk, breadth },
      };

      const baseSignalById = new Map();
      for (const baseId of baseIds) {
        const baseDefinition = baseDefinitionById.get(baseId);
        const baseSignal = signalForDefinition(baseDefinition, stateResult.states);
        baseSignalById.set(baseId, baseSignal);
        if (baseSignal !== true) continue;
        baseSignalCount[baseId] += 1;
        const baseEvent = buildBaseEvent(
          item,
          baseDefinition,
          stateResult.states,
          details,
          risk,
          excursion,
          benchmark,
          futureBenchmark,
          regime,
          date,
        );
        baseEvent.signal.breadth = breadth;
        rawBaseEvents.push(baseEvent);
      }

      for (const definition of definitions) {
        const signal = candidateSignal(
          baseSignalById.get(definition.base_candidate_id),
          target,
          definition,
        );
        if (signal !== null) availabilityCount[definition.candidate_id] += 1;
        if (signal !== true) continue;
        rawSignalCount[definition.candidate_id] += 1;
        const event = buildBaseEvent(
          item,
          definition,
          stateResult.states,
          details,
          risk,
          excursion,
          benchmark,
          futureBenchmark,
          regime,
          date,
        );
        event.base_candidate_id = definition.base_candidate_id;
        event.analysis_role = definition.analysis_role || null;
        event.signal.breadth = breadth;
        event.signal.selector = definition.selector;
        event.signal.allowed_market_regimes = definition.allowed_market_regimes || null;
        rawEvents.push(event);
      }
    }
  }

  const cooldownDays = Math.max(1, Number(round5Registry.cooldown_trading_days || 5));
  const deduplicated = deduplicateEvents(rawEvents, eligibleDates, cooldownDays);
  const baseDeduplicated = deduplicateEvents(rawBaseEvents, eligibleDates, cooldownDays);
  const suppressedCount = Object.fromEntries(definitions.map(item => [item.candidate_id, 0]));
  for (const event of deduplicated.suppressed) suppressedCount[event.candidate_id] += 1;
  const baseIndependentCount = Object.fromEntries(baseIds.map(baseId => [
    baseId,
    baseDeduplicated.kept.filter(event => event.candidate_id === baseId).length,
  ]));

  const summaries = {};
  for (const definition of definitions) {
    const summary = summarizeCandidateWalkForward(
      deduplicated.kept,
      definition,
      folds,
      tailOptions,
    );
    summary.analysis_role = definition.analysis_role || null;
    summary.ablation_group = definition.ablation_group || null;
    summary.removed_condition = definition.removed_condition ?? null;
    const baseEvents = baseDeduplicated.kept.filter(
      event => event.candidate_id === definition.base_candidate_id,
    );
    summary.base_candidate_all = summarizeTailRiskGroup(baseEvents, tailOptions);
    summary.selection_rate_from_base_pct = baseEvents.length
      ? round((summary.all.event_count / baseEvents.length) * 100, 2)
      : null;
    summary.raw_signal_count = rawSignalCount[definition.candidate_id];
    summary.independent_event_count = summary.all.event_count;
    summary.cooldown_suppressed_count = suppressedCount[definition.candidate_id];
    summary.promotion_assessment = evaluateRound5Promotion(
      summary,
      definition,
      evaluateWalkForwardPromotion,
    );
    summaries[definition.candidate_id] = summary;
  }

  const ablationComparison = buildAblationComparison(summaries, definitions);
  const breadthVariantComparison = buildBreadthVariantComparison(summaries, definitions);

  return {
    schema_version: 1,
    research_id: 'round_5_factor_refinement_ablation_breadth_study_v1',
    candidate_registry_id: round5Registry.registry_id,
    candidate_registry_status: round5Registry.status,
    generated_at: new Date().toISOString(),
    cutoff_date: priceContext.cutoff_date,
    source_date_range: [sourceDates[0] || null, sourceDates.at(-1) || null],
    eligible_signal_date_range: [eligibleDates[0] || null, eligibleDates.at(-1) || null],
    eligible_signal_dates: eligibleDates,
    cooldown_trading_days: cooldownDays,
    market_regime_definition: round5Registry.market_regime,
    market_regime_signal_date_count: regimeCounts,
    walk_forward_definition: round5Registry.walk_forward,
    walk_forward_folds: folds.map(fold => ({
      fold_id: fold.fold_id,
      train: fold.train,
      purge_before_validation: fold.purge_before_validation,
      validation: fold.validation,
      purge_before_test: fold.purge_before_test,
      test: fold.test,
    })),
    tail_risk_definition: round5Registry.tail_risk,
    breadth_definition: {
      ...round5Registry.breadth,
      market_and_industry_features_use_signal_date_cross_section_only: true,
    },
    leakage_guard: {
      signal_features_use_dates_lte_signal_date: true,
      breadth_uses_signal_date_cross_section_only: true,
      future_outcomes_are_stored_separately: true,
      outcome_excursions_use_only_post_signal_dates: true,
      candidate_selector_runs_before_candidate_cooldown: true,
      walk_forward_uses_chronological_folds: true,
      walk_forward_purge_days: Number(round5Registry.walk_forward?.purge_days || 0),
      walk_forward_test_windows_overlap: false,
      random_split_used: false,
      direction_reversal_reuses_prior_selector_without_retuning: true,
      formal_strategy_registry_modified: false,
      automatic_formal_promotion_enabled: false,
    },
    source_files: {
      price: priceContext.source_files,
      margin: marginContext.source_files,
      margin_failures: marginContext.failures,
    },
    source_file_count: {
      price: priceContext.source_files.length,
      margin: marginContext.source_files.length,
      margin_failures: marginContext.failures.length,
    },
    candidate_definitions: definitions,
    base_candidate_raw_signal_count: baseSignalCount,
    base_candidate_independent_event_count: baseIndependentCount,
    availability_observation_count: availabilityCount,
    raw_signal_count: rawSignalCount,
    cooldown_suppressed_count: suppressedCount,
    ablation_comparison: ablationComparison,
    breadth_variant_comparison: breadthVariantComparison,
    summaries,
    cooldown_suppressed_events: deduplicated.suppressed,
    events: deduplicated.kept,
  };
}

function generateRound5Research(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || ROOT);
  const predictionDate = compactDate(options.predictionDate) || latestPredictionDate(workspaceRoot);
  if (!predictionDate) throw new Error('No valid prediction summary is available');
  const summaryFile = path.join(workspaceRoot, 'data_predictions', predictionDate, 'summary.json');
  const payload = readJson(summaryFile, null);
  if (!payload || !Array.isArray(payload.stocks)) {
    throw new Error(`Invalid prediction summary: ${summaryFile}`);
  }
  const cutoff = [compactDate(payload.base_trade_date), compactDate(options.cutoff)]
    .filter(Boolean)
    .sort()
    .at(0) || predictionDate;
  const maxFiles = Math.max(80, Number(options.maxFiles) || 160);
  const registryFile = path.resolve(options.registry || path.join(
    workspaceRoot,
    'config',
    'strategy-candidate-registry-round-5.json',
  ));
  const baseRegistryFile = path.resolve(options.baseRegistry || path.join(
    workspaceRoot,
    'config',
    'strategy-candidate-registry.json',
  ));
  const { registry: round5Registry } = loadRound5Registry(registryFile);
  const { registry: baseRegistry } = loadCandidateRegistry(baseRegistryFile);
  const priceContext = loadHistoricalPriceContext(payload, workspaceRoot, cutoff, { maxFiles });
  const earliestDate = sourceDatesFromContext(priceContext)[0] || '';
  const marginContext = loadMarginResearchContext(workspaceRoot, cutoff, earliestDate);
  const result = buildRound5ResearchFromContext(
    payload,
    priceContext,
    marginContext,
    baseRegistry,
    round5Registry,
    { maxFiles },
  );
  const outputFile = path.resolve(options.output || path.join(
    workspaceRoot,
    'data_research',
    'strategy-factors',
    'round-5',
    `${cutoff}.json`,
  ));
  const summaryOutputFile = path.resolve(
    options.summaryOutput || outputFile.replace(/\.json$/i, '.summary.json'),
  );
  const compactSummary = buildCompactSummary(result);
  if (!options.dryRun) {
    writeJsonAtomic(outputFile, result);
    writeJsonAtomic(summaryOutputFile, compactSummary);
  }
  return {
    prediction_date: predictionDate,
    cutoff_date: cutoff,
    output_file: path.relative(workspaceRoot, outputFile).replaceAll(path.sep, '/'),
    summary_file: path.relative(workspaceRoot, summaryOutputFile).replaceAll(path.sep, '/'),
    source_file_count: result.source_file_count,
    walk_forward_fold_count: result.walk_forward_folds.length,
    raw_signal_count: result.raw_signal_count,
    independent_event_count: result.events.length,
    cooldown_suppressed_count: result.cooldown_suppressed_events.length,
    promotion_status: Object.fromEntries(Object.entries(result.summaries).map(([id, summary]) => [
      id,
      summary.promotion_assessment.status,
    ])),
    dry_run: Boolean(options.dryRun),
  };
}

function main(argv = process.argv.slice(2)) {
  const result = generateRound5Research(parseArgs(argv));
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
  parseArgs,
  loadRound5Registry,
  extendedStateDetail,
  candidateSignal,
  buildRound5ResearchFromContext,
  generateRound5Research,
  main,
};
