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
    return { errors, warnings, workflows: workflows.size, deploymentReachable: [] };
  }

  const deploy = workflows.get(CANONICAL_DEPLOY);
  if (!hasCanonicalPagesGroup(deploy)) {
    errors.push(`${CANONICAL_DEPLOY}: concurrency group must be exactly github-pages`);
  }
  if (!hasCancelFalse(deploy) || hasCancelTrue(deploy)) {
    errors.push(`${CANONICAL_DEPLOY}: Pages deployment must queue with cancel-in-progress: false`);
  }
  if (!hasWorkflowCall(deploy)) {
    errors.push(`${CANONICAL_DEPLOY}: must expose workflow_call for explicit chaining`);
  }

  const reachable = deploymentReachable(workflows);
  for (const name of [...reachable].sort()) {
    const text = workflows.get(name);
    if (!text) continue;

    if (hasWorkflowRun(text)) {
      errors.push(`${name}: deployment chain must not use workflow_run`);
    }
    if (hasCancelTrue(text)) {
      errors.push(`${name}: deployment-reachable workflow must not use cancel-in-progress: true`);
    }

    if (name !== CANONICAL_DEPLOY && hasWorkflowCall(text) && hasPushDataPath(text)) {
      errors.push(`${name}: reusable deployment-chain workflow also watches data/normalized push paths; this can duplicate a workflow_call run`);
    }
  }

  // The canonical deploy workflow still supports push as a compatibility fallback.
  // That may enqueue an extra deployment in addition to an explicit workflow_call,
  // but the shared github-pages lock guarantees serialization instead of cancellation.
  if (hasPushDataPath(deploy)) {
    warnings.push(`${CANONICAL_DEPLOY}: data/normalized push fallback is enabled; duplicate deploy requests may queue, but they cannot cancel each other`);
  }

  return {
    errors,
    warnings,
    workflows: workflows.size,
    deploymentReachable: [...reachable].sort(),
  };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-race-audit-'));
  const dir = path.join(root, '.github', 'workflows');
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, CANONICAL_DEPLOY), `on:\n  workflow_call:\nconcurrency:\n  group: github-pages\n  cancel-in-progress: false\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n`);
  fs.writeFileSync(path.join(dir, 'caller.yml'), `on:\n  workflow_dispatch:\nconcurrency:\n  group: caller\n  cancel-in-progress: false\njobs:\n  deploy:\n    uses: ./.github/workflows/deploy-pages.yml\n`);

  let result = audit(root);
  if (result.errors.length) throw new Error(`Expected clean self-test, got: ${result.errors.join('; ')}`);

  fs.writeFileSync(path.join(dir, 'caller.yml'), `on:\n  workflow_dispatch:\nconcurrency:\n  group: caller\n  cancel-in-progress: true\njobs:\n  deploy:\n    uses: ./.github/workflows/deploy-pages.yml\n`);
  result = audit(root);
  if (!result.errors.some((item) => item.includes('cancel-in-progress: true'))) {
    throw new Error('Expected cancel-in-progress regression to be detected');
  }

  fs.rmSync(root, { recursive: true, force: true });
  console.log('audit_workflow_deployment_races self-test passed');
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) {
    selfTest();
    process.exit(0);
  }

  const result = audit(process.cwd());
  console.log(`Scanned ${result.workflows} workflow file(s).`);
  console.log(`Deployment-reachable workflows: ${result.deploymentReachable.join(', ') || 'none'}`);
  for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log('Workflow deployment race audit passed.');
}

module.exports = { audit, deploymentReachable, localWorkflowUses };
