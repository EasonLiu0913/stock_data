'use strict';

const path = require('node:path');
const {
  buildResearchSummary,
  loadStoredResearchInputs,
  writeResearchSummary,
} = require('./momentum_research_summary');

function main() {
  const workspaceRoot = path.resolve(process.cwd());
  const dryRun = process.argv.includes('--dry-run');
  const { histories, replays } = loadStoredResearchInputs(workspaceRoot, 1);
  if (!histories.length) throw new Error('No Momentum v1 history is available for research summary');
  const summary = buildResearchSummary(histories, replays);
  const file = dryRun ? null : writeResearchSummary(workspaceRoot, summary, 1);
  console.log(JSON.stringify({
    schema_version: summary.schema_version,
    methodology_version: summary.methodology_version,
    dry_run: dryRun,
    signal_date_count: summary.signal_date_count,
    signal_dates: summary.signal_dates,
    mature_horizon_dates: summary.mature_horizon_dates,
    group_count: summary.groups.length,
    warnings: summary.warnings,
    file,
  }, null, 2));
}

if (require.main === module) main();
