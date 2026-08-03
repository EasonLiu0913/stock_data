'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  hitForTarget,
  normalizedEvaluationTarget,
  evaluateStrategyClassification,
  normalizeSnapshotRegistry,
  resolveLiveSnapshot,
  safeSnapshotPath,
  syncReplayRows,
} = require('../scripts/evaluate_tag_strategy_replay');

function writeJson(rootDir, relativePath, payload) {
  const file = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return file;
}

test('resolves the versioned live snapshot through the snapshot manifest', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-replay-snapshot-'));
  try {
    const snapshotRelative = 'data_prediction_analysis/strategy-snapshots/live_snapshot/20260803.json';
    writeJson(rootDir, snapshotRelative, {
      schema_version: 3,
      registry_id: 'prediction_tag_strategy_registry_v2',
      registry_fingerprint: 'abc123',
      forecast_date: '20260803',
      evaluation_mode: 'live_snapshot',
      tag_registry: [{ tag_id: 'tag_v1' }],
      strategy_registry: [{
        strategy_id: 'strategy_v2',
        family_id: 'strategy',
        version: 2,
        label: '測試策略',
        evaluation_target: 'close_return_gt_5',
      }],
      strategy_classifications: {
        strategy_v2: {
          strategy_id: 'strategy_v2',
          count: 1,
          members: ['2330'],
          calculation_status: 'completed',
        },
      },
    });
    writeJson(rootDir, 'data_prediction_analysis/strategy-snapshots/manifest.json', {
      schema_version: 2,
      dates: {
        20260803: {
          live_snapshot: {
            file: snapshotRelative,
            registry_fingerprint: 'abc123',
          },
        },
      },
    });

    const resolved = resolveLiveSnapshot({
      date: '20260803',
      legacySnapshotFile: path.join(rootDir, 'data_predictions/20260803/tag-strategy-snapshot.json'),
      workspaceRoot: rootDir,
    });

    assert.equal(resolved.snapshotFormat, 'versioned_registry_v2');
    assert.equal(resolved.registry.registry_id, 'prediction_tag_strategy_registry_v2');
    assert.equal(resolved.registry.strategies[0].strategy_id, 'strategy_v2');
    assert.equal(resolved.snapshot.strategy_classifications.strategy_v2.count, 1);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('normalizes a versioned snapshot registry for replay evaluation', () => {
  const registry = normalizeSnapshotRegistry({
    schema_version: 3,
    registry_id: 'registry_v2',
    registry_fingerprint: 'fingerprint',
    tag_registry: [{ tag_id: 'tag_v1' }],
    strategy_registry: [{ strategy_id: 'strategy_v2' }],
  });

  assert.equal(registry.registry_id, 'registry_v2');
  assert.deepEqual(registry.tags, [{ tag_id: 'tag_v1' }]);
  assert.deepEqual(registry.strategies, [{ strategy_id: 'strategy_v2' }]);
});

test('evaluates the five-day intraday rebound target only when the window is complete', () => {
  assert.equal(hitForTarget({
    actual: {
      max_return_5d_status: 'completed',
      max_return_5d: 10,
    },
  }, 'intraday_rebound_5d_10pct'), true);

  assert.equal(hitForTarget({
    actual: {
      max_return_5d_status: 'completed_corporate_action_check_unavailable',
      max_return_5d: 9.99,
    },
  }, 'intraday_rebound_5d_10pct'), false);

  assert.equal(hitForTarget({
    actual: {
      max_return_5d_status: 'incomplete_stock_price_window',
      max_return_5d: 12,
    },
  }, 'intraday_rebound_5d_10pct'), null);
});

test('uses the 4-percent-or-above rebound boundary from 20260803', () => {
  assert.equal(hitForTarget({
    verified: true,
    actual: { close_return: 4 },
  }, 'close_return_gte_4', '20260803'), true);
  assert.equal(hitForTarget({
    verified: true,
    actual: { close_return: 3.99 },
  }, 'close_return_gte_4', '20260803'), false);
  assert.equal(hitForTarget({
    verified: true,
    actual: { close_return: 5 },
  }, 'close_return_gt_5', '20260802'), false);
});

test('corrects both rebound strategies to the versioned same-day verification rule', () => {
  const definition = {
    strategy_id: 'oversold_margin_exit_rebound_v1',
    family_id: 'oversold_margin_exit_rebound',
    version: 1,
    label: '融資退場型跌深反彈',
    evaluation_target: 'intraday_rebound_5d_10pct',
  };
  const rows = [
    {
      stock_code: '2330',
      stock_name: '台積電',
      verified: true,
      actual: { close_return: 6.2, pattern_tags: ['開低走高'] },
      market_relative: { classification: 'relative_leadership' },
    },
    {
      stock_code: '2317',
      stock_name: '鴻海',
      verified: true,
      actual: { close_return: 4, pattern_tags: ['收盤偏強'] },
      market_relative: { classification: 'sector_driven' },
    },
    {
      stock_code: '2454',
      stock_name: '聯發科',
      verified: true,
      actual: { close_return: 3.99, pattern_tags: [] },
      market_relative: { classification: 'sector_driven' },
    },
  ];

  assert.equal(normalizedEvaluationTarget(definition, '20260802'), 'close_return_gt_5');
  assert.equal(normalizedEvaluationTarget(definition, '20260803'), 'close_return_gte_4');
  const evaluation = evaluateStrategyClassification(definition, {
    count: 3,
    members: ['2330', '2317', '2454'],
    calculation_status: 'partial',
  }, rows, null, '20260803');

  assert.equal(evaluation.evaluation_target, 'close_return_gte_4');
  assert.equal(evaluation.evaluation_policy_version, 2);
  assert.equal(evaluation.evaluation_operator, 'gte');
  assert.equal(evaluation.evaluation_threshold_percent, 4);
  assert.equal(evaluation.evaluation_target_label, '當日收盤報酬 ≥ 4.00%');
  assert.equal(evaluation.calculation_status, 'completed');
  assert.equal(evaluation.verified_candidates, 3);
  assert.equal(evaluation.hits, 2);
  assert.equal(evaluation.misses, 1);
  assert.equal(evaluation.hit_rate, 66.67);
  assert.deepEqual(evaluation.hit_members, ['2330', '2317']);
  assert.deepEqual(evaluation.miss_members, ['2454']);
  assert.equal(evaluation.stocks[0].verification_label, '明顯準確');
  assert.equal(evaluation.stocks[1].verification_label, '明顯準確');
  assert.equal(evaluation.stocks[2].verification_label, '明顯不準');
  assert.deepEqual(evaluation.stocks[0].outcome_tags, ['跌深反彈']);
  assert.deepEqual(evaluation.stocks[1].outcome_tags, ['跌深反彈']);
  assert.ok(rows[0].actual.pattern_tags.includes('跌深反彈'));
  assert.ok(rows[1].actual.pattern_tags.includes('跌深反彈'));
  assert.ok(!rows[2].actual.pattern_tags.includes('跌深反彈'));
});

test('copies versioned atomic tags and registered strategy matches into replay rows', () => {
  const replayDashboard = {
    rows: [{ stock_code: '2330', prediction: {} }],
  };
  const summary = {
    stocks: [{
      stock_code: '2330',
      atomic_tags: ['technical_rsi_oversold_v1'],
      unavailable_atomic_tags: ['margin_exit_5d_v1'],
      registered_strategy_matches: ['oversold_electronics_rebound_v2'],
      unavailable_registered_strategies: [],
    }],
  };

  syncReplayRows(replayDashboard, summary);

  assert.deepEqual(replayDashboard.rows[0].prediction.atomic_tags, ['technical_rsi_oversold_v1']);
  assert.deepEqual(
    replayDashboard.rows[0].prediction.registered_strategy_matches,
    ['oversold_electronics_rebound_v2'],
  );
  assert.deepEqual(
    replayDashboard.rows[0].prediction.prediction_strategies,
    ['oversold_electronics_rebound_v2'],
  );
});

test('rejects snapshot paths that escape the repository root', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-replay-path-'));
  try {
    assert.throws(
      () => safeSnapshotPath(rootDir, '../outside.json'),
      /Invalid versioned tag strategy snapshot path/,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
