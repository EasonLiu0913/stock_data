'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateRule,
  expressionMatches,
  validateRegistry,
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

test('numeric and boolean rules distinguish zero from missing', () => {
  assert.equal(evaluateRule({ value: 0 }, { path: 'value', operator: 'lt', value: 1 }), true);
  assert.equal(evaluateRule({}, { path: 'value', operator: 'lt', value: 1 }), false);
  assert.equal(evaluateRule({ flag: false }, { path: 'flag', operator: 'eq', value: false }), true);
});

test('AND OR NOT expression semantics are deterministic', () => {
  const matched = new Set(['a', 'b']);
  assert.equal(expressionMatches({ all: ['a'], any: ['b', 'c'], not: ['d'] }, matched), true);
  assert.equal(expressionMatches({ all: ['a', 'd'], any: [], not: [] }, matched), false);
  assert.equal(expressionMatches({ all: [], any: [], not: ['b'] }, matched), false);
});

test('registry rejects unknown tag references', () => {
  assert.throws(() => validateRegistry({ tags: [], strategies: [{ strategy_id: 'x', expression: { all: ['missing'] } }] }), /unknown tag/);
});

test('stock receives atomic tags before strategy evaluation', () => {
  const result = evaluateStock({
    stock_code: '2330',
    features: { r3: -9, margin_change: -100, margin_change_5d: -500 },
    is_disposition_stock: false,
  }, registry);
  assert.deepEqual(result.tag_ids, ['drop_v1', 'margin_1d_v1', 'margin_5d_v1', 'margin_exit_v1']);
  assert.deepEqual(result.strategy_ids, ['margin_rebound_v1']);
});

test('fixed tags and strategies remain in snapshot when count is zero', () => {
  const snapshot = buildSnapshot({
    forecast_date: '20260803',
    base_trade_date: '20260731',
    stocks: [{ stock_code: '2330', features: { r3: 1, margin_change: 10, margin_change_5d: 20 } }],
  }, registry, { generatedAt: '2026-08-03T00:00:00.000Z' });
  assert.equal(snapshot.tag_classifications.margin_exit_v1.count, 0);
  assert.deepEqual(snapshot.tag_classifications.margin_exit_v1.members, []);
  assert.equal(snapshot.strategy_classifications.margin_rebound_v1.count, 0);
  assert.deepEqual(snapshot.strategy_classifications.margin_rebound_v1.members, []);
});

test('live snapshot and historical recalculation remain explicitly separate', () => {
  const payload = { forecast_date: '20260803', base_trade_date: '20260731', stocks: [] };
  const live = buildSnapshot(payload, registry, { evaluationMode: 'live_snapshot' });
  const recalculated = buildSnapshot(payload, registry, { evaluationMode: 'historical_recalculation', dataAsOf: '20260731' });
  assert.equal(live.evaluation_mode, 'live_snapshot');
  assert.equal(recalculated.evaluation_mode, 'historical_recalculation');
  assert.equal(recalculated.data_as_of, '20260731');
});
