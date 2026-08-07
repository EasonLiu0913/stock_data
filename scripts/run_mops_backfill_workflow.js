#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  ROOT,
  normalizeRevenueMonth,
} = require('./crawl_mops_monthly_revenue');
const {
  DEFAULT_MANIFEST_PATH,
  buildRevenueMonthRange,
  inspectMopsMonth,
  runMopsBackfillTask,
} = require('./backfill_mops_monthly_revenue_task');

function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relativeToRoot(file) {
  const relative = path.relative(ROOT, file).replaceAll(path.sep, '/');
  if (!relative || relative.startsWith('../')) {
    throw new Error(`Path is outside repository root: ${file}`);
  }
  return relative;
}

function checkpointPaths(months, manifestPath = DEFAULT_MANIFEST_PATH) {
  const uniqueMonths = [...new Set(months.map((month) => normalizeRevenueMonth(month)))].sort();
  return [
    ...uniqueMonths.map((month) => `data_mops_monthly_revenue/${month}`),
    relativeToRoot(manifestPath),
  ];
}

function failedMonthsFromSummary(summary) {
  return Object.entries(summary?.items || {})
    .filter(([, item]) => item?.status === 'failed')
    .map(([month]) => normalizeRevenueMonth(month));
}

function discardFailedMonthChanges(summary) {
  for (const month of failedMonthsFromSummary(summary)) {
    const target = `data_mops_monthly_revenue/${month}`;
    try {
      git(['restore', '--staged', '--worktree', '--', target]);
    } catch {
      // A newly created failed month may not exist in HEAD.
    }
    try {
      git(['clean', '-fd', '--', target]);
    } catch {
      // Nothing untracked to remove.
    }
  }
}

function hasStagedChanges() {
  try {
    git(['diff', '--cached', '--quiet']);
    return false;
  } catch {
    return true;
  }
}

function commitSelected(paths, message) {
  git(['add', '--', ...paths]);
  if (!hasStagedChanges()) {
    console.log(`No staged changes for: ${message}`);
    return false;
  }
  git(['commit', '-m', message]);
  return true;
}

async function pushMainWithRetry({ attempts = 5 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      git(['pull', '--rebase', '--autostash', 'origin', 'main']);
      git(['push', 'origin', 'HEAD:main']);
      return;
    } catch (error) {
      try { git(['rebase', '--abort']); } catch {}
      if (attempt >= attempts) throw error;
      const delayMs = (4 + Math.floor(Math.random() * 5)) * 1000;
      console.log(`Push attempt ${attempt}/${attempts} failed; retrying after ${delayMs / 1000}s`);
      await sleep(delayMs);
    }
  }
}

async function persistCheckpoint({ months, manifestPath, event }) {
  if (event.reason === 'before_failure') {
    discardFailedMonthChanges(event.summary);
  }

  const paths = checkpointPaths(months, manifestPath);
  const label = months.length ? `${months[0]}-${months.at(-1)}` : 'manifest';
  const committed = commitSelected(
    paths,
    `data: checkpoint MOPS monthly revenue ${label}`,
  );
  if (committed) await pushMainWithRetry();
}

function validateRange(startMonth, endMonth) {
  const months = buildRevenueMonthRange(startMonth, endMonth);
  const details = [];
  for (const month of months) {
    const inspected = inspectMopsMonth(month);
    if (!inspected.valid) {
      throw new Error(`MOPS backfill validation failed for ${month}: ${inspected.reason}`);
    }
    details.push(inspected.metadata);
  }
  return details;
}

async function persistFinal(startMonth, endMonth, manifestPath) {
  const paths = [
    'data_mops_monthly_revenue',
    relativeToRoot(manifestPath),
  ];
  const committed = commitSelected(
    paths,
    `data: backfill MOPS monthly revenue ${startMonth}-${endMonth}`,
  );
  if (committed) await pushMainWithRetry();

  const status = git(['status', '--porcelain'], { capture: true }).trim();
  if (status) {
    throw new Error(`Unexpected uncommitted changes remain after final MOPS backfill commit:\n${status}`);
  }
}

async function main() {
  const args = parseArgs();
  const startMonth = normalizeRevenueMonth(args.get('start-month'));
  const endMonth = normalizeRevenueMonth(args.get('end-month'));
  const manifestPath = args.get('manifest-path')
    ? path.resolve(ROOT, args.get('manifest-path'))
    : DEFAULT_MANIFEST_PATH;
  const forceNewSnapshot = args.has('force-new-snapshot');
  const pendingCheckpointMonths = new Set();

  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);

  const result = await runMopsBackfillTask({
    startMonth,
    endMonth,
    manifestPath,
    forceNewSnapshot,
    // Preserve the old workflow meaning: asking for a new snapshot means the
    // selected months must actually be crawled instead of resume-skipped.
    force: forceNewSnapshot,
    checkpointEveryItems: 3,
    hooks: {
      async onItemDone(event) {
        if (event.status === 'done') {
          pendingCheckpointMonths.add(event.itemKey);
          if (event.index < event.total) {
            const delayMs = (3 + Math.floor(Math.random() * 5)) * 1000;
            console.log(`Polite delay before next MOPS month: ${delayMs / 1000}s`);
            await sleep(delayMs);
          }
        }
      },
      async onCheckpoint(event) {
        const months = [...pendingCheckpointMonths].sort();
        await persistCheckpoint({ months, manifestPath, event });
        pendingCheckpointMonths.clear();
      },
    },
  });

  const validation = validateRange(startMonth, endMonth);
  await persistFinal(startMonth, endMonth, manifestPath);

  console.log(JSON.stringify({
    ok: true,
    summary: result.summary,
    rebuilt: result.rebuilt,
    validation,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  checkpointPaths,
  failedMonthsFromSummary,
  relativeToRoot,
  validateRange,
};
