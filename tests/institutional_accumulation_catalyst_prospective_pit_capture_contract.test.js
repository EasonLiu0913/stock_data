'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildProspectiveSnapshot,
  validateProspectiveSnapshot,
  snapshotRelativePath,
  writeSnapshotAppendOnly,
} = require('../scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract');

function input(overrides = {}) {
  return {
    source_provider: 'MOPS',
    source_interface: 'prospective_material_information_listing',
    source_request_key: '2330|115',
    collected_at: '2026-09-10T12:00:00.000Z',
    source_reported_at: '2026-09-10T11:57:00.000Z',
    parser_version: 'institutional-accumulation-prospective-catalyst-parser-v1',
    methodology_identity: 'institutional-accumulation-catalyst-prospective-pit-capture-contract-v1',
    raw_response: '{"code":200,"data":[{"seq":1}]}',
    ...overrides,
  };
}

test('builds deterministic immutable forward-only PIT snapshot from zero-network fixture', () => {
  const a = buildProspectiveSnapshot(input());
  const b = buildProspectiveSnapshot(input());
  assert.deepStrictEqual(a, b);
  assert.equal(validateProspectiveSnapshot(a), true);
  assert.equal(a.pit_known_at, a.collected_at);
  assert.equal(a.historical_back_imputation_allowed, false);
  assert.equal(a.source_event_time_may_move_known_at_earlier, false);
  assert.match(a.response_sha256, /^[a-f0-9]{64}$/);
  assert.match(a.immutable_snapshot_id, /^[a-f0-9]{64}$/);
});

test('different response value/version produces a different immutable snapshot identity', () => {
  const oldVersion = buildProspectiveSnapshot(input());
  const newVersion = buildProspectiveSnapshot(input({
    collected_at: '2026-09-10T12:05:00.000Z',
    raw_response: '{"code":200,"data":[{"seq":1,"updated":true}]}',
  }));
  assert.notEqual(newVersion.response_sha256, oldVersion.response_sha256);
  assert.notEqual(newVersion.immutable_snapshot_id, oldVersion.immutable_snapshot_id);
  assert.notEqual(snapshotRelativePath(newVersion), snapshotRelativePath(oldVersion));
});

test('source-reported time never back-imputes known-at earlier than immutable collection', () => {
  const snapshot = buildProspectiveSnapshot(input({ source_reported_at: '2026-08-01T00:00:00.000Z' }));
  assert.equal(snapshot.pit_known_at, '2026-09-10T12:00:00.000Z');
  assert.equal(snapshot.source_reported_at, '2026-08-01T00:00:00.000Z');
  assert.equal(snapshot.source_event_time_may_move_known_at_earlier, false);
});

test('append-only writer is idempotent for identical snapshot and refuses overwrite collision', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prospective-pit-'));
  const snapshot = buildProspectiveSnapshot(input());
  const first = writeSnapshotAppendOnly(root, snapshot);
  const second = writeSnapshotAppendOnly(root, snapshot);
  assert.equal(first.status, 'created');
  assert.equal(second.status, 'unchanged');

  const destination = path.join(root, ...first.relative_path.split('/'));
  fs.writeFileSync(destination, '{"tampered":true}\n');
  assert.throws(() => writeSnapshotAppendOnly(root, snapshot), /immutable snapshot collision/);
});

test('validation fails closed when immutable raw value/version does not match its hash', () => {
  const snapshot = buildProspectiveSnapshot(input());
  snapshot.raw_response_base64 = Buffer.from('{"different":true}').toString('base64');
  assert.throws(() => validateProspectiveSnapshot(snapshot), /response_bytes mismatch|raw response hash mismatch/);
});
