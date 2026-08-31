'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HELPER = process.env.RACE_SAFE_HELPER || path.join(__dirname, '..', 'scripts', 'race_safe_main_publish.sh');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function git(cwd, ...args) {
  return run('git', args, { cwd });
}

function configure(cwd) {
  git(cwd, 'config', 'user.name', 'Test Bot');
  git(cwd, 'config', 'user.email', 'test@example.com');
}

test('regenerates from advanced remote main after first push race', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'race-safe-main-publish-'));
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'seed');
  const writer = path.join(root, 'writer');
  const competitor = path.join(root, 'competitor');
  const verify = path.join(root, 'verify');
  const state = path.join(root, 'state');
  fs.mkdirSync(state);

  run('git', ['init', '--bare', remote]);
  run('git', ['init', '-b', 'main', seed]);
  configure(seed);
  fs.writeFileSync(path.join(seed, 'base.txt'), 'A\n');
  git(seed, 'add', 'base.txt');
  git(seed, 'commit', '-m', 'seed');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', '-u', 'origin', 'main');
  run('git', ['--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main']);

  run('git', ['clone', remote, writer]);
  run('git', ['clone', remote, competitor]);
  configure(writer);
  configure(competitor);

  const rawSnapshot = path.join(state, 'raw.csv');
  fs.writeFileSync(rawSnapshot, 'validated-raw\n');
  const prepare = path.join(state, 'prepare.sh');
  fs.writeFileSync(prepare, `#!/usr/bin/env bash\nset -euo pipefail\ncp ${JSON.stringify(rawSnapshot)} raw.csv\nprintf 'derived:%s\\n' "$(tr -d '\\n' < base.txt)" > derived.txt\n`);
  fs.chmodSync(prepare, 0o755);

  const validate = path.join(state, 'validate.sh');
  fs.writeFileSync(validate, `#!/usr/bin/env bash\nset -euo pipefail\ntest "$(cat raw.csv)" = validated-raw\ngrep -q '^derived:' derived.txt\n`);
  fs.chmodSync(validate, 0o755);

  const marker = path.join(state, 'hook-ran');
  const hook = path.join(state, 'before-push.sh');
  fs.writeFileSync(hook, `#!/usr/bin/env bash\nset -euo pipefail\nif [ "$1" = 1 ] && [ ! -e ${JSON.stringify(marker)} ]; then\n  printf 'C\\n' > ${JSON.stringify(path.join(competitor, 'base.txt'))}\n  git -C ${JSON.stringify(competitor)} add base.txt\n  git -C ${JSON.stringify(competitor)} commit -m competitor\n  git -C ${JSON.stringify(competitor)} push origin HEAD:main\n  touch ${JSON.stringify(marker)}\nfi\n`);
  fs.chmodSync(hook, 0o755);

  const result = spawnSync(HELPER, [
    '--prepare-script', prepare,
    '--validate-script', validate,
    '--commit-message', 'publish derived',
    '--add-path', 'raw.csv',
    '--add-path', 'derived.txt',
    '--max-attempts', '3',
  ], {
    cwd: writer,
    encoding: 'utf8',
    env: { ...process.env, RACE_SAFE_BEFORE_PUSH_HOOK: hook },
  });

  assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stdout, /attempt 2\/3/);

  run('git', ['clone', remote, verify]);
  assert.equal(fs.readFileSync(path.join(verify, 'base.txt'), 'utf8'), 'C\n');
  assert.equal(fs.readFileSync(path.join(verify, 'raw.csv'), 'utf8'), 'validated-raw\n');
  assert.equal(fs.readFileSync(path.join(verify, 'derived.txt'), 'utf8'), 'derived:C\n');

  const log = git(verify, 'log', '--format=%s');
  assert.match(log, /competitor/);
  assert.match(log, /publish derived/);
});

test('fails closed when prepare changes an unowned path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'race-safe-main-publish-unowned-'));
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'seed');
  const writer = path.join(root, 'writer');
  const state = path.join(root, 'state');
  fs.mkdirSync(state);

  run('git', ['init', '--bare', remote]);
  run('git', ['init', '-b', 'main', seed]);
  configure(seed);
  fs.writeFileSync(path.join(seed, 'base.txt'), 'A\n');
  git(seed, 'add', 'base.txt');
  git(seed, 'commit', '-m', 'seed');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', '-u', 'origin', 'main');
  run('git', ['--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
  run('git', ['clone', remote, writer]);
  configure(writer);

  const prepare = path.join(state, 'prepare.sh');
  fs.writeFileSync(prepare, '#!/usr/bin/env bash\nset -euo pipefail\nprintf owned > owned.txt\nprintf unexpected > unexpected.txt\n');
  fs.chmodSync(prepare, 0o755);
  const validate = path.join(state, 'validate.sh');
  fs.writeFileSync(validate, '#!/usr/bin/env bash\nset -euo pipefail\ntest -s owned.txt\n');
  fs.chmodSync(validate, 0o755);

  const result = spawnSync(HELPER, [
    '--prepare-script', prepare,
    '--validate-script', validate,
    '--commit-message', 'should not publish',
    '--add-path', 'owned.txt',
    '--max-attempts', '1',
  ], { cwd: writer, encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside the explicitly staged publish paths/);
  assert.equal(git(writer, 'log', '--format=%s', '-1'), 'seed');
});
