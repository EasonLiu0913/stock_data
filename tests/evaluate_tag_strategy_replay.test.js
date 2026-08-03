'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  hitForTarget,
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
