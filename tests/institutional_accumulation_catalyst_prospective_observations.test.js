'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  buildProspectiveSnapshot,
  snapshotRelativePath,
} = require('../scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract');
const {
  ROOT_RELATIVE,
  EXPECTED_METHODOLOGY,
  auditObservations,
  assertCanonicalBase64,
  serializeAudit,
} = require('../scripts/audit_institutional_accumulation_catalyst_prospective_observations');

function tempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'prospective-observation-audit-'));
}

function makeSnapshot(stock, kind, collectedAt, raw = '{"ok":true}') {
  const isListing = kind === 'prospective_material_information_listing';
  return buildProspectiveSnapshot({
    source_provider: 'MOPS',
    source_interface: kind,
    source_request_key: isListing ? `${stock}|115|all` : `${stock}|1150101|1|sii`,
    collected_at: collectedAt,
    source_reported_at: isListing ? null : '2026-01-01T00:00:00.000Z',
    source_timestamp_precision: isListing ? 'collection_timestamp_only' : 'official_timestamp',
    parser_version: 'institutional-accumulation-catalyst-prospective-canary-parser-v1',
    methodology_identity: EXPECTED_METHODOLOGY,
    raw_response: raw,
  });
}

function writeSnapshot(repo, snapshot, overrideRelative = null) {
  const relative = overrideRelative || snapshotRelativePath(snapshot);
  const absolute = path.join(repo, ...relative.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(snapshot, null, 2)}\n`);
  return absolute;
}

function writeWindow(repo, minuteBase, rawSuffix = '') {
  const stocks = ['1102', '1104', '1216'];
  let offset = 0;
  for (const stock of stocks) {
    writeSnapshot(repo, makeSnapshot(stock, 'prospective_material_information_listing', `2026-09-10T13:${String(minuteBase + offset).padStart(2, '0')}:00.000Z`, `listing-${stock}${rawSuffix}`));
    offset += 1;
    writeSnapshot(repo, makeSnapshot(stock, 'prospective_material_information_detail', `2026-09-10T13:${String(minuteBase + offset).padStart(2, '0')}:00.000Z`, `detail-${stock}${rawSuffix}`));
    offset += 1;
  }
}

test('deterministic audit reports one complete three-stock listing/detail window', () => {
  const repo = tempRepo();
  writeWindow(repo, 10);
  const first = auditObservations(repo);
  const second = auditObservations(repo);
  assert.equal(first.valid_observation_count, 6);
  assert.equal(first.stock_count, 3);
  assert.equal(first.invalid_observation_count, 0);
  assert.equal(first.conflict_count, 0);
  assert.equal(first.unique_immutable_snapshot_count, 6);
  assert.equal(first.unique_response_sha256_count, 6);
  for (const stock of ['1102', '1104', '1216']) assert.deepEqual(first.stocks[stock], { total: 2, listing: 1, detail: 1 });
  assert.equal(serializeAudit(first), serializeAudit(second));
});

test('deterministic audit accepts exactly two complete repeated windows', () => {
  const repo = tempRepo();
  writeWindow(repo, 10, '-window-1');
  writeWindow(repo, 20, '-window-2');
  const audit = auditObservations(repo);
  assert.equal(audit.valid_observation_count, 12);
  assert.equal(audit.unique_immutable_snapshot_count, 12);
  for (const stock of ['1102', '1104', '1216']) assert.deepEqual(audit.stocks[stock], { total: 4, listing: 2, detail: 2 });
  assert.deepEqual(audit.source_interface_counts, {
    prospective_material_information_detail: 6,
    prospective_material_information_listing: 6,
  });
});

test('repeated official content may share response hash while immutable observations remain unique', () => {
  const repo = tempRepo();
  const stocks = ['1102', '1104', '1216'];
  let minute = 10;
  for (let window = 0; window < 2; window += 1) {
    for (const stock of stocks) {
      writeSnapshot(repo, makeSnapshot(stock, 'prospective_material_information_listing', `2026-09-10T13:${String(minute++).padStart(2, '0')}:00.000Z`, `same-listing-${stock}`));
      writeSnapshot(repo, makeSnapshot(stock, 'prospective_material_information_detail', `2026-09-10T13:${String(minute++).padStart(2, '0')}:00.000Z`, `same-detail-${stock}`));
    }
  }
  const audit = auditObservations(repo);
  assert.equal(audit.valid_observation_count, 12);
  assert.equal(audit.unique_immutable_snapshot_count, 12);
  assert.equal(audit.unique_response_sha256_count, 6);
});

test('incomplete repeated window fails closed', () => {
  const repo = tempRepo();
  writeWindow(repo, 10);
  writeSnapshot(repo, makeSnapshot('1102', 'prospective_material_information_listing', '2026-09-10T13:20:00.000Z', 'partial'));
  assert.throws(() => auditObservations(repo), /incomplete_observation_window/);
});

test('malformed JSON fails closed', () => {
  const repo = tempRepo();
  const root = path.join(repo, ...ROOT_RELATIVE.split('/'));
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'bad.json'), '{');
  assert.throws(() => auditObservations(repo, { requireCurrentBaseline: false }), /malformed_json/);
});

test('hash mismatch fails closed through canonical contract validator', () => {
  const repo = tempRepo();
  const snapshot = makeSnapshot('1102', 'prospective_material_information_listing', '2026-09-10T13:20:00.000Z');
  snapshot.response_sha256 = '0'.repeat(64);
  writeSnapshot(repo, snapshot, path.posix.join(ROOT_RELATIVE, 'tampered.json'));
  assert.throws(() => auditObservations(repo, { requireCurrentBaseline: false }), /raw response hash mismatch|snapshot_path_identity_mismatch/);
});

test('invalid base64 and response length fail closed', () => {
  const invalid = makeSnapshot('1102', 'prospective_material_information_listing', '2026-09-10T13:21:00.000Z');
  invalid.raw_response_base64 = '***=';
  assert.throws(() => assertCanonicalBase64(invalid), /canonical base64/);

  const badLength = makeSnapshot('1102', 'prospective_material_information_listing', '2026-09-10T13:22:00.000Z');
  badLength.response_bytes += 1;
  assert.throws(() => assertCanonicalBase64(badLength), /response_bytes mismatch/);
});

test('duplicate immutable identity at conflicting path fails closed', () => {
  const repo = tempRepo();
  const snapshot = makeSnapshot('1102', 'prospective_material_information_listing', '2026-09-10T13:23:00.000Z');
  writeSnapshot(repo, snapshot);
  writeSnapshot(repo, snapshot, path.posix.join(ROOT_RELATIVE, 'duplicate', `${snapshot.immutable_snapshot_id}.json`));
  assert.throws(() => auditObservations(repo, { requireCurrentBaseline: false }), /snapshot_path_identity_mismatch|immutable_snapshot_conflict|duplicate_immutable_snapshot/);
});

test('unexpected stock or interface fails closed', () => {
  const repoStock = tempRepo();
  const unexpectedStock = makeSnapshot('9999', 'prospective_material_information_listing', '2026-09-10T13:24:00.000Z');
  writeSnapshot(repoStock, unexpectedStock);
  assert.throws(() => auditObservations(repoStock, { requireCurrentBaseline: false }), /unexpected_stock/);

  const repoInterface = tempRepo();
  const unexpectedInterface = buildProspectiveSnapshot({
    source_provider: 'MOPS',
    source_interface: 'unexpected_interface',
    source_request_key: '1102|x',
    collected_at: '2026-09-10T13:25:00.000Z',
    parser_version: 'institutional-accumulation-catalyst-prospective-canary-parser-v1',
    methodology_identity: EXPECTED_METHODOLOGY,
    raw_response: '{"ok":true}',
  });
  writeSnapshot(repoInterface, unexpectedInterface);
  assert.throws(() => auditObservations(repoInterface, { requireCurrentBaseline: false }), /unexpected_interface/);
});

test('invalid PIT metadata fails closed', () => {
  const repo = tempRepo();
  const snapshot = makeSnapshot('1216', 'prospective_material_information_detail', '2026-09-10T13:26:00.000Z');
  snapshot.pit_known_at = '2026-09-10T13:25:59.000Z';
  writeSnapshot(repo, snapshot, path.posix.join(ROOT_RELATIVE, 'bad-pit.json'));
  assert.throws(() => auditObservations(repo, { requireCurrentBaseline: false }), /pit_known_at must equal collected_at|pit_known_at_mismatch/);
});
