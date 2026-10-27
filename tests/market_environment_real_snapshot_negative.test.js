'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { sha256 } = require('../scripts/market_environment_lib');
const { validateReferencedSources } = require('../scripts/verify_market_environment');

const fixture = 'data_market_environment/20260727/market_environment.json';
const snapshot = JSON.parse(fs.readFileSync(fixture, 'utf8'));

test('committed real snapshot SHA-256 matches canonical payload and rejects tampering', () => {
  const { snapshot_hash, ...payload } = snapshot;
  assert.equal(sha256(payload), snapshot_hash, 'real committed snapshot baseline must match');
  assert.notEqual(sha256({ ...payload, forecast_date_compact: '20260728' }), snapshot_hash);
  assert.notEqual(sha256({ ...payload, base_trade_date_compact: '20260723' }), snapshot_hash);
  assert.notEqual(sha256({ ...payload, environment: { ...payload.environment, label: 'tampered' } }), snapshot_hash);
});

test('real snapshot references fail closed on missing and wrong-date source paths', () => {
  const sources = snapshot.source_files;
  assert.ok(sources.twse_index && sources.foreign_futures);
  const missing = { ...snapshot, source_files: { ...sources, twse_index: 'data_twse_mi_index/20260724_missing.json' } };
  assert.throws(() => validateReferencedSources(missing, '20260724'), /twse_index source file is missing/);
  const wrong = { ...snapshot, source_files: { ...sources, foreign_futures: sources.foreign_futures.replace('20260724', '20260723') } };
  assert.throws(() => validateReferencedSources(wrong, '20260724'), /foreign_futures source file is missing|foreign_futures source date mismatch/);
  assert.throws(() => validateReferencedSources(snapshot, '20260725'), /source date mismatch/);
});
