'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STRATEGY_ID,
  LEGACY_STRATEGY_IDS,
  STRATEGY_LABEL,
  LEGACY_STRATEGY_LABELS,
  evaluateFormalStrategy,
  upsertFormalStrategyReplayGroup,
  syncReplayDashboardFormalTags,
} = require('../scripts/evaluate_formal_strategy_replay');

function prediction(code, formal = false) {
  return {
    stock_code: code,
    stock_name: code,
    strategy_tags: formal ? [STRATEGY_LABEL] : ['一般觀察'],
    formal_market_strategy: formal ? {
      strategy_id: STRATEGY_ID,
      confirmation_score: 7,
      environment_code: 'post_shock_day_2',
    } : undefined,
  };
}

function replay(code, classification, verified = true) {
  return {
    stock_code: code,
    verified,
    market_relative: {
      classification,
      market_percentile: classification === 'relative_leadership' ? 95 : 50,
    },
  };
}

test('formal strategy replay evaluates only formally tagged candidates', () => {
  const result = evaluateFormalStrategy(
    [prediction('2207', true), prediction('2540', true), prediction('2330', false)],
    [replay('2207', 'relative_leadership'), replay('2540', 'broad_market_driven'), replay('2330', 'relative_leadership')],
  );

  assert.equal(result.candidates, 2);
  assert.equal(result.verified_candidates, 2);
  assert.equal(result.hits, 1);
  assert.equal(result.precision, 50);
  assert.deepEqual(result.members, ['2207', '2540']);
  assert.deepEqual(result.hit_members, ['2207']);
  assert.equal(result.changes_direction_score, false);
});

test('formal strategy replay reports missing replay candidates without treating them as misses', () => {
  const result = evaluateFormalStrategy(
    [prediction('2207', true), prediction('5880', true)],
    [replay('2207', 'relative_leadership')],
  );

  assert.equal(result.candidates, 2);
  assert.equal(result.verified_candidates, 1);
  assert.equal(result.hits, 1);
  assert.equal(result.precision, 100);
  assert.equal(result.missing_replay_candidates, 1);
});

test('formal strategy replay still recognizes legacy tag-only candidates', () => {
  const legacy = prediction('2207', false);
  legacy.strategy_tags = [LEGACY_STRATEGY_LABELS[0]];
  const result = evaluateFormalStrategy(
    [legacy],
    [replay('2207', 'relative_leadership')],
  );

  assert.equal(result.label, STRATEGY_LABEL);
  assert.equal(result.candidates, 1);
  assert.equal(result.hits, 1);
});

test('formal strategy replay migrates candidates carrying the legacy strategy id', () => {
  const legacy = prediction('2207', true);
  legacy.strategy_tags = [];
  legacy.formal_market_strategy.strategy_id = LEGACY_STRATEGY_IDS[0];
  const result = evaluateFormalStrategy(
    [legacy],
    [replay('2207', 'relative_leadership')],
  );

  assert.equal(result.strategy_id, STRATEGY_ID);
  assert.equal(result.candidates, 1);
  assert.equal(result.hits, 1);
});

test('formal strategy remains in replay strategy groups even with zero candidates', () => {
  const evaluation = evaluateFormalStrategy(
    [prediction('2330', false)],
    [replay('2330', 'broad_market_driven')],
  );
  const groups = upsertFormalStrategyReplayGroup(
    [{ name: '一般觀察', count: 1 }],
    evaluation,
    [replay('2330', 'broad_market_driven')],
  );
  const formal = groups.find((group) => group.name === STRATEGY_LABEL);

  assert.equal(formal.count, 0);
  assert.equal(formal.formal_strategy, true);
  assert.equal(formal.relative_leadership_hits, 0);
});

test('formal strategy replay synchronization updates compact dashboard tags', () => {
  const dashboard = {
    rows: [
      { stock_code: '2207', prediction: { strategy_tags: ['優先觀察'] } },
      { stock_code: '2330', prediction: { strategy_tags: [STRATEGY_LABEL, LEGACY_STRATEGY_LABELS[0], '一般觀察'] } },
    ],
  };
  syncReplayDashboardFormalTags(dashboard, {
    members: ['2207'],
  });

  assert.deepEqual(
    dashboard.rows[0].prediction.strategy_tags,
    [STRATEGY_LABEL, '優先觀察'],
  );
  assert.deepEqual(dashboard.rows[1].prediction.strategy_tags, ['一般觀察']);
});
