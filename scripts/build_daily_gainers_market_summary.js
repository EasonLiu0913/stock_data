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
  if (!fs.existsSync(filePath)) {
    if (optional) return null;
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
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

function loadTaxonomy() {
  const taxonomy = readJson(TAXONOMY_PATH);
  const aliasToId = new Map();
  const labels = new Map();
  for (const theme of taxonomy.themes || []) {
    labels.set(theme.id, theme.label);
    aliasToId.set(theme.id, theme.id);
    for (const alias of theme.aliases || []) aliasToId.set(String(alias).toLowerCase(), theme.id);
  }
  labels.set(taxonomy.fallback_theme?.id || 'other', taxonomy.fallback_theme?.label || '其他 / 未分類');
  return { taxonomy, aliasToId, labels };
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
    const themes = normalizedThemes(byCode.get(code), taxonomy.aliasToId);
    const primary = themes[0];
    if (!primary) continue;
    themedStockCount += 1;
    if (!buckets.has(primary)) buckets.set(primary, []);
    buckets.get(primary).push(row);
  }
  const ranking = [...buckets.entries()].map(([themeId, members]) => {
    const gains = members.map((row) => Number(row.change_pct)).filter(Number.isFinite);
    const nearLimit = members.filter((row) => Number(row.change_pct) >= 9.5).length;
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
      representative_stocks: members.slice().sort((a, b) => Number(b.change_pct) - Number(a.change_pct)).slice(0, 5).map((row) => stockCode(row.code)),
    };
  }).sort((a, b) => b.stock_count - a.stock_count || (b.average_gain_pct || 0) - (a.average_gain_pct || 0));
  const top1 = ranking[0]?.stock_count || 0;
  const top3 = ranking.slice(0, 3).reduce((sum, item) => sum + item.stock_count, 0);
  return {
    taxonomy_version: taxonomy.taxonomy.methodology_version,
    themed_stock_count: themedStockCount,
    unclassified_stock_count: rows.length - themedStockCount,
    theme_ranking: ranking,
    top_1_theme_share_pct: pct(top1, rows.length),
    top_3_theme_share_pct: pct(top3, rows.length),
  };
}

function buildCatalystCoverage(analyses, total) {
  const counts = { direct: 0, corroborated: 0, circumstantial: 0, none: 0, unavailable: 0 };
  const causeTypes = {};
  for (const item of analyses || []) {
    const strength = counts[item.evidence_strength] === undefined ? 'unavailable' : item.evidence_strength;
    counts[strength] += 1;
    const cause = item.cause_type || 'unknown';
    causeTypes[cause] = (causeTypes[cause] || 0) + 1;
  }
  counts.unavailable += Math.max(0, total - (analyses || []).length);
  return {
    ...counts,
    public_catalyst_count: counts.direct + counts.corroborated,
    public_catalyst_coverage_pct: pct(counts.direct + counts.corroborated, total),
    cause_type_counts: causeTypes,
  };
}

function buildFundingSummary(analyses, total) {
  let institutionalSupport = 0;
  let institutionalOpposition = 0;
  let marginIncrease = 0;
  let marginDecrease = 0;
  let availableFlowStocks = 0;
  for (const item of analyses || []) {
    const flow = item.flow || {};
    const nets = ['foreign', 'investment_trust', 'dealer']
      .map((key) => Number(flow[key]?.net_lots))
      .filter(Number.isFinite);
    const marginDelta = Number(flow.margin?.margin_delta);
    if (nets.length || Number.isFinite(marginDelta)) availableFlowStocks += 1;
    const institutionalNet = nets.reduce((sum, value) => sum + value, 0);
    if (nets.length && institutionalNet > 0) institutionalSupport += 1;
    if (nets.length && institutionalNet < 0) institutionalOpposition += 1;
    if (Number.isFinite(marginDelta) && marginDelta > 0) marginIncrease += 1;
    if (Number.isFinite(marginDelta) && marginDelta < 0) marginDecrease += 1;
  }
  return {
    coverage_status: availableFlowStocks === total && total > 0 ? 'complete' : availableFlowStocks > 0 ? 'partial' : 'missing',
    available_stock_count: availableFlowStocks,
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

function buildNarrative(raw, analysis, themeSummary, catalyst) {
  const top = themeSummary.theme_ranking.slice(0, 3);
  const topText = top.length ? top.map((item) => `${item.label} ${item.stock_count} 檔`).join('、') : '題材尚未完成結構化分類';
  const legacy = typeof analysis?.market_summary?.summary === 'string' ? analysis.market_summary.summary.trim() : '';
  const headline = top.length
    ? `${raw.stock_count ?? (raw.stocks || []).length} 檔強勢股，主流集中於${top[0].label}`
    : `${raw.stock_count ?? (raw.stocks || []).length} 檔強勢股，題材分類待補`;
  const marketSummary = legacy || `本日共有 ${raw.stock_count ?? (raw.stocks || []).length} 檔股票漲幅達 5% 以上；${topText}。有公開直接或交叉佐證催化的股票占 ${catalyst.public_catalyst_coverage_pct}%。`;
  const nextDayWatch = [];
  if (top[0]) nextDayWatch.push(`觀察 ${top[0].label} 是否續量並維持族群擴散。`);
  if (catalyst.none + catalyst.circumstantial > catalyst.public_catalyst_count) nextDayWatch.push('弱證據個股占比較高，留意隔日動能退潮。');
  if (!nextDayWatch.length) nextDayWatch.push('觀察強勢股廣度、成交量與法人籌碼是否延續。');
  return { headline, marketSummary, nextDayWatch };
}

function sourceDescriptor(filePath) {
  return { path: rel(filePath), available: Boolean(filePath && fs.existsSync(filePath)), sha256: sha256File(filePath) };
}

function buildSummary(date, previousDateOverride = '') {
  if (!/^\d{8}$/.test(date)) throw new Error('--date must be YYYYMMDD');
  const rawPath = path.join(DATA_ROOT, `${date}.json`);
  const factsPath = path.join(DATA_ROOT, 'analysis-facts', `${date}.json`);
  const analysisPath = path.join(DATA_ROOT, 'analysis', `${date}.json`);
  const raw = readJson(rawPath);
  if (String(raw.target_date) !== date) throw new Error(`Raw target_date mismatch: ${raw.target_date} != ${date}`);
  const rows = Array.isArray(raw.stocks) ? raw.stocks : [];
  const analysis = readJson(analysisPath, true);
  const facts = readJson(factsPath, true);
  const previousDate = previousDateOverride || String(raw.previous_date || '');
  if (previousDate && !/^\d{8}$/.test(previousDate)) throw new Error(`Invalid previous_date: ${previousDate}`);
  if (previousDate && previousDate >= date) throw new Error(`previous_date must be before target_date: ${previousDate} >= ${date}`);
  const previousPath = previousDate ? path.join(DATA_ROOT, `${previousDate}.json`) : null;
  const previousRaw = previousPath ? readJson(previousPath, true) : null;
  if (previousRaw && String(previousRaw.target_date) !== previousDate) throw new Error(`Previous raw target_date mismatch: ${previousRaw.target_date} != ${previousDate}`);

  const analyses = Array.isArray(analysis?.analyses) ? analysis.analyses : [];
  const analysisCodes = new Set(analyses.map((item) => stockCode(item.code)));
  const rawCodes = new Set(rows.map((item) => stockCode(item.code)));
  const exactAnalysisCoverage = rows.length === analyses.length && rows.every((row) => analysisCodes.has(stockCode(row.code))) && analyses.every((item) => rawCodes.has(stockCode(item.code)));
  const latestAnalysis = isLatestPublished(analysis) && String(analysis?.target_date) === date;

  const taxonomy = loadTaxonomy();
  const themeSummary = buildThemeSummary(rows, analyses, taxonomy);
  themeSummary.market_structure = chooseRegime(raw, analysis, themeSummary);
  const catalyst = buildCatalystCoverage(analyses, rows.length);
  const funding = buildFundingSummary(analyses, rows.length);
  const gains = rows.map((row) => Number(row.change_pct));
  const breadth = {
    stock_count: rows.length,
    gain_5_to_7_count: gains.filter((v) => Number.isFinite(v) && v >= 5 && v < 7).length,
    gain_7_to_9_5_count: gains.filter((v) => Number.isFinite(v) && v >= 7 && v < 9.5).length,
    gain_9_5_plus_count: gains.filter((v) => Number.isFinite(v) && v >= 9.5).length,
    previous_day_stock_count: previousRaw && Array.isArray(previousRaw.stocks) ? previousRaw.stocks.length : null,
    stock_count_change: previousRaw && Array.isArray(previousRaw.stocks) ? rows.length - previousRaw.stocks.length : null,
  };
  const narrative = buildNarrative(raw, analysis, themeSummary, catalyst);
  const status = latestAnalysis && exactAnalysisCoverage ? 'final' : 'preliminary';
  const analysisCoverageStatus = exactAnalysisCoverage ? 'complete' : analyses.length ? 'partial' : 'missing';
  const factsCoverageStatus = facts ? 'complete' : 'missing';
  const previousCoverageStatus = previousRaw ? 'complete' : previousDate ? 'missing' : 'missing';

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
      analysis: sourceDescriptor(analysisPath),
      theme_taxonomy: sourceDescriptor(TAXONOMY_PATH),
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
    market_context: {
      regime: themeSummary.market_structure,
      source: analysis?.market_context || null,
    },
    theme_summary: themeSummary,
    catalyst_coverage: catalyst,
    funding_summary: funding,
    risk_signals: catalyst.none + catalyst.circumstantial > catalyst.public_catalyst_count ? ['weak_catalyst_coverage'] : [],
    headline: narrative.headline,
    market_summary: narrative.marketSummary,
    next_day_watch: narrative.nextDayWatch,
  };
}

function sameLineage(existing, next) {
  const strip = (value) => JSON.stringify(value || {});
  return existing?.schema_version === next.schema_version
    && existing?.methodology_version === next.methodology_version
    && existing?.contract_version === next.contract_version
    && strip(existing.source_lineage) === strip(next.source_lineage);
}

function updateManifest(summary) {
  fs.mkdirSync(SUMMARY_ROOT, { recursive: true });
  const manifestPath = path.join(SUMMARY_ROOT, 'manifest.json');
  const manifest = readJson(manifestPath, true) || { schema_version: 1, methodology_version: DAILY_GAINERS_AI_CONTRACT.market_summary.methodology_version, dates: [] };
  const dates = new Set(Array.isArray(manifest.dates) ? manifest.dates : []);
  dates.add(summary.target_date);
  const sorted = [...dates].filter((date) => /^\d{8}$/.test(date)).sort().reverse();
  const next = {
    schema_version: 1,
    methodology_version: DAILY_GAINERS_AI_CONTRACT.market_summary.methodology_version,
    generated_at: new Date().toISOString(),
    latest_date: sorted[0] || null,
    dates: sorted,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
}

function runSelfTest() {
  const taxonomy = loadTaxonomy();
  const rows = [
    { code: '1', change_pct: 9.7 },
    { code: '2', change_pct: 8 },
    { code: '3', change_pct: 6 },
  ];
  const analyses = [
    { code: '1', cause_tags: ['pcb'], evidence_strength: 'direct' },
    { code: '2', cause_tags: ['pcb'], evidence_strength: 'none' },
    { code: '3', cause_tags: ['optics'], evidence_strength: 'corroborated' },
  ];
  const themes = buildThemeSummary(rows, analyses, taxonomy);
  if (themes.theme_ranking[0]?.theme_id !== 'pcb' || themes.theme_ranking[0]?.stock_count !== 2) throw new Error('theme aggregation self-test failed');
  const catalyst = buildCatalystCoverage(analyses, 3);
  if (catalyst.public_catalyst_count !== 2) throw new Error('catalyst aggregation self-test failed');
  console.log('build_daily_gainers_market_summary self-test passed');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) return runSelfTest();
  const summary = buildSummary(args.date, args.previousDate);
  const outputPath = path.join(SUMMARY_ROOT, `${args.date}.json`);
  const existing = readJson(outputPath, true);
  if (!args.force && existing && sameLineage(existing, summary)) {
    console.log(`Market summary unchanged for ${args.date}; skipping write.`);
    updateManifest(existing);
    return;
  }
  fs.mkdirSync(SUMMARY_ROOT, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  updateManifest(summary);
  console.log(JSON.stringify({ output: rel(outputPath), status: summary.status, coverage: summary.coverage, breadth: summary.breadth }, null, 2));
}

if (require.main === module) main();

module.exports = { buildSummary, buildThemeSummary, buildCatalystCoverage, buildFundingSummary, normalizedThemes };
