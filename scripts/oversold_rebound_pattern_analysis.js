'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  finiteNumber,
  round,
  average,
  median,
} = require('./oversold_rebound_research_lib');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_RESEARCH_ROOT = path.join(ROOT, 'data_research', 'oversold-rebound');
const DEFAULT_PRIMARY_LABEL = 'intraday_rebound_5d_10pct';

const FEATURE_SPECS = Object.freeze([
  { id: 'return_1d', group: 'price_volume', path: 'features.price_volume.return_1d', label: '事件日 1 日報酬', unit: 'pct' },
  { id: 'return_3d', group: 'price_volume', path: 'features.price_volume.return_3d', label: '事件日前 3 日報酬', unit: 'pct' },
  { id: 'return_5d', group: 'price_volume', path: 'features.price_volume.return_5d', label: '事件日前 5 日報酬', unit: 'pct' },
  { id: 'return_10d', group: 'price_volume', path: 'features.price_volume.return_10d', label: '事件日前 10 日報酬', unit: 'pct' },
  { id: 'drawdown_20d', group: 'price_volume', path: 'features.price_volume.drawdown_20d', label: '距近 20 日高點跌幅', unit: 'pct' },
  { id: 'drawdown_60d', group: 'price_volume', path: 'features.price_volume.drawdown_60d', label: '距近 60 日高點跌幅', unit: 'pct' },
  { id: 'rsi14', group: 'price_volume', path: 'features.price_volume.rsi14', label: 'RSI14', unit: 'index' },
  { id: 'gap_sma5', group: 'price_volume', path: 'features.price_volume.gap_sma5', label: '距 SMA5 乖離', unit: 'pct' },
  { id: 'gap_sma20', group: 'price_volume', path: 'features.price_volume.gap_sma20', label: '距 SMA20 乖離', unit: 'pct' },
  { id: 'gap_sma60', group: 'price_volume', path: 'features.price_volume.gap_sma60', label: '距 SMA60 乖離', unit: 'pct' },
  { id: 'volume_ratio_5d', group: 'price_volume', path: 'features.price_volume.volume_ratio_5d', label: '成交量／5 日均量', unit: 'ratio' },
  { id: 'volume_ratio_20d', group: 'price_volume', path: 'features.price_volume.volume_ratio_20d', label: '成交量／20 日均量', unit: 'ratio' },
  { id: 'intraday_return', group: 'price_volume', path: 'features.price_volume.intraday_return', label: '事件日開收盤報酬', unit: 'pct' },
  { id: 'intraday_range_pct', group: 'price_volume', path: 'features.price_volume.intraday_range_pct', label: '事件日振幅', unit: 'pct' },
  { id: 'consecutive_down_days', group: 'price_volume', path: 'features.price_volume.consecutive_down_days', label: '連續下跌日數', unit: 'days' },
  { id: 'volatility_20d', group: 'price_volume', path: 'features.price_volume.volatility_20d', label: '20 日已實現波動', unit: 'pct' },
  { id: 'foreign_current_net_to_volume_pct', group: 'institutional', path: 'features.institutional.foreign.current_net_to_volume_pct', label: '外資當日買賣超占成交量', unit: 'pct' },
  { id: 'foreign_net_3d_shares', group: 'institutional', path: 'features.institutional.foreign.net_3d_shares', label: '外資近 3 日累積買賣超', unit: 'shares' },
  { id: 'foreign_net_5d_shares', group: 'institutional', path: 'features.institutional.foreign.net_5d_shares', label: '外資近 5 日累積買賣超', unit: 'shares' },
  { id: 'foreign_turned_to_buy', group: 'institutional', path: 'features.institutional.foreign.turned_to_buy', label: '外資是否由賣轉買', unit: 'boolean' },
  { id: 'trust_current_net_to_volume_pct', group: 'institutional', path: 'features.institutional.investment_trust.current_net_to_volume_pct', label: '投信當日買賣超占成交量', unit: 'pct' },
  { id: 'trust_net_3d_shares', group: 'institutional', path: 'features.institutional.investment_trust.net_3d_shares', label: '投信近 3 日累積買賣超', unit: 'shares' },
  { id: 'trust_turned_to_buy', group: 'institutional', path: 'features.institutional.investment_trust.turned_to_buy', label: '投信是否由賣轉買', unit: 'boolean' },
  { id: 'margin_change', group: 'margin', path: 'features.margin.margin_change', label: '融資當日增減', unit: 'source_unit' },
  { id: 'margin_change_3d', group: 'margin', path: 'features.margin.margin_change_3d', label: '融資近 3 日累積增減', unit: 'source_unit' },
  { id: 'margin_change_5d', group: 'margin', path: 'features.margin.margin_change_5d', label: '融資近 5 日累積增減', unit: 'source_unit' },
  { id: 'short_change', group: 'margin', path: 'features.margin.short_change', label: '融券當日增減', unit: 'source_unit' },
  { id: 'short_change_3d', group: 'margin', path: 'features.margin.short_change_3d', label: '融券近 3 日累積增減', unit: 'source_unit' },
  { id: 'broker_total_net_lots', group: 'broker', path: 'features.broker.totals_net_lots', label: '券商分點合計淨買賣超', unit: 'lots' },
  { id: 'broker_top5_buy_net_lots', group: 'broker', path: 'features.broker.top5_buy_net_lots', label: '前 5 大買方淨買超', unit: 'lots' },
  { id: 'broker_top5_sell_net_lots', group: 'broker', path: 'features.broker.top5_sell_net_lots', label: '前 5 大賣方淨賣超', unit: 'lots' },
  { id: 'broker_top5_net_concentration_lots', group: 'broker', path: 'features.broker.top5_net_concentration_lots', label: '前 5 大分點淨集中差', unit: 'lots' },
]);

function parseArgs(argv) {
  const options = {
    inputRoot: DEFAULT_RESEARCH_ROOT,
    outputRoot: DEFAULT_RESEARCH_ROOT,
    primaryLabel: DEFAULT_PRIMARY_LABEL,
    stocks: [],
    includeNonEquity: false,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (['--input-root', '--output-root', '--primary-label', '--stocks'].includes(arg)) {
      if (next === undefined) throw new Error(`${arg} 缺少值`);
      if (arg === '--input-root') options.inputRoot = path.resolve(next);
      else if (arg === '--output-root') options.outputRoot = path.resolve(next);
      else if (arg === '--primary-label') options.primaryLabel = next.trim();
      else if (arg === '--stocks') options.stocks = next.split(',').map(value => value.trim().toUpperCase()).filter(Boolean);
      index += 1;
    } else if (arg === '--include-non-equity') options.includeNonEquity = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知參數：${arg}`);
  }
  return options;
}

function printHelp() {
  console.log(`
個股跌深反彈成功／失敗特徵比較

用法：
  node scripts/oversold_rebound_pattern_analysis.js [options]

選項：
  --input-root PATH        事件資料根目錄
  --output-root PATH       規律分析輸出根目錄
  --primary-label KEY      主要結果標籤，預設 ${DEFAULT_PRIMARY_LABEL}
  --stocks 2330,6443       僅分析指定代碼
  --include-non-equity     同時分析 ETF 等非一般股票；預設排除
  --dry-run                只計算摘要，不寫檔
`);
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function atomicWriteJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function classifySecurity(stockCode, listedStocks = {}) {
  const code = String(stockCode || '').trim().toUpperCase();
  if (listedStocks && Object.hasOwn(listedStocks, code)) {
    return { security_type: 'listed_equity', is_equity: true, classification_basis: 'twse_industry_stock' };
  }
  if (/^\d{4}$/.test(code) && !code.startsWith('00')) {
    return { security_type: 'stock_like_equity', is_equity: true, classification_basis: 'four_digit_non_etf_code' };
  }
  if (code.startsWith('00')) {
    return { security_type: 'fund_or_index_product', is_equity: false, classification_basis: '00_prefix' };
  }
  return { security_type: 'non_equity_or_unclassified', is_equity: false, classification_basis: 'code_shape' };
}

function getPath(object, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), object);
}

function numericFeatureValue(event, spec) {
  const value = getPath(event, spec.path);
  if (typeof value === 'boolean') return value ? 1 : 0;
  return finiteNumber(value);
}

function standardDeviation(values) {
  const numbers = values.map(finiteNumber).filter(Number.isFinite);
  if (numbers.length < 2) return null;
  const mean = average(numbers);
  return Math.sqrt(numbers.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (numbers.length - 1));
}

function groupStats(values) {
  const numbers = values.map(finiteNumber).filter(Number.isFinite);
  return {
    count: numbers.length,
    mean: round(average(numbers)),
    median: round(median(numbers)),
    standard_deviation: round(standardDeviation(numbers)),
    minimum: numbers.length ? round(Math.min(...numbers)) : null,
    maximum: numbers.length ? round(Math.max(...numbers)) : null,
  };
}

function standardizedMeanDifference(successValues, failureValues) {
  const success = successValues.map(finiteNumber).filter(Number.isFinite);
  const failure = failureValues.map(finiteNumber).filter(Number.isFinite);
  if (success.length < 2 || failure.length < 2) return null;
  const successSd = standardDeviation(success);
  const failureSd = standardDeviation(failure);
  if (!Number.isFinite(successSd) || !Number.isFinite(failureSd)) return null;
  const denominator = success.length + failure.length - 2;
  if (denominator <= 0) return null;
  const pooledVariance = (((success.length - 1) * (successSd ** 2)) + ((failure.length - 1) * (failureSd ** 2))) / denominator;
  if (!(pooledVariance > 0)) return null;
  return round((average(success) - average(failure)) / Math.sqrt(pooledVariance), 4);
}

function compareFeature(verifiedEvents, spec, primaryLabel) {
  const successEvents = verifiedEvents.filter(event => event?.outcome_from_signal?.labels?.[primaryLabel] === true);
  const failureEvents = verifiedEvents.filter(event => event?.outcome_from_signal?.labels?.[primaryLabel] === false);
  const successValues = successEvents.map(event => numericFeatureValue(event, spec)).filter(Number.isFinite);
  const failureValues = failureEvents.map(event => numericFeatureValue(event, spec)).filter(Number.isFinite);
  const success = groupStats(successValues);
  const failure = groupStats(failureValues);
  const covered = success.count + failure.count;
  const coveragePct = verifiedEvents.length ? round((covered / verifiedEvents.length) * 100, 2) : 0;
  const effect = standardizedMeanDifference(successValues, failureValues);
  const absoluteEffect = Number.isFinite(effect) ? Math.abs(effect) : null;
  const eligible = success.count >= 2 && failure.count >= 2 && coveragePct >= 50 && Number.isFinite(effect);
  return {
    feature_id: spec.id,
    group: spec.group,
    label: spec.label,
    unit: spec.unit,
    success,
    failure,
    coverage_pct: coveragePct,
    mean_delta_success_minus_failure: Number.isFinite(success.mean) && Number.isFinite(failure.mean) ? round(success.mean - failure.mean) : null,
    median_delta_success_minus_failure: Number.isFinite(success.median) && Number.isFinite(failure.median) ? round(success.median - failure.median) : null,
    standardized_mean_difference: effect,
    direction: Number.isFinite(effect) ? (effect > 0 ? 'success_higher' : effect < 0 ? 'success_lower' : 'similar') : 'insufficient_data',
    exploratory_strength: !Number.isFinite(absoluteEffect)
      ? 'insufficient_data'
      : absoluteEffect >= 0.8
        ? 'large_exploratory_difference'
        : absoluteEffect >= 0.5
          ? 'moderate_exploratory_difference'
          : absoluteEffect >= 0.2
            ? 'small_exploratory_difference'
            : 'negligible_difference',
    eligible_as_candidate_pattern: eligible,
  };
}

function patternEvidenceLevel(verified, hits, misses) {
  if (verified >= 10 && hits >= 3 && misses >= 3) return 'pattern_ready';
  if (verified >= 6 && hits >= 2 && misses >= 2) return 'exploratory';
  return 'insufficient';
}

function buildStockPattern(eventPayload, security, options = {}) {
  const primaryLabel = options.primaryLabel || DEFAULT_PRIMARY_LABEL;
  const allEvents = Array.isArray(eventPayload?.events) ? eventPayload.events : [];
  const verifiedEvents = allEvents.filter(event => {
    const value = event?.outcome_from_signal?.labels?.[primaryLabel];
    return value === true || value === false;
  });
  const hits = verifiedEvents.filter(event => event.outcome_from_signal.labels[primaryLabel] === true).length;
  const misses = verifiedEvents.length - hits;
  const comparisons = FEATURE_SPECS.map(spec => compareFeature(verifiedEvents, spec, primaryLabel));
  const candidates = comparisons
    .filter(item => item.eligible_as_candidate_pattern)
    .sort((left, right) => Math.abs(right.standardized_mean_difference) - Math.abs(left.standardized_mean_difference))
    .slice(0, 10);
  const evidenceLevel = patternEvidenceLevel(verifiedEvents.length, hits, misses);

  return {
    schema_version: 1,
    research_id: 'historical_oversold_rebound_pattern_analysis_v1',
    stock_code: eventPayload.stock_code,
    stock_name: eventPayload.stock_name,
    security,
    primary_outcome: {
      key: primaryLabel,
      label: '5 個交易日內盤中最大反彈至少 10%',
      total_events: allEvents.length,
      verified_events: verifiedEvents.length,
      successful_events: hits,
      unsuccessful_events: misses,
      unverified_events: allEvents.length - verifiedEvents.length,
      hit_rate: verifiedEvents.length ? round((hits / verifiedEvents.length) * 100, 2) : null,
    },
    evidence_level: evidenceLevel,
    feature_comparisons: comparisons,
    candidate_patterns: evidenceLevel === 'insufficient' ? [] : candidates,
    notes: [
      '候選規律只比較同一股票的歷史成功與失敗事件，不代表因果關係。',
      '標準化差異僅作探索排序；樣本外驗證前不得直接轉成選股分數。',
      '每個特徵至少需要成功與失敗各 2 筆，且覆蓋率至少 50%，才列入候選規律。',
    ],
  };
}

function aggregateCandidatePatterns(stockPatterns) {
  const counts = new Map();
  for (const pattern of stockPatterns.filter(item => item.evidence_level !== 'insufficient')) {
    for (const candidate of pattern.candidate_patterns.slice(0, 3)) {
      const key = `${candidate.feature_id}:${candidate.direction}`;
      const current = counts.get(key) || {
        feature_id: candidate.feature_id,
        label: candidate.label,
        group: candidate.group,
        direction: candidate.direction,
        stock_count: 0,
        stock_codes: [],
      };
      current.stock_count += 1;
      if (current.stock_codes.length < 30) current.stock_codes.push(pattern.stock_code);
      counts.set(key, current);
    }
  }
  return [...counts.values()].sort((left, right) => right.stock_count - left.stock_count || left.feature_id.localeCompare(right.feature_id));
}

function loadEventPayloads(inputRoot, stocks = []) {
  const directory = path.join(inputRoot, 'events');
  if (!fs.existsSync(directory)) throw new Error(`找不到事件資料目錄：${directory}`);
  const requested = new Set(stocks);
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => path.join(directory, entry.name))
    .map(file => readJson(file, null))
    .filter(payload => payload && (!requested.size || requested.has(String(payload.stock_code).toUpperCase())))
    .sort((left, right) => String(left.stock_code).localeCompare(String(right.stock_code), 'en', { numeric: true }));
}

function analyzePatterns(options) {
  const listedStocks = readJson(path.join(ROOT, 'data_twse', 'twse_industry_Stock.json'), {});
  const payloads = loadEventPayloads(options.inputRoot, options.stocks);
  const universe = payloads.map(payload => ({
    stock_code: payload.stock_code,
    stock_name: payload.stock_name,
    event_count: payload.event_count,
    ...classifySecurity(payload.stock_code, listedStocks),
  }));
  const selected = payloads.filter(payload => {
    const security = classifySecurity(payload.stock_code, listedStocks);
    return options.includeNonEquity || security.is_equity;
  });
  const patterns = selected.map(payload => buildStockPattern(payload, classifySecurity(payload.stock_code, listedStocks), options));
  const securityTypeCounts = universe.reduce((result, item) => {
    result[item.security_type] = (result[item.security_type] || 0) + 1;
    return result;
  }, {});
  const evidenceCounts = patterns.reduce((result, item) => {
    result[item.evidence_level] = (result[item.evidence_level] || 0) + 1;
    return result;
  }, {});
  const summary = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    research_id: 'historical_oversold_rebound_pattern_analysis_v1',
    primary_outcome: options.primaryLabel,
    source_event_stock_count: payloads.length,
    analyzed_stock_count: patterns.length,
    excluded_non_equity_count: payloads.length - patterns.length,
    security_type_counts: securityTypeCounts,
    evidence_level_counts: evidenceCounts,
    recurring_candidate_patterns: aggregateCandidatePatterns(patterns),
    feature_specs: FEATURE_SPECS,
    notes: [
      '預設只分析一般股票；ETF、主動式 ETF 與其他非股票商品仍保留在原始事件庫。',
      '四位數且非 00 開頭、但不在 TWSE 上市股票清單者，暫列 stock_like_equity，主要涵蓋上櫃與興櫃股票。',
      '跨股票重複出現的候選特徵只是研究線索，不代表所有股票共享同一規律。',
    ],
  };
  return { universe, patterns, summary };
}

function writePatternAnalysis(outputRoot, result) {
  const patternsDirectory = path.join(outputRoot, 'patterns');
  fs.rmSync(patternsDirectory, { recursive: true, force: true });
  for (const pattern of result.patterns) atomicWriteJson(path.join(patternsDirectory, `${pattern.stock_code}.json`), pattern);
  atomicWriteJson(path.join(outputRoot, 'pattern-summary.json'), result.summary);
  atomicWriteJson(path.join(outputRoot, 'security-universe.json'), {
    schema_version: 1,
    generated_at: result.summary.generated_at,
    security_count: result.universe.length,
    securities: result.universe,
  });
}

function execute(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return null;
  }
  const result = analyzePatterns(options);
  if (!options.dryRun) writePatternAnalysis(options.outputRoot, result);
  const report = {
    research_id: result.summary.research_id,
    source_event_stock_count: result.summary.source_event_stock_count,
    analyzed_stock_count: result.summary.analyzed_stock_count,
    excluded_non_equity_count: result.summary.excluded_non_equity_count,
    security_type_counts: result.summary.security_type_counts,
    evidence_level_counts: result.summary.evidence_level_counts,
    recurring_candidate_patterns: result.summary.recurring_candidate_patterns.slice(0, 10),
    output_root: options.dryRun ? null : path.relative(ROOT, options.outputRoot).replaceAll(path.sep, '/'),
    dry_run: options.dryRun,
  };
  console.log(JSON.stringify(report, null, 2));
  return { options, result, report };
}

if (require.main === module) {
  try {
    execute();
  } catch (error) {
    console.error(`[oversold-rebound-pattern-analysis] ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  DEFAULT_RESEARCH_ROOT,
  DEFAULT_PRIMARY_LABEL,
  FEATURE_SPECS,
  parseArgs,
  classifySecurity,
  getPath,
  numericFeatureValue,
  groupStats,
  standardizedMeanDifference,
  compareFeature,
  patternEvidenceLevel,
  buildStockPattern,
  aggregateCandidatePatterns,
  loadEventPayloads,
  analyzePatterns,
  writePatternAnalysis,
  execute,
};
