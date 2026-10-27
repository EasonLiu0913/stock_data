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
    const expectRejected = (expected, label) => {
      const result = run();
      assert.notEqual(result.status, 0, label + ': unexpectedly accepted');
      assert.match(result.stderr, expected, label);
    };
    const wrongForecast = { ...payload, forecast_date_compact: '20260728' };
    fs.writeFileSync(destination, JSON.stringify(wrongForecast));
    expectRejected(/Market environment forecast date mismatch/, 'wrong forecast date');
    const wrongBase = { ...payload, base_trade_date_compact: '20260723' };
    fs.writeFileSync(destination, JSON.stringify(wrongBase));
    expectRejected(/Market environment base date mismatch/, 'wrong base date');

    // Replace only the isolated TWSE directory link with an isolated directory.
    // No repository source files are removed or modified.
    const twseLink = path.join(dir, 'data_twse_mi_index');
    fs.unlinkSync(twseLink);
    fs.mkdirSync(twseLink);
    fs.writeFileSync(destination, JSON.stringify(payload));
    expectRejected(/twse_index source file is missing/, 'missing TWSE source');
    const twseFile = path.join(twseLink, '20260724_twse_mi_index.json');
    fs.writeFileSync(twseFile, '');
    expectRejected(/twse_index source file is empty/, 'empty TWSE source');
    fs.unlinkSync(twseFile);
    fs.rmdirSync(twseLink);
    fs.symlinkSync(path.join(root, 'data_twse_mi_index'), twseLink, 'dir');

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
