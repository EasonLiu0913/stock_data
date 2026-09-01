#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FREEZE_FILE = path.join(ROOT, 'data_research', 'institutional-flow', 'institutional-accumulation-development-sample-freeze-v1.json');
const OUTCOME_FILE = path.join(ROOT, 'data_research', 'institutional-flow', 'institutional-accumulation-development-outcome-opening-v1.json');
const OUTPUT_FILE = path.join(ROOT, 'data_research', 'institutional-flow', 'institutional-accumulation-development-association-v1.json');

const ASSOCIATION_ID = 'institutional-accumulation-development-association-v1';
const EXPECTED_FREEZE_SHA256 = '66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b';
const EXPECTED_OUTCOME_BYTE_SHA256 = 'f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e';
const MIN_N = 20;
const FEATURES = [
  'pit_features.cross_sectional.core_accumulation_percentile',
  'pit_features.cross_sectional.supply_absorption_percentile',
  'pit_features.cross_sectional.price_return_percentile',
  'pit_features.cross_sectional.price_non_confirmation_rank_gap',
];
const OUTCOMES = [
  'absolute_forward_return',
  'taiex_relative_forward_return',
  'mfe',
  'mae',
];
const HORIZONS = ['D+5', 'D+10', 'D+20', 'D+40'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function getPath(object, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => value == null ? undefined : value[key], object);
}

function identity(row) {
  return `${row.stock}/${row.t0}`;
}

function averageRanks(values) {
  const ordered = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value || a.index - b.index);
  const ranks = new Array(values.length);
  let cursor = 0;
  while (cursor < ordered.length) {
    let end = cursor;
    while (end + 1 < ordered.length && ordered[end + 1].value === ordered[cursor].value) end += 1;
    const average = ((cursor + 1) + (end + 1)) / 2;
    for (let i = cursor; i <= end; i += 1) ranks[ordered[i].index] = average;
    cursor = end + 1;
  }
  return ranks;
}

function pearson(x, y) {
  if (x.length !== y.length || x.length < 2) return null;
  const mx = x.reduce((sum, value) => sum + value, 0) / x.length;
  const my = y.reduce((sum, value) => sum + value, 0) / y.length;
  let numerator = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    numerator += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return numerator / Math.sqrt(dx2 * dy2);
}

function spearman(x, y) {
  return pearson(averageRanks(x), averageRanks(y));
}

function round(value, digits = 10) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function validateParents(freeze, outcomes) {
  if (freeze.freeze_id !== 'institutional-accumulation-development-sample-freeze-v1') throw new Error('freeze identity mismatch');
  if (freeze.content_sha256 !== EXPECTED_FREEZE_SHA256) throw new Error(`freeze semantic SHA mismatch: ${freeze.content_sha256}`);
  if (sha256File(OUTCOME_FILE) !== EXPECTED_OUTCOME_BYTE_SHA256) throw new Error('refreshed development outcome bytes changed; refusing association analysis');
  if (outcomes.outcome_opening_id !== 'institutional-accumulation-outcome-opening-v1') throw new Error('development outcome identity mismatch');
  if (outcomes.parent_freeze?.content_sha256 !== EXPECTED_FREEZE_SHA256) throw new Error('development outcome parent freeze mismatch');
  if (outcomes.binary_success_threshold !== null) throw new Error('development outcome binary threshold unexpectedly present');
  if (outcomes.holdout_contract?.stock_holdout_outcome_opened !== false || outcomes.holdout_contract?.time_holdout_outcome_opened !== false) throw new Error('development outcome holdout contract is not sealed');
  if (outcomes.protected_motivation_stock?.stock !== '2454' || outcomes.protected_motivation_stock?.outcome_opened !== false) throw new Error('protected 2454 contract changed');
}

function buildAssociation() {
  const freeze = readJson(FREEZE_FILE);
  const outcomes = readJson(OUTCOME_FILE);
  validateParents(freeze, outcomes);

  const development = freeze.anchors.filter(row => row.eligibility?.eligible && row.partition === 'methodology_development');
  if (development.length !== 41) throw new Error(`expected 41 frozen methodology-development rows, got ${development.length}`);
  if (development.some(row => row.stock === '2454')) throw new Error('protected 2454 appeared in development freeze');

  const outcomeRows = outcomes.outcomes || [];
  if (outcomeRows.length !== 41 || outcomeRows.some(row => row.partition !== 'methodology_development') || outcomeRows.some(row => row.stock === '2454')) {
    throw new Error('development outcome scope mismatch');
  }
  const outcomeById = new Map(outcomeRows.map(row => [identity(row), row]));
  const developmentIds = development.map(identity).sort();
  const outcomeIds = outcomeRows.map(identity).sort();
  if (JSON.stringify(developmentIds) !== JSON.stringify(outcomeIds)) throw new Error('Phase 2/development outcome identities differ');

  const attempts = [];
  for (const feature of FEATURES) {
    for (const horizon of HORIZONS) {
      for (const outcome of OUTCOMES) {
        const x = [];
        const y = [];
        let featureMissing = 0;
        let outcomeMissing = 0;
        let pairMissing = 0;
        for (const row of development) {
          const featureValue = getPath(row, feature);
          const outcomeValue = outcomeById.get(identity(row))?.horizons?.[horizon]?.[outcome];
          const hasFeature = Number.isFinite(featureValue);
          const hasOutcome = Number.isFinite(outcomeValue);
          if (!hasFeature) featureMissing += 1;
          if (!hasOutcome) outcomeMissing += 1;
          if (!(hasFeature && hasOutcome)) {
            pairMissing += 1;
            continue;
          }
          x.push(featureValue);
          y.push(outcomeValue);
        }
        const n = x.length;
        const raw = n >= MIN_N ? spearman(x, y) : null;
        attempts.push({
          feature,
          horizon,
          outcome,
          total_frozen_development: development.length,
          n,
          missingness: {
            feature_missing: featureMissing,
            outcome_missing: outcomeMissing,
            pair_missing: pairMissing,
          },
          status: n >= MIN_N ? 'analyzable' : 'insufficient_n',
          spearman_rho: n >= MIN_N ? round(raw) : null,
          interpretation_allowed: n >= MIN_N,
        });
      }
    }
  }

  const payload = {
    association_id: ASSOCIATION_ID,
    methodology_version: ASSOCIATION_ID,
    research_only: true,
    development_only: true,
    production_strategy_promoted: false,
    production_model_promoted: false,
    binary_success_threshold: null,
    optimized_cutoff: null,
    composite_score: null,
    weights: null,
    catalyst_news_layer_added: false,
    holdout_contract: {
      stock_holdout_outcome_opened: false,
      time_holdout_outcome_opened: false,
      protected_2454_outcome_opened: false,
    },
    parent_freeze: {
      freeze_id: freeze.freeze_id,
      content_sha256: freeze.content_sha256,
      expected_content_sha256: EXPECTED_FREEZE_SHA256,
    },
    parent_outcome: {
      outcome_opening_id: outcomes.outcome_opening_id,
      byte_sha256: sha256File(OUTCOME_FILE),
      expected_byte_sha256: EXPECTED_OUTCOME_BYTE_SHA256,
      session_coverage: outcomes.session_coverage,
      extended_or_refreshed_in_this_round: false,
    },
    analysis_contract: {
      statistic: 'spearman_rank_association',
      tie_rule: 'average ranks',
      pairwise_complete_only: true,
      minimum_pairwise_complete_n: MIN_N,
      below_minimum_status: 'insufficient_n',
      features: FEATURES,
      outcomes: OUTCOMES,
      horizons: HORIZONS,
      attempted_pairs: FEATURES.length * OUTCOMES.length * HORIZONS.length,
      production_model: false,
    },
    counts: {
      frozen_methodology_development: development.length,
      phase3_outcome_rows: outcomeRows.length,
      attempted_pairs: attempts.length,
      analyzable_pairs: attempts.filter(row => row.status === 'analyzable').length,
      insufficient_n_pairs: attempts.filter(row => row.status === 'insufficient_n').length,
    },
    associations: attempts,
  };
  payload.content_sha256 = sha256Buffer(Buffer.from(JSON.stringify(payload)));
  return payload;
}

function main() {
  const payload = buildAssociation();
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(JSON.stringify({
    association_id: payload.association_id,
    parent_freeze: payload.parent_freeze,
    parent_outcome: payload.parent_outcome,
    counts: payload.counts,
    analyzable: payload.associations.filter(row => row.status === 'analyzable'),
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  ASSOCIATION_ID,
  EXPECTED_FREEZE_SHA256,
  EXPECTED_OUTCOME_BYTE_SHA256,
  MIN_N,
  FEATURES,
  OUTCOMES,
  HORIZONS,
  averageRanks,
  pearson,
  spearman,
  buildAssociation,
};
