#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  autoRevenueMonth,
  crawlMonth,
  monthOutputDir,
  normalizeRevenueMonth,
  readJson,
  taipeiIso,
  updateRootIndexes,
} = require('./crawl_mops_monthly_revenue');
const { applySnapshotPolicy } = require('./apply_mops_snapshot_policy');
const { existingMonths, rebuildMonth } = require('./rebuild_mops_monthly_revenue_metadata');
const { runTask } = require('./framework');

const DEFAULT_MANIFEST_PATH = path.join(ROOT, 'data_task_manifests', 'mops-monthly-revenue-backfill.json');
const VALID_COLLECTION_STATUSES = new Set(['baseline_seed', 'collecting', 'likely_complete']);

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

function nextRevenueMonth(value) {
  const month = normalizeRevenueMonth(value);
  let year = Number(month.slice(0, 4));
  let m = Number(month.slice(4, 6)) + 1;
  if (m === 13) {
    year += 1;
    m = 1;
  }
  return `${year}${String(m).padStart(2, '0')}`;
}

function buildRevenueMonthRange(startMonth, endMonth, { maxMonths = 36 } = {}) {
  const start = normalizeRevenueMonth(startMonth);
  const end = normalizeRevenueMonth(endMonth);
  if (start > end) throw new Error(`Invalid month range: ${start} > ${end}`);
  if (!Number.isInteger(maxMonths) || maxMonths < 1) throw new TypeError('maxMonths must be a positive integer');

  const months = [];
  for (let month = start; month <= end; month = nextRevenueMonth(month)) {
    months.push(month);
    if (months.length > maxMonths) {
      throw new Error(`Safety limit exceeded: a single backfill may include at most ${maxMonths} months`);
    }
  }
  return months;
}

function inspectMopsMonth(revenueMonth) {
  const month = normalizeRevenueMonth(revenueMonth);
  const file = path.join(monthOutputDir(month), 'monthly_revenue.json');
  if (!fs.existsSync(file)) {
    return { valid: false, resumable_complete: false, reason: 'missing_output', file };
  }

  const payload = readJson(file, null);
  if (!payload || payload.revenue_month !== month) {
    return { valid: false, resumable_complete: false, reason: 'month_mismatch_or_invalid_json', file };
  }
  if (!Array.isArray(payload.companies) || payload.companies.length === 0) {
    return { valid: false, resumable_complete: false, reason: 'missing_company_rows', file };
  }

  const status = payload.collection?.status;
  if (!VALID_COLLECTION_STATUSES.has(status)) {
    return { valid: false, resumable_complete: false, reason: 'invalid_collection_status', file, status };
  }

  const companyCount = Number(payload.collection?.company_count);
  if (!Number.isFinite(companyCount) || companyCount <= 0 || companyCount !== payload.companies.length) {
    return {
      valid: false,
      resumable_complete: false,
      reason: 'company_count_mismatch',
      file,
      company_count: companyCount,
      rows: payload.companies.length,
    };
  }

  return {
    valid: true,
    resumable_complete: status === 'baseline_seed' || status === 'likely_complete',
    reason: status === 'collecting' ? 'collecting_requires_refresh' : 'complete',
    file,
    metadata: {
      revenue_month: month,
      company_count: companyCount,
      baseline_month: payload.collection?.baseline_month ?? null,
      baseline_company_count: payload.collection?.baseline_company_count ?? null,
      coverage_ratio: payload.collection?.coverage_ratio ?? null,
      snapshot_count: payload.collection?.snapshot_count ?? null,
      status,
    },
  };
}

function rebuildMetadataFrom(startMonth, { calculatedAt = taipeiIso() } = {}) {
  const start = normalizeRevenueMonth(startMonth);
  const targets = existingMonths().filter((month) => month >= start);
  const rebuilt = [];
  for (const month of targets) {
    const payload = rebuildMonth(month, calculatedAt);
    rebuilt.push({
      revenue_month: month,
      baseline_month: payload.collection?.baseline_month ?? null,
      baseline_company_count: payload.collection?.baseline_company_count ?? null,
      company_count: payload.collection?.company_count ?? null,
      coverage_ratio: payload.collection?.coverage_ratio ?? null,
      status: payload.collection?.status ?? null,
    });
  }
  const latest = targets.at(-1);
  if (latest) {
    const latestPayload = readJson(path.join(monthOutputDir(latest), 'monthly_revenue.json'), null);
    if (latestPayload) updateRootIndexes(latest, latestPayload);
  }
  return rebuilt;
}

async function runMopsBackfillTask(options = {}) {
  const {
    startMonth,
    endMonth,
    manifestPath = DEFAULT_MANIFEST_PATH,
    forceNewSnapshot = false,
    force = false,
    checkpointEveryItems = 3,
    maxMonths = 36,
    logger,
    hooks = {},
    processMonth = async (month) => {
      await crawlMonth(month);
      applySnapshotPolicy(month, { forceNewSnapshot });
    },
    inspectMonth = inspectMopsMonth,
    rebuildMetadata = true,
  } = options;

  const latestAllowed = autoRevenueMonth();
  const start = normalizeRevenueMonth(startMonth);
  const end = normalizeRevenueMonth(endMonth);
  if (end > latestAllowed) {
    throw new Error(`End month ${end} is later than latest allowed revenue month ${latestAllowed}`);
  }
  const items = buildRevenueMonthRange(start, end, { maxMonths });

  const summary = await runTask({
    taskId: 'mops-monthly-revenue-backfill',
    items,
    manifestPath,
    force,
    logger,
    validatorVersion: 1,
    checkpoint: { everyItems: checkpointEveryItems },
    retry: {
      maxAttempts: 3,
      baseDelayMs: 3000,
      maxDelayMs: 30000,
    },
    hooks,
    async isComplete(month) {
      const inspected = inspectMonth(month);
      return {
        complete: inspected.valid && inspected.resumable_complete,
        metadata: inspected.metadata || null,
      };
    },
    async processItem(month) {
      await processMonth(month);
    },
    async validateItem(month) {
      const inspected = inspectMonth(month);
      return {
        valid: inspected.valid,
        metadata: inspected.metadata || { reason: inspected.reason },
      };
    },
  });

  const rebuilt = rebuildMetadata ? rebuildMetadataFrom(start) : [];
  return { summary, rebuilt };
}

async function main() {
  const args = parseArgs();
  const startMonth = args.get('start-month');
  const endMonth = args.get('end-month');
  if (!startMonth || !endMonth) {
    throw new Error('Both --start-month YYYYMM and --end-month YYYYMM are required');
  }

  const result = await runMopsBackfillTask({
    startMonth,
    endMonth,
    manifestPath: args.get('manifest-path') || DEFAULT_MANIFEST_PATH,
    forceNewSnapshot: args.has('force-new-snapshot'),
    force: args.has('force'),
    checkpointEveryItems: args.get('checkpoint-every') ? Number(args.get('checkpoint-every')) : 3,
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_MANIFEST_PATH,
  VALID_COLLECTION_STATUSES,
  buildRevenueMonthRange,
  inspectMopsMonth,
  nextRevenueMonth,
  rebuildMetadataFrom,
  runMopsBackfillTask,
};