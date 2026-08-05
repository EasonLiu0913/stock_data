#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_OPTIONS: ROUND1_OPTIONS,
  compactDate,
  readJson,
  round,
  percentile,
  median,
  normalizeIndustry,
  loadHistoricalPriceContext,
  periodReturn,
  dailyReturnMap,
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
  chronologicalSplitMap,
} = require('./generate_round_2_factor_research');
const {
  classifyMarketRegime,
  calculateCrowdingWeakening,
  evaluateExpression,
  deduplicateEvents,
  summarizeCandidates,
  buildCompactSummary,
} = require('./round_3_candidate_research_lib');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_REGISTRY_FILE = path.join(ROOT, 'config', 'strategy-candidate-registry.json');

function parseArgs(argv) {
  const options = {
    predictionDate: '',
    cutoff: '',
    maxFiles: 80,
    output: '',
    summaryOutput: '',
    registry: '',
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
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function latestPredictionDate(workspaceRoot = ROOT) {
  const directory = path.join(workspaceRoot, 'data_predictions');
  if (!fs.existsSync(directory)) return '';
  return fs.readdirSync(directory)
    .filter(name => /^20\d{6}$/.test(name))
    .filter(name => Array.isArray(readJson(path.join(directory, name, 'summary.json'), null)?.stocks))
    .sort()
    .at(-1) || '';
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function loadCandidateRegistry(file = DEFAULT_REGISTRY_FILE) {
  const registry = readJson(file, null);
  if (!registry || registry.status !== 'research_only') {
    throw new Error(`Invalid research-only candidate registry: ${file}`);
  }
  const definitions = [
    ...(Array.isArray(registry.candidate_tags) ? registry.candidate_tags : []),
    ...(Array.isArray(registry.candidate_strategies) ? registry.candidate_strategies : []),
  ].filter(item => item?.enabled !== false);
  const ids = definitions.map(item => item.candidate_id);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error('Candidate registry contains missing or duplicate candidate_id');
  }
  return { registry, definitions };
}

function sourceDatesFromContext(priceContext) {
  return priceContext.source_files
    .map(file => String(file).match(/fubon_(20\d{6})_sma\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();
}

function indexRowsByDate(priceContext) {
  const result = new Map();
  for (const [code, rows] of priceContext.by_code.entries()) {
    result.set(code, new Map(rows.map((row, index) => [row.date, index])));
  }
  return result;
}

function benchmarkAtDate(rawRecords, preferredRows, preferredIndex, options = {}) {
  const marketReturns = rawRecords.map(item => item.return20d).filter(Number.isFinite);
  const preferredHistory = Number.isInteger(preferredIndex)
    ? preferredRows.slice(0, preferredIndex + 1)
    : [];
  const preferred20d = periodReturn(preferredHistory, options.relativeWindow || 20);
  const marketReturn20d = Number.isFinite(preferred20d) ? preferred20d : median(marketReturns);
  const marketSource = Number.isFinite(preferred20d)
    ? options.preferredBenchmarkCode || '0050'
    : Number.isFinite(marketReturn20d) ? 'cross_section_median' : null;
  return { marketReturn20d, marketSource, preferredHistory };
}

function enrichRelativeStates(rawRecords, benchmark, options = {}) {
  const marketMinPeers = Number(options.marketMinPeers || 20);
  const industryMinPeers = Number(options.industryMinPeers || 5);
  const topPercentile = Number(options.relativeTopPercentile ?? 0.8);
  const marketExcessValues = rawRecords
    .map(item => Number.isFinite(item.return20d) && Number.isFinite(benchmark.marketReturn20d)
      ? item.return20d - benchmark.marketReturn20d
      : null)
    .filter(Number.isFinite);
  const marketThreshold = marketExcessValues.length >= marketMinPeers
    ? percentile(marketExcessValues, topPercentile)
    : null;

  const industryGroups = new Map();
  for (const item of rawRecords) {
    if (!item.industry || !Number.isFinite(item.return20d)) continue;
    if (!industryGroups.has(item.industry)) industryGroups.set(item.industry, []);
    industryGroups.get(item.industry).push(item.return20d);
  }
  const industryMedians = new Map();
  for (const [industry, values] of industryGroups.entries()) {
    if (values.length >= industryMinPeers) industryMedians.set(industry, median(values));
  }
  const industryExcessGroups = new Map();
  for (const item of rawRecords) {
    const industryReturn = industryMedians.get(item.industry);
    const excess = Number.isFinite(item.return20d) && Number.isFinite(industryReturn)
      ? item.return20d - industryReturn
      : null;
    item.industryReturn20d = industryReturn;
    item.industryExcess20d = excess;
    if (Number.isFinite(excess)) {
      if (!industryExcessGroups.has(item.industry)) industryExcessGroups.set(item.industry, []);
      industryExcessGroups.get(item.industry).push(excess);
    }
  }
  const industryThresholds = new Map();
  for (const [industry, values] of industryExcessGroups.entries()) {
    if (values.length >= industryMinPeers) {
      industryThresholds.set(industry, percentile(values, topPercentile));
    }
  }

  for (const item of rawRecords) {
    item.marketExcess20d = Number.isFinite(item.return20d) && Number.isFinite(benchmark.marketReturn20d)
      ? item.return20d - benchmark.marketReturn20d
      : null;
    item.marketRelativeAvailable = Number.isFinite(item.marketExcess20d) && Number.isFinite(marketThreshold);
    item.marketRelativePass = item.marketRelativeAvailable
      ? item.marketExcess20d >= marketThreshold
      : null;
    const industryThreshold = industryThresholds.get(item.industry);
    item.industryRelativeAvailable = Number.isFinite(item.industryExcess20d)
      && Number.isFinite(industryThreshold);
    item.industryRelativePass = item.industryRelativeAvailable
      ? item.industryExcess20d >= industryThreshold
      : null;
    item.marketThreshold20d = marketThreshold;
    item.industryThreshold20d = industryThreshold;
  }
}

function enrichLeadershipStates(rawRecords, benchmark, sourceDate, options = {}) {
  const window = Number(options.leadershipWindow || 7);
  const minWins = Number(options.leadershipMinWins || 5);
  const preferredDaily = dailyReturnMap(benchmark.preferredHistory);
  const crossSection = new Map();
  for (const item of rawRecords) {
    item.dailyReturns = dailyReturnMap(item.history);
    for (const [date, value] of item.dailyReturns.entries()) {
      if (date > sourceDate || !Number.isFinite(value)) continue;
      if (!crossSection.has(date)) crossSection.set(date, []);
      crossSection.get(date).push(value);
    }
  }
  const benchmarkDaily = new Map();
  const dates = [...crossSection.keys()].sort().slice(-window);
  for (const date of dates) {
    const preferred = preferredDaily.get(date);
    benchmarkDaily.set(date, Number.isFinite(preferred) ? preferred : median(crossSection.get(date) || []));
  }
  for (const item of rawRecords) {
    const comparisons = dates.map(date => ({
      stock: item.dailyReturns.get(date),
      benchmark: benchmarkDaily.get(date),
    })).filter(pair => Number.isFinite(pair.stock) && Number.isFinite(pair.benchmark));
    item.leadershipAvailable = comparisons.length === window;
    item.leadershipWins = item.leadershipAvailable
      ? comparisons.filter(pair => pair.stock > pair.benchmark).length
      : null;
    item.leadershipPass = item.leadershipAvailable ? item.leadershipWins >= minWins : null;
  }
}

function crowdingThresholdAtDate(rawRecords, options = {}) {
  const values = rawRecords.filter(item => item.crowding.available).map(item => item.crowding.ratio);
  return values.length >= Number(options.crowdingMinPeers || 20)
    ? percentile(values, Number(options.crowdingPercentile ?? 0.9))
    : null;
}

function stateDetail(item, crowdingThreshold, weakening) {
  return {
    price_return_20d_pct: round(item.return20d),
    market_return_20d_pct: round(item.marketReturn20d),
    market_excess_return_20d_pct: round(item.marketExcess20d),
    industry_return_20d_pct: round(item.industryReturn20d),
    industry_excess_return_20d_pct: round(item.industryExcess20d),
    trend_r2: item.trend.r2 ?? null,
    trend_slope_pct_per_day: item.trend.slope_pct_per_day ?? null,
    bullish_alignment: item.alignment.pass,
    leadership_wins_7d: item.leadershipWins,
    breakout_volume_ratio: item.breakout.volume_ratio ?? null,
    pullback_volume_ratio: item.pullback.volume_ratio ?? null,
    margin_change_5d: item.margin.margin_change_5d,
    margin_balance: item.margin.margin_balance,
    margin_crowding_ratio: Number.isFinite(item.crowding.ratio) ? round(item.crowding.ratio) : null,
    margin_crowding_threshold: Number.isFinite(crowdingThreshold) ? round(crowdingThreshold) : null,
    margin_crowding_weakening_price_return_5d_pct: weakening.price_return_5d_pct ?? null,
    margin_crowding_weakening_latest_return_1d_pct: weakening.latest_return_1d_pct ?? null,
    margin_crowding_weakening_sma20_gap_pct: weakening.sma20_gap_pct ?? null,
  };
}

function candidateStatesForItem(item, crowdingThreshold, registry) {
  const crowdingAvailable = item.crowding.available && Number.isFinite(crowdingThreshold);
  const crowdingPass = crowdingAvailable
    ? item.crowding.ratio >= crowdingThreshold && item.crowding.change_5d > 0
    : null;
  const crowdingTag = (registry.candidate_tags || []).find(
    definition => definition.candidate_id === 'margin_crowding_weakening_v2',
  );
  const weakeningRule = crowdingTag?.rule || {};
  const weakening = calculateCrowdingWeakening(
    item.history,
    { available: crowdingAvailable, pass: crowdingPass },
    {
      priceReturn5dLtePct: Number(weakeningRule.price_return_5d_lte_pct ?? -2),
      latestReturn1dLtPct: Number(weakeningRule.latest_return_1d_lt_pct ?? 0),
    },
  );
  const states = {
    technical_volume_breakout_confirmation_v1: item.breakout.pass,
    technical_strong_pullback_volume_contraction_v1: item.pullback.pass,
    margin_exit_price_resilience_v1: item.resilience.pass,
    margin_crowding_risk_v1: crowdingPass,
    technical_trend_quality_20d_v1: item.trend.pass,
    technical_bullish_alignment_v1: item.alignment.pass,
    relative_market_strength_20d_top20_v1: item.marketRelativePass,
    relative_industry_strength_20d_top20_v1: item.industryRelativePass,
    relative_leadership_persistence_7d_v1: item.leadershipPass,
    margin_crowding_weakening_v2: weakening.pass,
  };
  return { states, weakening, crowdingAvailable, crowdingPass };
}

function signalForDefinition(definition, states) {
  if (definition.kind === 'atomic_tag') return states[definition.candidate_id] ?? null;
  return evaluateExpression(definition.expression, states);
}

function buildRound3CandidateResearchFromContext(payload, priceContext, marginContext, registryPayload, options = {}) {
  const resolvedRound1 = { ...ROUND1_OPTIONS, ...options };
  const resolvedRound2 = { ...ROUND2_OPTIONS, ...options };
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const stockByCode = new Map(stocks.map(stock => [String(stock.stock_code || '').trim(), stock]));
  const sourceDates = sourceDatesFromContext(priceContext);
  const minimumHistory = Math.max(
    resolvedRound1.trendWindow,
    resolvedRound1.relativeWindow + 1,
    resolvedRound2.breakoutLookback + 1,
    resolvedRound2.pullbackStrengthWindow + 1,
    resolvedRound2.crowdingVolumeLookback,
  );
  const eligibleDates = sourceDates.slice(
    minimumHistory - 1,
    Math.max(minimumHistory - 1, sourceDates.length - 5),
  );
  const split = chronologicalSplitMap(eligibleDates);
  const dateIndexByCode = indexRowsByDate(priceContext);
  const preferredCode = resolvedRound1.preferredBenchmarkCode || '0050';
  const preferredRows = priceContext.by_code.get(preferredCode) || [];
  const preferredDateIndex = dateIndexByCode.get(preferredCode) || new Map();
  const definitions = [
    ...(registryPayload.candidate_tags || []),
    ...(registryPayload.candidate_strategies || []),
  ].filter(item => item.enabled !== false);
  const rawEvents = [];
  const rawSignalCount = Object.fromEntries(definitions.map(item => [item.candidate_id, 0]));
  const availabilityCount = Object.fromEntries(definitions.map(item => [item.candidate_id, 0]));
  const regimeCounts = { bull: 0, sideways: 0, bear: 0, unknown: 0 };

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
    const futureBenchmark = {
      1: median(rawRecords.map(item => item.outcomes[1])),
      3: median(rawRecords.map(item => item.outcomes[3])),
      5: median(rawRecords.map(item => item.outcomes[5])),
    };
    const regime = classifyMarketRegime(benchmark.marketReturn20d, {
      bullMinReturnPct: Number(registryPayload.market_regime?.bull_min_return_pct ?? 3),
      bearMaxReturnPct: Number(registryPayload.market_regime?.bear_max_return_pct ?? -3),
    });
    regimeCounts[regime] += 1;

    for (const item of rawRecords) {
      item.marketReturn20d = benchmark.marketReturn20d;
      const stateResult = candidateStatesForItem(item, crowdingThreshold, registryPayload);
      const details = stateDetail(item, crowdingThreshold, stateResult.weakening);
      const trueStates = Object.entries(stateResult.states)
        .filter(([, value]) => value === true)
        .map(([id]) => id)
        .sort();
      const unknownStates = Object.entries(stateResult.states)
        .filter(([, value]) => value === null || value === undefined)
        .map(([id]) => id)
        .sort();
      for (const definition of definitions) {
        const signal = signalForDefinition(definition, stateResult.states);
        if (signal !== null) availabilityCount[definition.candidate_id] += 1;
        if (signal !== true) continue;
        rawSignalCount[definition.candidate_id] += 1;
        rawEvents.push({
          candidate_id: definition.candidate_id,
          candidate_label: definition.label,
          candidate_kind: definition.kind,
          objective: definition.objective,
          split: split.map.get(date) || 'train',
          market_regime: regime,
          market_regime_return_20d_pct: round(benchmark.marketReturn20d),
          market_regime_source: benchmark.marketSource,
          signal_date: date,
          stock_code: item.code,
          stock_name: item.stock.stock_name || '',
          industry: item.industry,
          signal: {
            matched_state_ids: trueStates,
            unknown_state_ids: unknownStates,
            metrics: details,
          },
          outcome: {
            forward_return_1d_pct: round(item.outcomes[1]),
            forward_return_3d_pct: round(item.outcomes[3]),
            forward_return_5d_pct: round(item.outcomes[5]),
            benchmark_return_1d_pct: round(futureBenchmark[1]),
            benchmark_return_3d_pct: round(futureBenchmark[3]),
            benchmark_return_5d_pct: round(futureBenchmark[5]),
            forward_excess_return_1d_pct: round(item.outcomes[1] - futureBenchmark[1]),
            forward_excess_return_3d_pct: round(item.outcomes[3] - futureBenchmark[3]),
            forward_excess_return_5d_pct: round(item.outcomes[5] - futureBenchmark[5]),
            outcome_end_date: item.rows[item.index + 5]?.date || null,
          },
        });
      }
    }
  }

  const cooldownDays = Math.max(1, Number(registryPayload.cooldown_trading_days || 5));
  const deduplicated = deduplicateEvents(rawEvents, eligibleDates, cooldownDays);
  const suppressedCount = Object.fromEntries(definitions.map(item => [item.candidate_id, 0]));
  for (const event of deduplicated.suppressed) suppressedCount[event.candidate_id] += 1;
  const summaries = summarizeCandidates(
    deduplicated.kept,
    definitions,
    rawSignalCount,
    suppressedCount,
  );
  return {
    schema_version: 1,
    research_id: 'round_3_independent_regime_candidate_study_v1',
    candidate_registry_id: registryPayload.registry_id,
    candidate_registry_status: registryPayload.status,
    generated_at: new Date().toISOString(),
    cutoff_date: priceContext.cutoff_date,
    source_date_range: [sourceDates[0] || null, sourceDates.at(-1) || null],
    eligible_signal_date_range: [eligibleDates[0] || null, eligibleDates.at(-1) || null],
    eligible_signal_dates: eligibleDates,
    chronological_splits: split.boundaries,
    cooldown_trading_days: cooldownDays,
    market_regime_definition: registryPayload.market_regime,
    market_regime_signal_date_count: regimeCounts,
    leakage_guard: {
      signal_features_use_dates_lte_signal_date: true,
      future_outcomes_are_stored_separately: true,
      latest_outcome_horizon_days: 5,
      chronological_split_used: true,
      random_split_used: false,
      formal_strategy_registry_modified: false,
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
    availability_observation_count: availabilityCount,
    raw_signal_count: rawSignalCount,
    cooldown_suppressed_count: suppressedCount,
    summaries,
    cooldown_suppressed_events: deduplicated.suppressed,
    events: deduplicated.kept,
  };
}

function generateRound3CandidateResearch(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || ROOT);
  const predictionDate = compactDate(options.predictionDate) || latestPredictionDate(workspaceRoot);
  if (!predictionDate) throw new Error('No valid prediction summary is available');
  const summaryFile = path.join(workspaceRoot, 'data_predictions', predictionDate, 'summary.json');
  const payload = readJson(summaryFile, null);
  if (!payload || !Array.isArray(payload.stocks)) throw new Error(`Invalid prediction summary: ${summaryFile}`);
  const cutoff = [compactDate(payload.base_trade_date), compactDate(options.cutoff)]
    .filter(Boolean)
    .sort()
    .at(0) || predictionDate;
  const maxFiles = Math.max(40, Number(options.maxFiles) || 80);
  const registryFile = path.resolve(options.registry || path.join(
    workspaceRoot,
    'config',
    'strategy-candidate-registry.json',
  ));
  const { registry } = loadCandidateRegistry(registryFile);
  const priceContext = loadHistoricalPriceContext(payload, workspaceRoot, cutoff, { maxFiles });
  const earliestDate = sourceDatesFromContext(priceContext)[0] || '';
  const marginContext = loadMarginResearchContext(workspaceRoot, cutoff, earliestDate);
  const result = buildRound3CandidateResearchFromContext(
    payload,
    priceContext,
    marginContext,
    registry,
    { maxFiles },
  );
  const outputFile = path.resolve(options.output || path.join(
    workspaceRoot,
    'data_research',
    'strategy-factors',
    'round-3',
    `${cutoff}.json`,
  ));
  const summaryOutputFile = path.resolve(options.summaryOutput || outputFile.replace(/\.json$/i, '.summary.json'));
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
  const result = generateRound3CandidateResearch(parseArgs(argv));
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
  buildRound3CandidateResearchFromContext,
  generateRound3CandidateResearch,
  main,
};
