'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT } = require('./lib/daily_gainers_ai_contract');

const ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data_daily_gain_over_5');

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
    if (summary.source_lineage?.previous_raw?.available) {
      const expectedPath = `data_daily_gain_over_5/${previousDate}.json`;
      assert(summary.source_lineage.previous_raw.path === expectedPath, `previous_raw must use exact date path ${expectedPath}`);
    }
  }

  const rawCodes = new Set(rows.map((row) => String(row.code)));
  let themeStockCount = 0;
  for (const theme of summary.theme_summary?.theme_ranking || []) {
    finiteCount(theme.stock_count, `theme ${theme.theme_id} stock_count`, stockCount);
    finiteCount(theme.near_limit_up_count, `theme ${theme.theme_id} near_limit_up_count`, theme.stock_count);
    assert(Number.isFinite(Number(theme.share_pct)) && Number(theme.share_pct) >= 0 && Number(theme.share_pct) <= 100, `theme ${theme.theme_id} share_pct must be 0..100`);
    assert(['very_strong', 'strong', 'moderate', 'isolated'].includes(theme.strength), `theme ${theme.theme_id} has invalid strength`);
    for (const code of theme.representative_stocks || []) assert(rawCodes.has(String(code)), `theme ${theme.theme_id} references stock ${code} outside raw list`);
    themeStockCount += theme.stock_count;
  }
  finiteCount(summary.theme_summary?.themed_stock_count, 'themed_stock_count', stockCount);
  finiteCount(summary.theme_summary?.unclassified_stock_count, 'unclassified_stock_count', stockCount);
  assert(summary.theme_summary.themed_stock_count + summary.theme_summary.unclassified_stock_count === stockCount, 'themed + unclassified must equal stock_count');
  assert(themeStockCount === summary.theme_summary.themed_stock_count, 'theme ranking stock counts must equal themed_stock_count');
  for (const key of ['top_1_theme_share_pct', 'top_3_theme_share_pct']) {
    const value = Number(summary.theme_summary?.[key]);
    assert(Number.isFinite(value) && value >= 0 && value <= 100, `${key} must be 0..100`);
  }
  assert(contract.allowed_market_regimes.includes(summary.theme_summary?.market_structure), `invalid market_structure ${summary.theme_summary?.market_structure}`);

  const catalyst = summary.catalyst_coverage || {};
  for (const key of ['direct', 'corroborated', 'circumstantial', 'none', 'unavailable', 'public_catalyst_count']) finiteCount(catalyst[key], `catalyst ${key}`, stockCount);
  assert(catalyst.direct + catalyst.corroborated + catalyst.circumstantial + catalyst.none + catalyst.unavailable === stockCount, 'catalyst buckets must sum to stock_count');
  const catalystPct = Number(catalyst.public_catalyst_coverage_pct);
  assert(Number.isFinite(catalystPct) && catalystPct >= 0 && catalystPct <= 100, 'public_catalyst_coverage_pct must be 0..100');

  const funding = summary.funding_summary || {};
  assert(contract.coverage_statuses.includes(funding.coverage_status), `invalid funding coverage_status ${funding.coverage_status}`);
  for (const key of ['available_stock_count', 'institutional_support_count', 'institutional_opposition_count', 'margin_increase_count', 'margin_decrease_count']) finiteCount(funding[key], `funding ${key}`, stockCount);

  const coverage = summary.coverage || {};
  for (const key of ['overall', 'raw', 'previous_raw', 'facts', 'analysis', 'funding']) {
    assert(contract.coverage_statuses.includes(coverage[key]), `coverage.${key} has invalid status ${coverage[key]}`);
  }
  finiteCount(coverage.analyzed_stock_count, 'coverage.analyzed_stock_count', stockCount);
  assert(coverage.raw_stock_count === stockCount, 'coverage.raw_stock_count mismatch');
  if (summary.status === 'final') {
    assert(coverage.analysis === 'complete', 'final status requires complete analysis coverage');
    assert(coverage.analyzed_stock_count === stockCount, 'final status requires every raw stock analyzed');
    assert(summary.source_lineage?.analysis?.available === true, 'final status requires exact-date analysis source');
    assert(summary.source_lineage.analysis.path === `data_daily_gain_over_5/analysis/${date}.json`, 'final status analysis path must be exact target date');
  }
  assert(typeof summary.headline === 'string', 'headline must be a string');
  assert(typeof summary.market_summary === 'string', 'market_summary must be a string');
  assert(Array.isArray(summary.risk_signals), 'risk_signals must be an array');
  assert(Array.isArray(summary.next_day_watch), 'next_day_watch must be an array');
  return true;
}

function runSelfTest() {
  const raw = { target_date: '20260102', stocks: [{ code: '1', change_pct: 5.5 }, { code: '2', change_pct: 8 }, { code: '3', change_pct: 9.7 }] };
  const summary = {
    schema_version: DAILY_GAINERS_AI_CONTRACT.market_summary.schema_version,
    methodology_version: DAILY_GAINERS_AI_CONTRACT.market_summary.methodology_version,
    contract_version: DAILY_GAINERS_AI_CONTRACT.contract_version,
    target_date: '20260102', previous_date: '20251231', generated_at: new Date().toISOString(), status: 'preliminary',
    source_lineage: { previous_raw: { available: false }, analysis: { available: false } },
    coverage: { overall: 'partial', raw: 'complete', previous_raw: 'missing', facts: 'complete', analysis: 'missing', funding: 'missing', analyzed_stock_count: 0, raw_stock_count: 3 },
    breadth: { stock_count: 3, gain_5_to_7_count: 1, gain_7_to_9_5_count: 1, gain_9_5_plus_count: 1, previous_day_stock_count: null, stock_count_change: null },
    market_context: { regime: 'mixed', source: null },
    theme_summary: { taxonomy_version: 'daily-gainers-theme-taxonomy-v1', themed_stock_count: 0, unclassified_stock_count: 3, theme_ranking: [], top_1_theme_share_pct: 0, top_3_theme_share_pct: 0, market_structure: 'mixed' },
    catalyst_coverage: { direct: 0, corroborated: 0, circumstantial: 0, none: 0, unavailable: 3, public_catalyst_count: 0, public_catalyst_coverage_pct: 0, cause_type_counts: {} },
    funding_summary: { coverage_status: 'missing', available_stock_count: 0, institutional_support_count: 0, institutional_opposition_count: 0, margin_increase_count: 0, margin_decrease_count: 0 },
    risk_signals: [], headline: '', market_summary: '', next_day_watch: []
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
