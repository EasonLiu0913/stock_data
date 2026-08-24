'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  calculateMomentumFeatures,
} = require('../scripts/momentum_tag_features');
const {
  buildSnapshot,
  loadRegistry,
  validateRegistry,
} = require('../scripts/strategy_tag_engine');

function strongMomentumStock(overrides = {}) {
  return {
    stock_code: '2330',
    stock_name: '測試股',
    close: 120,
    high: 122,
    low: 110,
    features: {
      r1: 7.5,
      r3: 12.5,
      r5: 18.5,
      rsi14: 72,
      volume_ratio_5d: 3.2,
      gap_sma20: 6,
    },
    strategy_tag_features: {
      trend_bullish_alignment: true,
      trend_quality_20d: true,
      volume_breakout_confirmation: true,
      market_relative_strength_20d_top20: true,
      industry_relative_strength_20d_top20: true,
      leadership_persistence_7d: true,
      institutional_bullish: true,
      broker_bullish: true,
    },
    ...overrides,
  };
}

function makeRegistryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-registry-'));
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, '..', 'config', 'strategy-tag-registry.json'),
    path.join(root, 'config', 'strategy-tag-registry.json'),
  );
  fs.copyFileSync(
    path.join(__dirname, '..', 'config', 'momentum-tag-registry.json'),
    path.join(root, 'config', 'momentum-tag-registry.json'),
  );
  return root;
}

test('momentum score is deterministic and capped by 100-point component design', () => {
  const result = calculateMomentumFeatures(strongMomentumStock());
  assert.equal(result.momentum_model_version, 1);
  assert.equal(result.momentum_price_score, 30);
  assert.equal(result.momentum_volume_score, 20);
  assert.equal(result.momentum_trend_score, 20);
  assert.equal(result.momentum_chip_score, 16);
  assert.equal(result.momentum_breakout_score, 10);
  assert.equal(result.momentum_score, 96);
  assert.equal(result.momentum_grade, 'A');
  assert.equal(result.momentum_price_volume_sync, true);
  assert.equal(result.momentum_chip_sync, true);
  assert.equal(result.momentum_breakout, true);
});

test('overheated and distribution-risk flags remain observation-only independent facts', () => {
  const overheated = calculateMomentumFeatures(strongMomentumStock({
    features: {
      r1: 7.5, r3: 12.5, r5: 18.5, rsi14: 82, volume_ratio_5d: 3.2, gap_sma20: 6,
    },
  }));
  assert.equal(overheated.momentum_overheated, true);

  const distribution = calculateMomentumFeatures({
    stock_code: '9999',
    close: 104,
    high: 120,
    low: 100,
    features: { r1: 3, r3: 5, r5: 7, rsi14: 60, volume_ratio_5d: 3, gap_sma20: 1 },
    strategy_tag_features: {},
  });
  assert.equal(distribution.momentum_distribution_risk, true);
});

test('score acceleration is unavailable rather than fabricated when previous score is absent', () => {
  const first = calculateMomentumFeatures(strongMomentumStock());
  assert.equal(first.momentum_previous_score, null);
  assert.equal(first.momentum_acceleration, null);

  const second = calculateMomentumFeatures(strongMomentumStock({
    strategy_tag_features: {
      ...strongMomentumStock().strategy_tag_features,
      previous_momentum_score: 70,
    },
  }));
  assert.equal(second.momentum_acceleration, second.momentum_score - 70);
});

test('momentum registry extension validates and produces mutually exclusive C/B/A labels', () => {
  const registry = loadRegistry(makeRegistryRoot());
  assert.equal(validateRegistry(registry), true);
  const labels = new Map(registry.tags.map(tag => [tag.tag_id, tag.label]));
  assert.equal(labels.get('momentum_watch_v1'), '動能準備');
  assert.equal(labels.get('momentum_accelerating_v1'), '動能加速');
  assert.equal(labels.get('momentum_surge_v1'), '動能飆股');

  const aPayload = { forecast_date: '20260824', base_trade_date: '20260824', stocks: [strongMomentumStock()] };
  const snapshot = buildSnapshot(aPayload, registry, { generatedAt: '2026-08-24T10:00:00.000Z' });
  const tags = new Set(snapshot.stocks[0].atomic_tags);
  assert.equal(tags.has('momentum_surge_v1'), true);
  assert.equal(tags.has('momentum_accelerating_v1'), false);
  assert.equal(tags.has('momentum_watch_v1'), false);
  assert.equal(snapshot.tag_classifications.momentum_surge_v1.count, 1);
});

test('momentum scoring does not use market regime as an eligibility input', () => {
  const baseline = calculateMomentumFeatures(strongMomentumStock());
  const bear = calculateMomentumFeatures(strongMomentumStock({
    strategy_tag_features: {
      ...strongMomentumStock().strategy_tag_features,
      market_environment_code: 'bear_market',
      bear_market_environment_active: true,
    },
  }));
  assert.equal(bear.momentum_score, baseline.momentum_score);
  assert.equal(bear.momentum_grade, baseline.momentum_grade);
});
