'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateReferencedSources } = require('../scripts/verify_market_environment');

const root = path.resolve(__dirname, '..');
const base = '20260724';
const realTwse = 'data_twse_mi_index/20260724_twse_mi_index.json';
const realFutures = 'data_taifex_major_institutional_traders_futures_contracts/20260724_taifex_major_institutional_traders_futures_contracts.json';

test('source path traversal and symlink trust boundaries: research characterization only', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'market-untrusted-20260724-'));
  const inside = fs.mkdtempSync(path.join(root, '.research-source-boundary-'));
  try {
    const external = path.join(outside, '20260724_twse_mi_index.json');
    fs.writeFileSync(external, '{}');
    const symlink = path.join(inside, '20260724_twse_mi_index.json');
    fs.symlinkSync(external, symlink);
    const relative = path.relative(root, symlink).replaceAll(path.sep, '/');
    const traversal = path.relative(root, external).replaceAll(path.sep, '/');
    const payload = { source_files: { twse_index: realTwse, foreign_futures: realFutures } };
    assert.doesNotThrow(() => validateReferencedSources(payload, base), 'baseline references must validate');
    // Characterize current behavior without weakening or changing the verifier.
    payload.source_files.twse_index = relative;
    assert.throws(() => validateReferencedSources(payload, base), /outside allowed directory/, 'symlink outside allowlist must be rejected');
    payload.source_files.twse_index = traversal;
    assert.throws(() => validateReferencedSources(payload, base), /outside allowed directory/, 'traversal outside allowlist must be rejected');
  } finally {
    fs.rmSync(inside, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
