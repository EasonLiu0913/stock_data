#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  inspectReusableMonth,
} = require('./generate_mops_revenue_monthly_signal_returns');
const {
  runIncrementalRange,
} = require('./run_mops_revenue_monthly_signal_incremental');
const {
  buildRevenueMonthRange,
} = require('./backfill_mops_monthly_revenue_task');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');

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

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function detailFile(month) {
  return path.join(OUTPUT_ROOT, `${month}.json`);
}

function snapshotHashes(months) {
  return Object.fromEntries(months.map(month => {
    const file = detailFile(month);
    if (!fs.existsSync(file)) throw new Error(`Recovery validation requires an existing detail: ${month}`);
    return [month, sha256File(file)];
  }));
}

function validateRecoverySummary(summary, targetMonth, months) {
  if (!summary || summary.total !== months.length) {
    throw new Error(`Recovery validation summary total mismatch for ${targetMonth}`);
  }
  if (summary.generated !== 1 || summary.reused !== months.length - 1) {
    throw new Error(`Expected exactly one generated month for ${targetMonth}; got generated=${summary.generated}, reused=${summary.reused}`);
  }
  const generated = summary.items.filter(item => item.action === 'generated').map(item => item.month);
  if (generated.length !== 1 || generated[0] !== targetMonth) {
    throw new Error(`Expected only ${targetMonth} to regenerate; got ${generated.join(',') || 'none'}`);
  }
}

function assertOtherHashesUnchanged(before, months, targetMonth) {
  for (const month of months) {
    if (month === targetMonth) continue;
    const current = sha256File(detailFile(month));
    if (current !== before[month]) {
      throw new Error(`Recovery validation unexpectedly modified reusable month ${month}`);
    }
  }
}

function assertWorkspaceRestored(before, months) {
  for (const month of months) {
    const current = sha256File(detailFile(month));
    if (current !== before[month]) {
      throw new Error(`Recovery validation did not restore original detail ${month}`);
    }
  }
}

function runScenario({ scenario, startMonth, endMonth, targetMonth, months, before, originalBytes, logger = console }) {
  const targetFile = detailFile(targetMonth);
  if (scenario === 'missing') {
    fs.unlinkSync(targetFile);
  } else if (scenario === 'corrupt') {
    fs.writeFileSync(targetFile, '{"corrupt":', 'utf8');
  } else {
    throw new Error(`Unknown recovery scenario: ${scenario}`);
  }

  try {
    const summary = runIncrementalRange({ startMonth, endMonth, logger });
    validateRecoverySummary(summary, targetMonth, months);
    assertOtherHashesUnchanged(before, months, targetMonth);

    const repaired = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    if (repaired.dataset !== 'mops_monthly_revenue_conservative_signal_returns' || repaired.revenue_month !== targetMonth) {
      throw new Error(`Recovered detail identity mismatch for ${targetMonth}`);
    }
    logger.log(`[MOPS recovery] ${scenario} scenario passed: only ${targetMonth} regenerated`);
    return summary;
  } finally {
    fs.writeFileSync(targetFile, originalBytes);
  }
}

function validateRecovery(options = {}) {
  const {
    startMonth,
    endMonth,
    targetMonth,
    logger = console,
  } = options;
  const months = buildRevenueMonthRange(startMonth, endMonth, { maxMonths: 36 });
  if (!months.includes(targetMonth)) throw new Error(`recovery month ${targetMonth} must be inside ${startMonth}-${endMonth}`);

  for (const month of months) {
    const inspection = inspectReusableMonth(month);
    if (!inspection.reusable) {
      throw new Error(`Recovery validation requires a mature reusable range; ${month} is not reusable (${inspection.reason})`);
    }
  }

  const targetFile = detailFile(targetMonth);
  const originalBytes = fs.readFileSync(targetFile);
  const before = snapshotHashes(months);

  try {
    const missing = runScenario({ scenario: 'missing', startMonth, endMonth, targetMonth, months, before, originalBytes, logger });
    assertWorkspaceRestored(before, months);
    const corrupt = runScenario({ scenario: 'corrupt', startMonth, endMonth, targetMonth, months, before, originalBytes, logger });
    assertWorkspaceRestored(before, months);
    return {
      ok: true,
      start_month: startMonth,
      end_month: endMonth,
      recovery_month: targetMonth,
      scenarios: {
        missing: { generated: missing.generated, reused: missing.reused },
        corrupt: { generated: corrupt.generated, reused: corrupt.reused },
      },
      workspace_restored: true,
    };
  } finally {
    fs.writeFileSync(targetFile, originalBytes);
    assertWorkspaceRestored(before, months);
  }
}

function main() {
  const args = parseArgs();
  const startMonth = args.get('start-month');
  const endMonth = args.get('end-month');
  const targetMonth = args.get('recovery-month');
  if (!startMonth || !endMonth || !targetMonth) {
    throw new Error('Usage: node scripts/validate_mops_revenue_incremental_recovery.js --start-month YYYYMM --end-month YYYYMM --recovery-month YYYYMM');
  }
  console.log(JSON.stringify(validateRecovery({ startMonth, endMonth, targetMonth }), null, 2));
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
  assertOtherHashesUnchanged,
  parseArgs,
  validateRecovery,
  validateRecoverySummary,
};
