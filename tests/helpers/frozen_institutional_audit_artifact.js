'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function readFrozenArtifact(relativePath, expectedSha256) {
  const raw = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), expectedSha256, `${relativePath} changed`);
  return JSON.parse(raw);
}

function materializeProtectedObservationSet() {
  const repoRoot = process.cwd();
  const manifestPath = 'data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json';
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, manifestPath), 'utf8'));
  assert.equal(manifest.valid_observation_count, 36, 'protected observation count changed');
  assert.equal(manifest.invalid_observation_count, 0);
  assert.equal(manifest.conflict_count, 0);
  assert.equal(manifest.source_paths.length, manifest.valid_observation_count);

  const fixtureRoot = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'institutional-protected-pit-'));
  for (const sourcePath of manifest.source_paths) {
    const source = path.resolve(repoRoot, sourcePath);
    assert.ok(source.startsWith(`${repoRoot}${path.sep}`), `source path escaped repository: ${sourcePath}`);
    const relative = path.relative(repoRoot, source);
    const target = path.join(fixtureRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }

  return {
    repoRoot: fixtureRoot,
    rootRelative: 'data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit',
    cleanup: () => fs.rmSync(fixtureRoot, { recursive: true, force: true }),
  };
}

module.exports = { readFrozenArtifact, materializeProtectedObservationSet };
