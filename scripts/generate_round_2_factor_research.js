#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseMarginCsv } = require('./oversold_rebound_research_lib');
const {
  DEFAULT_OPTIONS,
  compactDate,
  finiteNumber,
  readJson,
  round,
  percentile,
  median,
  loadHistoricalPriceContext,
  calculateVolumeBreakout,
  calculatePullbackVolumeContraction,
  calculateMarginExitPriceResilience,
  calculateMarginCrowdingRaw,
} = require('./historical_factor_research_round_2');

const ROOT = path.resolve(__dirname, '..');
const FACTORS = Object.freeze([
  { id: 'volume_breakout_confirmation_v1', label: '放量突破確認' },
  { id: 'strong_pullback_volume_contraction_v1', label: '強勢股回檔量縮' },
  { id: 'margin_exit_price_resilience_v1', label: '融資退場但股價抗跌' },
  { id: 'margin_crowding_risk_v1', label: '融資擁擠風險' },
]);

function parseArgs(argv) {
  const options = {
    predictionDate: '',
    cutoff: '',
    maxFiles: 80,
    output: '',
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prediction-date') options.predictionDate = argv[++index] || '';
    else if (arg === '--cutoff') options.cutoff = argv[++index] || '';
    else if (arg === '--max-files') options.maxFiles = Number(argv[++index] || 0);
    else if (arg === '--output') options.output = argv[++index] || '';
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

function marginFileNames(workspaceRoot) {
  const directory = path.join(workspaceRoot, 'data_twse_margin_balance');
  const manifest = readJson(path.join(directory, 'files.json'), null);
  let names = Array.isArray(manifest) ? [...manifest] : [];
  try {
    names.push(...fs.readdirSync(directory));
  } catch {
    return names;
  }
  return [...new Set(names)];
}

function loadMarginResearchContext(workspaceRoot, cutoff, earliestDate = '') {
  const normalizedCutoff = compactDate(cutoff);
  const normalizedEarliest = compactDate(earliestDate);
  const rows = marginFileNames(workspaceRoot)
    .map(file => ({
      file,
      date: String(file).match(/^(20\d{6})_twse_margin_balance\.csv$/)?.[1] || '',
    }))
    .filter(item => item.date)
    .filter(item => !normalizedCutoff || item.date <= normalizedCutoff)
    .filter(item => !normalizedEarliest || item.date >= normalizedEarliest)
    .sort((left, right) => left.date.localeCompare(right.date));
  const unique = [...new Map(rows.map(item => [item.file, item])).values()];
  const maps = new Map();
  const failures = [];
  for (const item of unique) {
    try {
      const text = fs.readFileSync(path.join(workspaceRoot, 'data_twse_margin_balance', item.file), 'utf8');
      maps.set(item.date, parseMarginCsv(text));
    } catch (error) {
      failures.push({ date: item.date, file: item.file, error: error.message });
    }
  }
  return {
    dates: [...maps.keys()].sort(),
    maps,
    source_files: unique.map(item => `data_twse_margin_balance/${item.file}`),
    failures,
  };
}

function marginFeaturesAt(code, date, marginContext, periods = 5) {
  const index = marginContext.dates.indexOf(date);
  if (index < 0) return { margin_change_5d: null, margin_balance: null, valid_days: 0 };
  const selectedDates = marginContext.dates.slice(Math.max(0, index - periods + 1), index + 1);
  const current = marginContext.maps.get(date)?.get(code) || null;
  const changes = selectedDates.map(itemDate => finiteNumber(
    marginContext.maps.get(itemDate)?.get(code)?.margin_change,
  ));
  const valid = changes.filter(Number.isFinite);
  return {
    margin_change_5d: selectedDates.length === periods && valid.length === periods
      ? valid.reduce((sum, value) => sum + value, 0)
      : null,
    margin_balance: finiteNumber(current?.margin_balance),
    valid_days: valid.length,
  };
}

function forwardReturn(rows, index, horizon) {
  const current = rows[index]?.close;
  const future = rows[index + horizon]?.close;
  if (![current, future].every(value => Number.isFinite(value) && value > 0)) return null;
  return ((future / current) - 1) * 100;
}

function average(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function rate(values, predicate) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? (usable.filter(predicate).length / usable.length) * 100 : null;
}

function chronologicalSplitMap(dates) {
  const unique = [...new Set(dates)].sort();
  const trainEnd = Math.max(1, Math.floor(unique.length * 0.6));
  const validationEnd = Math.max(trainEnd, Math.floor(unique.length * 0.8));
  const map = new Map();
  unique.forEach((date, index) => {
    map.set(date, index < trainEnd ? 'train' : index < validationEnd ? 'validation' : 'test');
  });
  return {
    map,
    boundaries: {
      train: unique.length ? [unique[0], unique[Math.max(0, trainEnd - 1)]] : [null, null],
      validation: validationEnd > trainEnd ? [unique[trainEnd], unique[validationEnd - 1]] : [null, null],
      test: unique.length > validationEnd ? [unique[validationEnd], unique.at(-1)] : [null, null],
    },
  };
}

function summarizeEventGroup(events) {
  const returns1d = events.map(item => item.outcome.forward_return_1d_pct);
  const returns3d = events.map(item => item.outcome.forward_return_3d_pct);
  const returns5d = events.map(item => item.outcome.forward_return_5d_pct);
  const excess5d = events.map(item => item.outcome.forward_excess_return_5d_pct);
  return {
    event_count: events.length,
    stock_count: new Set(events.map(item => item.stock_code)).size,
    average_return_1d_pct: round(average(returns1d)),
    average_return_3d_pct: round(average(returns3d)),
    average_return_5d_pct: round(average(returns5d)),
    median_return_5d_pct: round(median(returns5d)),
    positive_return_5d_rate_pct: round(rate(returns5d, value => value > 0), 2),
    rebound_4pct_5d_rate_pct: round(rate(returns5d, value => value >= 4), 2),
    average_excess_return_5d_pct: round(average(excess5d)),
    positive_excess_return_5d_rate_pct: round(rate(excess5d, value => value > 0), 2),
  };
}

function summarizeEvents(events) {
  const result = {};
  for (const factor of FACTORS) {
    result[factor.id] = {
      factor_id: factor.id,
      label: factor.label,
      all: summarizeEventGroup(events.filter(item => item.factor_id === factor.id)),
      train: summarizeEventGroup(events.filter(item => item.factor_id === factor.id && item.split === 'train')),
      validation: summarizeEventGroup(events.filter(item => item.factor_id === factor.id && item.split === 'validation')),
      test: summarizeEventGroup(events.filter(item => item.factor_id === factor.id && item.split === 'test')),
    };
  }
  return result;
}

function buildRound2EventResearchFromContext(payload, priceContext, marginContext, options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const stockByCode = new Map(stocks.map(stock => [String(stock.stock_code || '').trim(), stock]));
  const sourceDates = priceContext.source_files
    .map(file => String(file).match(/fubon_(20\d{6})_sma\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();
  const minimumHistory = Math.max(
    resolved.breakoutLookback + 1,
    resolved.pullbackStrengthWindow + 1,
    resolved.crowdingVolumeLookback,
  );
  const eligibleDates = sourceDates.slice(minimumHistory - 1, Math.max(minimumHistory - 1, sourceDates.length - 5));
  const split = chronologicalSplitMap(eligibleDates);
  const events = [];
  const availability = Object.fromEntries(FACTORS.map(factor => [factor.id, 0]));
  const signalCounts = Object.fromEntries(FACTORS.map(factor => [factor.id, 0]));
  const dateIndexByCode = new Map();
  for (const [code, rows] of priceContext.by_code.entries()) {
    dateIndexByCode.set(code, new Map(rows.map((row, index) => [row.date, index])));
  }

  for (const date of eligibleDates) {
    const rawRecords = [];
    for (const [code, stock] of stockByCode.entries()) {
      const rows = priceContext.by_code.get(code) || [];
      const index = dateIndexByCode.get(code)?.get(date);
      if (!Number.isInteger(index) || index < minimumHistory - 1 || index + 5 >= rows.length) continue;
      const history = rows.slice(0, index + 1);
      const margin = marginFeaturesAt(code, date, marginContext, 5);
      const outcomes = {
        1: forwardReturn(rows, index, 1),
        3: forwardReturn(rows, index, 3),
        5: forwardReturn(rows, index, 5),
      };
      if (![outcomes[1], outcomes[3], outcomes[5]].every(Number.isFinite)) continue;
      rawRecords.push({
        code,
        stock,
        rows,
        index,
        history,
        margin,
        outcomes,
        breakout: calculateVolumeBreakout(history, resolved),
        pullback: calculatePullbackVolumeContraction(history, resolved),
        resilience: calculateMarginExitPriceResilience(history, margin, resolved),
        crowding: calculateMarginCrowdingRaw(history, margin, resolved),
      });
    }

    const crowdingValues = rawRecords.filter(item => item.crowding.available).map(item => item.crowding.ratio);
    const crowdingThreshold = crowdingValues.length >= resolved.crowdingMinPeers
      ? percentile(crowdingValues, resolved.crowdingPercentile)
      : null;
    const benchmark = {
      1: median(rawRecords.map(item => item.outcomes[1])),
      3: median(rawRecords.map(item => item.outcomes[3])),
      5: median(rawRecords.map(item => item.outcomes[5])),
    };

    for (const item of rawRecords) {
      const factorStates = [
        { factor: FACTORS[0], available: item.breakout.available, pass: item.breakout.pass, detail: item.breakout },
        { factor: FACTORS[1], available: item.pullback.available, pass: item.pullback.pass, detail: item.pullback },
        { factor: FACTORS[2], available: item.resilience.available, pass: item.resilience.pass, detail: item.resilience },
        {
          factor: FACTORS[3],
          available: item.crowding.available && Number.isFinite(crowdingThreshold),
          pass: item.crowding.available && Number.isFinite(crowdingThreshold)
            ? item.crowding.ratio >= crowdingThreshold && item.crowding.change_5d > 0
            : null,
          detail: {
            ...item.crowding,
            crowding_threshold: crowdingThreshold,
          },
        },
      ];
      for (const state of factorStates) {
        if (state.available) availability[state.factor.id] += 1;
        if (state.pass !== true) continue;
        signalCounts[state.factor.id] += 1;
        events.push({
          factor_id: state.factor.id,
          factor_label: state.factor.label,
          split: split.map.get(date) || 'train',
          signal_date: date,
          stock_code: item.code,
          stock_name: item.stock.stock_name || '',
          industry: item.stock.industry || item.stock.industry_name || '',
          signal: Object.fromEntries(Object.entries(state.detail)
            .filter(([key]) => !['available', 'pass'].includes(key))
            .map(([key, value]) => [key, Number.isFinite(value) ? round(value) : value])),
          outcome: {
            forward_return_1d_pct: round(item.outcomes[1]),
            forward_return_3d_pct: round(item.outcomes[3]),
            forward_return_5d_pct: round(item.outcomes[5]),
            benchmark_return_1d_pct: round(benchmark[1]),
            benchmark_return_3d_pct: round(benchmark[3]),
            benchmark_return_5d_pct: round(benchmark[5]),
            forward_excess_return_1d_pct: round(item.outcomes[1] - benchmark[1]),
            forward_excess_return_3d_pct: round(item.outcomes[3] - benchmark[3]),
            forward_excess_return_5d_pct: round(item.outcomes[5] - benchmark[5]),
            outcome_end_date: item.rows[item.index + 5]?.date || null,
          },
        });
      }
    }
  }

  events.sort((left, right) => left.signal_date.localeCompare(right.signal_date)
    || left.factor_id.localeCompare(right.factor_id)
    || left.stock_code.localeCompare(right.stock_code));
  return {
    schema_version: 1,
    research_id: 'round_2_volume_margin_factor_event_study_v1',
    generated_at: new Date().toISOString(),
    cutoff_date: priceContext.cutoff_date,
    source_date_range: [sourceDates[0] || null, sourceDates.at(-1) || null],
    eligible_signal_date_range: [eligibleDates[0] || null, eligibleDates.at(-1) || null],
    chronological_splits: split.boundaries,
    leakage_guard: {
      signal_features_use_dates_lte_signal_date: true,
      outcomes_are_stored_separately: true,
      latest_outcome_horizon_days: 5,
      random_split_used: false,
    },
    thresholds: {
      breakout_lookback: resolved.breakoutLookback,
      breakout_volume_ratio_min: resolved.breakoutVolumeRatioMin,
      pullback_strength_window: resolved.pullbackStrengthWindow,
      pullback_strength_return_min_pct: resolved.pullbackStrengthReturnMinPct,
      pullback_depth_range_pct: [resolved.pullbackMinPct, resolved.pullbackMaxPct],
      pullback_volume_ratio_max: resolved.pullbackVolumeRatioMax,
      margin_resilience_return_min_pct: resolved.marginResilienceReturnMinPct,
      margin_resilience_sma20_tolerance_pct: resolved.marginResilienceSma20TolerancePct,
      margin_crowding_percentile: resolved.crowdingPercentile * 100,
      margin_crowding_min_peers: resolved.crowdingMinPeers,
    },
    source_files: {
      price: priceContext.source_files,
      margin: marginContext.source_files,
      margin_failures: marginContext.failures,
    },
    availability_observation_count: availability,
    signal_count: signalCounts,
    summaries: summarizeEvents(events),
    events,
  };
}

function generateRound2FactorResearch(options = {}) {
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
  const maxFiles = Math.max(30, Number(options.maxFiles) || 80);
  const priceContext = loadHistoricalPriceContext(payload, workspaceRoot, cutoff, { maxFiles });
  const earliestDate = priceContext.source_files
    .map(file => String(file).match(/fubon_(20\d{6})_sma\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort()[0] || '';
  const marginContext = loadMarginResearchContext(workspaceRoot, cutoff, earliestDate);
  const result = buildRound2EventResearchFromContext(payload, priceContext, marginContext, options);
  const outputFile = path.resolve(options.output || path.join(
    workspaceRoot,
    'data_research',
    'strategy-factors',
    'round-2',
    `${cutoff}.json`,
  ));
  if (!options.dryRun) writeJsonAtomic(outputFile, result);
  return {
    prediction_date: predictionDate,
    cutoff_date: cutoff,
    output_file: path.relative(workspaceRoot, outputFile).replaceAll(path.sep, '/'),
    event_count: result.events.length,
    signal_count: result.signal_count,
    dry_run: Boolean(options.dryRun),
  };
}

function main(argv = process.argv.slice(2)) {
  const result = generateRound2FactorResearch(parseArgs(argv));
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
  FACTORS,
  parseArgs,
  latestPredictionDate,
  writeJsonAtomic,
  marginFileNames,
  loadMarginResearchContext,
  marginFeaturesAt,
  forwardReturn,
  average,
  rate,
  chronologicalSplitMap,
  summarizeEventGroup,
  summarizeEvents,
  buildRound2EventResearchFromContext,
  generateRound2FactorResearch,
  main,
};
