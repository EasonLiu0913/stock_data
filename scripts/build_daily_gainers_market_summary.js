'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DAILY_GAINERS_AI_CONTRACT, isLatestPublished } = require('./lib/daily_gainers_ai_contract');

const ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data_daily_gain_over_5');
const SUMMARY_ROOT = path.join(DATA_ROOT, 'market-summary');
const TAXONOMY_PATH = path.join(ROOT, 'config', 'daily-gainers-theme-taxonomy.json');

function parseArgs(argv) {
  const args = { date: '', previousDate: '', force: false, selfTest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--date') args.date = argv[++i] || '';
    else if (value === '--previous-date') args.previousDate = argv[++i] || '';
    else if (value === '--force') args.force = true;
    else if (value === '--self-test') args.selfTest = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function readJson(filePath, optional = false) {
  if (!filePath || !fs.existsSync(filePath)) {
    if (optional) return null;
    throw new Error(`Missing required file: ${filePath ? path.relative(ROOT, filePath) : '(empty path)'}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function rel(filePath) {
  return filePath ? path.relative(ROOT, filePath).split(path.sep).join('/') : null;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pct(count, total) {
  return total > 0 ? round((count / total) * 100, 1) : 0;
}

function stockCode(value) {
  return String(value ?? '').trim();
}

function finiteNullable(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function loadTaxonomy() {
  const taxonomy = readJson(TAXONOMY_PATH);
  const aliasToId = new Map();
  const labels = new Map();
  for (const theme of taxonomy.themes || []) {
    labels.set(theme.id, theme.label);
    aliasToId.set(String(theme.id).toLowerCase(), theme.id);
    for (const alias of theme.aliases || []) aliasToId.set(String(alias).toLowerCase(), theme.id);
  }
  const fallbackId = taxonomy.fallback_theme?.id || 'other';
  labels.set(fallbackId, taxonomy.fallback_theme?.label || '其他 / 未分類');
  return { taxonomy, aliasToId, labels, fallbackId };
}

function normalizedThemes(analysis, aliasToId) {
  const explicit = [];
  if (typeof analysis?.primary_theme === 'string') explicit.push(analysis.primary_theme);
  if (Array.isArray(analysis?.theme_tags)) explicit.push(...analysis.theme_tags);
  if (Array.isArray(analysis?.cause_tags)) explicit.push(...analysis.cause_tags);
  const result = [];
  for (const item of explicit) {
    const id = aliasToId.get(String(item).trim().toLowerCase());
    if (id && !result.includes(id)) result.push(id);
  }
  return result;
}

function buildThemeSummary(rows, analyses, taxonomy) {
  const byCode = new Map((analyses || []).map((item) => [stockCode(item.code), item]));
  const buckets = new Map();
  let themedStockCount = 0;
  for (const row of rows) {
    const code = stockCode(row.code);
    const primary = normalizedThemes(byCode.get(code), taxonomy.aliasToId)[0];
    if (!primary) continue;
    themedStockCount += 1;
    if (!buckets.has(primary)) buckets.set(primary, []);
    buckets.get(primary).push(row);
  }
  const ranking = [...buckets.entries()].map(([themeId, members]) => {
    const gains = members.map((row) => finiteNullable(row.change_pct)).filter((v) => v !== null);
    const nearLimit = members.filter((row) => (finiteNullable(row.change_pct) ?? -Infinity) >= 9.5).length;
    const averageGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null;
    const count = members.length;
    return {
      theme_id: themeId,
      label: taxonomy.labels.get(themeId) || themeId,
      stock_count: count,
      share_pct: pct(count, rows.length),
      near_limit_up_count: nearLimit,
      average_gain_pct: round(averageGain, 2),
      strength: count >= 5 ? 'very_strong' : count >= 3 ? 'strong' : count === 2 ? 'moderate' : 'isolated',
      representative_stocks: members.slice().sort((a, b) => (finiteNullable(b.change_pct) ?? -Infinity) - (finiteNullable(a.change_pct) ?? -Infinity)).slice(0, 5).map((row) => stockCode(row.code)),
    };
  }).sort((a, b) => b.stock_count - a.stock_count || (b.average_gain_pct || 0) - (a.average_gain_pct || 0));
  const top1 = ranking[0]?.stock_count || 0;
  const top3 = ranking.slice(0, 3).reduce((sum, item) => sum + item.stock_count, 0);
  return {
    taxonomy_version: taxonomy.taxonomy.methodology_version,
    themed_stock_count: themedStockCount,
    unclassified_stock_count: rows.length - themedStockCount,
    theme_coverage_pct: pct(themedStockCount, rows.length),
    theme_ranking: ranking,
    top_1_theme_share_pct: pct(top1, rows.length),
    top_3_theme_share_pct: pct(top3, rows.length),
  };
}

function buildCatalystCoverage(analyses, total) {
  const counts = { direct: 0, corroborated: 0, circumstantial: 0, none: 0, unavailable: 0 };
  const causeTypes = {};
  for (const item of analyses || []) {
    const strength = Object.prototype.hasOwnProperty.call(counts, item.evidence_strength) ? item.evidence_strength : 'unavailable';
    counts[strength] += 1;
    const cause = item.cause_type || 'unknown';
    causeTypes[cause] = (causeTypes[cause] || 0) + 1;
  }
  counts.unavailable += Math.max(0, total - (analyses || []).length);
  const publicCatalystCount = counts.direct + counts.corroborated;
  return { ...counts, public_catalyst_count: publicCatalystCount, public_catalyst_coverage_pct: pct(publicCatalystCount, total), cause_type_counts: causeTypes };
}

function buildFundingSummary(analyses, total) {
  let institutionalSupport = 0;
  let institutionalOpposition = 0;
  let marginIncrease = 0;
  let marginDecrease = 0;
  let availableFlowStocks = 0;
  let institutionalAvailableStocks = 0;
  let marginAvailableStocks = 0;
  for (const item of analyses || []) {
    const flow = item.flow || {};
    const nets = ['foreign', 'investment_trust', 'dealer'].map((key) => finiteNullable(flow[key]?.net_lots)).filter((value) => value !== null);
    const marginDelta = finiteNullable(flow.margin?.margin_delta);
    if (nets.length) institutionalAvailableStocks += 1;
    if (marginDelta !== null) marginAvailableStocks += 1;
    if (nets.length || marginDelta !== null) availableFlowStocks += 1;
    const institutionalNet = nets.reduce((sum, value) => sum + value, 0);
    if (nets.length && institutionalNet > 0) institutionalSupport += 1;
    if (nets.length && institutionalNet < 0) institutionalOpposition += 1;
    if (marginDelta !== null && marginDelta > 0) marginIncrease += 1;
    if (marginDelta !== null && marginDelta < 0) marginDecrease += 1;
  }
  return {
    coverage_status: availableFlowStocks === total && total > 0 ? 'complete' : availableFlowStocks > 0 ? 'partial' : 'missing',
    available_stock_count: availableFlowStocks,
    institutional_available_stock_count: institutionalAvailableStocks,
    margin_available_stock_count: marginAvailableStocks,
    institutional_support_count: institutionalSupport,
    institutional_opposition_count: institutionalOpposition,
    margin_increase_count: marginIncrease,
    margin_decrease_count: marginDecrease,
  };
}

function chooseRegime(raw, analysis, themeSummary) {
  const allowed = DAILY_GAINERS_AI_CONTRACT.market_summary.allowed_market_regimes;
  const existing = analysis?.market_context?.breadth_regime;
  if (allowed.includes(existing)) return existing;
  const count = (raw.stocks || []).length;
  if (!count) return 'unknown';
  if (count >= 40 && themeSummary.top_3_theme_share_pct < 45) return 'broad_risk_on';
  if (themeSummary.top_3_theme_share_pct >= 45 && themeSummary.theme_ranking.length >= 2) return 'theme_rotation';
  if (count >= 25) return 'mixed';
  return 'risk_off_with_pockets';
}

function buildNarrative(raw, themeSummary, catalyst, funding) {
  const total = raw.stock_count ?? (raw.stocks || []).length;
  const top = themeSummary.theme_ranking.slice(0, 3);
  const topText = top.length ? top.map((item) => `${item.label} ${item.stock_count} 檔`).join('、') : '題材結構仍待補足';
  const headline = top.length ? `${total} 檔強勢股，${top[0].label}為主要聚焦題材` : `${total} 檔強勢股，題材分類仍待補足`;
  const fundingText = funding.coverage_status === 'missing' ? '籌碼資料目前不足，未將缺值視為 0。' : `已有 ${funding.available_stock_count}/${total} 檔可判讀籌碼，法人偏多 ${funding.institutional_support_count} 檔。`;
  const marketSummary = `本日共有 ${total} 檔股票漲幅達 5% 以上；${topText}。公開直接或交叉佐證催化覆蓋 ${catalyst.public_catalyst_coverage_pct}%。${fundingText}`;
  const nextDayWatch = [];
  if (top[0]) nextDayWatch.push(`觀察 ${top[0].label} 是否續量並維持族群擴散。`);
  if (catalyst.none + catalyst.circumstantial > catalyst.public_catalyst_count) nextDayWatch.push('弱證據個股占比較高，留意隔日動能退潮。');
  if (funding.coverage_status !== 'complete') nextDayWatch.push('待籌碼資料完整後，再確認法人與融資是否支持本日強勢結構。');
  if (!nextDayWatch.length) nextDayWatch.push('觀察強勢股廣度、成交量與法人籌碼是否延續。');
  return { headline, marketSummary, nextDayWatch };
}

function sourceDescriptor(filePath, extra = {}) {
  return { path: rel(filePath), available: Boolean(filePath && fs.existsSync(filePath)), sha256: sha256File(filePath), ...extra };
}

function buildSummary(date, previousDateOverride = '') {
  if (!/^\d{8}$/.test(date)) throw new Error('--date must be YYYYMMDD');
  const rawPath = path.join(DATA_ROOT, `${date}.json`);
  const factsPath = path.join(DATA_ROOT, 'analysis-facts', `${date}.json`);
  const analysisPath = path.join(DATA_ROOT, 'analysis', `${date}.json`);
  const raw = readJson(rawPath);
  if (String(raw.target_date) !== date) throw new Error(`Raw target_date mismatch: ${raw.target_date} != ${date}`);
  const rows = Array.isArray(raw.stocks) ? raw.stocks : [];
  if (Number.isInteger(raw.stock_count) && raw.stock_count !== rows.length) throw new Error(`Raw stock_count mismatch: ${raw.stock_count} != ${rows.length}`);

  const analysis = readJson(analysisPath, true);
  const facts = readJson(factsPath, true);
  const latestAnalysis = isLatestPublished(analysis) && String(analysis?.target_date) === date;
  // Latest-rules-only: an old analysis file may exist for a historical date, but
  // its schema must never feed current market-summary semantics.
  const analyses = latestAnalysis && Array.isArray(analysis?.analyses) ? analysis.analyses : [];

  const previousDate = previousDateOverride || String(raw.previous_date || '');
  if (previousDate && !/^\d{8}$/.test(previousDate)) throw new Error(`Invalid previous_date: ${previousDate}`);
  if (previousDate && previousDate >= date) throw new Error(`previous_date must be before target_date: ${previousDate} >= ${date}`);
  const previousPath = previousDate ? path.join(DATA_ROOT, `${previousDate}.json`) : null;
  const previousRaw = previousPath ? readJson(previousPath, true) : null;
  if (previousRaw && String(previousRaw.target_date) !== previousDate) throw new Error(`Previous raw target_date mismatch: ${previousRaw.target_date} != ${previousDate}`);

  const analysisCodes = analyses.map((item) => stockCode(item.code));
  const rawCodes = rows.map((item) => stockCode(item.code));
  const exactAnalysisCoverage = latestAnalysis && analysisCodes.length === rawCodes.length && analysisCodes.every((code, index) => code === rawCodes[index]);

  const taxonomy = loadTaxonomy();
  const themeSummary = buildThemeSummary(rows, analyses, taxonomy);
  themeSummary.market_structure = chooseRegime(raw, latestAnalysis ? analysis : null, themeSummary);
  const catalyst = buildCatalystCoverage(analyses, rows.length);
  const funding = buildFundingSummary(analyses, rows.length);
  const gains = rows.map((row) => finiteNullable(row.change_pct));
  if (gains.some((value) => value === null || value < 5)) throw new Error('Raw 5% list contains invalid or sub-threshold change_pct');
  const breadth = {
    stock_count: rows.length,
    gain_5_to_7_count: gains.filter((v) => v >= 5 && v < 7).length,
    gain_7_to_9_5_count: gains.filter((v) => v >= 7 && v < 9.5).length,
    gain_9_5_plus_count: gains.filter((v) => v >= 9.5).length,
    previous_day_stock_count: previousRaw && Array.isArray(previousRaw.stocks) ? previousRaw.stocks.length : null,
    stock_count_change: previousRaw && Array.isArray(previousRaw.stocks) ? rows.length - previousRaw.stocks.length : null,
  };
  const narrative = buildNarrative(raw, themeSummary, catalyst, funding);
  const status = exactAnalysisCoverage ? 'final' : 'preliminary';
  const analysisCoverageStatus = exactAnalysisCoverage ? 'complete' : 'missing';
  const factsCoverageStatus = facts ? 'complete' : 'missing';
  const previousCoverageStatus = previousRaw ? 'complete' : 'missing';
  const riskSignals = [];
  if (catalyst.none + catalyst.circumstantial > catalyst.public_catalyst_count) riskSignals.push('weak_catalyst_coverage');
  if (themeSummary.top_1_theme_share_pct >= 35) riskSignals.push('high_theme_concentration');
  if (funding.coverage_status !== 'complete') riskSignals.push('funding_coverage_incomplete');
  if (analysis && !latestAnalysis) riskSignals.push('outdated_analysis_ignored');

  return {
    schema_version: DAILY_GAINERS_AI_CONTRACT.market_summary.schema_version,
    methodology_version: DAILY_GAINERS_AI_CONTRACT.market_summary.methodology_version,
    contract_version: DAILY_GAINERS_AI_CONTRACT.contract_version,
    target_date: date,
    previous_date: previousDate || null,
    generated_at: new Date().toISOString(),
    status,
    source_lineage: {
      raw: sourceDescriptor(rawPath),
      previous_raw: sourceDescriptor(previousPath),
      facts: sourceDescriptor(factsPath),
      analysis: sourceDescriptor(analysisPath, { latest_contract: latestAnalysis }),
      theme_taxonomy: sourceDescriptor(TAXONOMY_PATH),
      semantic_source: latestAnalysis ? 'published_unified_analysis' : 'none',
    },
    coverage: {
      overall: analysisCoverageStatus === 'complete' && factsCoverageStatus === 'complete' ? 'complete' : analysisCoverageStatus === 'missing' && factsCoverageStatus === 'missing' ? 'missing' : 'partial',
      raw: 'complete',
      previous_raw: previousCoverageStatus,
      facts: factsCoverageStatus,
      analysis: analysisCoverageStatus,
      funding: funding.coverage_status,
      analyzed_stock_count: analyses.length,
      raw_stock_count: rows.length,
    },
    breadth,
    market_context: { regime: themeSummary.market_structure, source: latestAnalysis ? analysis.market_context || null : null },
    theme_summary: themeSummary,
    catalyst_coverage: catalyst,
    funding_summary: funding,
    risk_signals: riskSignals,
    headline: narrative.headline,
    market_summary: narrative.marketSummary,
    next_day_watch: narrative.nextDayWatch,
  };
}

function contentWithoutGeneratedAt(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = JSON.parse(JSON.stringify(payload));
  delete clone.generated_at;
  return clone;
}

function sameContent(existing, next) {
  return JSON.stringify(contentWithoutGeneratedAt(existing)) === JSON.stringify(contentWithoutGeneratedAt(next));
}

function updateManifest(summary) {
  fs.mkdirSync(SUMMARY_ROOT, { recursive: true });
  const manifestPath = path.join(SUMMARY_ROOT, 'manifest.json');
  const existing = readJson(manifestPath, true);
  const dates = new Set(Array.isArray(existing?.dates) ? existing.dates : []);
  dates.add(summary.target_date);
  const sorted = [...dates].filter((date) => /^\d{8}$/.test(date)).sort().reverse();
  const substantive = { schema_version: 1, methodology_version: DAILY_GAINERS_AI_CONTRACT.market_summary.methodology_version, latest_date: sorted[0] || null, dates: sorted };
  if (existing && JSON.stringify(contentWithoutGeneratedAt(existing)) === JSON.stringify(substantive)) return false;
  fs.writeFileSync(manifestPath, `${JSON.stringify({ ...substantive, generated_at: new Date().toISOString() }, null, 2)}\n`);
  return true;
}

function runSelfTest() {
  const taxonomy = loadTaxonomy();
  const rows = [{ code: '1', change_pct: 9.7 }, { code: '2', change_pct: 8 }, { code: '3', change_pct: 6 }];
  const analyses = [
    { code: '1', cause_tags: ['pcb'], evidence_strength: 'direct', flow: { foreign: { net_lots: null }, margin: { margin_delta: null } } },
    { code: '2', cause_tags: ['pcb'], evidence_strength: 'none', flow: {} },
    { code: '3', cause_tags: ['optics'], evidence_strength: 'corroborated', flow: {} },
  ];
  const themes = buildThemeSummary(rows, analyses, taxonomy);
  if (themes.theme_ranking[0]?.theme_id !== 'pcb' || themes.theme_ranking[0]?.stock_count !== 2) throw new Error('theme aggregation self-test failed');
  const catalyst = buildCatalystCoverage(analyses, 3);
  if (catalyst.public_catalyst_count !== 2) throw new Error('catalyst aggregation self-test failed');
  const funding = buildFundingSummary(analyses, 3);
  if (funding.coverage_status !== 'missing' || funding.available_stock_count !== 0) throw new Error('null funding must remain unavailable');
  console.log('build_daily_gainers_market_summary self-test passed');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) return runSelfTest();
  const summary = buildSummary(args.date, args.previousDate);
  const outputPath = path.join(SUMMARY_ROOT, `${args.date}.json`);
  const existing = readJson(outputPath, true);
  let summaryChanged = true;
  if (!args.force && existing && sameContent(existing, summary)) {
    summaryChanged = false;
    console.log(`Market summary unchanged for ${args.date}; skipping summary write.`);
  } else {
    fs.mkdirSync(SUMMARY_ROOT, { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  const manifestChanged = updateManifest(summaryChanged ? summary : existing);
  console.log(JSON.stringify({ output: rel(outputPath), summary_changed: summaryChanged, manifest_changed: manifestChanged, status: summary.status, coverage: summary.coverage, breadth: summary.breadth }, null, 2));
}

if (require.main === module) main();

module.exports = { buildSummary, buildThemeSummary, buildCatalystCoverage, buildFundingSummary, normalizedThemes, finiteNullable };
