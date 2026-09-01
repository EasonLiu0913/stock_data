#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getDailyPrice } = require('./lib/stock_price_provider');

const ROOT = path.resolve(__dirname, '..');
const FREEZE_PATH = 'data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json';
const OUTPUT_PATH = 'data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json';
const EXPECTED_FREEZE_ID = 'institutional-accumulation-development-sample-freeze-v1';
const EXPECTED_FREEZE_SHA256 = '66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b';
const OUTCOME_ID = 'institutional-accumulation-outcome-opening-v1';
const PROTECTED_STOCK = '2454';
const HORIZONS = [5, 10, 20, 40];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256Bytes(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function semanticFreezeHash(payload) {
  const copy = JSON.parse(JSON.stringify(payload));
  delete copy.content_sha256;
  return crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

function verifyFrozenManifest(payload, root = ROOT) {
  if (payload.freeze_id !== EXPECTED_FREEZE_ID) throw new Error(`freeze identity mismatch: ${payload.freeze_id}`);
  if (payload.content_sha256 !== EXPECTED_FREEZE_SHA256) throw new Error(`freeze content_sha256 changed: ${payload.content_sha256}`);
  const semantic = semanticFreezeHash(payload);
  if (semantic !== EXPECTED_FREEZE_SHA256) throw new Error(`freeze semantic hash mismatch: ${semantic}`);
  if (payload.protected_motivation_stock_excluded !== PROTECTED_STOCK) throw new Error('protected 2454 exclusion contract changed');
  if (!payload.source_file_sha256 || typeof payload.source_file_sha256 !== 'object') throw new Error('frozen source-file hashes missing');
  const changed = [];
  for (const [relative, expected] of Object.entries(payload.source_file_sha256)) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file)) {
      changed.push(`${relative}:missing`);
      continue;
    }
    const actual = sha256Bytes(file);
    if (actual !== expected) changed.push(`${relative}:${actual}`);
  }
  if (changed.length) throw new Error(`frozen source identity mismatch (${changed.length}): ${changed.slice(0, 8).join(', ')}`);
  return { semantic_sha256: semantic, verified_source_files: Object.keys(payload.source_file_sha256).length };
}

function parseTradingSessions(root = ROOT) {
  const files = readJson(path.join(root, 'data_twse_foreign_investors', 'files.json'));
  if (!Array.isArray(files)) throw new Error('foreign-investor session manifest must be an array');
  return [...new Set(files.map(name => String(name).match(/^(20\d{6})_twse_foreign_investors\.json$/)?.[1]).filter(Boolean))].sort();
}

function parseNumber(value) {
  if (value == null) return null;
  const n = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readTaiexClose(date, root = ROOT) {
  const relative = `data_twse_mi_index/${date}_twse_mi_index.json`;
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) return { value: null, source_file: relative, state: 'missing_file' };
  let payload;
  try {
    payload = readJson(file);
  } catch {
    return { value: null, source_file: relative, state: 'invalid_json' };
  }
  for (const table of payload.tables || []) {
    const fields = table.fields || [];
    const nameIndex = fields.indexOf('指數');
    const closeIndex = fields.indexOf('收盤指數');
    if (nameIndex < 0 || closeIndex < 0) continue;
    for (const row of table.data || []) {
      if (String(row?.[nameIndex] || '').trim() !== '發行量加權股價指數') continue;
      const value = parseNumber(row?.[closeIndex]);
      return value == null
        ? { value: null, source_file: relative, state: 'invalid_value' }
        : { value, source_file: relative, state: 'available' };
    }
  }
  return { value: null, source_file: relative, state: 'missing_index_row' };
}

function selectDevelopmentAnchors(payload) {
  const anchors = Array.isArray(payload.anchors) ? payload.anchors : [];
  const development = [];
  for (const anchor of anchors) {
    if (anchor.partition !== 'methodology_development' || anchor.eligibility?.eligible !== true) continue;
    const stock = String(anchor.stock || '');
    if (stock === PROTECTED_STOCK) throw new Error('protected 2454 entered methodology_development');
    if (!/^\d{4}$/.test(stock) || !/^20\d{6}$/.test(String(anchor.t0 || ''))) {
      throw new Error(`invalid frozen development anchor identity: ${JSON.stringify({ stock: anchor.stock, t0: anchor.t0 })}`);
    }
    development.push(anchor);
  }
  if (development.length !== payload.counts?.methodology_development) {
    throw new Error(`development count mismatch: ${development.length} != ${payload.counts?.methodology_development}`);
  }
  return development;
}

function horizonSession(sessions, t0, horizon) {
  const index = sessions.indexOf(t0);
  if (index < 0) throw new Error(`T0 ${t0} absent from official session calendar`);
  return sessions[index + horizon] || null;
}

function ratioReturn(end, start) {
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(end) || end <= 0) return null;
  return end / start - 1;
}

function roundMetric(value) {
  return Number.isFinite(value) ? Number(value.toFixed(10)) : null;
}

function buildWindowDates(sessions, t0, horizonDate) {
  if (!horizonDate) return [];
  const start = sessions.indexOf(t0);
  const end = sessions.indexOf(horizonDate);
  if (start < 0 || end <= start) return [];
  return sessions.slice(start + 1, end + 1);
}

function computeExcursions(stock, baseClose, windowDates, root = ROOT) {
  if (!windowDates.length) return { mfe: null, mae: null, state: 'horizon_not_observed', missing_dates: [] };
  let maxHighReturn = -Infinity;
  let minLowReturn = Infinity;
  const missingDates = [];
  const provenance = [];
  for (const date of windowDates) {
    const price = getDailyPrice(stock, date, { root });
    if (!price || !Number.isFinite(price.high) || price.high <= 0 || !Number.isFinite(price.low) || price.low <= 0) {
      missingDates.push(date);
      continue;
    }
    maxHighReturn = Math.max(maxHighReturn, price.high / baseClose - 1);
    minLowReturn = Math.min(minLowReturn, price.low / baseClose - 1);
    provenance.push({ date, source: price.source, source_file: price.source_file });
  }
  if (missingDates.length) return { mfe: null, mae: null, state: 'missing_window_observation', missing_dates: missingDates, provenance };
  return { mfe: roundMetric(maxHighReturn), mae: roundMetric(minLowReturn), state: 'available', missing_dates: [], provenance };
}

function computeHorizon(anchor, horizon, sessions, root = ROOT) {
  const stock = String(anchor.stock);
  const t0 = String(anchor.t0);
  const horizonDate = horizonSession(sessions, t0, horizon);
  if (!horizonDate) {
    return {
      horizon_sessions: horizon,
      horizon_date: null,
      state: 'horizon_not_observed',
      absolute_forward_return: null,
      taiex_forward_return: null,
      taiex_relative_forward_return: null,
      mfe: null,
      mae: null,
      stock_provenance: null,
      benchmark_provenance: null,
      excursion_state: 'horizon_not_observed',
    };
  }

  const base = getDailyPrice(stock, t0, { root });
  const end = getDailyPrice(stock, horizonDate, { root });
  const baseTaiex = readTaiexClose(t0, root);
  const endTaiex = readTaiexClose(horizonDate, root);
  const stockReturn = ratioReturn(end?.close, base?.close);
  const taiexReturn = ratioReturn(endTaiex.value, baseTaiex.value);
  const windowDates = base?.close ? buildWindowDates(sessions, t0, horizonDate) : [];
  const excursions = base?.close
    ? computeExcursions(stock, base.close, windowDates, root)
    : { mfe: null, mae: null, state: 'missing_base_price', missing_dates: [] };

  let state = 'available';
  if (stockReturn == null) state = !base ? 'missing_stock_base' : 'missing_stock_horizon';
  return {
    horizon_sessions: horizon,
    horizon_date: horizonDate,
    state,
    absolute_forward_return: roundMetric(stockReturn),
    taiex_forward_return: roundMetric(taiexReturn),
    taiex_relative_forward_return: stockReturn == null || taiexReturn == null ? null : roundMetric(stockReturn - taiexReturn),
    mfe: excursions.mfe,
    mae: excursions.mae,
    stock_provenance: {
      base: base ? { date: t0, source: base.source, source_file: base.source_file } : { date: t0, state: 'missing' },
      horizon: end ? { date: horizonDate, source: end.source, source_file: end.source_file } : { date: horizonDate, state: 'missing' },
    },
    benchmark_provenance: {
      base: { date: t0, source: 'twse_mi_index:發行量加權股價指數', source_file: baseTaiex.source_file, state: baseTaiex.state },
      horizon: { date: horizonDate, source: 'twse_mi_index:發行量加權股價指數', source_file: endTaiex.source_file, state: endTaiex.state },
    },
    excursion_state: excursions.state,
    excursion_missing_dates: excursions.missing_dates,
    excursion_provenance: excursions.provenance || [],
  };
}

function buildArtifact(payload, root = ROOT) {
  const freezeVerification = verifyFrozenManifest(payload, root);
  const sessions = parseTradingSessions(root);
  const development = selectDevelopmentAnchors(payload);
  const outcomes = development.map(anchor => ({
    stock: String(anchor.stock),
    t0: String(anchor.t0),
    partition: 'methodology_development',
    horizons: Object.fromEntries(HORIZONS.map(h => [`D+${h}`, computeHorizon(anchor, h, sessions, root)])),
  }));

  if (outcomes.some(item => item.stock === PROTECTED_STOCK || item.partition !== 'methodology_development')) {
    throw new Error('forbidden partition/protected stock materialized');
  }

  const coverage = {};
  for (const h of HORIZONS) {
    const key = `D+${h}`;
    const rows = outcomes.map(item => item.horizons[key]);
    coverage[key] = {
      total_development_anchors: rows.length,
      observed_horizon_date: rows.filter(row => row.horizon_date != null).length,
      absolute_return_available: rows.filter(row => row.absolute_forward_return != null).length,
      taiex_relative_available: rows.filter(row => row.taiex_relative_forward_return != null).length,
      mfe_mae_available: rows.filter(row => row.mfe != null && row.mae != null).length,
      horizon_not_observed: rows.filter(row => row.state === 'horizon_not_observed').length,
    };
  }

  const sessionDates = sessions.filter(date => date >= payload.anchor_sessions?.[0]);
  return {
    outcome_opening_id: OUTCOME_ID,
    methodology_version: OUTCOME_ID,
    research_only: true,
    production_strategy_promoted: false,
    binary_success_threshold: null,
    same_industry_relative_outcomes: 'omitted: PIT-safe effective-dated historical industry membership remains unproven',
    protected_motivation_stock: { stock: PROTECTED_STOCK, outcome_opened: false },
    holdout_contract: { stock_holdout_outcome_opened: false, time_holdout_outcome_opened: false },
    parent_freeze: {
      freeze_id: payload.freeze_id,
      content_sha256: payload.content_sha256,
      semantic_sha256_verified: freezeVerification.semantic_sha256,
      referenced_source_files_verified: freezeVerification.verified_source_files,
    },
    outcome_contract: {
      horizons: HORIZONS.map(h => `D+${h}`),
      horizon_unit: 'exchange trading sessions represented by official TWSE foreign-investor EOD archive session identities',
      base: 'frozen T0 close',
      stock_price_source: 'scripts/lib/stock_price_provider.js:getDailyPrice',
      benchmark: 'TWSE MI_INDEX 發行量加權股價指數 aligned to the same session date',
      absolute_forward_return: 'close(D+h) / close(T0) - 1',
      taiex_relative_forward_return: 'stock forward return - TAIEX forward return',
      mfe: 'max daily high from T+1..D+h / close(T0) - 1; missing if any required window OHLC is missing',
      mae: 'min daily low from T+1..D+h / close(T0) - 1; missing if any required window OHLC is missing',
      missingness: 'missing observations remain null and are never converted to zero',
    },
    session_coverage: {
      first: sessionDates[0] || null,
      last: sessionDates.at(-1) || null,
      count: sessionDates.length,
    },
    counts: {
      methodology_development: outcomes.length,
      stock_holdout_materialized: 0,
      time_holdout_materialized: 0,
      protected_2454_materialized: 0,
    },
    coverage,
    outcomes,
  };
}

function main() {
  const root = ROOT;
  const freezeFile = path.join(root, FREEZE_PATH);
  const outputFile = path.join(root, OUTPUT_PATH);
  const payload = readJson(freezeFile);
  const artifact = buildArtifact(payload, root);
  fs.writeFileSync(outputFile, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({ output: OUTPUT_PATH, counts: artifact.counts, coverage: artifact.coverage }, null, 2));
}

if (require.main === module) main();

module.exports = {
  EXPECTED_FREEZE_SHA256,
  HORIZONS,
  OUTCOME_ID,
  buildArtifact,
  buildWindowDates,
  computeHorizon,
  horizonSession,
  parseTradingSessions,
  readTaiexClose,
  selectDevelopmentAnchors,
  semanticFreezeHash,
  verifyFrozenManifest,
};
