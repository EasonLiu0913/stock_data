'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getDailyPrice, normalizeDate, parseNumber } = require('./stock_price_provider');
const { validateDailyPayload } = require('./histock_broker_quality');

const SOURCE_STATES = Object.freeze({
  AVAILABLE: 'available',
  MISSING: 'missing',
  QUALITY_REJECTED: 'quality_rejected',
  AVAILABILITY_UNSAFE: 'availability_unsafe',
  NOT_APPLICABLE: 'not_applicable',
});

const OBSERVATION_OFFSETS = Object.freeze([20, 15, 10, 5, 3, 1, 0]);

function normalizeStock(value) {
  const stock = String(value || '').trim();
  if (!/^\d{4}$/.test(stock)) throw new Error(`Invalid stock code: ${value}`);
  return stock;
}

function normalizeSourceState(value) {
  if (!Object.values(SOURCE_STATES).includes(value)) throw new Error(`Invalid source state: ${value}`);
  return value;
}

function repoPath(root, file) {
  return file ? path.relative(root, file).replaceAll(path.sep, '/') : null;
}

function createObservation({
  value = null,
  state,
  source,
  sourceFile = null,
  sessionDate = null,
  knownAt = null,
  availabilityRule,
  details = null,
}) {
  const normalizedState = normalizeSourceState(state);
  if (!source) throw new Error('Observation source is required');
  if (!availabilityRule) throw new Error('Observation availabilityRule is required');
  if (sessionDate != null) normalizeDate(sessionDate);
  if (normalizedState !== SOURCE_STATES.AVAILABLE && value !== null) {
    throw new Error(`Non-available observation must not expose a PIT-safe value: ${normalizedState}`);
  }
  return {
    value,
    state: normalizedState,
    provenance: {
      source,
      source_file: sourceFile,
      session_date: sessionDate,
      known_at: knownAt,
      availability_rule: availabilityRule,
      details,
    },
  };
}

function availableObservation(args) {
  return createObservation({ ...args, state: SOURCE_STATES.AVAILABLE });
}

function unavailableObservation(state, args) {
  return createObservation({ ...args, value: null, state });
}

function buildObservationDates(tradingDates, t0) {
  const ordered = [...new Set((tradingDates || []).map(normalizeDate))].sort();
  const anchor = normalizeDate(t0);
  const anchorIndex = ordered.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`T0 is not present in trading-date sequence: ${anchor}`);
  const result = {};
  for (const offset of OBSERVATION_OFFSETS) {
    const index = anchorIndex - offset;
    result[offset === 0 ? 'T0' : `T-${offset}`] = index >= 0 ? ordered[index] : null;
  }
  return result;
}

function applyEodAvailability(observation, { sessionComplete }) {
  if (observation.state !== SOURCE_STATES.AVAILABLE || sessionComplete !== false) return observation;
  return unavailableObservation(SOURCE_STATES.AVAILABILITY_UNSAFE, {
    source: observation.provenance.source,
    sourceFile: observation.provenance.source_file,
    sessionDate: observation.provenance.session_date,
    knownAt: observation.provenance.known_at,
    availabilityRule: `${observation.provenance.availability_rule}; same-session EOD fact withheld until session completion`,
    details: observation.provenance.details,
  });
}

function loadJson(file) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (error) {
    return { ok: false, error };
  }
}

function findInstitutionalRow(payload, stock) {
  if (!payload || payload.stat !== 'OK' || !Array.isArray(payload.fields) || !Array.isArray(payload.data)) return null;
  const codeIndex = payload.fields.indexOf('證券代號');
  const netIndex = payload.fields.lastIndexOf('買賣超股數');
  if (codeIndex < 0 || netIndex < 0) return null;
  const row = payload.data.find(item => String(item?.[codeIndex] || '').trim() === stock);
  if (!row) return null;
  const value = parseNumber(row[netIndex]);
  return Number.isFinite(value) ? { row, value } : null;
}

function loadTwseInstitutionalObservation(stockCode, sessionDate, actor, options = {}) {
  const stock = normalizeStock(stockCode);
  const date = normalizeDate(sessionDate);
  const root = path.resolve(options.root || path.resolve(__dirname, '../..'));
  const actorConfig = {
    foreign: ['data_twse_foreign_investors', 'twse_foreign_investors'],
    investment_trust: ['data_twse_investment_trust', 'twse_investment_trust'],
    dealer: ['data_twse_dealers', 'twse_dealers'],
  }[actor];
  if (!actorConfig) throw new Error(`Unsupported institutional actor: ${actor}`);
  const [directory, suffix] = actorConfig;
  const file = path.join(root, directory, `${date}_${suffix}.json`);
  const sourceFile = repoPath(root, file);
  if (!fs.existsSync(file)) {
    return unavailableObservation(SOURCE_STATES.MISSING, {
      source: suffix,
      sourceFile,
      sessionDate: date,
      availabilityRule: 'TWSE EOD archive; source session is authoritative; unavailable before session completion',
      details: 'archive_file_missing',
    });
  }
  const loaded = loadJson(file);
  if (!loaded.ok || loaded.value?.date !== date || loaded.value?.stat !== 'OK') {
    return unavailableObservation(SOURCE_STATES.QUALITY_REJECTED, {
      source: suffix,
      sourceFile,
      sessionDate: date,
      availabilityRule: 'TWSE EOD archive; source session is authoritative; unavailable before session completion',
      details: 'invalid_archive_payload',
    });
  }
  const found = findInstitutionalRow(loaded.value, stock);
  if (!found) {
    return unavailableObservation(SOURCE_STATES.MISSING, {
      source: suffix,
      sourceFile,
      sessionDate: date,
      availabilityRule: 'TWSE EOD archive; row omission is not assumed to mean zero',
      details: 'stock_row_missing_or_invalid',
    });
  }
  return applyEodAvailability(availableObservation({
    value: found.value,
    source: suffix,
    sourceFile,
    sessionDate: date,
    availabilityRule: 'TWSE EOD archive; explicit numeric row value is observable only after session completion',
    details: { metric: 'net_buy_sell_shares', actor },
  }), options);
}

function loadPriceObservation(stockCode, sessionDate, options = {}) {
  const stock = normalizeStock(stockCode);
  const date = normalizeDate(sessionDate);
  const root = path.resolve(options.root || path.resolve(__dirname, '../..'));
  const price = getDailyPrice(stock, date, { root });
  if (!price) {
    return unavailableObservation(SOURCE_STATES.MISSING, {
      source: 'unified_stock_price_provider',
      sourceFile: null,
      sessionDate: date,
      availabilityRule: 'Unified price provider; missing/invalid close remains missing',
      details: 'no_usable_price',
    });
  }
  return applyEodAvailability(availableObservation({
    value: {
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      volume: price.volume,
    },
    source: price.source,
    sourceFile: price.source_file,
    sessionDate: date,
    availabilityRule: 'Unified stock price provider; EOD price/volume unavailable before session completion',
  }), options);
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function loadMarginObservation(stockCode, sessionDate, options = {}) {
  const stock = normalizeStock(stockCode);
  const date = normalizeDate(sessionDate);
  const root = path.resolve(options.root || path.resolve(__dirname, '../..'));
  const file = path.join(root, 'data_twse_margin_balance', `${date}_twse_margin_balance.csv`);
  const sourceFile = repoPath(root, file);
  if (!fs.existsSync(file)) {
    return unavailableObservation(SOURCE_STATES.MISSING, {
      source: 'twse_margin_balance', sourceFile, sessionDate: date,
      availabilityRule: 'TWSE margin EOD archive; unavailable before session completion',
      details: 'archive_file_missing',
    });
  }
  let lines;
  try {
    lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  } catch {
    lines = [];
  }
  if (lines.length < 2) {
    return unavailableObservation(SOURCE_STATES.QUALITY_REJECTED, {
      source: 'twse_margin_balance', sourceFile, sessionDate: date,
      availabilityRule: 'TWSE margin EOD archive; unavailable before session completion',
      details: 'invalid_csv',
    });
  }
  const headers = parseCsvLine(lines[0]);
  const codeIndex = headers.indexOf('股票代號');
  const balanceIndex = headers.indexOf('融資今日餘額');
  if (codeIndex < 0 || balanceIndex < 0) {
    return unavailableObservation(SOURCE_STATES.QUALITY_REJECTED, {
      source: 'twse_margin_balance', sourceFile, sessionDate: date,
      availabilityRule: 'TWSE margin EOD archive; unavailable before session completion',
      details: 'required_columns_missing',
    });
  }
  const row = lines.slice(1).map(parseCsvLine).find(item => String(item[codeIndex] || '').trim() === stock);
  if (!row) {
    return unavailableObservation(SOURCE_STATES.MISSING, {
      source: 'twse_margin_balance', sourceFile, sessionDate: date,
      availabilityRule: 'TWSE margin EOD archive; stock-row omission remains missing',
      details: 'stock_row_missing',
    });
  }
  const value = parseNumber(row[balanceIndex]);
  if (!Number.isFinite(value)) {
    return unavailableObservation(SOURCE_STATES.QUALITY_REJECTED, {
      source: 'twse_margin_balance', sourceFile, sessionDate: date,
      availabilityRule: 'TWSE margin EOD archive; unavailable before session completion',
      details: 'margin_balance_invalid',
    });
  }
  return applyEodAvailability(availableObservation({
    value,
    source: 'twse_margin_balance',
    sourceFile,
    sessionDate: date,
    availabilityRule: 'TWSE margin EOD archive; explicit numeric row value is observable only after session completion',
    details: { metric: 'financing_current_balance' },
  }), options);
}

function loadHistockBrokerObservation(stockCode, sessionDate, options = {}) {
  const stock = normalizeStock(stockCode);
  const date = normalizeDate(sessionDate);
  const root = path.resolve(options.root || path.resolve(__dirname, '../..'));
  const file = path.join(root, 'data_research', 'institutional-flow', 'histock', stock, 'daily', `${date}.json`);
  const sourceFile = repoPath(root, file);
  if (!fs.existsSync(file)) {
    return unavailableObservation(SOURCE_STATES.MISSING, {
      source: 'histock_broker_history', sourceFile, sessionDate: date,
      availabilityRule: 'Historical broker daily artifact; scrape date does not prove intraday availability',
      details: 'daily_file_missing',
    });
  }
  const loaded = loadJson(file);
  const quality = loaded.ok ? validateDailyPayload(loaded.value, { stock, date }) : { valid: false, reasons: ['json_parse_failed'] };
  if (!quality.valid) {
    return unavailableObservation(SOURCE_STATES.QUALITY_REJECTED, {
      source: 'histock_broker_history', sourceFile, sessionDate: date,
      availabilityRule: 'Historical broker daily artifact; hard quality gate must pass before use',
      details: quality.reasons,
    });
  }
  const net = loaded.value.records.reduce((sum, record) => sum + record.net, 0);
  return applyEodAvailability(availableObservation({
    value: net,
    source: 'histock_broker_history',
    sourceFile,
    sessionDate: date,
    availabilityRule: 'Historical broker daily artifact; conservatively observable after source session completion',
    details: { metric: 'aggregate_branch_net' },
  }), options);
}

function tdccHistoricalObservation({ value = null, sourceFile = null, sessionDate = null, productionNoLookaheadSafe = false } = {}) {
  const date = sessionDate == null ? null : normalizeDate(sessionDate);
  if (productionNoLookaheadSafe !== true) {
    return unavailableObservation(SOURCE_STATES.AVAILABILITY_UNSAFE, {
      source: 'tdcc_shareholding_history',
      sourceFile,
      sessionDate: date,
      availabilityRule: 'Historical TDCC publication timestamp is unproven; production_no_lookahead_safe=false',
      details: 'excluded_from_pit_safe_feature_values',
    });
  }
  if (!Number.isFinite(value)) {
    return unavailableObservation(SOURCE_STATES.MISSING, {
      source: 'tdcc_shareholding_history', sourceFile, sessionDate: date,
      availabilityRule: 'TDCC value requires PIT-safe provenance and an explicit numeric observation',
      details: 'value_missing',
    });
  }
  return availableObservation({
    value,
    source: 'tdcc_shareholding_history',
    sourceFile,
    sessionDate: date,
    availabilityRule: 'PIT-safe TDCC publication contract independently proven',
  });
}

function historicalIndustryObservation() {
  return unavailableObservation(SOURCE_STATES.NOT_APPLICABLE, {
    source: 'current_twse_industry_mapping',
    sourceFile: 'data_twse/twse_industry.csv',
    sessionDate: null,
    availabilityRule: 'Current/static industry mapping is not projected backward without effective-dated proof',
    details: 'historical_effective_membership_unproven',
  });
}

function isPitSafe(observation) {
  return observation?.state === SOURCE_STATES.AVAILABLE;
}

function evaluateAnchorEligibility(observationsByLabel, requiredLabels) {
  const reasons = [];
  for (const label of requiredLabels || []) {
    const observation = observationsByLabel?.[label];
    if (!observation) reasons.push(`${label}:absent`);
    else if (!isPitSafe(observation)) reasons.push(`${label}:${observation.state}`);
  }
  return { eligible: reasons.length === 0, reasons };
}

module.exports = {
  SOURCE_STATES,
  OBSERVATION_OFFSETS,
  applyEodAvailability,
  buildObservationDates,
  createObservation,
  evaluateAnchorEligibility,
  historicalIndustryObservation,
  isPitSafe,
  loadHistockBrokerObservation,
  loadMarginObservation,
  loadPriceObservation,
  loadTwseInstitutionalObservation,
  normalizeStock,
  parseCsvLine,
  tdccHistoricalObservation,
};
