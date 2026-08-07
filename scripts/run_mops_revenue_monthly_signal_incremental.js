#!/usr/bin/env node
'use strict';

const {
  generateMonth,
  inspectReusableMonth,
} = require('./generate_mops_revenue_monthly_signal_returns');
const { buildRevenueMonthRange } = require('./backfill_mops_monthly_revenue_task');

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

function runIncrementalRange(options = {}) {
  const {
    startMonth,
    endMonth,
    forceFullRebuild = false,
    inspectMonth = inspectReusableMonth,
    generate = generateMonth,
    maxMonths = 36,
    logger = console,
  } = options;

  const months = buildRevenueMonthRange(startMonth, endMonth, { maxMonths });
  const summary = {
    start_month: months[0],
    end_month: months.at(-1),
    total: months.length,
    generated: 0,
    reused: 0,
    items: [],
  };

  for (const month of months) {
    const inspection = forceFullRebuild
      ? { reusable: false, reason: 'force_full_rebuild' }
      : inspectMonth(month);

    if (inspection.reusable) {
      summary.reused += 1;
      summary.items.push({ month, action: 'reused', reason: inspection.reason });
      logger.log(`[MOPS research] ${month} REUSE (${inspection.reason})`);
      continue;
    }

    logger.log(`[MOPS research] ${month} GENERATE (${inspection.reason})`);
    const result = generate(month);
    summary.generated += 1;
    summary.items.push({
      month,
      action: 'generated',
      reason: inspection.reason,
      output: result?.output || null,
      counts: result?.counts || null,
    });
  }

  return summary;
}

function main() {
  const args = parseArgs();
  const startMonth = args.get('start-month');
  const endMonth = args.get('end-month');
  if (!startMonth || !endMonth) {
    throw new Error('Both --start-month YYYYMM and --end-month YYYYMM are required');
  }
  const summary = runIncrementalRange({
    startMonth,
    endMonth,
    forceFullRebuild: args.has('force-full-rebuild'),
  });
  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  runIncrementalRange,
};
