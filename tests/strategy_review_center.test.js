'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  compactDate,
  normalizeSnapshot,
  buildDefinitions,
  ruleToText,
  expressionGroups,
  snapshotOptions,
  normalizeEvaluation,
  candidateRows,
  sortRows,
} = require('../public/strategy-review-center.js');

const latestRegistry = {
  registry_id: 'current_registry',
  tags: [
    { tag_id: 'tag_a_v1', label: '條件 A', category: 'technical', rule: { path: 'features.a', operator: 'gte', value: 1 } },
    { tag_id: 'risk_watch_v1', label: '風險觀察', usage_role: 'observation_only', evaluation_target: 'market_relative_underperformance_5d' },
  ],
  strategies: [
    { strategy_id: 'strategy_a_v2', family_id: 'strategy_a', version: 2, label: '策略 A', expression: { all: ['tag_a_v1'], any: [], not: [] } },
    { strategy_id: 'future_strategy_v1', family_id: 'future_strategy', version: 1, label: '尚未回算的新策略', expression: { all: ['tag_a_v1'] } },
  ],
};

const snapshot = {
  registry_id: 'historical_registry',
  registry_fingerprint: 'abc123',
  tag_registry: latestRegistry.tags,
  strategy_registry: [latestRegistry.strategies[0]],
  tag_classifications: {
    risk_watch_v1: { count: 1, members: ['2330'], calculation_status: 'completed' },
  },
  strategy_classifications: {
    strategy_a_v2: { count: 2, members: ['2330', '2317'], calculation_status: 'completed' },
  },
  stocks: [
    { stock_code: '2330', stock_name: '台積電', industry: '半導體業', candidate_score: 90, atomic_tags: ['tag_a_v1'], registered_strategy_matches: ['strategy_a_v2'] },
    { stock_code: '2317', stock_name: '鴻海', industry: '其他電子業', candidate_score: 70, atomic_tags: ['tag_a_v1'], registered_strategy_matches: ['strategy_a_v2'] },
  ],
};

const replaySources = {
  tagStrategy: {
    evaluations: {
      strategy_a_v2: {
        strategy_id: 'strategy_a_v2', label: '策略 A', candidates: 2, verified_candidates: 2,
        hits: 1, misses: 1, hit_rate: 50, average_return: 2.5, average_market_excess_return: 1.2,
        members: ['2330', '2317'],
        stocks: [
          { stock_code: '2330', stock_name: '台積電', verified: true, hit: true, close_return: 5, market_excess_return: 3 },
          { stock_code: '2317', stock_name: '鴻海', verified: true, hit: false, close_return: 0, market_excess_return: -0.6 },
        ],
      },
    },
  },
  formalStrategy: null,
  observation: {
    evaluations: {
      risk_watch_v1: {
        tag_id: 'risk_watch_v1', label: '風險觀察', candidates: 1, verified_candidates: 1,
        hits: 1, misses: 0, hit_rate: 100, members: ['2330'],
        stocks: [{ stock_code: '2330', stock_name: '台積電', verified: true, hit: true, return_5d_pct: -8, market_excess_return_5d_pct: -5 }],
      },
    },
  },
};

test('compactDate accepts common date formats and rejects invalid values', () => {
  assert.equal(compactDate('2026-08-05'), '20260805');
  assert.equal(compactDate('2026/08/05'), '20260805');
  assert.equal(compactDate('20260805'), '20260805');
  assert.equal(compactDate('2026-8-5'), '');
});

test('buildDefinitions includes future registry strategies even when the selected snapshot has no classification', () => {
  const definitions = buildDefinitions(latestRegistry, snapshot, replaySources);
  assert.ok(definitions.some(item => item.id === 'strategy_a_v2' && item.kind === 'strategy'));
  assert.ok(definitions.some(item => item.id === 'future_strategy_v1' && item.kind === 'strategy'));
  assert.ok(definitions.some(item => item.id === 'risk_watch_v1' && item.kind === 'observation'));
  assert.equal(definitions.filter(item => item.id === 'strategy_a_v2').length, 1);
});

test('normalizeSnapshot supports the public snapshot registry fields', () => {
  const normalized = normalizeSnapshot(snapshot);
  assert.equal(normalized.registryId, 'historical_registry');
  assert.equal(normalized.strategies.length, 1);
  assert.equal(normalized.tags.length, 2);
  assert.equal(normalized.stocks.length, 2);
});

test('ruleToText and expressionGroups expose readable screening rules', () => {
  assert.equal(ruleToText(latestRegistry.tags[0].rule), 'features.a 大於等於 1');
  const groups = expressionGroups(latestRegistry.strategies[0], new Map([['tag_a_v1', '條件 A']]));
  assert.deepEqual(groups.map(item => item.label), ['全部符合']);
  assert.equal(groups[0].items[0].label, '條件 A');
});

test('snapshotOptions defaults to the latest historical recalculation before the immutable live snapshot', () => {
  const options = snapshotOptions({
    live_snapshot: { file: 'live.json', generated_at: '2026-08-01T00:00:00Z' },
    historical_recalculations: [
      { file: 'old.json', generated_at: '2026-08-02T00:00:00Z' },
      { file: 'new.json', generated_at: '2026-08-03T00:00:00Z' },
    ],
  });
  assert.deepEqual(options.map(item => item.file), ['new.json', 'old.json', 'live.json']);
});

test('normalizeEvaluation merges replay accuracy with snapshot membership', () => {
  const definition = buildDefinitions(latestRegistry, snapshot, replaySources).find(item => item.id === 'strategy_a_v2');
  const evaluation = normalizeEvaluation(definition, snapshot, replaySources);
  assert.equal(evaluation.candidates, 2);
  assert.equal(evaluation.verified, 2);
  assert.equal(evaluation.hits, 1);
  assert.equal(evaluation.hitRate, 50);
  assert.equal(evaluation.averageExcess, 1.2);
});

test('candidateRows merges snapshot attributes and replay outcomes', () => {
  const definition = buildDefinitions(latestRegistry, snapshot, replaySources).find(item => item.id === 'strategy_a_v2');
  const evaluation = normalizeEvaluation(definition, snapshot, replaySources);
  const rows = candidateRows(definition, snapshot, evaluation);
  const tsmc = rows.find(row => row.stock_code === '2330');
  assert.equal(rows.length, 2);
  assert.equal(tsmc.stock_name, '台積電');
  assert.equal(tsmc.industry, '半導體業');
  assert.equal(tsmc.candidate_score, 90);
  assert.equal(tsmc.close_return, 5);
  assert.equal(tsmc.result, 'hit');
});

test('observation rows use risk verification wording and five-day excess return', () => {
  const definition = buildDefinitions(latestRegistry, snapshot, replaySources).find(item => item.id === 'risk_watch_v1');
  const evaluation = normalizeEvaluation(definition, snapshot, replaySources);
  const [row] = candidateRows(definition, snapshot, evaluation);
  assert.equal(row.result_label, '風險印證');
  assert.equal(row.return_5d_pct, -8);
  assert.equal(row.market_excess_return, -5);
});

test('sortRows toggles numeric and text columns while keeping missing values last', () => {
  const rows = [
    { stock_code: '2', candidate_score: null, stock_name: '乙' },
    { stock_code: '1', candidate_score: 90, stock_name: '甲' },
    { stock_code: '3', candidate_score: 70, stock_name: '丙' },
  ];
  assert.deepEqual(sortRows(rows, 'candidate_score', 'desc').map(row => row.stock_code), ['1', '3', '2']);
  assert.deepEqual(sortRows(rows, 'stock_code', 'asc').map(row => row.stock_code), ['1', '2', '3']);
});
