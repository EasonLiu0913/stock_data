'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hashFreezePayload,
  partitionFor,
  percentileRanks,
  selectAnchorSessions,
} = require('../scripts/freeze_institutional_accumulation_development_sample');

test('Phase 2 anchor session selection keeps the latest usable sessions after T-20 warmup', () => {
  const dates = Array.from({ length: 35 }, (_, index) => `2026${String(index + 1).padStart(4, '0')}`);
  assert.deepEqual(selectAnchorSessions(dates, 4), dates.slice(-4));
});

test('Phase 2 partitions freeze stock holdout before time holdout', () => {
  const universe = ['1101', '1102', '1103', '1104', '1108', '1109', '1110', '1201', '1203', '1210'];
  const sessions = ['20260814', '20260817', '20260818', '20260819', '20260820', '20260821', '20260824', '20260825', '20260826', '20260827'];
  assert.equal(partitionFor('1108', '20260827', universe, sessions), 'stock_holdout');
  assert.equal(partitionFor('1101', '20260827', universe, sessions), 'time_holdout');
  assert.equal(partitionFor('1101', '20260824', universe, sessions), 'methodology_development');
});

test('percentile ranks are deterministic and average ties', () => {
  const rows = [{ v: 10 }, { v: 20 }, { v: 20 }, { v: 40 }];
  const ranks = percentileRanks(rows, row => row.v);
  assert.equal(ranks[0], 0);
  assert.equal(ranks[1], 0.5);
  assert.equal(ranks[2], 0.5);
  assert.equal(ranks[3], 1);
});

test('freeze content hash excludes only its own hash field', () => {
  const a = { freeze_id: 'x', outcome_blind: true, anchors: [{ stock: '1101' }] };
  const first = hashFreezePayload(a);
  const second = hashFreezePayload({ ...a, content_sha256: 'different' });
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});
