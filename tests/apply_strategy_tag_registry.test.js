'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { applyRegistry, latestPredictionDate } = require('../scripts/apply_strategy_tag_registry');

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function fixtureRegistry(version = 1, threshold = -8) {
  return {
    registry_id: `fixture_v${version}`,
    tags: [{
      tag_id: `drop_v${version}`, family_id: 'drop', version, label: '急跌', fixed_display: true, enabled: true,
      rule: { path: 'features.r3', operator: 'lte', value: threshold },
    }],
    strategies: [{
      strategy_id: `rebound_v${version}`, family_id: 'rebound', version, label: '反彈', fixed_display: true, enabled: true,
      expression: { all: [`drop_v${version}`], any: [], not: [] },
    }],
  };
}

function createWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'strategy-registry-'));
  writeJson(path.join(root, 'data_predictions', '20260803', 'summary.json'), {
    forecast_date: '20260803',
    base_trade_date: '20260731',
    stocks: [{ stock_code: '2330', stock_name: '台積電', features: { r3: -9 } }],
  });
  fs.mkdirSync(path.join(root, 'data_predictions', '20260804'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data_predictions', '20260804', 'summary.json'), '');
  return root;
}

test('latest prediction date ignores empty or invalid summaries', () => {
  const root = createWorkspace();
  assert.equal(latestPredictionDate('data_predictions', root), '20260803');
});

test('live snapshot enriches summary once and reuses immutable snapshot', () => {
  const root = createWorkspace();
  const registry = fixtureRegistry();
  const first = applyRegistry({ workspaceRoot: root, date: '20260803', registry, evaluationMode: 'live_snapshot' });
  const second = applyRegistry({ workspaceRoot: root, date: '20260803', registry, evaluationMode: 'live_snapshot' });
  assert.equal(first.reused_existing_snapshot, false);
  assert.equal(second.reused_existing_snapshot, true);
  const summary = JSON.parse(fs.readFileSync(path.join(root, 'data_predictions', '20260803', 'summary.json')));
  assert.deepEqual(summary.stocks[0].atomic_tags, ['drop_v1']);
  assert.deepEqual(summary.stocks[0].registered_strategy_matches, ['rebound_v1']);
  assert.equal(summary.strategy_classifications_v2.rebound_v1.count, 1);
});

test('historical recalculation preserves summary and stores multiple registry versions', () => {
  const root = createWorkspace();
  const summaryFile = path.join(root, 'data_predictions', '20260803', 'summary.json');
  const original = fs.readFileSync(summaryFile, 'utf8');
  const v1 = applyRegistry({ workspaceRoot: root, date: '20260803', registry: fixtureRegistry(1, -8), evaluationMode: 'historical_recalculation', dataAsOf: '20260731' });
  const v2 = applyRegistry({ workspaceRoot: root, date: '20260803', registry: fixtureRegistry(2, -10), evaluationMode: 'historical_recalculation', dataAsOf: '20260731' });
  assert.notEqual(v1.snapshot_file, v2.snapshot_file);
  assert.equal(fs.readFileSync(summaryFile, 'utf8'), original);
  assert.ok(fs.existsSync(path.join(root, v1.snapshot_file)));
  assert.ok(fs.existsSync(path.join(root, v2.snapshot_file)));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data_prediction_analysis', 'strategy-snapshots', 'manifest.json')));
  assert.equal(manifest.dates['20260803'].historical_recalculations.length, 2);
});
