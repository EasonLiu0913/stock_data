'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  hashFreezePayload,
  partitionFor,
  percentileRanks,
  selectAnchorSessions,
  writeFreezeOnce,
} = require('../scripts/freeze_institutional_accumulation_development_sample');
const {
  VERSIONS,
  assertSourceIdentity,
  resolveFreezeVersion,
} = require('../scripts/lib/institutional_accumulation_freeze_versions');
const { OBSERVED_MAIN, buildManifest, compareDevelopmentObservations } = require('../scripts/build_institutional_accumulation_source_lineage_v2_1');

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

test('freeze writer preserves an existing version and refuses different-byte replacement', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'institutional-freeze-write-'));
  const target = path.join(root, 'freeze.json');
  try {
    assert.equal(writeFreezeOnce(target, '{"version":1}\n'), 'created');
    assert.equal(writeFreezeOnce(target, '{"version":1}\n'), 'already-identical');
    assert.throws(() => writeFreezeOnce(target, '{"version":2}\n'), /Refusing to replace/);
    assert.equal(fs.readFileSync(target, 'utf8'), '{"version":1}\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('v1 and v2 resolve only from their separately pinned freeze and source identities', () => {
  const root = path.resolve(__dirname, '..');
  for (const version of ['v1', 'v2']) {
    const resolved = resolveFreezeVersion(version, { root });
    assert.equal(resolved.sourceIdentity.commit, VERSIONS[version].sourceCommit);
    assert.equal(resolved.sourceIdentity.blob, VERSIONS[version].sourceBlob);
    assert.equal(resolved.payload.content_sha256, VERSIONS[version].semanticSha256);
  }
  assert.throws(() => resolveFreezeVersion('v1', {
    root,
    sourceIdentity: { commit: '30e35fd5a1a90f07fe0038d8ff0b19953023760d', blob: 'e8991ea4a67d5cfe04095413dac2eaadaa974771' },
  }), /source identity mismatch/);
  assert.throws(() => assertSourceIdentity('v2', {
    commit: '30e35fd5a1a90f07fe0038d8ff0b19953023760d',
    blob: 'e8991ea4a67d5cfe04095413dac2eaadaa974771',
  }), /source identity mismatch/);
});

test('lineage comparison covers development observations and excludes holdout partitions', () => {
  const observation = source => ({ state: 'available', value: { close: 10 }, provenance: { source_file: source } });
  const makeAnchor = (partition, source) => ({
    stock: partition === 'stock_holdout' ? '1105' : '1101',
    t0: '20260827',
    partition,
    observations: { T0: { price: observation(source), foreign: observation(source), dealer: observation(source), margin: observation(source), investment_trust: observation(source) } },
  });
  const result = compareDevelopmentObservations(
    { anchors: [makeAnchor('methodology_development', 'v1-source'), makeAnchor('stock_holdout', 'holdout-v1')] },
    { anchors: [makeAnchor('methodology_development', 'v2-source'), makeAnchor('stock_holdout', 'holdout-v2')] },
  );
  assert.deepEqual(result.totals, { anchors: 1, observationComparisons: 5, stateChanges: 0, valueChanges: 0, provenanceChanges: 5 });
  assert.equal(result.comparisons.length, 5);
  assert.ok(result.comparisons.every(row => row.stock === '1101'));
  assert.equal(result.scope, 'methodology_development anchors only; protected and holdout partitions are excluded');
});

test('committed lineage manifest regenerates deterministically when its observed main commit is available', {
  skip: (() => {
    try {
      execFileSync('git', ['cat-file', '-e', `${OBSERVED_MAIN}^{commit}`], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
      return false;
    } catch {
      return 'Observed-main history is not present in this bounded local checkout';
    }
  })(),
}, () => {
  const manifestPath = path.resolve(__dirname, '../data_research/institutional-flow/institutional-accumulation-source-lineage-v2.1.json');
  const committed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.deepEqual(buildManifest(), committed);
});

test('lineage manifest records only the registered development-view comparison and source identities', () => {
  const manifestPath = path.resolve(__dirname, '../data_research/institutional-flow/institutional-accumulation-source-lineage-v2.1.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.freeze_versions.v1.freeze_blob, VERSIONS.v1.freezeBlob);
  assert.equal(manifest.freeze_versions.v2.freeze_blob, VERSIONS.v2.freezeBlob);
  assert.equal(manifest.freeze_versions.v1.semantic_sha256, VERSIONS.v1.semanticSha256);
  assert.equal(manifest.freeze_versions.v2.source_blob, VERSIONS.v2.sourceBlob);
  assert.equal(manifest.later_source_observation.source_blob, 'e8991ea4a67d5cfe04095413dac2eaadaa974771');
  assert.deepEqual(manifest.frozen_observation_comparison.totals, {
    anchors: 96, observationComparisons: 3360, stateChanges: 0, valueChanges: 0, provenanceChanges: 3,
  });
  assert.ok(manifest.frozen_observation_comparison.comparisons.every(row => row.v1 && row.v2));
  assert.equal(manifest.forbidden_research_access.protected_or_holdout_partitions_compared, false);
});
