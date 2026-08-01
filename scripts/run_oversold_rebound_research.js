#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  ROOT,
  parseArgs,
  runResearch,
  writeResearch,
} = require('./mine_oversold_rebound_events');
const { applyDealerFeatureFix } = require('./patch_oversold_rebound_dealer_features');
const { finalizeResearchResult } = require('./oversold_rebound_outcome_verification');

function printHelp() {
  console.log(`
個股跌深反彈歷史事件研究（正式執行入口）

用法：
  node scripts/run_oversold_rebound_research.js [options]

支援參數：
  --from YYYYMMDD
  --to YYYYMMDD
  --stocks 2330,6443
  --max-gap N
  --max-episode-span N
  --output-root PATH
  --dry-run
  --help

本入口會在事件挖掘後修正自營商欄位映射，並驗證各持有期間是否已完成；尚未走完觀察期的事件不計入命中率分母。
`);
}

function execute(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return null;
  }
  const mined = runResearch(ROOT, options);
  const dealerFixed = applyDealerFeatureFix(mined, ROOT, options);
  const result = finalizeResearchResult(dealerFixed);
  if (!options.dryRun) writeResearch(options.outputRoot, result);
  const report = {
    research_id: result.summary.research_id,
    date_range: result.manifest.date_range,
    stock_count: result.summary.stock_count,
    event_count: result.summary.event_count,
    primary_outcome: result.summary.primary_outcome,
    outcome_counts: result.summary.outcome_counts,
    feature_coverage: result.summary.feature_coverage,
    output_root: options.dryRun ? null : path.relative(ROOT, options.outputRoot).replaceAll(path.sep, '/'),
    dry_run: options.dryRun,
  };
  console.log(JSON.stringify(report, null, 2));
  return { options, result, report };
}

function main() {
  try {
    execute();
  } catch (error) {
    console.error(`[oversold-rebound-research] ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { execute };
