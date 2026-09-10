'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildProspectiveSnapshot,
  snapshotRelativePath,
} = require('../scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract');
const {
  buildWindowDeltaAudit,
} = require('../scripts/audit_institutional_accumulation_catalyst_prospective_window_deltas');

const ROOT_RELATIVE = 'data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit';
const STOCKS = ['1102', '1104', '1216'];
const INTERFACES = ['prospective_material_information_detail', 'prospective_material_information_listing'];
const METHODOLOGY = 'institutional-accumulation-catalyst-prospective-live-capture-canary-v1';
const PARSER = 'institutional-accumulation-catalyst-prospective-canary-parser-v1';

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'prospective-delta-'));
}

function requestKey(stock, sourceInterface) {
  return sourceInterface.endsWith('_listing') ? `${stock}|115|all` : `${stock}|1150101|1|sii`;
}

function fixtureSnapshot(stock, sourceInterface, collectedAt, payload) {
  return buildProspectiveSnapshot({
    source_provider: 'MOPS',
    source_interface: sourceInterface,
    source_request_key: requestKey(stock, sourceInterface),
    collected_at: collectedAt,
    source_reported_at: null,
    source_timestamp_precision: 'collection_timestamp_only',
    parser_version: PARSER,
    methodology_identity: METHODOLOGY,
    raw_response: Buffer.from(payload),
  });
}

function writeSnapshot(repoRoot, snapshot, overridePath = null) {
  const canonical = snapshotRelativePath(snapshot);
  const relative = overridePath || canonical;
  const absolute = path.join(repoRoot, ...relative.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(snapshot, null, 2)}\n`);
  return absolute;
}

function buildTwoWindows(repoRoot, mutator = null) {
  const paths = [];
  for (let w = 0; w < 2; w += 1) {
    for (let s = 0; s < STOCKS.length; s += 1) {
      for (let i = 0; i < INTERFACES.length; i += 1) {
        const stock = STOCKS[s];
        const sourceInterface = INTERFACES[i];
        const minute = w * 20 + s * 2 + i;
        const collectedAt = `2026-09-10T13:${String(minute).padStart(2, '0')}:00.000Z`;
        let snapshot = fixtureSnapshot(stock, sourceInterface, collectedAt, `${stock}|${sourceInterface}|window=${w + 1}`);
        if (mutator) snapshot = mutator({ snapshot, window: w + 1, stock, sourceInterface }) || snapshot;
        paths.push(writeSnapshot(repoRoot, snapshot));
      }
    }
  }
  return paths;
}

function run(repoRoot) {
  return buildWindowDeltaAudit(repoRoot, { rootRelative: ROOT_RELATIVE, skipCommittedAuditCheck: true });
}

test('deterministically pairs exactly two complete validated windows', () => {
  const repo = tmpRepo();
  buildTwoWindows(repo);
  const audit = run(repo);
  assert.equal(audit.observation_count, 12);
  assert.equal(audit.pair_count, 6);
  assert.equal(audit.changed_pair_count, 6);
  assert.equal(audit.unchanged_pair_count, 0);
  assert.equal(audit.pairs.length, 6);
  for (const pair of audit.pairs) {
    assert.ok(pair.elapsed_milliseconds > 0);
    assert.equal(pair.raw_content_changed, true);
    assert.notEqual(pair.window_1.immutable_snapshot_id, pair.window_2.immutable_snapshot_id);
  }
});

test('raw content may remain unchanged across windows', () => {
  const repo = tmpRepo();
  for (let w = 0; w < 2; w += 1) {
    for (let s = 0; s < STOCKS.length; s += 1) {
      for (let i = 0; i < INTERFACES.length; i += 1) {
        const stock = STOCKS[s];
        const sourceInterface = INTERFACES[i];
        const minute = w * 20 + s * 2 + i;
        const snap = fixtureSnapshot(stock, sourceInterface, `2026-09-10T13:${String(minute).padStart(2, '0')}:00.000Z`, `${stock}|${sourceInterface}|same`);
        writeSnapshot(repo, snap);
      }
    }
  }
  const audit = run(repo);
  assert.equal(audit.changed_pair_count, 0);
  assert.equal(audit.unchanged_pair_count, 6);
});

test('partial second window fails closed', () => {
  const repo = tmpRepo();
  const paths = buildTwoWindows(repo);
  fs.unlinkSync(paths.at(-1));
  assert.throws(() => run(repo), /unexpected_observation_shape|unexpected_stock_window_shape/);
});

test('third window fails closed', () => {
  const repo = tmpRepo();
  buildTwoWindows(repo);
  for (let s = 0; s < STOCKS.length; s += 1) {
    for (let i = 0; i < INTERFACES.length; i += 1) {
      const stock = STOCKS[s];
      const sourceInterface = INTERFACES[i];
      const snap = fixtureSnapshot(stock, sourceInterface, `2026-09-10T14:${String(s * 2 + i).padStart(2, '0')}:00.000Z`, `${stock}|${sourceInterface}|window=3`);
      writeSnapshot(repo, snap);
    }
  }
  assert.throws(() => run(repo), /unexpected_observation_shape/);
});

test('timestamp tie fails closed', () => {
  const repo = tmpRepo();
  buildTwoWindows(repo, ({ snapshot, window, stock, sourceInterface }) => {
    if (window === 2 && stock === '1102' && sourceInterface.endsWith('_listing')) {
      return fixtureSnapshot(stock, sourceInterface, '2026-09-10T13:01:00.000Z', 'different-content');
    }
    return snapshot;
  });
  assert.throws(() => run(repo), /collection_time_tie/);
});

test('source request key mismatch fails closed', () => {
  const repo = tmpRepo();
  buildTwoWindows(repo, ({ snapshot, window, stock, sourceInterface }) => {
    if (window === 2 && stock === '1104' && sourceInterface.endsWith('_detail')) {
      return buildProspectiveSnapshot({
        source_provider: 'MOPS', source_interface: sourceInterface, source_request_key: `${stock}|1150202|2|sii`,
        collected_at: snapshot.collected_at, source_reported_at: null, source_timestamp_precision: 'collection_timestamp_only',
        parser_version: PARSER, methodology_identity: METHODOLOGY, raw_response: Buffer.from('mismatch'),
      });
    }
    return snapshot;
  });
  assert.throws(() => run(repo), /source_request_key_mismatch/);
});

test('unexpected stock/interface is rejected through canonical observation validation', () => {
  const repo = tmpRepo();
  buildTwoWindows(repo, ({ snapshot, window, stock, sourceInterface }) => {
    if (window === 2 && stock === '1216' && sourceInterface.endsWith('_listing')) {
      return buildProspectiveSnapshot({
        source_provider: 'MOPS', source_interface: sourceInterface, source_request_key: '9999|115|all',
        collected_at: snapshot.collected_at, source_reported_at: null, source_timestamp_precision: 'collection_timestamp_only',
        parser_version: PARSER, methodology_identity: METHODOLOGY, raw_response: Buffer.from('unexpected-stock'),
      });
    }
    return snapshot;
  });
  assert.throws(() => run(repo), /unexpected_stock/);
});

test('malformed, hash/base64/PIT/path/immutable defects fail closed through inherited validation', () => {
  for (const defect of ['malformed', 'hash', 'base64', 'pit', 'path', 'immutable']) {
    const repo = tmpRepo();
    const paths = buildTwoWindows(repo);
    const target = paths[0];
    if (defect === 'malformed') fs.writeFileSync(target, '{bad-json');
    else {
      const snapshot = JSON.parse(fs.readFileSync(target, 'utf8'));
      if (defect === 'hash') snapshot.response_sha256 = '0'.repeat(64);
      if (defect === 'base64') snapshot.raw_response_base64 = '***not-base64***';
      if (defect === 'pit') snapshot.pit_known_at = '2026-01-01T00:00:00.000Z';
      if (defect === 'immutable') snapshot.immutable_snapshot_id = 'f'.repeat(64);
      fs.writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`);
      if (defect === 'path') {
        const moved = `${target}.moved.json`;
        fs.renameSync(target, moved);
      }
    }
    assert.throws(() => run(repo));
  }
});
