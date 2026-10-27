'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const file = '.github/workflows/prepare-market-environment.yml';
const parsed = spawnSync('ruby', ['-ryaml', '-rjson', '-e',
  'w=YAML.load_file(ARGV[0]); puts JSON.generate(w.fetch("jobs").fetch("prepare").fetch("steps"))', file], { encoding: 'utf8' });
assert.equal(parsed.status, 0, parsed.stderr);
const steps = JSON.parse(parsed.stdout);
const byName = name => {
  const s = steps.find(x => x.name === name);
  assert.ok(s, 'Missing workflow step: ' + name);
  return s;
};
const guarded = [
  'Resolve forecast and base dates',
  'Validate existing snapshot before retry',
  'Refresh external market inputs from current main',
  'Generate immutable shadow environment snapshot',
  'Verify regenerated environment integrity',
  'Install market environment banner',
  'Run market environment tests',
  'Commit and push snapshot and UI',
];
function condition(step, market, existing) {
  const expr = byName(step).if;
  assert.equal(typeof expr, 'string', step + ' requires explicit if');
  const tokens = expr.split(/\s*&&\s*/);
  return tokens.every(token => {
    const m = /^steps\.(market_day|existing)\.outputs\.skip != 'true'$/.exec(token);
    assert.ok(m, 'Unexpected condition for ' + step + ': ' + token);
    return (m[1] === 'market_day' ? market : existing) !== 'true';
  });
}
test('TWSE closure disables every date, regeneration, verification, UI and push step', () => {
  for (const name of guarded) assert.equal(condition(name, 'true', ''), false, name);
});
test('normal trading date with invalid existing snapshot takes regeneration and integrity gate', () => {
  for (const name of guarded) assert.equal(condition(name, 'false', 'false'), true, name);
  for (const name of guarded.slice(2)) assert.equal(condition(name, 'false', 'true'), false, name);
  const verify = byName('Verify regenerated environment integrity');
  assert.match(verify.run, /node scripts\/verify_market_environment\.js/);
  assert.match(verify.run, /set -euo pipefail/);
  assert.equal(verify.id, 'verify_regenerated');
});
test('failed integrity verification prevents UI and push through default success status', () => {
  for (const name of ['Install market environment banner', 'Run market environment tests', 'Commit and push snapshot and UI']) {
    assert.doesNotMatch(byName(name).if, /always\(\)|failure\(\)/, name);
  }
  assert.match(byName('Commit and push snapshot and UI').run, /git push origin HEAD:main/);
  assert.equal(byName('Report retry decision').if, 'always()');
});
