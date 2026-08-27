'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT, isLatestPublished } = require('./lib/daily_gainers_ai_contract');

const ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data_daily_gain_over_5');
const TAXONOMY_PATH = path.join(ROOT, DAILY_GAINERS_AI_CONTRACT.market_summary.theme_taxonomy_path);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid daily gainers market summary: ${message}`);
}

function finiteCount(value, label, max) {
  assert(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`);
  if (Number.isFinite(max)) assert(value <= max, `${label} cannot exceed stock_count`);
}

function percent(value, label) {
  const number = Number(value);
  assert(Number.isFinite(number) && number >= 0 && number <= 100, `${label} must be 0..100`);
}

function validateSummary(summary, raw, date) {
  const contract = DAILY_GAINERS_AI_CONTRACT.market_summary;
  assert(summary && typeof summary === 'object', 'payload must be an object');
  assert(summary.schema_version === contract.schema_version, `schema_version must be ${contract.schema_version}`);
  assert(summary.methodology_version === contract.methodology_version, `methodology_version must be ${contract.methodology_version}`);
  assert(summary.contract_version === DAILY_GAINERS_AI_CONTRACT.contract_version, 'contract_version mismatch');
  assert(summary.target_date === date, `target_date ${summary.target_date} must equal ${date}`);
  assert(raw.target_date === date, `raw target_date ${raw.target_date} must equal ${date}`);
  assert(contract.allowed_statuses.includes(summary.status), `unsupported status ${summary.status}`);
  for (const field of contract.required_fields) assert(Object.prototype.hasOwnProperty.call(summary, field), `missing required field ${field}`);

  const rows = Array.isArray(raw.stocks) ? raw.stocks : [];
  const stockCount = rows.length;
  if (Number.isInteger(raw.stock_count)) assert(raw.stock_count === stockCount, `raw stock_count ${raw.stock_count} != rows ${stockCount}`);
  const rawCodes = rows.map((row) => String(row.code));
  assert(new Set(rawCodes).size === rawCodes.length, 'raw stock codes must be unique');
  for (const row of rows) {
    const change = Number(row.change_pct);
    assert(Number.isFinite(change) && change >= 5, `raw stock ${row.code} must have finite change_pct >= 5`);
  }

  const breadth = summary.breadth || {};
  assert(breadth.stock_count === stockCount, `breadth.stock_count ${breadth.stock_count} != raw stock count ${stockCount}`);
  finiteCount(breadth.gain_5_to_7_count, 'gain_5_to_7_count', stockCount);
  finiteCount(breadth.gain_7_to_9_5_count, 'gain_7_to_9_5_count', stockCount);
  finiteCount(breadth.gain_9_5_plus_count, 'gain_9_5_plus_count', stockCount);
  assert(breadth.gain_5_to_7_count + breadth.gain_7_to_9_5_count + breadth.gain_9_5_plus_count === stockCount, 'gain buckets must sum to stock_count');
  if (breadth.previous_day_stock_count != null) finiteCount(breadth.previous_day_stock_count, 'previous_day_stock_count');
  if (breadth.stock_count_change != null) assert(Number.isInteger(breadth.stock_count_change), 'stock_count_change must be an integer or null');

  const previousDate = summary.previous_date;
  if (previousDate != null) {
    assert(/^\d{8}$/.test(previousDate), 'previous_date must be YYYYMMDD or null');
    assert(previousDate < date, `previous_date ${previousDate} must be before target_date ${date}`);
    assert(previousDate === String(raw.previous_date || ''), `previous_date ${previousDate} must equal raw.previous_date ${raw.previous_date}`);
    const expectedPath = `data_daily_gain_over_5/${previousDate}.json`;
    assert(summary.source_lineage?.previous_raw?.path === expectedPath, `previous_raw must use exact date path ${expectedPath}`);
    const previousFile = path.join(DATA_ROOT, `${previousDate}.json`);
    if (summary.source_lineage.previous_raw.available) {
      assert(fs.existsSync(previousFile), `previous_raw marked available but ${expectedPath} is missing`);
      const previousRaw = readJson(previousFile);
      assert(String(previousRaw.target_date) === previousDate, 'previous raw target_date mismatch');
      assert(Array.isArray(previousRaw.stocks), 'previous raw stocks must be an array');
      assert(breadth.previous_day_stock_count === previousRaw.stocks.length, 'previous_day_stock_count mismatch');
      assert(breadth.stock_count_change === stockCount - previousRaw.stocks.length, 'stock_count_change mismatch');
    } else {
      assert(breadth.previous_day_stock_count === null && breadth.stock_count_change === null, 'missing previous_raw requires null comparison counts');
    }
  }

  const taxonomy = readJson(TAXONOMY_PATH);
  const allowedThemeIds = new Set((taxonomy.themes || []).map((theme) => theme.id));
  const seenThemes = new Set();
  let themeStockCount = 0;
  for (const theme of summary.theme_summary?.theme_ranking || []) {
    assert(allowedThemeIds.has(theme.theme_id), `theme ${theme.theme_id} is not in canonical taxonomy`);
    assert(!seenThemes.has(theme.theme_id), `duplicate theme ${theme.theme_id}`);
    seenThemes.add(theme.theme_id);
    finiteCount(theme.stock_count, `theme ${theme.theme_id} stock_count`, stockCount);
    finiteCount(theme.near_limit_up_count, `theme ${theme.theme_id} near_limit_up_count`, theme.stock_count);
    percent(theme.share_pct, `theme ${theme.theme_id} share_pct`);
    assert(['very_strong', 'strong', 'moderate', 'isolated'].includes(theme.strength), `theme ${theme.theme_id} has invalid strength`);
    for (const code of theme.representative_stocks || []) assert(rawCodes.includes(String(code)), `theme ${theme.theme_id} references stock ${code} outside raw list`);
    themeStockCount += theme.stock_count;
  }
  finiteCount(summary.theme_summary?.themed_stock_count, 'themed_stock_count', stockCount);
  finiteCount(summary.theme_summary?.unclassified_stock_count, 'unclassified_stock_count', stockCount);
  assert(summary.theme_summary.themed_stock_count + summary.theme_summary.unclassified_stock_count === stockCount, 'themed + unclassified must equal stock_count');
  assert(themeStockCount === summary.theme_summary.themed_stock_count, 'theme ranking stock counts must equal themed_stock_count');
  percent(summary.theme_summary?.theme_coverage_pct, 'theme_coverage_pct');
  percent(summary.theme_summary?.top_1_theme_share_pct, 'top_1_theme_share_pct');
  percent(summary.theme_summary?.top_3_theme_share_pct, 'top_3_theme_share_pct');
  assert(contract.allowed_market_regimes.includes(summary.theme_summary?.market_structure), `invalid market_structure ${summary.theme_summary?.market_structure}`);
  assert(summary.market_context?.regime === summary.theme_summary?.market_structure, 'market_context.regime must match theme_summary.market_structure');

  const catalyst = summary.catalyst_coverage || {};
  for (const key of ['direct', 'corroborated', 'circumstantial', 'none', 'unavailable', 'public_catalyst_count']) finiteCount(catalyst[key], `catalyst ${key}`, stockCount);
  assert(catalyst.direct + catalyst.corroborated + catalyst.circumstantial + catalyst.none + catalyst.unavailable === stockCount, 'catalyst buckets must sum to stock_count');
  assert(catalyst.public_catalyst_count === catalyst.direct + catalyst.corroborated, 'public_catalyst_count must equal direct + corroborated');
  percent(catalyst.public_catalyst_coverage_pct, 'public_catalyst_coverage_pct');
  const causeTotal = Object.entries(catalyst.cause_type_counts || {}).reduce((sum, [cause, count]) => {
    assert(DAILY_GAINERS_AI_CONTRACT.cause_types.includes(cause), `unknown cause_type ${cause}`);
    finiteCount(count, `cause_type ${cause}`, stockCount);
    return sum + count;
  }, 0);
  assert(causeTotal === stockCount - catalyst.unavailable, 'cause_type_counts must cover analyzed stocks exactly');

  const funding = summary.funding_summary || {};
  assert(contract.coverage_statuses.includes(funding.coverage_status), `invalid funding coverage_status ${funding.coverage_status}`);
  for (const key of ['available_stock_count', 'institutional_available_stock_count', 'margin_available_stock_count', 'institutional_support_count', 'institutional_opposition_count', 'margin_increase_count', 'margin_decrease_count']) finiteCount(funding[key], `funding ${key}`, stockCount);
  assert(funding.institutional_support_count + funding.institutional_opposition_count <= funding.institutional_available_stock_count, 'institutional direction counts exceed available coverage');
  assert(funding.margin_increase_count + funding.margin_decrease_count <= funding.margin_available_stock_count, 'margin direction counts exceed available coverage');
  if (funding.coverage_status === 'missing') assert(funding.available_stock_count === 0, 'missing funding coverage requires available_stock_count=0');
  if (funding.coverage_status === 'complete') assert(funding.available_stock_count === stockCount && stockCount > 0, 'complete funding coverage requires every stock available');

  const coverage = summary.coverage || {};
  for (const key of ['overall', 'raw', 'previous_raw', 'facts', 'analysis', 'funding']) assert(contract.coverage_statuses.includes(coverage[key]), `coverage.${key} has invalid status ${coverage[key]}`);
  assert(coverage.raw === 'complete', 'raw coverage must be complete');
  assert(coverage.funding === funding.coverage_status, 'coverage.funding must match funding_summary.coverage_status');
  finiteCount(coverage.analyzed_stock_count, 'coverage.analyzed_stock_count', stockCount);
  assert(coverage.raw_stock_count === stockCount, 'coverage.raw_stock_count mismatch');

  assert(summary.source_lineage?.raw?.path === `data_daily_gain_over_5/${date}.json`, 'raw lineage path must be exact target date');
  assert(summary.source_lineage?.raw?.available === true, 'raw lineage must be available');
  assert(summary.source_lineage?.analysis?.path === `data_daily_gain_over_5/analysis/${date}.json`, 'analysis lineage path must be exact target date');
  assert(summary.source_lineage?.facts?.path === `data_daily_gain_over_5/analysis-facts/${date}.json`, 'facts lineage path must be exact target date');

  if (summary.status === 'final') {
    assert(coverage.analysis === 'complete', 'final status requires complete analysis coverage');
    assert(coverage.analyzed_stock_count === stockCount, 'final status requires every raw stock analyzed');
    assert(summary.source_lineage.analysis.available === true, 'final status requires exact-date analysis source');
    const analysisPath = path.join(DATA_ROOT, 'analysis', `${date}.json`);
    assert(fs.existsSync(analysisPath), 'final status analysis file is missing');
    const analysis = readJson(analysisPath);
    assert(isLatestPublished(analysis), 'final status requires latest published methodology');
    assert(String(analysis.target_date) === date, 'final analysis target_date mismatch');
    const analysisCodes = (analysis.analyses || []).map((item) => String(item.code));
    assert(JSON.stringify(analysisCodes) === JSON.stringify(rawCodes), 'final analysis must cover raw stocks exactly once and in the same order');
  }

  assert(typeof summary.headline === 'string' && summary.headline.trim().length > 0, 'headline must be non-empty');
  assert(typeof summary.market_summary === 'string' && summary.market_summary.trim().length > 0, 'market_summary must be non-empty');
  assert(Array.isArray(summary.risk_signals), 'risk_signals must be an array');
  assert(Array.isArray(summary.next_day_watch) && summary.next_day_watch.length > 0, 'next_day_watch must be a non-empty array');
  return true;
}

function runSelfTest() {
  const raw = { target_date: '20260102', previous_date: '20251231', stocks: [{ code: '1', change_pct: 5.5 }, { code: '2', change_pct: 8 }, { code: '3', change_pct: 9.7 }] };
  const summary = {
    schema_version: DAILY_GAINERS_AI_CONTRACT.market_summary.schema_version,
    methodology_version: DAILY_GAINERS_AI_CONTRACT.market_summary.methodology_version,
    contract_version: DAILY_GAINERS_AI_CONTRACT.contract_version,
    target_date: '20260102', previous_date: '20251231', generated_at: new Date().toISOString(), status: 'preliminary',
    source_lineage: { raw: { path: 'data_daily_gain_over_5/20260102.json', available: true }, previous_raw: { path: 'data_daily_gain_over_5/20251231.json', available: false }, facts: { path: 'data_daily_gain_over_5/analysis-facts/20260102.json', available: false }, analysis: { path: 'data_daily_gain_over_5/analysis/20260102.json', available: false } },
    coverage: { overall: 'missing', raw: 'complete', previous_raw: 'missing', facts: 'missing', analysis: 'missing', funding: 'missing', analyzed_stock_count: 0, raw_stock_count: 3 },
    breadth: { stock_count: 3, gain_5_to_7_count: 1, gain_7_to_9_5_count: 1, gain_9_5_plus_count: 1, previous_day_stock_count: null, stock_count_change: null },
    market_context: { regime: 'mixed', source: null },
    theme_summary: { taxonomy_version: 'daily-gainers-theme-taxonomy-v1', themed_stock_count: 0, unclassified_stock_count: 3, theme_coverage_pct: 0, theme_ranking: [], top_1_theme_share_pct: 0, top_3_theme_share_pct: 0, market_structure: 'mixed' },
    catalyst_coverage: { direct: 0, corroborated: 0, circumstantial: 0, none: 0, unavailable: 3, public_catalyst_count: 0, public_catalyst_coverage_pct: 0, cause_type_counts: {} },
    funding_summary: { coverage_status: 'missing', available_stock_count: 0, institutional_available_stock_count: 0, margin_available_stock_count: 0, institutional_support_count: 0, institutional_opposition_count: 0, margin_increase_count: 0, margin_decrease_count: 0 },
    risk_signals: [], headline: '測試市場摘要', market_summary: '測試市場摘要內容', next_day_watch: ['測試觀察']
  };
  validateSummary(summary, raw, '20260102');
  console.log('validate_daily_gainers_market_summary self-test passed');
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--self-test') return runSelfTest();
  const dateIndex = args.indexOf('--date');
  const date = dateIndex >= 0 ? args[dateIndex + 1] : '';
  assert(/^\d{8}$/.test(date), '--date must be YYYYMMDD');
  const rawPath = path.join(DATA_ROOT, `${date}.json`);
  const summaryPath = path.join(DATA_ROOT, 'market-summary', `${date}.json`);
  assert(fs.existsSync(rawPath), `missing raw file ${path.relative(ROOT, rawPath)}`);
  assert(fs.existsSync(summaryPath), `missing summary file ${path.relative(ROOT, summaryPath)}`);
  validateSummary(readJson(summaryPath), readJson(rawPath), date);
  console.log(`Validated daily gainers market summary: ${date}`);
}

if (require.main === module) main();

module.exports = { validateSummary };
