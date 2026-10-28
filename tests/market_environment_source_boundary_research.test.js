'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = '20260724';
const realTwse = 'data_twse_mi_index/20260724_twse_mi_index.json';
const realFutures = 'data_taifex_major_institutional_traders_futures_contracts/20260724_taifex_major_institutional_traders_futures_contracts.json';

test('source path traversal and symlink trust boundaries: isolated research characterization', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-source-boundary-'));
  try {
    const scripts = path.join(dir, 'scripts');
    fs.mkdirSync(scripts);
    for (const file of ['verify_market_environment.js', 'market_environment_lib.js']) {
      fs.copyFileSync(path.join(root, 'scripts', file), path.join(scripts, file));
    }
    for (const directory of ['data_twse_mi_index', 'data_taifex_major_institutional_traders_futures_contracts']) {
      fs.symlinkSync(path.join(root, directory), path.join(dir, directory), 'dir');
    }
    const { validateReferencedSources } = require(path.join(scripts, 'verify_market_environment.js'));
    const payload = { source_files: { twse_index: realTwse, foreign_futures: realFutures } };
    assert.doesNotThrow(() => validateReferencedSources(payload, base), 'baseline references must validate');
    const outside = path.join(dir, 'outside');
    fs.mkdirSync(outside);
    const external = path.join(outside, '20260724_twse_mi_index.json');
    fs.writeFileSync(external, '{}');
    payload.source_files.twse_index = '../outside/20260724_twse_mi_index.json';
    assert.throws(() => validateReferencedSources(payload, base), /outside allowed directory/, 'traversal must be rejected');
    payload.source_files.twse_index = 'data_twse_mi_index/../outside/20260724_twse_mi_index.json';
    assert.throws(() => validateReferencedSources(payload, base), /outside allowed directory/, 'nested traversal must be rejected');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
