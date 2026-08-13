#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { discoverTradingDates } = require('./fundamental_event_timeline');
const { fallbackFormalEvents } = require('./build_fundamental_event_timeline');

const ROOT = path.resolve(__dirname, '..');
const STOCK_LIST_FILE = path.join(ROOT, 'data_twse', 'twse_industry_Stock.json');
const FIN_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const EVENT_ROOT = path.join(ROOT, 'data_fundamental_events');
const OUT_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'formal-report-event-gap-report.json');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function loadUniverse() {
  const master = readJson(STOCK_LIST_FILE, {});
  const map = new Map();
  for (const [code, meta] of Object.entries(master || {})) {
    if (/^\d{4,6}$/.test(code)) map.set(code, { stock_code: code, stock_name: meta?.Name || '', industry: meta?.Industry || '' });
  }
  if (fs.existsSync(FIN_ROOT)) {
    for (const d of fs.readdirSync(FIN_ROOT, { withFileTypes: true })) {
      if (d.isDirectory() && /^\d{4,6}$/.test(d.name) && !map.has(d.name)) map.set(d.name, { stock_code: d.name, stock_name: '', industry: '' });
    }
  }
  return [...map.values()].sort((a, b) => a.stock_code.localeCompare(b.stock_code));
}
function loadQuarterRows(stock) {
  const dir = path.join(FIN_ROOT, stock);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => /^20\d{2}Q[1-4]\.json$/.test(name))
    .map(name => {
      const file = path.join(dir, name);
      const payload = readJson(file, {});
      return {
        fiscal_period: payload.fiscal_period || name.replace('.json', ''),
        conservative_known_date: payload.methodology?.conservative_known_date || null,
        eps: Number.isFinite(Number(payload.standalone_quarter?.eps)) ? Number(payload.standalone_quarter.eps) : null,
        source_file: path.relative(ROOT, file),
      };
    })
    .sort((a, b) => a.fiscal_period.localeCompare(b.fiscal_period));
}
function loadFormalEvents(stock) {
  const dir = path.join(EVENT_ROOT, stock);
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  for (const name of fs.readdirSync(dir).filter(name => /^20\d{2}\.json$/.test(name))) {
    const file = path.join(dir, name);
    const payload = readJson(file, {});
    for (const event of payload.events || []) {
      if (event.event_type !== 'formal_financial_report' || !event.fiscal_period) continue;
      map.set(event.fiscal_period, { ...event, source_file: path.relative(ROOT, file) });
    }
  }
  return map;
}
function classify(stock) {
  if (stock.quarterly_eps_count === 0) return 'missing_eps';
  if (stock.missing_event_count === 0) return 'already_complete_for_available_eps';
  if (stock.direct_fallback_candidate_count > 0 && stock.unbuildable_event_count === 0) return 'event_only_gap';
  if (stock.direct_fallback_candidate_count > 0) return 'partial_event_gap';
  return 'event_gap_without_known_date';
}
function inspectStock(meta, tradingDates, asOfDate) {
  const rows = loadQuarterRows(meta.stock_code);
  const events = loadFormalEvents(meta.stock_code);
  const fallbackMap = new Map(fallbackFormalEvents(meta.stock_code, tradingDates, asOfDate).map(event => [event.fiscal_period, event]));
  const periods = rows.map(row => {
    const existing = events.get(row.fiscal_period) || null;
    const fallback = fallbackMap.get(row.fiscal_period) || null;
    let status = 'missing_event_no_known_date';
    if (existing) status = 'existing_event';
    else if (fallback) status = 'direct_fallback_candidate';
    else if (row.conservative_known_date && row.conservative_known_date > asOfDate) status = 'future_pending';
    return {
      fiscal_period: row.fiscal_period,
      eps: row.eps,
      quarterly_source_file: row.source_file,
      conservative_known_date: row.conservative_known_date,
      status,
      existing_event: existing ? {
        availability_confidence: existing.availability_confidence || null,
        published_date: existing.published_date || null,
        fallback_known_date: existing.fallback_known_date || null,
        effective_trading_date: existing.effective_trading_date || null,
        source_file: existing.source_file,
      } : null,
      proposed_fallback_event: !existing && fallback ? {
        event_id: fallback.event_id,
        availability_confidence: fallback.availability_confidence,
        fallback_known_date: fallback.fallback_known_date,
        effective_trading_date: fallback.effective_trading_date,
        source: fallback.source,
      } : null,
    };
  });
  const existingPeriods = [...events.keys()].sort();
  const missing = periods.filter(p => p.status !== 'existing_event');
  const candidates = periods.filter(p => p.status === 'direct_fallback_candidate');
  const future = periods.filter(p => p.status === 'future_pending');
  const unbuildable = periods.filter(p => p.status === 'missing_event_no_known_date');
  const result = {
    stock_code: meta.stock_code,
    stock_name: meta.stock_name,
    industry: meta.industry,
    quarterly_eps_count: rows.length,
    quarterly_eps_periods: rows.map(r => r.fiscal_period),
    existing_formal_event_count: events.size,
    existing_formal_event_periods: existingPeriods,
    missing_event_count: missing.length,
    missing_event_periods: missing.map(p => p.fiscal_period),
    direct_fallback_candidate_count: candidates.length,
    direct_fallback_candidate_periods: candidates.map(p => p.fiscal_period),
    future_pending_count: future.length,
    future_pending_periods: future.map(p => p.fiscal_period),
    unbuildable_event_count: unbuildable.length,
    unbuildable_event_periods: unbuildable.map(p => p.fiscal_period),
    periods,
  };
  result.priority = classify(result);
  result.recommended_action = {
    event_only_gap: 'build_fallback_events_from_existing_quarterly_data',
    partial_event_gap: 'build_available_fallback_events_then_investigate_remaining_periods',
    missing_eps: 'backfill_quarterly_eps_before_formal_event_build',
    already_complete_for_available_eps: 'no_event_backfill_needed_for_existing_eps_periods',
    event_gap_without_known_date: 'investigate_missing_conservative_known_date_or_official_filing_event',
  }[result.priority];
  return result;
}
function summarize(stocks) {
  const priorityCounts = {};
  let epsStocks = 0, eventStocks = 0, candidateStocks = 0, candidateEvents = 0, missingEvents = 0, futurePending = 0, unbuildable = 0;
  for (const stock of stocks) {
    priorityCounts[stock.priority] = (priorityCounts[stock.priority] || 0) + 1;
    if (stock.quarterly_eps_count > 0) epsStocks++;
    if (stock.existing_formal_event_count > 0) eventStocks++;
    if (stock.direct_fallback_candidate_count > 0) candidateStocks++;
    candidateEvents += stock.direct_fallback_candidate_count;
    missingEvents += stock.missing_event_count;
    futurePending += stock.future_pending_count;
    unbuildable += stock.unbuildable_event_count;
  }
  return {
    total_stocks: stocks.length,
    stocks_with_quarterly_eps: epsStocks,
    stocks_with_existing_formal_events: eventStocks,
    stocks_with_direct_fallback_candidates: candidateStocks,
    direct_fallback_candidate_events: candidateEvents,
    total_missing_events_for_available_eps: missingEvents,
    future_pending_events: futurePending,
    unbuildable_missing_events: unbuildable,
    priority_counts: priorityCounts,
  };
}
function main() {
  const asOfDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const tradingDates = discoverTradingDates(ROOT);
  const universe = loadUniverse();
  const stocks = universe.map(meta => inspectStock(meta, tradingDates, asOfDate));
  const payload = {
    schema_version: 1,
    dataset: 'formal_report_event_gap_report',
    generated_at: new Date().toISOString(),
    as_of_date: asOfDate,
    mode: 'investigation_only',
    mutates_fundamental_events: false,
    universe_source: path.relative(ROOT, STOCK_LIST_FILE),
    methodology: {
      existing_event_source: 'data_fundamental_events/{stock}/{year}.json',
      quarterly_source: 'data_finmind_quarterly_financial_quality/{stock}/{quarter}.json',
      fallback_planner: 'scripts/build_fundamental_event_timeline.js::fallbackFormalEvents',
      note: 'A direct fallback candidate is plan-only. This report never writes data_fundamental_events.',
    },
    summary: summarize(stocks),
    stocks,
  };
  writeJson(OUT_FILE, payload);
  console.log(JSON.stringify({ output: path.relative(ROOT, OUT_FILE), ...payload.summary }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { inspectStock, summarize, classify };
