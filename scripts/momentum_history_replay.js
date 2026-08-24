'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { calculateMomentumFeatures, MOMENTUM_MODEL_VERSION } = require('./momentum_tag_features');
const { rowForFileDate } = require('./historical_factor_research');

const HISTORY_SCHEMA_VERSION = 1;
const REPLAY_SCHEMA_VERSION = 1;
const DEFAULT_REPLAY_HORIZONS = [1, 3, 5];

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

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function modelDirectory(workspaceRoot, family, version = MOMENTUM_MODEL_VERSION) {
  return path.join(workspaceRoot, 'data_prediction_analysis', family, `v${version}`);
}

function historyFile(workspaceRoot, signalDate, version = MOMENTUM_MODEL_VERSION) {
  return path.join(modelDirectory(workspaceRoot, 'momentum-history', version), `${signalDate}.json`);
}

function replayFile(workspaceRoot, signalDate, version = MOMENTUM_MODEL_VERSION) {
  return path.join(modelDirectory(workspaceRoot, 'momentum-replay', version), `${signalDate}.json`);
}

function listHistoryDates(workspaceRoot, beforeDate = '', version = MOMENTUM_MODEL_VERSION) {
  const directory = modelDirectory(workspaceRoot, 'momentum-history', version);
  let names = [];
  try { names = fs.readdirSync(directory); } catch { return []; }
  const cutoff = compactDate(beforeDate);
  return names
    .map(name => name.match(/^(20\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .filter(date => !cutoff || date < cutoff)
    .sort();
}

function previousHistory(workspaceRoot, signalDate, version = MOMENTUM_MODEL_VERSION) {
  const previousDate = listHistoryDates(workspaceRoot, signalDate, version).at(-1) || '';
  if (!previousDate) return { signal_date: null, by_code: new Map() };
  const payload = readJson(historyFile(workspaceRoot, previousDate, version), null);
  const byCode = new Map((payload?.stocks || []).map(stock => [String(stock.stock_code), stock]));
  return { signal_date: previousDate, by_code: byCode, payload };
}

function signalDateFromPayload(payload, fallbackDate = '') {
  return compactDate(payload?.base_trade_date)
    || compactDate(payload?.signal_date)
    || compactDate(payload?.forecast_date)
    || compactDate(fallbackDate);
}

function injectPreviousScores(stocks, previous) {
  return (stocks || []).map(stock => {
    const code = String(stock.stock_code || '').trim();
    const prior = previous?.by_code?.get(code);
    const previousScore = Number(prior?.momentum_score);
    return {
      ...stock,
      strategy_tag_features: {
        ...(stock.strategy_tag_features || {}),
        previous_momentum_score: Number.isFinite(previousScore) ? previousScore : null,
      },
    };
  });
}

function momentumTagIds(stock) {
  return (stock.atomic_tags || []).filter(id => String(id).startsWith('momentum_'));
}

function buildMomentumHistory(payload, options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const signalDate = signalDateFromPayload(payload, options.signalDate);
  if (!signalDate) throw new Error('Momentum history requires a signal/base trade date');
  const previous = options.previous || previousHistory(workspaceRoot, signalDate, MOMENTUM_MODEL_VERSION);
  const enrichedStocks = injectPreviousScores(payload.stocks || [], previous);
  const stocks = enrichedStocks.map(stock => {
    const features = calculateMomentumFeatures(stock);
    return {
      stock_code: String(stock.stock_code || ''),
      stock_name: stock.stock_name || '',
      industry: stock.industry || stock.industry_name || '',
      momentum_model_version: MOMENTUM_MODEL_VERSION,
      momentum_score: features.momentum_score,
      momentum_grade: features.momentum_grade,
      momentum_previous_score: features.momentum_previous_score,
      momentum_acceleration: features.momentum_acceleration,
      component_scores: {
        price: features.momentum_price_score,
        volume: features.momentum_volume_score,
        trend: features.momentum_trend_score,
        chip: features.momentum_chip_score,
        breakout: features.momentum_breakout_score,
      },
      facts: {
        price_volume_sync: features.momentum_price_volume_sync,
        chip_sync: features.momentum_chip_sync,
        breakout: features.momentum_breakout,
        overheated: features.momentum_overheated,
        distribution_risk: features.momentum_distribution_risk,
      },
      momentum_inputs: features.momentum_inputs,
      momentum_tags: momentumTagIds(stock),
    };
  });
  const gradeCounts = { A: 0, B: 0, C: 0, none: 0 };
  for (const stock of stocks) gradeCounts[stock.momentum_grade || 'none'] += 1;
  return {
    schema_version: HISTORY_SCHEMA_VERSION,
    momentum_model_version: MOMENTUM_MODEL_VERSION,
    signal_date: signalDate,
    forecast_date: compactDate(payload.forecast_date) || null,
    previous_signal_date: previous.signal_date || null,
    generated_at: options.generatedAt || new Date().toISOString(),
    source_registry_id: payload.strategy_snapshot_metadata?.registry_id || payload.registry_id || null,
    source_registry_fingerprint: payload.strategy_snapshot_metadata?.registry_fingerprint || payload.registry_fingerprint || null,
    stock_count: stocks.length,
    grade_counts: gradeCounts,
    stocks,
  };
}

function updateManifest(workspaceRoot, family, payload, version = MOMENTUM_MODEL_VERSION) {
  const directory = modelDirectory(workspaceRoot, family, version);
  const file = path.join(directory, 'manifest.json');
  const manifest = readJson(file, {
    schema_version: 1,
    momentum_model_version: version,
    updated_at: null,
    dates: {},
  });
  const signalDate = compactDate(payload.signal_date);
  manifest.dates[signalDate] = {
    file: `${signalDate}.json`,
    generated_at: payload.generated_at,
    stock_count: payload.stock_count,
    completed_horizon: payload.completed_horizon ?? null,
  };
  manifest.updated_at = new Date().toISOString();
  writeJsonAtomic(file, manifest);
  return file;
}

function persistMomentumHistory(payload, options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const history = buildMomentumHistory(payload, { ...options, workspaceRoot });
  const file = historyFile(workspaceRoot, history.signal_date, history.momentum_model_version);
  if (!options.dryRun) {
    writeJsonAtomic(file, history);
    updateManifest(workspaceRoot, 'momentum-history', history, history.momentum_model_version);
  }
  return { history, file };
}

function listSmaPriceFiles(workspaceRoot, fromDate = '', maxForwardFiles = 12) {
  const directory = path.join(workspaceRoot, 'data_fubon');
  const manifest = readJson(path.join(directory, 'files.json'), null);
  let names = Array.isArray(manifest) ? [...manifest] : [];
  try { names.push(...fs.readdirSync(directory)); } catch {}
  const start = compactDate(fromDate);
  const rows = names
    .map(file => ({ file, date: String(file).match(/^fubon_(20\d{6})_sma\.json$/)?.[1] || '' }))
    .filter(item => item.date)
    .filter(item => !start || item.date >= start)
    .sort((left, right) => left.date.localeCompare(right.date));
  return [...new Map(rows.map(item => [item.file, item])).values()].slice(0, maxForwardFiles);
}

function loadForwardPriceRows(workspaceRoot, history, maxForwardFiles = 12) {
  const codes = new Set((history.stocks || []).map(stock => String(stock.stock_code)));
  const byCode = new Map([...codes].map(code => [code, []]));
  const files = listSmaPriceFiles(workspaceRoot, history.signal_date, maxForwardFiles);
  for (const item of files) {
    const source = readJson(path.join(workspaceRoot, 'data_fubon', item.file), null);
    if (!source || typeof source !== 'object') continue;
    for (const code of codes) {
      const row = rowForFileDate(source[code], item.date, item.date);
      if (row?.date === item.date) byCode.get(code).push(row);
    }
  }
  for (const [code, rows] of byCode.entries()) {
    byCode.set(code, [...new Map(rows.map(row => [row.date, row])).values()]
      .sort((left, right) => left.date.localeCompare(right.date)));
  }
  return { files, by_code: byCode };
}

function horizonOutcome(rows, signalDate, horizon) {
  const signalIndex = rows.findIndex(row => row.date === signalDate);
  if (signalIndex < 0) return null;
  const signal = rows[signalIndex];
  const future = rows.slice(signalIndex + 1, signalIndex + 1 + horizon);
  if (future.length < horizon || !Number.isFinite(signal.close) || signal.close <= 0) return null;
  const target = future[horizon - 1];
  const highs = future.map(row => Number.isFinite(row.high) ? row.high : row.close).filter(Number.isFinite);
  const lows = future.map(row => Number.isFinite(row.low) ? row.low : row.close).filter(Number.isFinite);
  return {
    date: target.date,
    return_pct: round(((target.close / signal.close) - 1) * 100),
    max_gain_pct: highs.length ? round(((Math.max(...highs) / signal.close) - 1) * 100) : null,
    max_drawdown_pct: lows.length ? round(((Math.min(...lows) / signal.close) - 1) * 100) : null,
  };
}

function buildMomentumReplay(history, priceContext, options = {}) {
  const horizons = options.horizons || DEFAULT_REPLAY_HORIZONS;
  let completedHorizon = 0;
  const stocks = (history.stocks || []).map(stock => {
    const rows = priceContext.by_code.get(String(stock.stock_code)) || [];
    const outcomes = {};
    for (const horizon of horizons) {
      const result = horizonOutcome(rows, history.signal_date, horizon);
      outcomes[`t_plus_${horizon}`] = result;
      if (result) completedHorizon = Math.max(completedHorizon, horizon);
    }
    const day1 = outcomes.t_plus_1;
    const day5 = outcomes.t_plus_5;
    return {
      stock_code: stock.stock_code,
      stock_name: stock.stock_name,
      momentum_score: stock.momentum_score,
      momentum_grade: stock.momentum_grade,
      momentum_acceleration: stock.momentum_acceleration,
      momentum_tags: stock.momentum_tags || [],
      outcomes,
      reached_plus_4_pct_5d: day5?.max_gain_pct != null ? day5.max_gain_pct >= 4 : null,
      reached_plus_7_pct_5d: day5?.max_gain_pct != null ? day5.max_gain_pct >= 7 : null,
      reached_plus_10_pct_5d: day5?.max_gain_pct != null ? day5.max_gain_pct >= 10 : null,
      next_day_weakening: day1?.return_pct != null ? day1.return_pct <= -2 : null,
    };
  });
  const available = stocks.filter(stock => stock.outcomes.t_plus_1).length;
  return {
    schema_version: REPLAY_SCHEMA_VERSION,
    momentum_model_version: history.momentum_model_version,
    signal_date: history.signal_date,
    generated_at: options.generatedAt || new Date().toISOString(),
    completed_horizon: completedHorizon,
    stock_count: stocks.length,
    available_t_plus_1_count: available,
    source_price_files: priceContext.files.map(item => `data_fubon/${item.file}`),
    stocks,
  };
}

function persistMomentumReplay(workspaceRoot, history, options = {}) {
  const priceContext = loadForwardPriceRows(workspaceRoot, history, options.maxForwardFiles || 12);
  const replay = buildMomentumReplay(history, priceContext, options);
  const file = replayFile(workspaceRoot, history.signal_date, history.momentum_model_version);
  if (!options.dryRun) {
    writeJsonAtomic(file, replay);
    updateManifest(workspaceRoot, 'momentum-replay', replay, history.momentum_model_version);
  }
  return { replay, file };
}

function refreshRecentReplays(workspaceRoot, options = {}) {
  const version = options.version || MOMENTUM_MODEL_VERSION;
  const dates = listHistoryDates(workspaceRoot, '', version).slice(-(options.lookbackDates || 10));
  const results = [];
  for (const date of dates) {
    const history = readJson(historyFile(workspaceRoot, date, version), null);
    if (!history?.stocks) continue;
    const result = persistMomentumReplay(workspaceRoot, history, options);
    results.push({ signal_date: date, completed_horizon: result.replay.completed_horizon, file: result.file });
  }
  return results;
}

module.exports = {
  HISTORY_SCHEMA_VERSION,
  REPLAY_SCHEMA_VERSION,
  DEFAULT_REPLAY_HORIZONS,
  compactDate,
  readJson,
  writeJsonAtomic,
  round,
  modelDirectory,
  historyFile,
  replayFile,
  listHistoryDates,
  previousHistory,
  signalDateFromPayload,
  injectPreviousScores,
  buildMomentumHistory,
  persistMomentumHistory,
  listSmaPriceFiles,
  loadForwardPriceRows,
  horizonOutcome,
  buildMomentumReplay,
  persistMomentumReplay,
  refreshRecentReplays,
};
