#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  ROOT,
  readJson,
  atomicWriteJson,
  round,
} = require('./market_environment_lib');
const {
  OVERSOLD_ELECTRONICS_STRATEGY_ID,
  OVERSOLD_ELECTRONICS_TAG,
  summarizeStocks,
  oversoldCandidateScore,
} = require('./apply_formal_market_strategy_tags');
const { generateOversoldBetaRebound } = require('./oversold_beta_rebound');

const DISPOSITION_NOT_CONNECTED_WARNING = '處置股資料未接入，無法完成此項排除。';
const DISPOSITION_INCOMPLETE_WARNING = '上市與上櫃處置資料未同時成功，未執行處置股硬排除。';
const FORMAL_DISPOSITION_CRITERION = '排除預測日仍在處置期間的上市與上櫃股票';

function compactDate(value) {
  const compact = String(value || '').replaceAll('-', '').replaceAll('/', '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isOversoldCandidate(stock) {
  return Boolean(stock?.formal_market_strategies?.[OVERSOLD_ELECTRONICS_STRATEGY_ID]
    || stock?.oversold_electronics_rebound
    || (Array.isArray(stock?.strategy_tags) && stock.strategy_tags.includes(OVERSOLD_ELECTRONICS_TAG)));
}

function cleanDispositionWarnings(values, replacement = null) {
  const output = (Array.isArray(values) ? values : [])
    .filter((value) => value !== DISPOSITION_NOT_CONNECTED_WARNING)
    .filter((value) => value !== DISPOSITION_INCOMPLETE_WARNING);
  if (replacement) output.push(replacement);
  return [...new Set(output)];
}

function normalizeCriteria(values) {
  const output = (Array.isArray(values) ? values : [])
    .filter((value) => !String(value).includes('處置股資料接入後才啟用硬排除'))
    .filter((value) => value !== FORMAL_DISPOSITION_CRITERION);
  output.push(FORMAL_DISPOSITION_CRITERION);
  return output;
}

function removeOversoldStrategy(stock) {
  if (Array.isArray(stock.strategy_tags)) {
    stock.strategy_tags = stock.strategy_tags.filter((tag) => tag !== OVERSOLD_ELECTRONICS_TAG);
  }
  delete stock.oversold_electronics_rebound;
  if (stock.formal_market_strategies && typeof stock.formal_market_strategies === 'object') {
    delete stock.formal_market_strategies[OVERSOLD_ELECTRONICS_STRATEGY_ID];
    if (!Object.keys(stock.formal_market_strategies).length) delete stock.formal_market_strategies;
  }
}

function updateCandidateMetadata(stock, readiness, dispositionComplete) {
  const metadata = stock?.formal_market_strategies?.[OVERSOLD_ELECTRONICS_STRATEGY_ID]
    || stock?.oversold_electronics_rebound;
  if (!metadata) return;
  metadata.market_readiness_score = finiteNumber(readiness?.score);
  metadata.market_readiness_status = readiness?.status || null;
  metadata.candidate_score = oversoldCandidateScore(stock, readiness);
  metadata.criteria = normalizeCriteria(metadata.criteria);
  metadata.risk_warnings = cleanDispositionWarnings(
    metadata.risk_warnings,
    dispositionComplete ? null : DISPOSITION_INCOMPLETE_WARNING,
  );
  stock.oversold_electronics_rebound = metadata;
  stock.formal_market_strategies = {
    ...(stock.formal_market_strategies || {}),
    [OVERSOLD_ELECTRONICS_STRATEGY_ID]: metadata,
  };
}

function buildDispositionMetadata({ disposition, sourceFile, beforeCount, excludedCodes, remainingCount }) {
  const complete = disposition?.complete_market_coverage === true;
  return {
    status: complete ? 'completed' : disposition ? 'incomplete' : 'unavailable',
    complete_market_coverage: complete,
    source_file: sourceFile,
    active_record_count: disposition?.active_record_count ?? null,
    active_stock_record_count: disposition?.active_stock_record_count ?? null,
    active_stock_count: disposition?.active_stock_count ?? null,
    candidate_count_before: beforeCount,
    excluded_count: complete ? excludedCodes.length : 0,
    excluded_codes: complete ? excludedCodes : [],
    candidate_count_after: remainingCount,
  };
}

function applyConstraintsToPayloads({ summary, groupSummary, disposition = null, readiness = null, dispositionSourceFile = null }) {
  if (!Array.isArray(summary?.stocks)) throw new Error('Missing prediction summary stocks');
  const complete = disposition?.complete_market_coverage === true;
  const activeCodes = new Set(complete ? (disposition.active_stock_codes || []).map(String) : []);
  const beforeCandidates = summary.stocks.filter(isOversoldCandidate);
  const excluded = complete
    ? beforeCandidates.filter((stock) => activeCodes.has(String(stock.stock_code)))
    : [];
  const excludedCodes = excluded.map((stock) => String(stock.stock_code)).sort();
  const excludedSet = new Set(excludedCodes);

  for (const stock of summary.stocks) {
    if (!isOversoldCandidate(stock)) continue;
    if (excludedSet.has(String(stock.stock_code))) removeOversoldStrategy(stock);
    else updateCandidateMetadata(stock, readiness, complete);
  }

  const remaining = summary.stocks.filter(isOversoldCandidate);
  const sortedMembers = [...remaining]
    .sort((left, right) => (finiteNumber(right?.oversold_electronics_rebound?.candidate_score) ?? -Infinity)
      - (finiteNumber(left?.oversold_electronics_rebound?.candidate_score) ?? -Infinity))
    .map((stock) => String(stock.stock_code));
  const dispositionMetadata = buildDispositionMetadata({
    disposition,
    sourceFile: dispositionSourceFile,
    beforeCount: beforeCandidates.length,
    excludedCodes,
    remainingCount: remaining.length,
  });

  const classification = summary?.formal_strategy_classifications?.[OVERSOLD_ELECTRONICS_STRATEGY_ID];
  if (classification) {
    classification.criteria = normalizeCriteria(classification.criteria);
    classification.market_readiness_score = finiteNumber(readiness?.score);
    classification.market_readiness_status = readiness?.status || null;
    classification.count = classification.calculation_status === 'completed' ? remaining.length : classification.count;
    classification.members = classification.calculation_status === 'completed' ? sortedMembers : classification.members;
    classification.calculation_message = classification.calculation_status === 'completed'
      ? remaining.length ? `已完成計算並排除正式處置股，共 ${remaining.length} 筆。` : '已完成計算並排除正式處置股，當日 0 筆。'
      : classification.calculation_message;
    classification.data_warnings = cleanDispositionWarnings(
      classification.data_warnings,
      complete ? null : DISPOSITION_INCOMPLETE_WARNING,
    );
    classification.disposition_filter = dispositionMetadata;
  }

  const groups = Array.isArray(groupSummary?.groups) ? groupSummary.groups : [];
  const group = groups.find((item) => item?.strategy_id === OVERSOLD_ELECTRONICS_STRATEGY_ID);
  if (group) {
    const aggregate = summarizeStocks(remaining);
    Object.assign(group, aggregate);
    group.criteria = normalizeCriteria(group.criteria);
    group.members = sortedMembers;
    group.market_readiness_score = finiteNumber(readiness?.score);
    group.market_readiness_status = readiness?.status || null;
    const scores = remaining
      .map((stock) => finiteNumber(stock?.oversold_electronics_rebound?.candidate_score))
      .filter((value) => value !== null);
    group.candidate_score_average = scores.length
      ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length, 1)
      : null;
    group.calculation_message = group.calculation_status === 'completed'
      ? remaining.length ? `已完成計算並排除正式處置股，共 ${remaining.length} 筆。` : '已完成計算並排除正式處置股，當日 0 筆。'
      : group.calculation_message;
    group.data_warnings = cleanDispositionWarnings(
      group.data_warnings,
      complete ? null : DISPOSITION_INCOMPLETE_WARNING,
    );
    group.disposition_filter = dispositionMetadata;
  }

  summary.market_constraints = {
    ...(summary.market_constraints || {}),
    disposition: dispositionMetadata,
  };
  return {
    summary,
    groupSummary,
    result: {
      disposition_complete: complete,
      candidate_count_before: beforeCandidates.length,
      excluded_count: excludedCodes.length,
      excluded_codes: excludedCodes,
      candidate_count_after: remaining.length,
    },
  };
}

function runReplayEvaluationIfPresent(date) {
  const predictionDir = path.join(ROOT, 'data_predictions', date);
  const required = ['summary.json', 'replay-dashboard.json', 'replay-summary.json']
    .map((name) => path.join(predictionDir, name));
  if (!required.every((file) => fs.existsSync(file))) return { evaluated: false, reason: 'replay_files_missing' };
  const script = path.join(__dirname, 'evaluate_formal_strategy_replay.js');
  const result = spawnSync(process.execPath, [script, '--date', date], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`Replay evaluation failed with exit code ${result.status}`);
  return { evaluated: true };
}

function applyOfficialMarketConstraints({ date, dryRun = false, evaluateReplayIfPresent = false } = {}) {
  const target = compactDate(date);
  if (!target) throw new Error('date must be YYYYMMDD');
  const predictionDir = path.join(ROOT, 'data_predictions', target);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const groupSummaryFile = path.join(predictionDir, 'group-summary.json');
  const constraintDir = path.join(ROOT, 'data_market_constraints', target);
  const dispositionFile = path.join(constraintDir, 'disposition.json');
  const nightFile = path.join(constraintDir, 'night-futures.json');
  const disposition = readJson(dispositionFile, null);
  const night = readJson(nightFile, null);
  if (!disposition && !night) {
    return { date: target, skipped: true, reason: 'official_constraint_snapshot_missing' };
  }
  if (!Array.isArray(readJson(summaryFile, null)?.stocks)) {
    return { date: target, skipped: true, reason: 'prediction_summary_missing' };
  }

  if (night?.available === true && night?.target_date === target && finiteNumber(night.change_percent) !== null) {
    generateOversoldBetaRebound({
      date: target,
      rootDir: 'data_predictions',
      nightFuturesChange: finiteNumber(night.change_percent),
      dryRun,
    });
  }
  const summary = readJson(summaryFile, null);
  const groupSummary = readJson(groupSummaryFile, { groups: [] });
  const readinessFile = path.join(ROOT, 'data_market_environment', target, 'oversold_beta_rebound.json');
  const readiness = readJson(readinessFile, summary?.market_rebound_readiness || null);
  const applied = applyConstraintsToPayloads({
    summary,
    groupSummary,
    disposition,
    readiness,
    dispositionSourceFile: disposition ? path.relative(ROOT, dispositionFile).replaceAll(path.sep, '/') : null,
  });
  applied.summary.market_constraints.night_futures = {
    status: night?.available === true && night?.target_date === target ? 'completed' : night ? 'unavailable' : 'missing',
    source_file: night ? path.relative(ROOT, nightFile).replaceAll(path.sep, '/') : null,
    change_percent: night?.available === true && night?.target_date === target
      ? finiteNumber(night.change_percent)
      : null,
    selected_contract_month: night?.selected_contract_month || null,
  };

  if (!dryRun) {
    atomicWriteJson(summaryFile, applied.summary);
    atomicWriteJson(groupSummaryFile, applied.groupSummary);
  }
  const replay = !dryRun && evaluateReplayIfPresent
    ? runReplayEvaluationIfPresent(target)
    : { evaluated: false, reason: dryRun ? 'dry_run' : 'not_requested' };
  return {
    date: target,
    skipped: false,
    readiness_score: finiteNumber(readiness?.score),
    night_futures_change_percent: finiteNumber(night?.change_percent),
    ...applied.result,
    replay,
    dry_run: dryRun,
  };
}

function parseArgs(argv) {
  const options = { date: '', dryRun: false, evaluateReplayIfPresent: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--evaluate-replay-if-present') options.evaluateReplayIfPresent = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = applyOfficialMarketConstraints(parseArgs(argv));
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  DISPOSITION_NOT_CONNECTED_WARNING,
  DISPOSITION_INCOMPLETE_WARNING,
  FORMAL_DISPOSITION_CRITERION,
  compactDate,
  isOversoldCandidate,
  cleanDispositionWarnings,
  normalizeCriteria,
  removeOversoldStrategy,
  updateCandidateMetadata,
  buildDispositionMetadata,
  applyConstraintsToPayloads,
  applyOfficialMarketConstraints,
  main,
};
