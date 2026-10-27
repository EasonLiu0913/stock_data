'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workflow = '.github/workflows/prepare-market-environment.yml';
const extract = spawnSync('ruby', ['-ryaml', '-rjson', '-e',
  'w=YAML.load_file(ARGV[0]); s=w.fetch("jobs").fetch("prepare").fetch("steps").find{|x| x["name"]=="Report retry decision"}; puts JSON.generate(s.fetch("run"))', workflow], { encoding: 'utf8' });
assert.equal(extract.status, 0, extract.stderr);
const original = JSON.parse(extract.stdout);

function render({ market = 'false', existing = 'false', dates = 'success', verify = 'success' }) {
  const values = {
    'steps.market_day.outputs.skip': market,
    'steps.existing.outputs.skip': existing,
    'steps.dates.outcome': dates,
    'steps.verify_regenerated.outcome': verify,
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-summary-'));
  const file = path.join(dir, 'summary.md');
  try {
    const script = original.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (all, key) => {
      if (!(key.trim() in values)) throw new Error('Unexpected workflow expression: ' + key);
      return values[key.trim()];
    });
    const run = spawnSync('bash', ['-e', '-c', script], {
      encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: file,
        FORECAST_TARGET_DATE: '20261027', FORECAST_BASE_DATE: '20261022' },
    });
    assert.equal(run.status, 0, run.stderr);
    return fs.readFileSync(file, 'utf8');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('actual workflow summary script: closure skips without claiming regeneration', () => {
  const text = render({ market: 'true', dates: 'skipped', verify: 'skipped' });
  assert.match(text, /Taiwan market closed; snapshot preparation skipped/);
  assert.doesNotMatch(text, /regeneration path executed|regenerated snapshot passed|Forecast date:/);
});

test('actual workflow summary script: failed verification is not called successful', () => {
  const text = render({ verify: 'failure' });
  assert.match(text, /FAILED integrity verification/);
  assert.doesNotMatch(text, /passed integrity verification|regeneration path executed/);
});

test('actual workflow summary script: successful verification is reported only on success', () => {
  assert.match(render({ verify: 'success' }), /regenerated snapshot passed integrity verification/);
  assert.match(render({ dates: 'failure', verify: 'skipped' }), /date resolution did not succeed/);
  assert.match(render({ verify: 'skipped' }), /not verified as successful/);
  assert.match(render({ existing: 'true', verify: 'skipped' }), /existing snapshot passed full integrity validation/);
});
