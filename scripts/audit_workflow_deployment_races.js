const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CANONICAL_DEPLOY = 'deploy-pages.yml';

function listWorkflowFiles(root) {
  const dir = path.join(root, '.github', 'workflows');
  return fs.readdirSync(dir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
}

function readWorkflows(root) {
  const workflows = new Map();
  for (const name of listWorkflowFiles(root)) {
    const file = path.join(root, '.github', 'workflows', name);
    workflows.set(name, fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  }
  return workflows;
}

function localWorkflowUses(text) {
  const result = [];
  const re = /^\s*uses:\s*\.\/\.github\/workflows\/([^\s#]+)\s*$/gm;
  let match;
  while ((match = re.exec(text))) result.push(match[1]);
  return result;
}

function hasWorkflowRun(text) {
  return /^\s{2}workflow_run\s*:/m.test(text) || /^\s*workflow_run\s*:/m.test(text);
}

function hasCancelTrue(text) {
  return /^\s*cancel-in-progress:\s*true\s*(?:#.*)?$/m.test(text);
}

function hasCancelFalse(text) {
  return /^\s*cancel-in-progress:\s*false\s*(?:#.*)?$/m.test(text);
}

function hasCanonicalPagesGroup(text) {
  return /^\s*group:\s*github-pages\s*(?:#.*)?$/m.test(text);
}

function hasWorkflowCall(text) {
  return /^\s{2}workflow_call\s*:/m.test(text) || /^\s*workflow_call\s*:/m.test(text);
}

function hasPushDataPath(text) {
  return /^\s*-\s*['"]?(?:data[^'"\s]*|normalized[^'"\s]*)/m.test(text);
}

function hasCheckoutMain(text) {
  return /uses:\s*actions\/checkout@[^\n]+[\s\S]{0,600}?\n\s*ref:\s*main\s*(?:#.*)?(?:\n|$)/m.test(text);
}

function hasContentsWritePermission(text) {
  return /^\s*contents:\s*write\s*(?:#.*)?$/m.test(text);
}

function hasGitWriteCommand(text) {
  return /(^|[;&|]\s*|\n\s*)git\s+(?:commit|push)\b/m.test(text);
}

function isRepositoryWriter(text) {
  return hasContentsWritePermission(text) || hasGitWriteCommand(text);
}

function buildReverseGraph(workflows) {
  const reverse = new Map([...workflows.keys()].map((name) => [name, new Set()]));
  for (const [caller, text] of workflows) {
    for (const callee of localWorkflowUses(text)) {
      if (!reverse.has(callee)) reverse.set(callee, new Set());
      reverse.get(callee).add(caller);
    }
  }
  return reverse;
}

function deploymentReachable(workflows) {
  const reverse = buildReverseGraph(workflows);
  const reachable = new Set([CANONICAL_DEPLOY]);
  const queue = [CANONICAL_DEPLOY];
  while (queue.length) {
    const current = queue.shift();
    for (const caller of reverse.get(current) || []) {
      if (!reachable.has(caller)) {
        reachable.add(caller);
        queue.push(caller);
      }
    }
  }
  return reachable;
}

function audit(root = process.cwd()) {
  const workflows = readWorkflows(root);
  const errors = [];
  const warnings = [];

  if (!workflows.has(CANONICAL_DEPLOY)) {
    errors.push(`Missing canonical workflow: ${CANONICAL_DEPLOY}`);
    return {
      errors,
      warnings,
      workflows: workflows.size,
      deploymentReachable: [],
      repositoryWriters: [],
      cancelableWorkflows: [],
    };
  }

  const deploy = workflows.get(CANONICAL_DEPLOY);
  if (!hasCanonicalPagesGroup(deploy)) {
    errors.push(`${CANONICAL_DEPLOY}: concurrency group must be exactly github-pages`);
  }
  if (!hasCancelTrue(deploy) || hasCancelFalse(deploy)) {
    errors.push(`${CANONICAL_DEPLOY}: Pages publication layer must use cancel-in-progress: true so stale deployments are superseded`);
  }
  if (!hasWorkflowCall(deploy)) {
    errors.push(`${CANONICAL_DEPLOY}: must expose workflow_call for explicit chaining`);
  }
  if (!hasCheckoutMain(deploy)) {
    errors.push(`${CANONICAL_DEPLOY}: Pages publication must checkout ref: main before packaging`);
  }
  if (isRepositoryWriter(deploy)) {
    errors.push(`${CANONICAL_DEPLOY}: publication layer must not commit or push repository data`);
  }

  const reachable = deploymentReachable(workflows);
  const repositoryWriters = [];
  const cancelableWorkflows = [];

  for (const [name, text] of workflows) {
    const writer = isRepositoryWriter(text);
    const cancelTrue = hasCancelTrue(text);

    if (writer) repositoryWriters.push(name);
    if (cancelTrue) cancelableWorkflows.push(name);

    // Layering invariant:
    // 1. Repository/data writers must never be cancelled after partial work.
    // 2. The canonical Pages publisher is intentionally cancelable because it
    //    rebuilds from the latest committed main and does not mutate repository data.
    if (name !== CANONICAL_DEPLOY && writer && cancelTrue) {
      errors.push(`${name}: repository/data write layer must use cancel-in-progress: false (or omit cancellation); committed progress must not be discarded`);
    }
  }

  for (const name of [...reachable].sort()) {
    const text = workflows.get(name);
    if (!text) continue;

    if (hasWorkflowRun(text)) {
      errors.push(`${name}: deployment chain must not use workflow_run`);
    }

    if (name !== CANONICAL_DEPLOY && hasWorkflowCall(text) && hasPushDataPath(text)) {
      errors.push(`${name}: reusable deployment-chain workflow also watches data/normalized push paths; this can duplicate a workflow_call run`);
    }
  }

  // The canonical deploy workflow still supports push as a compatibility fallback.
  // Explicit workflow_call plus push fallback can request duplicate publications,
  // but stale Pages-only runs are safe to cancel because each run checks out main.
  if (hasPushDataPath(deploy)) {
    warnings.push(`${CANONICAL_DEPLOY}: data/normalized push fallback is enabled; duplicate publication requests may occur, but stale Pages runs are superseded safely`);
  }

  return {
    errors,
    warnings,
    workflows: workflows.size,
    deploymentReachable: [...reachable].sort(),
    repositoryWriters: repositoryWriters.sort(),
    cancelableWorkflows: cancelableWorkflows.sort(),
  };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-race-audit-'));
  const dir = path.join(root, '.github', 'workflows');
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, CANONICAL_DEPLOY), `on:\n  workflow_call:\npermissions:\n  contents: read\n  pages: write\nconcurrency:\n  group: github-pages\n  cancel-in-progress: true\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: main\n      - uses: actions/deploy-pages@v4\n`);
  fs.writeFileSync(path.join(dir, 'caller.yml'), `on:\n  workflow_dispatch:\npermissions:\n  contents: write\nconcurrency:\n  group: caller\n  cancel-in-progress: false\njobs:\n  write:\n    runs-on: ubuntu-latest\n    steps:\n      - run: git commit -am test && git push origin HEAD:main\n  deploy:\n    needs: write\n    uses: ./.github/workflows/deploy-pages.yml\n`);
  fs.writeFileSync(path.join(dir, 'analysis-only.yml'), `on:\n  workflow_dispatch:\nconcurrency:\n  group: analysis-only\n  cancel-in-progress: true\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo safe-to-cancel\n`);

  let result = audit(root);
  if (result.errors.length) throw new Error(`Expected clean layered self-test, got: ${result.errors.join('; ')}`);
  if (!result.repositoryWriters.includes('caller.yml')) throw new Error('Expected caller.yml to be classified as repository writer');
  if (!result.cancelableWorkflows.includes(CANONICAL_DEPLOY)) throw new Error('Expected canonical Pages workflow to be cancelable');

  fs.writeFileSync(path.join(dir, 'caller.yml'), `on:\n  workflow_dispatch:\npermissions:\n  contents: write\nconcurrency:\n  group: caller\n  cancel-in-progress: true\njobs:\n  write:\n    runs-on: ubuntu-latest\n    steps:\n      - run: git commit -am test && git push origin HEAD:main\n  deploy:\n    needs: write\n    uses: ./.github/workflows/deploy-pages.yml\n`);
  result = audit(root);
  if (!result.errors.some((item) => item.includes('repository/data write layer'))) {
    throw new Error('Expected cancelable repository writer regression to be detected');
  }

  fs.writeFileSync(path.join(dir, 'caller.yml'), `on:\n  workflow_dispatch:\npermissions:\n  contents: write\nconcurrency:\n  group: caller\n  cancel-in-progress: false\njobs:\n  write:\n    runs-on: ubuntu-latest\n    steps:\n      - run: git commit -am test && git push origin HEAD:main\n  deploy:\n    needs: write\n    uses: ./.github/workflows/deploy-pages.yml\n`);
  fs.writeFileSync(path.join(dir, CANONICAL_DEPLOY), `on:\n  workflow_call:\npermissions:\n  contents: read\n  pages: write\nconcurrency:\n  group: github-pages\n  cancel-in-progress: false\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: main\n      - uses: actions/deploy-pages@v4\n`);
  result = audit(root);
  if (!result.errors.some((item) => item.includes('publication layer must use cancel-in-progress: true'))) {
    throw new Error('Expected non-cancelable Pages publisher regression to be detected');
  }

  fs.rmSync(root, { recursive: true, force: true });
  console.log('audit_workflow_deployment_races layered self-test passed');
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) {
    selfTest();
    process.exit(0);
  }

  const result = audit(process.cwd());
  console.log(`Scanned ${result.workflows} workflow file(s).`);
  console.log(`Repository/data write workflows: ${result.repositoryWriters.join(', ') || 'none'}`);
  console.log(`Workflows with cancel-in-progress: true: ${result.cancelableWorkflows.join(', ') || 'none'}`);
  console.log(`Deployment-reachable workflows: ${result.deploymentReachable.join(', ') || 'none'}`);
  for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log('Workflow deployment layering audit passed.');
}

module.exports = {
  audit,
  deploymentReachable,
  localWorkflowUses,
  isRepositoryWriter,
};
