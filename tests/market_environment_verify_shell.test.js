'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const parsed = spawnSync('ruby', ['-ryaml', '-rjson', '-e',
  'w=YAML.load_file(ARGV[0]); puts JSON.generate(w.fetch("jobs").fetch("prepare").fetch("steps"))',
  '.github/workflows/prepare-market-environment.yml'], { encoding: 'utf8' });
assert.equal(parsed.status, 0, parsed.stderr);
const steps = JSON.parse(parsed.stdout);
const get = name => {
  const step = steps.find(s => s.name === name);
  assert.ok(step, name);
  return step.run;
};
function runOriginal(name, result, force = 'false') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-verify-shell-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const log = path.join(dir, 'invocations');
  const output = path.join(dir, 'output');
  const fakeNode = path.join(bin, 'node');
  fs.writeFileSync(fakeNode, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$VERIFY_CALL_LOG"\nexit "$VERIFY_EXIT_CODE"\n', { mode: 0o755 });
  try {
    const r = spawnSync('bash', ['-e', '-c', get(name)], {
      encoding: 'utf8', env: {
        ...process.env, PATH: bin + ':' + process.env.PATH,
        VERIFY_CALL_LOG: log, VERIFY_EXIT_CODE: String(result),
        GITHUB_OUTPUT: output, FORECAST_TARGET_DATE: '20991231',
        FORECAST_BASE_DATE: '20991230', FORCE: force,
      },
    });
    return { status: r.status, stderr: r.stderr, stdout: r.stdout,
      output: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '',
      calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '' };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('existing snapshot missing or date-invalid is not reused; regeneration requested', () => {
  for (const reason of ['missing-source', 'wrong-date']) {
    const r = runOriginal('Validate existing snapshot before retry', 1);
    assert.equal(r.status, 0, reason);
    assert.match(r.output, /^skip=false$/m, reason);
    assert.match(r.calls, /scripts\/verify_market_environment\.js --forecast-date 20991231 --base-date 20991230/, reason);
    assert.doesNotMatch(r.calls, /install_market_environment_ui|git push/, reason);
  }
});
test('existing snapshot verified is reused, and force skips verification', () => {
  const valid = runOriginal('Validate existing snapshot before retry', 0);
  assert.equal(valid.status, 0);
  assert.match(valid.output, /^skip=true$/m);
  const forced = runOriginal('Validate existing snapshot before retry', 1, 'true');
  assert.equal(forced.status, 0);
  assert.match(forced.output, /^skip=false$/m);
  assert.equal(forced.calls, '');
});
test('post-generation verification failure exits nonzero, never executes UI or push', () => {
  const failed = runOriginal('Verify regenerated environment integrity', 1);
  assert.notEqual(failed.status, 0);
  assert.match(failed.calls, /scripts\/verify_market_environment\.js --forecast-date 20991231 --base-date 20991230/);
  assert.doesNotMatch(failed.calls, /install_market_environment_ui|git push/);
  const valid = runOriginal('Verify regenerated environment integrity', 0);
  assert.equal(valid.status, 0);
});
