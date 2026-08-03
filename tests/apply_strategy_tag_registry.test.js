'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  applyRegistry,
  enrichMarginFeatures,
  latestPredictionDate,
} = require('../scripts/apply_strategy_tag_registry');

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

function marginRegistry(invalidFingerprints = []) {
  return {
    registry_id: 'margin_fixture_v1',
    replace_invalid_live_fingerprints: invalidFingerprints,
    tags: [
      {
        tag_id: 'margin_1d_v1', family_id: 'margin_1d', version: 1,
        label: '融資當日退場', fixed_display: true, enabled: true,
        rule: { path: 'strategy_tag_features.margin_change', operator: 'lt', value: 0 },
      },
      {
        tag_id: 'margin_5d_v1', family_id: 'margin_5d', version: 1,
        label: '融資近五日退場', fixed_display: true, enabled: true,
        rule: { path: 'strategy_tag_features.margin_change_5d', operator: 'lt', value: 0 },
      },
      {
        tag_id: 'margin_exit_v1', family_id: 'margin_exit', version: 1,
        label: '融資明顯退場', fixed_display: true, enabled: true,
        expression: { all: ['margin_1d_v1', 'margin_5d_v1'], any: [], not: [] },
      },
    ],
    strategies: [{
      strategy_id: 'margin_rebound_v1', family_id: 'margin_rebound', version: 1,
      label: '融資退場型跌深反彈', fixed_display: true, enabled: true,
      expression: { all: ['margin_exit_v1'], any: [], not: [] },
    }],
  };
}

function createWorkspace(stocks = [{ stock_code: '2330', stock_name: '台積電', features: { r3: -9 } }]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'strategy-registry-'));
  writeJson(path.join(root, 'data_predictions', '20260803', 'summary.json'), {
    forecast_date: '20260803',
    base_trade_date: '20260731',
    stocks,
  });
  fs.mkdirSync(path.join(root, 'data_predictions', '20260804'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data_predictions', '20260804', 'summary.json'), '');
  return root;
}

const MARGIN_HEADERS = [
  '股票代號', '股票名稱',
  '融資買進', '融資賣出', '融資現金償還', '融資前日餘額', '融資今日餘額', '融資限額',
  '融券買進', '融券賣出', '融券現券償還', '融券前日餘額', '融券今日餘額', '融券限額',
  '資券互抵', '註記',
];

function writeMarginSeries(root) {
  const dates = ['20260727', '20260728', '20260729', '20260730', '20260731'];
  const changes = [-10, -20, -30, -40, -50];
  const files = [];
  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const previous = 1000 - changes.slice(0, index).reduce((sum, value) => sum - value, 0);
    const current = previous + changes[index];
    const row = [
      '2330', '台積電', '1', '2', '0', String(previous), String(current), '10000',
      '0', '0', '0', '0', '0', '10000', '0', '',
    ];
    const filename = `${date}_twse_margin_balance.csv`;
    files.push(filename);
    const file = path.join(root, 'data_twse_margin_balance', filename);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${MARGIN_HEADERS.join(',')}\n${row.join(',')}\n`);
  }
  writeJson(path.join(root, 'data_twse_margin_balance', 'files.json'), files);
  return dates;
}

test('latest prediction date ignores empty or invalid summaries', () => {
  const root = createWorkspace();
  assert.equal(latestPredictionDate('data_predictions', root), '20260803');
});

test('margin enrichment uses the latest five trading dates without future leakage', () => {
  const root = createWorkspace([
    { stock_code: '2330', stock_name: '台積電', features: {} },
    { stock_code: '2317', stock_name: '鴻海', features: {} },
  ]);
  const dates = writeMarginSeries(root);
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'data_predictions', '20260803', 'summary.json')));
  const metadata = enrichMarginFeatures(payload, root, '20260731');
  assert.deepEqual(metadata.selected_dates, dates);
  assert.equal(metadata.calculation_status, 'partial');
  assert.equal(metadata.available_1d_stock_count, 1);
  assert.equal(metadata.available_5d_stock_count, 1);
  assert.equal(payload.stocks[0].strategy_tag_features.margin_change, -50);
  assert.equal(payload.stocks[0].strategy_tag_features.margin_change_5d, -150);
  assert.equal(payload.stocks[0].strategy_tag_features.margin_valid_days, 5);
  assert.equal(payload.stocks[1].strategy_tag_features.margin_change, null);
  assert.equal(payload.stocks[1].strategy_tag_features.margin_change_5d, null);
});

test('live snapshot enriches summary once and reuses immutable snapshot', () => {
  const root = createWorkspace();
  const registry = fixtureRegistry();
  const first = applyRegistry({ workspaceRoot: root, date: '20260803', registry, evaluationMode: 'live_snapshot' });
  const second = applyRegistry({ workspaceRoot: root, date: '20260803', registry, evaluationMode: 'live_snapshot' });
  assert.equal(first.reused_existing_snapshot, false);
  assert.equal(second.reused_existing_snapshot, true);
  assert.equal(second.manifest_changed, false);
  const summary = JSON.parse(fs.readFileSync(path.join(root, 'data_predictions', '20260803', 'summary.json')));
  assert.deepEqual(summary.stocks[0].atomic_tags, ['drop_v1']);
  assert.deepEqual(summary.stocks[0].registered_strategy_matches, ['rebound_v1']);
  assert.equal(summary.strategy_classifications_v2.rebound_v1.count, 1);
});

test('invalid live snapshot is archived and replaced with calculated margin features', () => {
  const root = createWorkspace([
    { stock_code: '2330', stock_name: '台積電', features: {} },
    { stock_code: '2317', stock_name: '鴻海', features: {} },
  ]);
  writeMarginSeries(root);
  const liveFile = path.join(root, 'data_prediction_analysis', 'strategy-snapshots', 'live_snapshot', '20260803.json');
  writeJson(liveFile, {
    schema_version: 2,
    registry_id: 'bad_registry',
    registry_fingerprint: 'badfingerprint',
    forecast_date: '20260803',
    base_trade_date: '20260731',
    evaluation_mode: 'live_snapshot',
    data_as_of: '20260731',
    generated_at: '2026-08-03T00:00:00.000Z',
    tag_registry: [], strategy_registry: [], tag_classifications: {}, strategy_classifications: {}, stocks: [],
  });
  const result = applyRegistry({
    workspaceRoot: root,
    date: '20260803',
    registry: marginRegistry(['badfingerprint']),
    evaluationMode: 'live_snapshot',
  });
  assert.equal(result.corrected_invalid_live_snapshot, true);
  assert.ok(result.archived_snapshot_file);
  assert.ok(fs.existsSync(path.join(root, result.archived_snapshot_file)));
  const snapshot = JSON.parse(fs.readFileSync(liveFile));
  assert.equal(snapshot.schema_version, 3);
  assert.equal(snapshot.tag_classifications.margin_exit_v1.calculation_status, 'partial');
  assert.equal(snapshot.tag_classifications.margin_exit_v1.count, 1);
  assert.equal(snapshot.tag_classifications.margin_exit_v1.available_stock_count, 1);
  assert.equal(snapshot.tag_classifications.margin_exit_v1.unavailable_stock_count, 1);
  assert.equal(snapshot.strategy_classifications.margin_rebound_v1.count, 1);
  assert.deepEqual(snapshot.stocks[0].registered_strategy_matches, ['margin_rebound_v1']);
  assert.deepEqual(snapshot.stocks[1].unavailable_registered_strategies, ['margin_rebound_v1']);
  const summary = JSON.parse(fs.readFileSync(path.join(root, 'data_predictions', '20260803', 'summary.json')));
  assert.equal(summary.stocks[0].strategy_tag_features.margin_change_5d, -150);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data_prediction_analysis', 'strategy-snapshots', 'manifest.json')));
  assert.equal(manifest.schema_version, 2);
  assert.equal(manifest.dates['20260803'].live_snapshot_history.length, 1);
  assert.match(manifest.dates['20260803'].live_snapshot_history[0].file, /badfingerprint\.json$/);

  const second = applyRegistry({
    workspaceRoot: root,
    date: '20260803',
    registry: marginRegistry(['badfingerprint']),
    evaluationMode: 'live_snapshot',
  });
  assert.equal(second.corrected_invalid_live_snapshot, false);
  assert.equal(second.reused_existing_snapshot, true);
});

test('a valid live snapshot remains immutable when a later registry is different', () => {
  const root = createWorkspace();
  const liveFile = path.join(root, 'data_prediction_analysis', 'strategy-snapshots', 'live_snapshot', '20260803.json');
  writeJson(liveFile, {
    schema_version: 3,
    registry_id: 'valid_old',
    registry_fingerprint: 'valid-old-fingerprint',
    forecast_date: '20260803',
    base_trade_date: '20260731',
    evaluation_mode: 'live_snapshot',
    data_as_of: '20260731',
    generated_at: '2026-08-03T00:00:00.000Z',
    tag_registry: [], strategy_registry: [], tag_classifications: {}, strategy_classifications: {}, stocks: [],
  });
  const result = applyRegistry({
    workspaceRoot: root,
    date: '20260803',
    registry: marginRegistry([]),
    evaluationMode: 'live_snapshot',
  });
  assert.equal(result.corrected_invalid_live_snapshot, false);
  assert.equal(result.reused_existing_snapshot, true);
  assert.equal(JSON.parse(fs.readFileSync(liveFile)).registry_fingerprint, 'valid-old-fingerprint');
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
