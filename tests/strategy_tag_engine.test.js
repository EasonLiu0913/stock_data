'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  firstDefined,
  evaluateRuleState,
  evaluateRule,
  expressionState,
  expressionMatches,
  validateRegistry,
  registryFingerprint,
  evaluateStock,
  buildSnapshot,
} = require('../scripts/strategy_tag_engine');

const registry = {
  registry_id: 'fixture',
  tags: [
    { tag_id: 'drop_v1', family_id: 'drop', version: 1, label: '急跌', fixed_display: true, enabled: true, rule: { path: 'features.r3', operator: 'lte', value: -8 } },
    { tag_id: 'margin_1d_v1', family_id: 'margin_1d', version: 1, label: '融資當日退場', fixed_display: true, enabled: true, rule: { path: 'features.margin_change', operator: 'lt', value: 0 } },
    { tag_id: 'margin_5d_v1', family_id: 'margin_5d', version: 1, label: '融資五日退場', fixed_display: true, enabled: true, rule: { path: 'features.margin_change_5d', operator: 'lt', value: 0 } },
    { tag_id: 'margin_exit_v1', family_id: 'margin_exit', version: 1, label: '融資明顯退場', fixed_display: true, enabled: true, expression: { all: ['margin_1d_v1', 'margin_5d_v1'], any: [], not: [] } },
    { tag_id: 'disposition_v1', family_id: 'disposition', version: 1, label: '處置股', fixed_display: true, enabled: true, rule: { path: 'is_disposition_stock', operator: 'eq', value: true } },
  ],
  strategies: [
    {
      strategy_id: 'margin_rebound_v1', family_id: 'margin_rebound', version: 1,
      label: '融資退場型跌深反彈', fixed_display: true, enabled: true,
      expression: { all: ['drop_v1', 'margin_exit_v1'], any: [], not: ['disposition_v1'] },
    },
  ],
};

test('numeric and boolean rules distinguish zero, false and missing', () => {
  assert.equal(evaluateRuleState({ value: 0 }, { path: 'value', operator: 'lt', value: 1 }), true);
  assert.equal(evaluateRuleState({}, { path: 'value', operator: 'lt', value: 1 }), null);
  assert.equal(evaluateRule({}, { path: 'value', operator: 'lt', value: 1 }), false);
  assert.equal(evaluateRuleState({ flag: false }, { path: 'flag', operator: 'eq', value: false }), true);
});

test('undefined may use a fallback but explicit null blocks stale fallback values', () => {
  const rule = { paths: ['authoritative.flag', 'legacy_flag'], operator: 'eq', value: true };
  assert.equal(firstDefined({ legacy_flag: false }, rule), false);
  assert.equal(firstDefined({ authoritative: { flag: null }, legacy_flag: false }, rule), null);
  assert.equal(evaluateRuleState({ authoritative: { flag: null }, legacy_flag: false }, rule), null);
});

test('AND OR NOT expression semantics support unavailable inputs', () => {
  const matched = new Set(['a', 'b']);
  assert.equal(expressionMatches({ all: ['a'], any: ['b', 'c'], not: ['d'] }, matched), true);
  assert.equal(expressionMatches({ all: ['a', 'd'], any: [], not: [] }, matched), false);
  assert.equal(expressionMatches({ all: [], any: [], not: ['b'] }, matched), false);
  assert.equal(expressionState({ all: ['a', 'b'] }, new Map([['a', true], ['b', null]])), null);
  assert.equal(expressionState({ all: ['a', 'b'] }, new Map([['a', false], ['b', null]])), false);
  assert.equal(expressionState({ any: ['a', 'b'] }, new Map([['a', false], ['b', null]])), null);
  assert.equal(expressionState({ any: ['a', 'b'] }, new Map([['a', true], ['b', null]])), true);
});

test('registry rejects unknown tag references and invalid versions', () => {
  assert.throws(() => validateRegistry({ tags: [], strategies: [{ strategy_id: 'x', version: 1, expression: { all: ['missing'] } }] }), /unknown tag/);
  assert.throws(() => validateRegistry({ tags: [{ tag_id: 'x', version: 0 }], strategies: [] }), /Invalid tag version/);
});

test('registry fingerprint is stable and changes with rules', () => {
  const first = registryFingerprint(registry);
  const second = registryFingerprint(JSON.parse(JSON.stringify(registry)));
  const changed = JSON.parse(JSON.stringify(registry));
  changed.tags[0].rule.value = -10;
  assert.equal(first, second);
  assert.notEqual(first, registryFingerprint(changed));
});

test('stock receives atomic tags before strategy evaluation', () => {
  const result = evaluateStock({
    stock_code: '2330',
    features: { r3: -9, margin_change: -100, margin_change_5d: -500 },
    is_disposition_stock: false,
  }, registry);
  assert.deepEqual(result.tag_ids, ['drop_v1', 'margin_1d_v1', 'margin_5d_v1', 'margin_exit_v1']);
  assert.deepEqual(result.unavailable_tag_ids, []);
  assert.deepEqual(result.strategy_ids, ['margin_rebound_v1']);
});

test('explicitly unavailable exclusion data makes the dependent strategy unavailable', () => {
  const protectedRegistry = JSON.parse(JSON.stringify(registry));
  protectedRegistry.tags.find(tag => tag.tag_id === 'disposition_v1').rule = {
    paths: ['strategy_tag_features.disposition_stock', 'is_disposition_stock'],
    operator: 'eq',
    value: true,
  };
  const unavailable = evaluateStock({
    stock_code: '2330',
    features: { r3: -9, margin_change: -100, margin_change_5d: -500 },
    strategy_tag_features: { disposition_stock: null },
    is_disposition_stock: false,
  }, protectedRegistry);
  assert.ok(unavailable.unavailable_tag_ids.includes('disposition_v1'));
  assert.deepEqual(unavailable.strategy_ids, []);
  assert.deepEqual(unavailable.unavailable_strategy_ids, ['margin_rebound_v1']);

  const fallback = evaluateStock({
    stock_code: '2330',
    features: { r3: -9, margin_change: -100, margin_change_5d: -500 },
    strategy_tag_features: {},
    is_disposition_stock: false,
  }, protectedRegistry);
  assert.ok(!fallback.unavailable_tag_ids.includes('disposition_v1'));
  assert.deepEqual(fallback.strategy_ids, ['margin_rebound_v1']);
});

test('missing margin data propagates to tag and strategy as unavailable', () => {
  const result = evaluateStock({
    stock_code: '2330',
    features: { r3: -9 },
    is_disposition_stock: false,
  }, registry);
  assert.deepEqual(result.unavailable_tag_ids.sort(), ['margin_1d_v1', 'margin_5d_v1', 'margin_exit_v1'].sort());
  assert.deepEqual(result.unavailable_strategy_ids, ['margin_rebound_v1']);
});

test('fixed tags and strategies remain completed with zero true matches when data exists', () => {
  const snapshot = buildSnapshot({
    forecast_date: '20260803',
    base_trade_date: '20260731',
    stocks: [{
      stock_code: '2330',
      features: { r3: 1, margin_change: 10, margin_change_5d: 20 },
      is_disposition_stock: false,
    }],
  }, registry, { generatedAt: '2026-08-03T00:00:00.000Z' });
  assert.equal(snapshot.schema_version, 3);
  assert.ok(snapshot.registry_fingerprint);
  assert.equal(snapshot.tag_classifications.margin_exit_v1.calculation_status, 'completed');
  assert.equal(snapshot.tag_classifications.margin_exit_v1.count, 0);
  assert.deepEqual(snapshot.tag_classifications.margin_exit_v1.members, []);
  assert.equal(snapshot.strategy_classifications.margin_rebound_v1.calculation_status, 'completed');
  assert.equal(snapshot.strategy_classifications.margin_rebound_v1.count, 0);
});

test('all-missing data is N/A and mixed availability is partial', () => {
  const unavailable = buildSnapshot({
    stocks: [{ stock_code: '1', features: { r3: -9 }, is_disposition_stock: false }],
  }, registry);
  assert.equal(unavailable.tag_classifications.margin_exit_v1.calculation_status, 'unable_to_calculate');
  assert.equal(unavailable.tag_classifications.margin_exit_v1.count, null);
  assert.equal(unavailable.strategy_classifications.margin_rebound_v1.calculation_status, 'unable_to_calculate');

  const partial = buildSnapshot({
    stocks: [
      { stock_code: '1', features: { r3: -9, margin_change: -10, margin_change_5d: -30 }, is_disposition_stock: false },
      { stock_code: '2', features: { r3: -9 }, is_disposition_stock: false },
    ],
  }, registry);
  assert.equal(partial.tag_classifications.margin_exit_v1.calculation_status, 'partial');
  assert.equal(partial.tag_classifications.margin_exit_v1.count, 1);
  assert.equal(partial.tag_classifications.margin_exit_v1.available_stock_count, 1);
  assert.equal(partial.tag_classifications.margin_exit_v1.unavailable_stock_count, 1);
  assert.equal(partial.tag_classifications.margin_exit_v1.coverage_pct, 50);
  assert.deepEqual(partial.stocks[1].unavailable_atomic_tags.sort(), ['margin_1d_v1', 'margin_5d_v1', 'margin_exit_v1'].sort());
});

test('live snapshot and historical recalculation remain explicitly separate', () => {
  const payload = { forecast_date: '20260803', base_trade_date: '20260731', stocks: [] };
  const live = buildSnapshot(payload, registry, { evaluationMode: 'live_snapshot' });
  const recalculated = buildSnapshot(payload, registry, { evaluationMode: 'historical_recalculation', dataAsOf: '20260731' });
  assert.equal(live.evaluation_mode, 'live_snapshot');
  assert.equal(recalculated.evaluation_mode, 'historical_recalculation');
  assert.equal(recalculated.data_as_of, '20260731');
});
