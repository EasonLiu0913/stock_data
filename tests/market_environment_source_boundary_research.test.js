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

test('research-only pinned descriptor hash rejects substituted source bytes', () => {
  const crypto = require('node:crypto');
  const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-descriptor-pin-'));
  let fd;
  try {
    const file = path.join(dir, '20260724_twse_mi_index.json');
    const original = Buffer.from('{"date":"20260724","value":1}');
    const replacement = Buffer.from('{"date":"20260724","value":9}');
    fs.writeFileSync(file, original);
    const expected = digest(original);
    fd = fs.openSync(file, fs.constants.O_RDONLY);
    const captured = fs.readFileSync(fd);
    assert.equal(digest(captured), expected);
    // Rename-based replacement changes the path target but not the opened descriptor.
    const temp = path.join(dir, 'replacement.json');
    fs.writeFileSync(temp, replacement);
    fs.renameSync(temp, file);
    assert.equal(digest(fs.readFileSync(file)), digest(replacement));
    assert.notEqual(digest(fs.readFileSync(file)), expected,
      'a later pathname-based read must reject an independently pinned SHA');
    assert.equal(digest(captured), expected,
      'previously captured descriptor bytes remain bound to the original evidence');
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('research-only independent SHA pin rejects pre-open replacement', () => {
  const crypto = require('node:crypto');
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-preopen-pin-'));
  let fd;
  try {
    const source = path.join(dir, '20260724_twse_mi_index.json');
    const expectedBytes = Buffer.from('{"date":"20260724","value":1}');
    const alteredBytes = Buffer.from('{"date":"20260724","value":9}');
    const expectedSha = sha(expectedBytes);
    fs.writeFileSync(source, expectedBytes);
    // The source is replaced *before* opening it: a file descriptor alone is insufficient.
    fs.writeFileSync(source, alteredBytes);
    fd = fs.openSync(source, fs.constants.O_RDONLY);
    const observed = fs.readFileSync(fd);
    assert.notEqual(sha(observed), expectedSha);
    assert.throws(() => {
      if (sha(observed) !== expectedSha) throw Error('independent source SHA-256 mismatch');
    }, /independent source SHA-256 mismatch/);
    // A matching hash must be computed from the same captured bytes that consumers use.
    assert.equal(sha(observed), sha(alteredBytes));
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(dir, {recursive:true, force:true});
  }
});
