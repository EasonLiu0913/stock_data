'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT_ROOT = path.join(ROOT, 'data_research', 'oversold-rebound');
const DEFAULT_OUTPUT_ROOT = path.join(ROOT, 'public', 'data', 'oversold-rebound-dashboard');
const DEFAULT_PRIMARY_LABEL = 'intraday_rebound_5d_10pct';

function parseArgs(argv) {
  const options = {
    inputRoot: DEFAULT_INPUT_ROOT,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    stocks: [],
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--input-root' || arg === '--output-root' || arg === '--stocks') {
      if (next === undefined) throw new Error(`${arg} 缺少值`);
      if (arg === '--input-root') options.inputRoot = path.resolve(next);
      else if (arg === '--output-root') options.outputRoot = path.resolve(next);
      else options.stocks = next.split(',').map(value => value.trim().toUpperCase()).filter(Boolean);
      index += 1;
    } else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知參數：${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`\n跌深反彈研究 Dashboard 公開資料產生器\n\n用法：\n  node scripts/generate_oversold_rebound_dashboard_data.js [options]\n\n選項：\n  --input-root PATH   研究資料根目錄\n  --output-root PATH  公開 Dashboard 資料輸出目錄\n  --stocks 2330,6443 只產生指定股票（僅供測試）\n  --dry-run           只計算摘要，不寫檔\n`);
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeOutcome(pattern) {
  const source = pattern?.primary_outcome || {};
  return {
    key: source.key || DEFAULT_PRIMARY_LABEL,
    label: source.label || '5 個交易日內盤中最大反彈至少 10%',
    total_events: finiteNumber(source.total_events) ?? 0,
    verified_events: finiteNumber(source.verified_events) ?? 0,
    successful_events: finiteNumber(source.successful_events) ?? 0,
    unsuccessful_events: finiteNumber(source.unsuccessful_events) ?? 0,
    unverified_events: finiteNumber(source.unverified_events) ?? 0,
    hit_rate: finiteNumber(source.hit_rate),
  };
}

function candidatePatterns(pattern) {
  if (Array.isArray(pattern?.candidate_patterns)) return pattern.candidate_patterns.slice(0, 12);
  return (Array.isArray(pattern?.feature_comparisons) ? pattern.feature_comparisons : [])
    .filter(item => item?.eligible_as_candidate_pattern)
    .sort((a, b) => Math.abs(finiteNumber(b?.standardized_mean_difference) || 0) - Math.abs(finiteNumber(a?.standardized_mean_difference) || 0))
    .slice(0, 12);
}

function normalizePatternItem(item) {
  return {
    feature_id: item?.feature_id || '',
    label: item?.label || item?.feature_id || '',
    group: item?.group || 'other',
    unit: item?.unit || '',
    direction: item?.direction || 'insufficient_data',
    exploratory_strength: item?.exploratory_strength || 'insufficient_data',
    coverage_pct: finiteNumber(item?.coverage_pct),
    standardized_mean_difference: finiteNumber(item?.standardized_mean_difference),
    mean_delta_success_minus_failure: finiteNumber(item?.mean_delta_success_minus_failure),
    median_delta_success_minus_failure: finiteNumber(item?.median_delta_success_minus_failure),
    success: item?.success || {},
    failure: item?.failure || {},
    eligible_as_candidate_pattern: Boolean(item?.eligible_as_candidate_pattern),
  };
}

function summarizeEvent(event, primaryLabel = DEFAULT_PRIMARY_LABEL) {
  const signal = event?.signal || {};
  const deepest = event?.deepest_signal || {};
  const outcome = event?.outcome_from_signal || {};
  const deepestOutcome = event?.outcome_from_deepest_signal || {};
  const label = outcome?.labels?.[primaryLabel];
  return {
    event_id: event?.event_id || '',
    signal_date: event?.signal_date || signal?.date || null,
    deepest_signal_date: event?.deepest_signal_date || deepest?.date || null,
    episode_end_date: event?.episode_end_date || null,
    observation_count: finiteNumber(event?.observation_count) ?? 0,
    trigger_ids: Array.isArray(event?.trigger_ids) ? event.trigger_ids : [],
    result: label === true ? 'success' : label === false ? 'failure' : 'unverified',
    signal: {
      close: finiteNumber(signal?.close),
      severity: finiteNumber(signal?.severity),
      return_3d: finiteNumber(signal?.price_volume?.return_3d),
      return_5d: finiteNumber(signal?.price_volume?.return_5d),
      return_10d: finiteNumber(signal?.price_volume?.return_10d),
      drawdown_20d: finiteNumber(signal?.price_volume?.drawdown_20d),
      drawdown_60d: finiteNumber(signal?.price_volume?.drawdown_60d),
      rsi14: finiteNumber(signal?.price_volume?.rsi14),
      gap_sma20: finiteNumber(signal?.price_volume?.gap_sma20),
      volume_ratio_5d: finiteNumber(signal?.price_volume?.volume_ratio_5d),
      volume_ratio_20d: finiteNumber(signal?.price_volume?.volume_ratio_20d),
    },
    deepest_signal: {
      close: finiteNumber(deepest?.close),
      severity: finiteNumber(deepest?.severity),
      return_5d: finiteNumber(deepest?.price_volume?.return_5d),
      drawdown_20d: finiteNumber(deepest?.price_volume?.drawdown_20d),
      rsi14: finiteNumber(deepest?.price_volume?.rsi14),
    },
    outcome_from_signal: {
      future_return_1d: finiteNumber(outcome?.future_return_1d),
      future_return_3d: finiteNumber(outcome?.future_return_3d),
      future_return_5d: finiteNumber(outcome?.future_return_5d),
      future_return_10d: finiteNumber(outcome?.future_return_10d),
      max_return_3d: finiteNumber(outcome?.max_return_3d),
      max_return_5d: finiteNumber(outcome?.max_return_5d),
      max_return_10d: finiteNumber(outcome?.max_return_10d),
      max_adverse_5d: finiteNumber(outcome?.max_adverse_5d),
      days_to_close_rebound_5pct: finiteNumber(outcome?.days_to_close_rebound_5pct),
      days_to_intraday_rebound_5pct: finiteNumber(outcome?.days_to_intraday_rebound_5pct),
      verified: label === true || label === false,
    },
    outcome_from_deepest_signal: {
      future_return_5d: finiteNumber(deepestOutcome?.future_return_5d),
      max_return_5d: finiteNumber(deepestOutcome?.max_return_5d),
      max_adverse_5d: finiteNumber(deepestOutcome?.max_adverse_5d),
    },
    feature_availability: {
      foreign: event?.features?.institutional?.foreign?.current_net_shares !== null && event?.features?.institutional?.foreign?.current_net_shares !== undefined,
      investment_trust: event?.features?.institutional?.investment_trust?.current_net_shares !== null && event?.features?.institutional?.investment_trust?.current_net_shares !== undefined,
      margin: event?.features?.margin && Object.values(event.features.margin).some(value => value !== null && value !== undefined),
      broker: event?.features?.broker && Object.values(event.features.broker).some(value => value !== null && value !== undefined),
    },
  };
}

function stockIndexItem(pattern) {
  const outcome = normalizeOutcome(pattern);
  const candidates = candidatePatterns(pattern);
  return {
    stock_code: String(pattern?.stock_code || ''),
    stock_name: pattern?.stock_name || '',
    security_type: pattern?.security?.security_type || 'unclassified',
    evidence_level: pattern?.evidence_level || 'insufficient',
    event_count: outcome.total_events,
    verified_events: outcome.verified_events,
    successful_events: outcome.successful_events,
    unsuccessful_events: outcome.unsuccessful_events,
    unverified_events: outcome.unverified_events,
    hit_rate: outcome.hit_rate,
    candidate_pattern_count: candidates.length,
    detail_file: `stocks/${String(pattern?.stock_code || '')}.json`,
  };
}

function buildStockDetail(pattern, eventsPayload, profile) {
  const primaryOutcome = normalizeOutcome(pattern);
  return {
    schema_version: 1,
    stock_code: String(pattern?.stock_code || eventsPayload?.stock_code || ''),
    stock_name: pattern?.stock_name || eventsPayload?.stock_name || '',
    security: pattern?.security || {},
    evidence_level: pattern?.evidence_level || 'insufficient',
    primary_outcome: primaryOutcome,
    candidate_patterns: candidatePatterns(pattern).map(normalizePatternItem),
    feature_comparisons: (Array.isArray(pattern?.feature_comparisons) ? pattern.feature_comparisons : []).map(normalizePatternItem),
    feature_coverage: profile?.feature_coverage || {},
    history: eventsPayload?.history || {},
    events: (Array.isArray(eventsPayload?.events) ? eventsPayload.events : []).map(event => summarizeEvent(event, primaryOutcome.key)),
    notes: [
      '成功／失敗比較只使用已走完對應觀察期的事件。',
      '候選規律是探索性差異，尚未經過樣本外驗證。',
    ],
  };
}

function buildDashboardData(options = {}) {
  const inputRoot = path.resolve(options.inputRoot || DEFAULT_INPUT_ROOT);
  const outputRoot = path.resolve(options.outputRoot || DEFAULT_OUTPUT_ROOT);
  const selected = new Set((options.stocks || []).map(value => String(value).toUpperCase()));
  const summary = readJson(path.join(inputRoot, 'summary.json'), {});
  const manifest = readJson(path.join(inputRoot, 'manifest.json'), {});
  const patternSummary = readJson(path.join(inputRoot, 'pattern-summary.json'), {});
  const patternDir = path.join(inputRoot, 'patterns');
  const patternFiles = fs.existsSync(patternDir)
    ? fs.readdirSync(patternDir).filter(file => file.endsWith('.json')).sort()
    : [];
  const stocks = [];
  const details = [];

  for (const file of patternFiles) {
    const code = path.basename(file, '.json').toUpperCase();
    if (selected.size && !selected.has(code)) continue;
    const pattern = readJson(path.join(patternDir, file), null);
    if (!pattern) continue;
    const eventsPayload = readJson(path.join(inputRoot, 'events', `${code}.json`), {});
    const profile = readJson(path.join(inputRoot, 'profiles', `${code}.json`), {});
    const detail = buildStockDetail(pattern, eventsPayload, profile);
    stocks.push(stockIndexItem(pattern));
    details.push(detail);
  }

  stocks.sort((a, b) => {
    const evidenceRank = { pattern_ready: 0, exploratory: 1, insufficient: 2 };
    const rank = (evidenceRank[a.evidence_level] ?? 9) - (evidenceRank[b.evidence_level] ?? 9);
    if (rank) return rank;
    const hitDiff = (b.hit_rate ?? -1) - (a.hit_rate ?? -1);
    if (hitDiff) return hitDiff;
    return a.stock_code.localeCompare(b.stock_code, 'zh-TW', { numeric: true });
  });

  const overview = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    research_id: 'historical_oversold_rebound_dashboard_v1',
    source_research_id: summary?.research_id || manifest?.research_id || null,
    date_range: manifest?.date_range || {
      actual_from: summary?.data_quality?.price?.first_date || null,
      actual_to: summary?.data_quality?.price?.last_date || null,
    },
    event_stock_count: finiteNumber(summary?.stock_count) ?? stocks.length,
    event_count: finiteNumber(summary?.event_count) ?? 0,
    analyzed_stock_count: finiteNumber(patternSummary?.analyzed_stock_count) ?? stocks.length,
    excluded_non_equity_count: finiteNumber(patternSummary?.excluded_non_equity_count) ?? 0,
    primary_outcome: summary?.primary_outcome || summary?.outcome_counts?.[DEFAULT_PRIMARY_LABEL] || {},
    outcome_counts: summary?.outcome_counts || {},
    evidence_level_counts: patternSummary?.evidence_level_counts || {},
    security_type_counts: patternSummary?.security_type_counts || {},
    feature_coverage: summary?.feature_coverage || {},
    recurring_candidate_patterns: Array.isArray(patternSummary?.recurring_candidate_patterns)
      ? patternSummary.recurring_candidate_patterns.slice(0, 30)
      : [],
    stocks,
  };

  if (!options.dryRun) {
    const tempRoot = `${outputRoot}.tmp-${process.pid}`;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    writeJson(path.join(tempRoot, 'overview.json'), overview);
    for (const detail of details) writeJson(path.join(tempRoot, 'stocks', `${detail.stock_code}.json`), detail);
    fs.rmSync(outputRoot, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
    fs.renameSync(tempRoot, outputRoot);
  }

  return {
    overview,
    detail_count: details.length,
    output_root: options.dryRun ? null : outputRoot,
    dry_run: Boolean(options.dryRun),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const result = buildDashboardData(options);
  console.log(JSON.stringify({
    research_id: result.overview.research_id,
    analyzed_stock_count: result.overview.analyzed_stock_count,
    published_stock_count: result.detail_count,
    event_count: result.overview.event_count,
    output_root: result.output_root,
    dry_run: result.dry_run,
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_INPUT_ROOT,
  DEFAULT_OUTPUT_ROOT,
  parseArgs,
  candidatePatterns,
  summarizeEvent,
  buildStockDetail,
  buildDashboardData,
};
