'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const date = '20260727', base = '20260724';
const source = path.join(root, 'data_market_environment', date, 'market_environment.json');

test('complete verifier rejects isolated tampered real snapshot, without touching repository files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-verify-isolated-'));
  try {
    const scripts = path.join(dir, 'scripts');
    fs.mkdirSync(scripts);
    for (const file of ['verify_market_environment.js', 'market_environment_lib.js']) {
      fs.copyFileSync(path.join(root, 'scripts', file), path.join(scripts, file));
    }
    for (const name of ['data_external_market', 'data_market_risk', 'data_twse_mi_index',
      'data_taifex_major_institutional_traders_futures_contracts', 'data_fubon']) {
      fs.symlinkSync(path.join(root, name), path.join(dir, name), 'dir');
    }
    const target = path.join(dir, 'data_market_environment', date);
    fs.mkdirSync(target, { recursive: true });
    const payload = JSON.parse(fs.readFileSync(source, 'utf8'));
    const destination = path.join(target, 'market_environment.json');
    const run = () => spawnSync(process.execPath, [path.join(scripts, 'verify_market_environment.js'),
      '--forecast-date', date, '--base-date', base, '--allow-historical-reconstruction'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' },
    });
    fs.writeFileSync(destination, JSON.stringify(payload));
    const baseline = run();
    assert.equal(baseline.status, 0, 'Real snapshot baseline must pass complete verifier: ' + baseline.stderr);
    payload.environment.label += ' (tampered)';
    fs.writeFileSync(destination, JSON.stringify(payload));
    const tampered = run();
    assert.notEqual(tampered.status, 0);
    assert.match(tampered.stderr, /Market environment snapshot hash mismatch/);
    assert.equal(JSON.parse(fs.readFileSync(source, 'utf8')).environment.label.replace(/ \(tampered\)$/, ''), payload.environment.label.replace(/ \(tampered\)$/, ''));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
