'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MIN_N,
  FEATURES,
  OUTCOMES,
  HORIZONS,
  averageRanks,
  spearman,
  buildAssociation,
} = require('../scripts/analyze_institutional_accumulation_development_associations');

test('averageRanks uses deterministic average ranks for ties', () => {
  assert.deepEqual(averageRanks([10, 20, 20, 40]), [1, 2.5, 2.5, 4]);
});

test('Spearman handles monotonic and tied examples', () => {
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1);
  const tied = spearman([1, 2, 2, 4], [10, 20, 20, 40]);
  assert.equal(tied, 1);
});

test('association artifact obeys preregistered scope and minimum n', () => {
  const payload = buildAssociation();
  assert.equal(payload.association_id, 'institutional-accumulation-development-association-v1');
  assert.equal(payload.research_only, true);
  assert.equal(payload.development_only, true);
  assert.equal(payload.production_strategy_promoted, false);
  assert.equal(payload.production_model_promoted, false);
  assert.equal(payload.binary_success_threshold, null);
  assert.equal(payload.optimized_cutoff, null);
  assert.equal(payload.composite_score, null);
  assert.equal(payload.weights, null);
  assert.equal(payload.catalyst_news_layer_added, false);
  assert.deepEqual(payload.analysis_contract.features, FEATURES);
  assert.deepEqual(payload.analysis_contract.outcomes, OUTCOMES);
  assert.deepEqual(payload.analysis_contract.horizons, HORIZONS);
  assert.equal(payload.analysis_contract.minimum_pairwise_complete_n, MIN_N);
  assert.equal(payload.counts.frozen_methodology_development, 41);
  assert.equal(payload.counts.phase3_outcome_rows, 41);
  assert.equal(payload.associations.length, 64);
  assert.equal(payload.holdout_contract.stock_holdout_outcome_opened, false);
  assert.equal(payload.holdout_contract.time_holdout_outcome_opened, false);
  assert.equal(payload.holdout_contract.protected_2454_outcome_opened, false);

  for (const row of payload.associations) {
    assert.ok(FEATURES.includes(row.feature));
    assert.ok(OUTCOMES.includes(row.outcome));
    assert.ok(HORIZONS.includes(row.horizon));
    assert.equal(row.total_frozen_development, 41);
    assert.equal(row.missingness.pair_missing, 41 - row.n);
    if (row.n < MIN_N) {
      assert.equal(row.status, 'insufficient_n');
      assert.equal(row.spearman_rho, null);
      assert.equal(row.interpretation_allowed, false);
    } else {
      assert.equal(row.status, 'analyzable');
      assert.equal(typeof row.spearman_rho, 'number');
      assert.equal(row.interpretation_allowed, true);
      assert.ok(row.spearman_rho >= -1 && row.spearman_rho <= 1);
    }
  }
});

test('frozen Phase 3 coverage leaves D+10/D+20/D+40 below preregistered n gate', () => {
  const payload = buildAssociation();
  for (const horizon of ['D+10', 'D+20', 'D+40']) {
    const rows = payload.associations.filter(row => row.horizon === horizon);
    assert.equal(rows.length, FEATURES.length * OUTCOMES.length);
    assert.ok(rows.every(row => row.status === 'insufficient_n'));
    assert.ok(rows.every(row => row.spearman_rho === null));
  }
});

test('artifact generation is deterministic', () => {
  assert.deepEqual(buildAssociation(), buildAssociation());
});
