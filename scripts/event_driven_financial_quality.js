#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { scoreRow } = require('./generate_financial_quality_score_timeline');
const { discoverTradingDates, resolveEffectiveTradingDate } = require('./fundamental_event_timeline');

const ROOT = path.resolve(__dirname, '..');
const FIN_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const VERIFIED_ROOT = path.join(ROOT, 'data_fundamental_events_verified');
const HISTORICAL_ROOT = path.join(ROOT, 'data_fundamental_events_historical');
const LIVE_ROOT = path.join(ROOT, 'data_fundamental_events');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function round(v, d = 4) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }
function pctChange(a, b) { return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a / b - 1) * 100 : null; }
function diff(a, b) { return Number.isFinite(a) && Number.isFinite(b) ? a - b : null; }
function periodIndex(period) {
  const m = String(period || '').match(/^(20\d{2})Q([1-4])$/);
  if (!m) return null;
  return Number(m[1]) * 4 + Number(m[2]) - 1;
}
function periodFromIndex(index) {
  if (!Number.isInteger(index)) return null;
  return `${Math.floor(index / 4)}Q${index % 4 + 1}`;
}
function previousPeriod(period, delta = 1) {
  const index = periodIndex(period);
  return Number.isInteger(index) ? periodFromIndex(index - delta) : null;
}
function loadQuarter(stockId, period, root = ROOT) {
  const file = path.join(root, 'data_finmind_quarterly_financial_quality', String(stockId), `${period}.json`);
  const payload = readJson(file);
  if (!payload?.standalone_quarter) return null;
  return { file, payload, q: payload.standalone_quarter };
}
function conservativeEffectiveDate(payload, tradingDates) {
  const known = payload?.methodology?.conservative_known_date || null;
  if (!known) return null;
  return resolveEffectiveTradingDate({ publishedDate: known, timestampPrecision: 'fallback', tradingDates });
}
function normalizeCurrentQuarterMetrics(event) {
  const m = event?.metrics || {};
  const revenue = Number(m.revenue);
  const eps = Number(m.eps);
  const grossMargin = Number(m.gross_margin_pct);
  const operatingMargin = Number(m.operating_margin_pct);
  let operatingIncome = Number(m.operating_income);
  if (!Number.isFinite(operatingIncome) && Number.isFinite(revenue) && Number.isFinite(operatingMargin)) {
    operatingIncome = revenue * operatingMargin / 100;
  }
  const required = { revenue, operating_income: operatingIncome, eps, gross_margin_pct: grossMargin, operating_margin_pct: operatingMargin };
  const missing = Object.entries(required).filter(([, value]) => !Number.isFinite(value)).map(([key]) => key);
  return { values: required, missing };
}
function calculateMetrics(current, prev, yoy) {
  return {
    revenue_qoq_pct: round(pctChange(current.revenue, prev?.revenue)),
    revenue_yoy_pct: round(pctChange(current.revenue, yoy?.revenue)),
    operating_income_qoq_pct: round(pctChange(current.operating_income, prev?.operating_income)),
    operating_income_yoy_pct: round(pctChange(current.operating_income, yoy?.operating_income)),
    eps_qoq_pct: round(pctChange(current.eps, prev?.eps)),
    eps_yoy_pct: round(pctChange(current.eps, yoy?.eps)),
    gross_margin_qoq_pp: round(diff(current.gross_margin_pct, prev?.gross_margin_pct)),
    gross_margin_yoy_pp: round(diff(current.gross_margin_pct, yoy?.gross_margin_pct)),
    operating_margin_qoq_pp: round(diff(current.operating_margin_pct, prev?.operating_margin_pct)),
    operating_margin_yoy_pp: round(diff(current.operating_margin_pct, yoy?.operating_margin_pct)),
  };
}
function scorePreliminaryEvent(event, options = {}) {
  const root = options.root || ROOT;
  const tradingDates = options.tradingDates || discoverTradingDates(root);
  const stockId = String(event?.stock_id || '');
  const period = event?.fiscal_period || null;
  const effectiveDate = event?.effective_trading_date || null;
  if (!stockId || !period || !effectiveDate) return { scoreable: false, reason: 'missing_stock_period_or_effective_date' };
  const normalized = normalizeCurrentQuarterMetrics(event);
  if (normalized.missing.length) return { scoreable: false, reason: 'missing_current_metrics', missing: normalized.missing };
  const prevPeriod = previousPeriod(period, 1);
  const yoyPeriod = previousPeriod(period, 4);
  const prev = loadQuarter(stockId, prevPeriod, root);
  const yoy = loadQuarter(stockId, yoyPeriod, root);
  if (!prev?.q || !yoy?.q) return { scoreable: false, reason: 'missing_comparison_quarter', missing_periods: [!prev?.q ? prevPeriod : null, !yoy?.q ? yoyPeriod : null].filter(Boolean) };
  const comparisonAvailability = [prev, yoy].map(item => ({
    period: item.payload.fiscal_period,
    effective_date: conservativeEffectiveDate(item.payload, tradingDates),
  }));
  const futureComparison = comparisonAvailability.find(item => !item.effective_date || item.effective_date > effectiveDate);
  if (futureComparison) return { scoreable: false, reason: 'comparison_quarter_not_yet_known', comparison: futureComparison };
  const metrics = calculateMetrics(normalized.values, prev.q, yoy.q);
  const scored = scoreRow(metrics);
  return {
    scoreable: true,
    stock_id: stockId,
    fiscal_period: period,
    effective_date: effectiveDate,
    financial_quality_score: scored.score,
    financial_quality_max_score: scored.max_score,
    score_reasons: scored.reasons,
    metrics,
    current_values: normalized.values,
    comparison_periods: { previous_quarter: prevPeriod, year_ago_quarter: yoyPeriod },
    comparison_availability: comparisonAvailability,
    source_event_id: event.event_id || null,
    source_event_type: event.event_type,
    availability_confidence: event.availability_confidence || null,
    score_basis: 'preliminary_event_recomputed',
  };
}
function loadEventsFromRoot(root, stockId) {
  const dir = path.join(root, String(stockId));
  if (!fs.existsSync(dir)) return [];
  const events = [];
  for (const name of fs.readdirSync(dir).filter(name => /^20\d{2}\.json$/.test(name)).sort()) {
    const payload = readJson(path.join(dir, name), {});
    for (const event of payload.events || []) events.push(event);
  }
  return events;
}
function confidenceRank(value) {
  const order = ['official_timestamp','official_date','verified_company_ir','curated_supplemental','aggregate_snapshot_date','fallback_deadline','unknown'];
  const idx = order.indexOf(String(value || 'unknown'));
  return idx < 0 ? order.length : idx;
}
function buildEventDrivenFinancialRows(stockId, options = {}) {
  const root = options.root || ROOT;
  const tradingDates = options.tradingDates || discoverTradingDates(root);
  const dir = path.join(root, 'data_finmind_quarterly_financial_quality', String(stockId));
  const timeline = readJson(path.join(dir, 'financial-quality-score-timeline.json'), {});
  const formalRows = [];
  for (const row of timeline.rows || []) {
    const source = loadQuarter(stockId, row.fiscal_period, root);
    if (!source) continue;
    const effectiveDate = conservativeEffectiveDate(source.payload, tradingDates);
    if (!effectiveDate) continue;
    formalRows.push({
      ...row,
      effective_known_date: effectiveDate,
      availability_confidence: 'fallback_deadline',
      score_basis: 'formal_score_with_fallback_availability',
      source_event_id: null,
    });
  }

  const eventRoots = [
    path.join(root, 'data_fundamental_events_verified'),
    path.join(root, 'data_fundamental_events_historical'),
    path.join(root, 'data_fundamental_events'),
  ];
  const prelimEvents = eventRoots.flatMap(sourceRoot => loadEventsFromRoot(sourceRoot, stockId))
    .filter(event => event.event_type === 'preliminary_earnings' && event.fiscal_period && event.effective_trading_date);
  const scoredPreliminary = [];
  const rejectedPreliminary = [];
  for (const event of prelimEvents) {
    const scored = scorePreliminaryEvent(event, { root, tradingDates });
    if (scored.scoreable) scoredPreliminary.push(scored);
    else rejectedPreliminary.push({ event_id: event.event_id || null, fiscal_period: event.fiscal_period || null, effective_trading_date: event.effective_trading_date || null, availability_confidence: event.availability_confidence || null, reason: scored.reason, missing: scored.missing || scored.missing_periods || null });
  }

  const rows = [...formalRows, ...scoredPreliminary].sort((a, b) =>
    String(a.effective_known_date || a.effective_date).localeCompare(String(b.effective_known_date || b.effective_date)) ||
    String(a.fiscal_period).localeCompare(String(b.fiscal_period)) ||
    confidenceRank(a.availability_confidence) - confidenceRank(b.availability_confidence));
  return { rows, formalRows, scoredPreliminary, rejectedPreliminary };
}
function latestKnownScore(rows, eventDate) {
  const eligible = (rows || []).filter(row => {
    const known = row.effective_known_date || row.effective_date;
    return known && known <= eventDate && Number.isFinite(Number(row.financial_quality_score));
  });
  if (!eligible.length) return null;
  eligible.sort((a, b) => {
    const periodCmp = (periodIndex(a.fiscal_period) || 0) - (periodIndex(b.fiscal_period) || 0);
    if (periodCmp !== 0) return periodCmp;
    const dateCmp = String(a.effective_known_date || a.effective_date).localeCompare(String(b.effective_known_date || b.effective_date));
    if (dateCmp !== 0) return dateCmp;
    return confidenceRank(b.availability_confidence) - confidenceRank(a.availability_confidence);
  });
  return eligible.at(-1);
}

module.exports = {
  periodIndex,
  previousPeriod,
  normalizeCurrentQuarterMetrics,
  calculateMetrics,
  scorePreliminaryEvent,
  buildEventDrivenFinancialRows,
  latestKnownScore,
};
