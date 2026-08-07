#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  OUTPUT_ROOT,
  completionSummary,
  monthOutputDir,
  normalizeRevenueMonth,
  previousRevenueMonth,
  readJson,
  rebuildDerivedCompanies,
  taipeiIso,
  updateRootIndexes,
  writeJson,
} = require('./crawl_mops_monthly_revenue');

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

function existingMonths() {
  if (!fs.existsSync(OUTPUT_ROOT)) return [];
  return fs.readdirSync(OUTPUT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^20\d{4}$/.test(entry.name))
    .map((entry) => entry.name)
    .filter((month) => fs.existsSync(path.join(monthOutputDir(month), 'monthly_revenue.json')))
    .sort();
}

function rebuildMonth(month, calculatedAt) {
  const outputFile = path.join(monthOutputDir(month), 'monthly_revenue.json');
  const payload = readJson(outputFile, null);
  if (!payload) throw new Error(`Missing monthly revenue payload: ${outputFile}`);
  const previousMonth = previousRevenueMonth(month);
  const previousPayload = readJson(path.join(monthOutputDir(previousMonth), 'monthly_revenue.json'), null);

  const companies = rebuildDerivedCompanies(payload.companies, previousPayload);
  const collection = completionSummary(companies.length, previousPayload, {
    baselineMonth: previousMonth,
    calculatedAt,
  });

  const rebuilt = {
    ...payload,
    schema_version: 2,
    collection: {
      ...payload.collection,
      ...collection,
    },
    companies,
  };
  writeJson(outputFile, rebuilt);
  return rebuilt;
}

function main() {
  const args = parseArgs();
  const months = existingMonths();
  if (!months.length) {
    console.log(JSON.stringify({ ok: true, rebuilt: [] }, null, 2));
    return;
  }

  const from = args.get('from') ? normalizeRevenueMonth(args.get('from')) : months[0];
  const calculatedAt = taipeiIso();
  const targets = months.filter((month) => month >= from);
  const summaries = [];

  for (const month of targets) {
    const rebuilt = rebuildMonth(month, calculatedAt);
    summaries.push({
      revenue_month: month,
      baseline_month: rebuilt.collection.baseline_month,
      baseline_company_count: rebuilt.collection.baseline_company_count,
      company_count: rebuilt.collection.company_count,
      coverage_ratio: rebuilt.collection.coverage_ratio,
      status: rebuilt.collection.status,
    });
  }

  const latest = targets.at(-1);
  if (latest) {
    const latestPayload = readJson(path.join(monthOutputDir(latest), 'monthly_revenue.json'));
    updateRootIndexes(latest, latestPayload);
  }

  console.log(JSON.stringify({ ok: true, from, rebuilt: summaries }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { existingMonths, rebuildMonth };
