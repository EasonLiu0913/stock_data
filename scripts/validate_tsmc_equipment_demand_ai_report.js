'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_WATCHLIST = path.join(ROOT, 'config', 'tsmc-equipment-demand-ai-watchlist.json');
const DEFAULT_DASHBOARD = path.join(ROOT, 'data_prediction_analysis', 'tsmc-equipment-demand', 'dashboard.json');
const RESEARCH_DAY_CUTOFF_HOUR = 6;

const DIRECTIONS = new Set(['bullish', 'neutral', 'bearish', 'uncertain']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const EVIDENCE_DIRECTIONS = new Set(['positive', 'negative', 'mixed', 'neutral']);
const FUNDAMENTAL_DIRECTIONS = new Set(['positive', 'negative', 'mixed', 'neutral', 'insufficient']);
const PRICE_STATES = new Set(['strong', 'neutral', 'weak', 'no_data']);
const RELATIONSHIPS = new Set(['confirmed', 'divergent', 'mixed', 'insufficient']);
const SOURCE_TYPES = new Set(['official', 'regulatory', 'industry', 'news', 'other']);
const QUERY_STATUSES = new Set(['ok', 'no_results', 'failed']);
const RELEVANCE = new Set(['high', 'medium', 'low']);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function isDate(value) {
  return typeof value === 'string' && /^\d{8}$/.test(value);
}

function isIsoDateTime(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function researchDate(iso) {
  const date = new Date(iso);
  const shifted = new Date(date.getTime() - RESEARCH_DAY_CUTOFF_HOUR * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(shifted);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}${get('month')}${get('day')}`;
}

function validateWatchlist(watchlist) {
  assert(watchlist.schema_version === 1, 'watchlist.schema_version must be 1');
  assert(typeof watchlist.methodology_version === 'string' && watchlist.methodology_version, 'watchlist methodology_version missing');
  assert(Array.isArray(watchlist.stocks) && watchlist.stocks.length === 6, 'watchlist must contain exactly 6 stocks');
  const codes = new Set();
  for (const stock of watchlist.stocks) {
    assert(/^\d{4}$/.test(stock.code), `invalid watchlist stock code: ${stock.code}`);
    assert(!codes.has(stock.code), `duplicate watchlist stock code: ${stock.code}`);
    codes.add(stock.code);
    assert(typeof stock.name === 'string' && stock.name, `watchlist stock ${stock.code} missing name`);
    assert(Array.isArray(stock.watch_targets) && stock.watch_targets.length > 0, `watchlist stock ${stock.code} missing watch_targets`);
  }
  return watchlist;
}

function validateRaw(raw, watchlist) {
  assert(raw.schema_version === 1, 'raw.schema_version must be 1');
  assert(raw.methodology_version === 'tsmc-equipment-demand-ai-raw-v1', 'raw methodology_version mismatch');
  assert(isDate(raw.report_date), 'raw.report_date must be YYYYMMDD');
  assert(raw.timezone === 'Asia/Taipei', 'raw.timezone must be Asia/Taipei');
  assert(isIsoDateTime(raw.search_started_at), 'raw.search_started_at must be ISO date-time');
  assert(isIsoDateTime(raw.search_completed_at), 'raw.search_completed_at must be ISO date-time');
  assert(researchDate(raw.search_started_at) === raw.report_date, 'raw.report_date must equal the Asia/Taipei 06:00-based research day of search_started_at');
  assert(Date.parse(raw.search_completed_at) >= Date.parse(raw.search_started_at), 'raw.search_completed_at precedes search_started_at');
  assert(raw.watchlist_methodology_version === watchlist.methodology_version, 'raw watchlist methodology version mismatch');
  assert(Array.isArray(raw.queries) && raw.queries.length > 0, 'raw.queries must be non-empty');
  assert(Array.isArray(raw.evidence), 'raw.evidence must be an array');

  const queryIds = new Set();
  for (const query of raw.queries) {
    assert(typeof query.id === 'string' && query.id, 'raw query id missing');
    assert(!queryIds.has(query.id), `duplicate raw query id: ${query.id}`);
    queryIds.add(query.id);
    assert(typeof query.query === 'string' && query.query, `raw query ${query.id} text missing`);
    assert(QUERY_STATUSES.has(query.status), `invalid raw query status: ${query.status}`);
  }

  const evidenceIds = new Set();
  for (const item of raw.evidence) {
    assert(/^E\d{3,}$/.test(item.id), `invalid evidence id: ${item.id}`);
    assert(!evidenceIds.has(item.id), `duplicate evidence id: ${item.id}`);
    evidenceIds.add(item.id);
    assert(Array.isArray(item.query_ids) && item.query_ids.length > 0, `evidence ${item.id} query_ids missing`);
    for (const queryId of item.query_ids) assert(queryIds.has(queryId), `evidence ${item.id} references unknown query ${queryId}`);
    assert(typeof item.source_name === 'string' && item.source_name, `evidence ${item.id} source_name missing`);
    assert(SOURCE_TYPES.has(item.source_type), `evidence ${item.id} source_type invalid`);
    assert(typeof item.title === 'string' && item.title, `evidence ${item.id} title missing`);
    assert(/^https?:\/\//.test(item.url || ''), `evidence ${item.id} URL invalid`);
    assert(isIsoDateTime(item.retrieved_at), `evidence ${item.id} retrieved_at invalid`);
    assert(item.published_at == null || isIsoDateTime(item.published_at), `evidence ${item.id} published_at invalid`);
    assert(Array.isArray(item.companies), `evidence ${item.id} companies must be array`);
    assert(Array.isArray(item.topics), `evidence ${item.id} topics must be array`);
    assert(typeof item.summary === 'string' && item.summary, `evidence ${item.id} summary missing`);
    assert(RELEVANCE.has(item.relevance), `evidence ${item.id} relevance invalid`);
    assert(EVIDENCE_DIRECTIONS.has(item.evidence_direction), `evidence ${item.id} direction invalid`);
  }
  return { evidenceIds };
}

function validateAnalysis(analysis, raw, rawFile, dashboard, watchlist, rawEvidenceIds) {
  assert(analysis.schema_version === 1, 'analysis.schema_version must be 1');
  assert(analysis.methodology_version === 'tsmc-equipment-demand-ai-analysis-v1', 'analysis methodology_version mismatch');
  assert(isDate(analysis.report_date), 'analysis.report_date must be YYYYMMDD');
  assert(analysis.report_date === raw.report_date, 'analysis.report_date must equal raw.report_date');
  assert(analysis.raw_report_date === raw.report_date, 'analysis.raw_report_date must equal raw.report_date');
  assert(analysis.timezone === 'Asia/Taipei', 'analysis.timezone must be Asia/Taipei');
  assert(isIsoDateTime(analysis.generated_at), 'analysis.generated_at must be ISO date-time');
  assert(analysis.raw_sha256 === sha256File(rawFile), 'analysis.raw_sha256 does not match raw file bytes');
  assert(analysis.price_trading_date === dashboard.trading_date, 'analysis.price_trading_date does not match dashboard.trading_date');
  assert(analysis.price_dashboard_generated_at === dashboard.generated_at, 'analysis.price_dashboard_generated_at does not match dashboard.generated_at');

  assert(analysis.overall && DIRECTIONS.has(analysis.overall.direction), 'analysis overall.direction invalid');
  assert(CONFIDENCE.has(analysis.overall.confidence), 'analysis overall.confidence invalid');
  assert(typeof analysis.overall.headline === 'string' && analysis.overall.headline, 'analysis overall.headline missing');
  assert(typeof analysis.overall.summary === 'string' && analysis.overall.summary, 'analysis overall.summary missing');
  assert(Array.isArray(analysis.overall.today_focus) && analysis.overall.today_focus.length > 0 && analysis.overall.today_focus.length <= 5, 'analysis overall.today_focus must have 1-5 items');
  assert(Array.isArray(analysis.overall.evidence_ids), 'analysis overall.evidence_ids must be array');
  for (const id of analysis.overall.evidence_ids) assert(rawEvidenceIds.has(id), `analysis overall references unknown evidence ${id}`);

  assert(Array.isArray(analysis.stocks) && analysis.stocks.length === 6, 'analysis must contain exactly 6 stocks');
  const expected = new Map(watchlist.stocks.map(stock => [stock.code, stock]));
  const dashboardStocks = new Map((dashboard.stocks || []).map(stock => [stock.code, stock]));
  const seen = new Set();

  for (const stock of analysis.stocks) {
    assert(expected.has(stock.code), `analysis contains out-of-scope stock ${stock.code}`);
    assert(!seen.has(stock.code), `analysis duplicate stock ${stock.code}`);
    seen.add(stock.code);
    assert(stock.name === expected.get(stock.code).name, `analysis stock ${stock.code} name mismatch`);
    assert(DIRECTIONS.has(stock.direction), `analysis stock ${stock.code} direction invalid`);
    assert(CONFIDENCE.has(stock.confidence), `analysis stock ${stock.code} confidence invalid`);
    assert(stock.fundamental_evidence && FUNDAMENTAL_DIRECTIONS.has(stock.fundamental_evidence.direction), `analysis stock ${stock.code} fundamental direction invalid`);
    assert(typeof stock.fundamental_evidence.summary === 'string' && stock.fundamental_evidence.summary, `analysis stock ${stock.code} fundamental summary missing`);
    assert(stock.price_observation && PRICE_STATES.has(stock.price_observation.state), `analysis stock ${stock.code} price state invalid`);
    const fact = dashboardStocks.get(stock.code);
    assert(fact, `dashboard missing stock ${stock.code}`);
    assert(stock.price_observation.state === fact.state, `analysis stock ${stock.code} price state must equal deterministic dashboard state ${fact.state}`);
    assert(typeof stock.price_observation.summary === 'string' && stock.price_observation.summary, `analysis stock ${stock.code} price summary missing`);
    assert(RELATIONSHIPS.has(stock.relationship), `analysis stock ${stock.code} relationship invalid`);
    assert(typeof stock.interpretation === 'string' && stock.interpretation, `analysis stock ${stock.code} interpretation missing`);
    assert(Array.isArray(stock.watch_next) && stock.watch_next.length > 0, `analysis stock ${stock.code} watch_next missing`);
    assert(Array.isArray(stock.evidence_ids), `analysis stock ${stock.code} evidence_ids must be array`);
    for (const id of stock.evidence_ids) assert(rawEvidenceIds.has(id), `analysis stock ${stock.code} references unknown evidence ${id}`);
  }
  assert(seen.size === expected.size, 'analysis stock coverage mismatch');
}

function parseArgs(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--self-test') result.selfTest = true;
    else if (arg === '--raw') result.raw = argv[++i];
    else if (arg === '--analysis') result.analysis = argv[++i];
    else if (arg === '--dashboard') result.dashboard = argv[++i];
    else if (arg === '--watchlist') result.watchlist = argv[++i];
    else fail(`Unknown argument: ${arg}`);
  }
  return result;
}

function validateFiles({ raw, analysis, dashboard = DEFAULT_DASHBOARD, watchlist = DEFAULT_WATCHLIST }) {
  assert(raw && analysis, '--raw and --analysis are required');
  const watch = validateWatchlist(readJson(watchlist));
  const rawPayload = readJson(raw);
  const { evidenceIds } = validateRaw(rawPayload, watch);
  const dashboardPayload = readJson(dashboard);
  const analysisPayload = readJson(analysis);
  validateAnalysis(analysisPayload, rawPayload, raw, dashboardPayload, watch, evidenceIds);
  console.log(`TSMC equipment AI report validation passed: ${analysisPayload.report_date}`);
}

function selfTest() {
  assert(researchDate('2026-09-04T00:00:00+08:00') === '20260903', '00:00 must remain on previous research day');
  assert(researchDate('2026-09-04T05:59:59+08:00') === '20260903', '05:59:59 must remain on previous research day');
  assert(researchDate('2026-09-04T06:00:00+08:00') === '20260904', '06:00 must begin the new research day');
  assert(researchDate('2026-09-04T23:59:59+08:00') === '20260904', '23:59:59 must remain on current research day');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsmc-equipment-ai-'));
  const watchlist = validateWatchlist(readJson(DEFAULT_WATCHLIST));
  const started = '2026-09-04T00:30:00+08:00';
  const raw = {
    schema_version: 1,
    methodology_version: 'tsmc-equipment-demand-ai-raw-v1',
    report_date: '20260903',
    search_started_at: started,
    search_completed_at: '2026-09-04T00:40:00+08:00',
    timezone: 'Asia/Taipei',
    watchlist_methodology_version: watchlist.methodology_version,
    queries: [{ id: 'Q001', query: 'TSMC equipment demand', status: 'ok', note: null }],
    evidence: [{
      id: 'E001', query_ids: ['Q001'], source_name: 'TSMC', source_type: 'official',
      title: 'Test evidence', url: 'https://example.com/evidence', published_at: '2026-09-03T10:00:00+08:00',
      retrieved_at: started, companies: ['TSMC'], topics: ['equipment'], summary: 'test evidence',
      relevance: 'high', evidence_direction: 'positive'
    }]
  };
  const rawFile = path.join(temp, 'raw.json');
  fs.writeFileSync(rawFile, JSON.stringify(raw, null, 2));
  const dashboard = {
    generated_at: '2026-09-03T08:00:00.000Z', trading_date: '20260902',
    stocks: watchlist.stocks.map(stock => ({ code: stock.code, state: 'neutral' }))
  };
  const dashboardFile = path.join(temp, 'dashboard.json');
  fs.writeFileSync(dashboardFile, JSON.stringify(dashboard, null, 2));
  const analysis = {
    schema_version: 1,
    methodology_version: 'tsmc-equipment-demand-ai-analysis-v1',
    report_date: '20260903', generated_at: '2026-09-04T00:45:00+08:00', timezone: 'Asia/Taipei',
    raw_report_date: '20260903', raw_sha256: sha256File(rawFile), price_trading_date: '20260902',
    price_dashboard_generated_at: dashboard.generated_at,
    overall: { direction: 'bullish', confidence: 'medium', headline: 'Test', summary: 'Test summary', today_focus: ['Watch evidence'], evidence_ids: ['E001'] },
    stocks: watchlist.stocks.map(stock => ({
      code: stock.code, name: stock.name, direction: 'neutral', confidence: 'low',
      fundamental_evidence: { direction: 'insufficient', summary: 'Insufficient company-specific evidence.' },
      price_observation: { state: 'neutral', summary: 'Deterministic price state is neutral.' },
      relationship: 'insufficient', interpretation: 'More evidence is required.', watch_next: stock.watch_targets.slice(0, 1), evidence_ids: []
    }))
  };
  const analysisFile = path.join(temp, 'analysis.json');
  fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
  validateFiles({ raw: rawFile, analysis: analysisFile, dashboard: dashboardFile, watchlist: DEFAULT_WATCHLIST });

  const tampered = JSON.parse(JSON.stringify(analysis));
  tampered.stocks[0].price_observation.state = 'strong';
  fs.writeFileSync(analysisFile, JSON.stringify(tampered, null, 2));
  let rejected = false;
  try { validateFiles({ raw: rawFile, analysis: analysisFile, dashboard: dashboardFile, watchlist: DEFAULT_WATCHLIST }); }
  catch (error) { rejected = /price state must equal deterministic/.test(error.message); }
  assert(rejected, 'self-test expected deterministic price-state tampering to be rejected');
  console.log('TSMC equipment AI validator self-test passed');
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  if (args.selfTest) selfTest();
  else validateFiles(args);
}

module.exports = { validateFiles, validateRaw, validateAnalysis, validateWatchlist, sha256File, researchDate };
