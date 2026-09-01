#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  OBSERVATION_OFFSETS,
  SOURCE_STATES,
  buildObservationDates,
  evaluateAnchorEligibility,
  loadMarginObservation,
  loadPriceObservation,
  loadTwseInstitutionalObservation,
} = require('./lib/institutional_accumulation_pit');

const ROOT = path.resolve(__dirname, '..');
const METHODOLOGY = 'institutional-accumulation-development-sample-freeze-v1';
const PARENT_METHODOLOGY = 'institutional-accumulation-point-in-time-contract-v1';
const DEFAULT_CUTOFF = '20260827';
const DEFAULT_UNIVERSE_SIZE = 15;
const DEFAULT_ANCHOR_SESSION_COUNT = 10;
const OUTPUT = path.join(ROOT, 'data_research', 'institutional-flow', 'institutional-accumulation-development-sample-freeze-v1.json');
const PROTECTED_STOCK = '2454';
const LABELS = OBSERVATION_OFFSETS.map(offset => offset === 0 ? 'T0' : `T-${offset}`);

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function manifestDates(relativePath, suffix, root = ROOT) {
  const list = readJson(path.join(root, relativePath), []);
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (Array.isArray(list) ? list : [])
    .map(name => String(name).match(new RegExp(`^(20\\d{6})_${escaped}`))?.[1] || null)
    .filter(Boolean)
    .sort();
}

function intersection(arrays) {
  if (!arrays.length) return [];
  let result = new Set(arrays[0]);
  for (const list of arrays.slice(1)) {
    const next = new Set(list);
    result = new Set([...result].filter(item => next.has(item)));
  }
  return [...result].sort();
}

function parseUniverse(root = ROOT, size = DEFAULT_UNIVERSE_SIZE) {
  const file = path.join(root, 'data_twse', 'twse_industry.csv');
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  const codes = rows
    .map(line => line.split(',')[0]?.trim())
    .filter(code => /^\d{4}$/.test(code) && Number(code) >= 1000 && code !== PROTECTED_STOCK)
    .sort((a, b) => Number(a) - Number(b));
  return [...new Set(codes)].slice(0, size);
}

function commonTradingDates(root = ROOT, cutoff = DEFAULT_CUTOFF) {
  return intersection([
    manifestDates('data_twse_foreign_investors/files.json', 'twse_foreign_investors', root),
    manifestDates('data_twse_dealers/files.json', 'twse_dealers', root),
    manifestDates('data_twse_margin_balance/files.json', 'twse_margin_balance', root),
  ]).filter(date => date <= cutoff);
}

function selectAnchorSessions(tradingDates, count = DEFAULT_ANCHOR_SESSION_COUNT) {
  const warmup = Math.max(...OBSERVATION_OFFSETS);
  const usable = tradingDates.slice(warmup);
  return usable.slice(-count);
}

function requiredLabelsForObservationDates(observationDates) {
  const labels = [];
  for (const label of LABELS) {
    if (!observationDates[label]) labels.push(`${label}:trading_session`);
    labels.push(`${label}:price`, `${label}:foreign`, `${label}:dealer`);
  }
  return labels;
}

function loadAnchor(stock, t0, tradingDates, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const observationDates = buildObservationDates(tradingDates, t0);
  const byLabel = {};
  const flat = {};
  const complete = { root, sessionComplete: true };

  for (const label of LABELS) {
    const date = observationDates[label];
    if (!date) {
      byLabel[label] = { session_date: null, price: null, foreign: null, dealer: null, margin: null, investment_trust: null };
      continue;
    }
    const row = {
      session_date: date,
      price: loadPriceObservation(stock, date, complete),
      foreign: loadTwseInstitutionalObservation(stock, date, 'foreign', complete),
      dealer: loadTwseInstitutionalObservation(stock, date, 'dealer', complete),
      margin: loadMarginObservation(stock, date, complete),
      investment_trust: loadTwseInstitutionalObservation(stock, date, 'investment_trust', complete),
    };
    byLabel[label] = row;
    for (const source of ['price', 'foreign', 'dealer']) flat[`${label}:${source}`] = row[source];
  }

  const required = requiredLabelsForObservationDates(observationDates);
  const absentSessionReasons = required.filter(label => label.endsWith(':trading_session'));
  const eligibility = evaluateAnchorEligibility(flat, required.filter(label => !label.endsWith(':trading_session')));
  eligibility.reasons.unshift(...absentSessionReasons.map(label => `${label}:absent`));
  eligibility.eligible = eligibility.reasons.length === 0;

  const features = eligibility.eligible ? derivePitFeatures(byLabel) : null;
  return { stock, t0, observation_dates: observationDates, eligibility, observations: byLabel, pit_features: features };
}

function derivePitFeatures(byLabel) {
  let foreign = 0;
  let dealer = 0;
  let positiveCore = 0;
  let volume = 0;
  let volumeAvailable = true;
  for (const label of LABELS) {
    const row = byLabel[label];
    const foreignValue = row.foreign.value;
    const dealerValue = row.dealer.value;
    const core = foreignValue + dealerValue;
    foreign += foreignValue;
    dealer += dealerValue;
    if (core > 0) positiveCore += 1;
    const observedVolume = row.price.value?.volume;
    if (Number.isFinite(observedVolume) && observedVolume > 0) volume += observedVolume;
    else volumeAvailable = false;
  }
  const t20 = byLabel['T-20'].price.value.close;
  const t0 = byLabel.T0.price.value.close;
  const priceReturn = t20 > 0 ? (t0 / t20) - 1 : null;
  const core = foreign + dealer;
  return {
    foreign_sampled_net_shares: foreign,
    dealer_sampled_net_shares: dealer,
    core_institutional_sampled_net_shares: core,
    positive_core_flow_observation_count: positiveCore,
    sampled_net_to_volume: volumeAvailable && volume > 0 ? core / volume : null,
    price_return_t20_t0: priceReturn,
  };
}

function percentileRanks(items, accessor) {
  const available = items
    .map((item, index) => ({ index, value: accessor(item) }))
    .filter(entry => Number.isFinite(entry.value))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  const result = new Array(items.length).fill(null);
  if (!available.length) return result;
  let cursor = 0;
  while (cursor < available.length) {
    let end = cursor;
    while (end + 1 < available.length && available[end + 1].value === available[cursor].value) end += 1;
    const averageRank = (cursor + end) / 2;
    const percentile = available.length === 1 ? 0.5 : averageRank / (available.length - 1);
    for (let i = cursor; i <= end; i += 1) result[available[i].index] = percentile;
    cursor = end + 1;
  }
  return result;
}

function addCrossSectionalRanks(anchors) {
  const grouped = new Map();
  for (const anchor of anchors) {
    if (!anchor.eligibility.eligible) continue;
    if (!grouped.has(anchor.t0)) grouped.set(anchor.t0, []);
    grouped.get(anchor.t0).push(anchor);
  }
  for (const group of grouped.values()) {
    group.sort((a, b) => Number(a.stock) - Number(b.stock));
    const accumulation = percentileRanks(group, item => item.pit_features.core_institutional_sampled_net_shares);
    const absorption = percentileRanks(group, item => item.pit_features.sampled_net_to_volume);
    const price = percentileRanks(group, item => item.pit_features.price_return_t20_t0);
    group.forEach((anchor, index) => {
      anchor.pit_features.cross_sectional = {
        core_accumulation_percentile: accumulation[index],
        supply_absorption_percentile: absorption[index],
        price_return_percentile: price[index],
        price_non_confirmation_rank_gap:
          Number.isFinite(accumulation[index]) && Number.isFinite(price[index]) ? accumulation[index] - price[index] : null,
      };
    });
  }
}

function partitionFor(stock, t0, universe, anchorSessions) {
  const stockIndex = universe.indexOf(stock);
  const timeIndex = anchorSessions.indexOf(t0);
  const stockHoldout = stockIndex >= 0 && stockIndex % 5 === 4;
  const timeHoldoutStart = Math.max(0, Math.floor(anchorSessions.length * 0.8));
  if (stockHoldout) return 'stock_holdout';
  if (timeIndex >= timeHoldoutStart) return 'time_holdout';
  return 'methodology_development';
}

function collectSourceFileHashes(root, anchors) {
  const files = new Set();
  for (const anchor of anchors) {
    for (const label of LABELS) {
      const row = anchor.observations[label];
      if (!row) continue;
      for (const source of ['price', 'foreign', 'dealer', 'margin', 'investment_trust']) {
        const relative = row[source]?.provenance?.source_file;
        if (relative) files.add(relative);
      }
    }
  }
  return Object.fromEntries([...files].sort().map(relative => {
    const file = path.join(root, relative);
    return [relative, fs.existsSync(file) ? sha256File(file) : null];
  }));
}

function hashFreezePayload(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
  delete clone.content_sha256;
  return sha256Buffer(Buffer.from(JSON.stringify(clone)));
}

function buildFreeze(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const cutoff = options.cutoff || DEFAULT_CUTOFF;
  const universeSize = Number(options.universeSize || DEFAULT_UNIVERSE_SIZE);
  const anchorSessionCount = Number(options.anchorSessionCount || DEFAULT_ANCHOR_SESSION_COUNT);
  const universe = parseUniverse(root, universeSize);
  const tradingDates = commonTradingDates(root, cutoff);
  const anchorSessions = selectAnchorSessions(tradingDates, anchorSessionCount);
  if (!universe.length) throw new Error('Phase 2 universe is empty');
  if (anchorSessions.length !== anchorSessionCount) {
    throw new Error(`Insufficient deterministic anchor sessions: expected ${anchorSessionCount}, got ${anchorSessions.length}`);
  }

  const anchors = [];
  for (const t0 of anchorSessions) {
    for (const stock of universe) {
      const anchor = loadAnchor(stock, t0, tradingDates, { root });
      anchor.partition = partitionFor(stock, t0, universe, anchorSessions);
      anchors.push(anchor);
    }
  }
  addCrossSectionalRanks(anchors);

  const counts = { methodology_development: 0, stock_holdout: 0, time_holdout: 0, ineligible: 0 };
  for (const anchor of anchors) {
    if (!anchor.eligibility.eligible) counts.ineligible += 1;
    else counts[anchor.partition] += 1;
  }

  const payload = {
    freeze_id: METHODOLOGY,
    methodology_version: METHODOLOGY,
    parent_pit_methodology: PARENT_METHODOLOGY,
    outcome_blind: true,
    sample_freeze: true,
    outcome_fields_present: [],
    protected_motivation_stock_excluded: PROTECTED_STOCK,
    cutoff_session: cutoff,
    selection_contract: {
      universe: `first ${universeSize} ascending four-digit TWSE equity codes >= 1000 from data_twse/twse_industry.csv, excluding protected motivation stock ${PROTECTED_STOCK}; current industry labels are ignored`,
      trading_dates: 'ascending intersection of foreign/dealer/margin archive manifests at or before cutoff; offsets count these source-shared trading sessions',
      anchor_sessions: `latest ${anchorSessionCount} usable sessions after a 20-session warmup`,
      required_sources: ['unified_price:T-20/T-15/T-10/T-5/T-3/T-1/T0', 'foreign:T-20/T-15/T-10/T-5/T-3/T-1/T0', 'dealer:T-20/T-15/T-10/T-5/T-3/T-1/T0'],
      optional_sources: ['investment_trust', 'margin', 'HiStock broker (not loaded for freeze; no backfill)', 'catalyst/disclosure (separate PIT-safe layer only)'],
      fail_closed: 'any absent/non-available required observation makes the prospective anchor ineligible; no missing/rejected/unsafe value is zero-filled',
      event_anchor_construction: 'threshold-free: every eligible stock-session is frozen; PIT continuous/rank features are preserved without selecting a winning cutoff',
      tdcc_history: 'excluded / availability_unsafe while production_no_lookahead_safe=false',
      historical_industry: 'current/static industry mapping is not projected backward',
    },
    partition_contract: {
      priority: ['stock_holdout', 'time_holdout', 'methodology_development'],
      stock_holdout: 'every fifth stock in deterministic ascending universe (zero-based index % 5 === 4), across all frozen anchor sessions',
      time_holdout: 'non-stock-holdout stocks in final 20% of frozen anchor sessions',
      methodology_development: 'all remaining eligible anchors',
      motivation_cases: `${PROTECTED_STOCK} excluded before partitioning`,
    },
    feature_contract: {
      institutional_accumulation: 'foreign + dealer sampled net shares across frozen observation family; investment trust remains separate optional PIT evidence',
      supply_absorption: 'sampled core institutional net shares divided by sampled observed volume when every volume value is valid; no free-float normalization',
      price_non_confirmation: 'cross-sectional core-accumulation percentile minus contemporaneous T-20-to-T0 price-return percentile; no success threshold',
      crowding_risk: 'margin observations preserved as optional PIT inputs, not used to decide eligibility or anchor inclusion',
      catalyst: 'not used in core anchor selection; separate optional PIT-safe layer only',
      final_weighted_score: null,
    },
    universe,
    trading_date_span: { first: tradingDates[0], last: tradingDates[tradingDates.length - 1], count: tradingDates.length },
    anchor_sessions: anchorSessions,
    counts,
    anchors,
    source_file_sha256: collectSourceFileHashes(root, anchors),
    forbidden_outcome_fields: ['forward_return', 'mfe', 'mae', 'breakout', 'repricing_success', 'failure_label', 'future_catalyst'],
    future_round_status: 'not_promoted',
  };
  payload.content_sha256 = hashFreezePayload(payload);
  return payload;
}

function main() {
  const payload = buildFreeze();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
  console.log(JSON.stringify({
    freeze_id: payload.freeze_id,
    content_sha256: payload.content_sha256,
    universe: payload.universe,
    anchor_sessions: payload.anchor_sessions,
    counts: payload.counts,
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  DEFAULT_ANCHOR_SESSION_COUNT,
  DEFAULT_CUTOFF,
  DEFAULT_UNIVERSE_SIZE,
  LABELS,
  METHODOLOGY,
  OUTPUT,
  addCrossSectionalRanks,
  buildFreeze,
  commonTradingDates,
  derivePitFeatures,
  hashFreezePayload,
  intersection,
  manifestDates,
  parseUniverse,
  partitionFor,
  percentileRanks,
  selectAnchorSessions,
};
