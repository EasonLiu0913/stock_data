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

test('source symlink escaping approved directory fails closed in isolated fixture', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-symlink-boundary-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'));
    for (const file of ['verify_market_environment.js', 'market_environment_lib.js']) {
      fs.copyFileSync(path.join(root, 'scripts', file), path.join(dir, 'scripts', file));
    }
    const twseDir = path.join(dir, 'data_twse_mi_index');
    const futuresDir = path.join(dir, 'data_taifex_major_institutional_traders_futures_contracts');
    fs.mkdirSync(twseDir);
    fs.mkdirSync(futuresDir);
    const external = path.join(dir, 'outside.json');
    fs.writeFileSync(external, '{"date":"20260724"}');
    const twseName = '20260724_twse_mi_index.json';
    fs.symlinkSync(external, path.join(twseDir, twseName));
    fs.writeFileSync(path.join(futuresDir, '20260724_taifex_major_institutional_traders_futures_contracts.json'), '{"date":"20260724"}');
    const {validateReferencedSources} = require(path.join(dir, 'scripts', 'verify_market_environment.js'));
    const payload = {source_files: {
      twse_index: 'data_twse_mi_index/' + twseName,
      foreign_futures: realFutures,
    }};
    assert.throws(() => validateReferencedSources(payload, base), /resolves outside allowed directory/);
    fs.rmSync(path.join(twseDir, twseName));
    fs.writeFileSync(path.join(twseDir, twseName), '{"date":"20260724"}');
    assert.doesNotThrow(() => validateReferencedSources(payload, base));
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('source replacement with same-size bytes is not authenticated by path-only source gate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-source-replacement-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'));
    for (const file of ['verify_market_environment.js', 'market_environment_lib.js']) {
      fs.copyFileSync(path.join(root, 'scripts', file), path.join(dir, 'scripts', file));
    }
    const twseDir = path.join(dir, 'data_twse_mi_index');
    const futuresDir = path.join(dir, 'data_taifex_major_institutional_traders_futures_contracts');
    fs.mkdirSync(twseDir);
    fs.mkdirSync(futuresDir);
    const twseFile = path.join(twseDir, '20260724_twse_mi_index.json');
    const original = '{"date":"20260724","value":1}';
    const replacement = '{"date":"20260724","value":9}';
    assert.equal(Buffer.byteLength(original), Buffer.byteLength(replacement));
    fs.writeFileSync(twseFile, original);
    fs.writeFileSync(path.join(futuresDir, '20260724_taifex_major_institutional_traders_futures_contracts.json'), original);
    const {validateReferencedSources} = require(path.join(dir, 'scripts', 'verify_market_environment.js'));
    const payload = {source_files: {
      twse_index: realTwse,
      foreign_futures: realFutures,
    }};
    assert.doesNotThrow(() => validateReferencedSources(payload, base));
    fs.writeFileSync(twseFile, replacement);
    assert.notEqual(fs.readFileSync(twseFile, 'utf8'), original);
    assert.doesNotThrow(() => validateReferencedSources(payload, base),
      'characterization: the path/size/date gate does not authenticate file bytes');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('post-check symlink swap demonstrates unpinned source-read race', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-postcheck-swap-'));
  try {
    const scriptDir = path.join(dir, 'scripts');
    fs.mkdirSync(scriptDir);
    for (const name of ['verify_market_environment.js', 'market_environment_lib.js']) {
      fs.copyFileSync(path.join(root, 'scripts', name), path.join(scriptDir, name));
    }
    const twseDir = path.join(dir, 'data_twse_mi_index');
    const futuresDir = path.join(dir, 'data_taifex_major_institutional_traders_futures_contracts');
    fs.mkdirSync(twseDir);
    fs.mkdirSync(futuresDir);
    const source = path.join(twseDir, '20260724_twse_mi_index.json');
    const outside = path.join(dir, 'external-payload.json');
    fs.writeFileSync(source, '{"date":"20260724","value":"trusted"}');
    fs.writeFileSync(outside, '{"date":"20260724","value":"replaced"}');
    fs.writeFileSync(path.join(futuresDir, '20260724_taifex_major_institutional_traders_futures_contracts.json'), '{}');
    const {validateReferencedSources} = require(path.join(scriptDir, 'verify_market_environment.js'));
    const payload = {source_files: {twse_index: realTwse, foreign_futures: realFutures}};
    assert.doesNotThrow(() => validateReferencedSources(payload, base));
    fs.rmSync(source);
    fs.symlinkSync(outside, source);
    assert.equal(JSON.parse(fs.readFileSync(source, 'utf8')).value, 'replaced',
      'a later path-based read can observe untrusted substituted bytes');
    assert.throws(() => validateReferencedSources(payload, base), /resolves outside allowed directory/,
      'rechecking after replacement rejects the symlink; previous validation is not a durable authorization');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
