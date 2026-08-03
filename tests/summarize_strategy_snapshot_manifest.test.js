'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  snapshotSummary,
  summarizeManifest,
} = require('../scripts/summarize_strategy_snapshot_manifest');

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function fixtureSnapshot() {
  return {
    stocks: [{ stock_code: '2330' }, { stock_code: '2317' }],
    source_metadata: {
      margin: {
        calculation_status: 'partial',
        coverage_5d_pct: 94.01,
        calculation_message: '部分股票沒有融資紀錄。',
      },
    },
    tag_classifications: {
      oversold: {
        tag_id: 'oversold',
        family_id: 'oversold',
        version: 1,
        label: '超賣',
        count: 1,
        calculation_status: 'completed',
        coverage_pct: 100,
        available_stock_count: 2,
        unavailable_stock_count: 0,
      },
    },
    strategy_classifications: {
      rebound_v2: {
        strategy_id: 'rebound_v2',
        family_id: 'rebound',
        version: 2,
        label: '反彈策略',
        count: 0,
        calculation_status: 'completed',
        coverage_pct: 100,
        available_stock_count: 2,
        unavailable_stock_count: 0,
      },
    },
  };
}

test('snapshotSummary keeps zero candidates and source coverage', () => {
  const summary = snapshotSummary(fixtureSnapshot());
  assert.equal(summary.total_stock_count, 2);
  assert.equal(summary.tags[0].count, 1);
  assert.equal(summary.strategies[0].count, 0);
  assert.equal(summary.strategies[0].version, 2);
  assert.equal(summary.sources.margin.coverage_pct, 94.01);
});

test('summarizeManifest annotates live, archived, and recalculated snapshots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-summary-'));
  const snapshotFiles = [
    'snapshots/live.json',
    'snapshots/archive.json',
    'snapshots/history.json',
  ];
  for (const file of snapshotFiles) writeJson(path.join(root, file), fixtureSnapshot());
  const manifestFile = path.join(root, 'snapshots', 'manifest.json');
  writeJson(manifestFile, {
    schema_version: 2,
    updated_at: null,
    dates: {
      '20260803': {
        live_snapshot: { file: snapshotFiles[0] },
        live_snapshot_history: [{ file: snapshotFiles[1] }],
        historical_recalculations: [{ file: snapshotFiles[2] }],
      },
    },
  });

  const first = summarizeManifest(manifestFile, { workspaceRoot: root });
  const saved = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  assert.equal(first.entry_count, 3);
  assert.equal(first.summarized_entry_count, 3);
  assert.equal(saved.dates['20260803'].live_snapshot.classification_summary.strategy_count, 1);
  assert.equal(saved.dates['20260803'].historical_recalculations[0].classification_summary.strategies[0].count, 0);

  const second = summarizeManifest(manifestFile, { workspaceRoot: root });
  assert.equal(second.changed, false);
  assert.equal(second.summarized_entry_count, 0);
});
