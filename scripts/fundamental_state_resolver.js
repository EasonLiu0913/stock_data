#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_EVENT_ROOTS = [
  path.join(ROOT, 'data_fundamental_events'),
  path.join(ROOT, 'data_fundamental_events_historical'),
  path.join(ROOT, 'data_fundamental_events_verified'),
];

const CONFIDENCE_RANK = Object.freeze({
  official_timestamp: 0,
  official_date: 1,
  verified_company_ir: 2,
  curated_supplemental: 3,
  aggregate_snapshot_date: 4,
  fallback_deadline: 5,
  unknown: 6,
});

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function normalizeCutoff(value) {
  const text = String(value || '').trim();
  if (/^20\d{2}-\d{2}-\d{2}$/.test(text)) return { raw: text, date: text, hasTime: false, epochMs: null };
  const match = text.match(/^(20\d{2}-\d{2}-\d{2})T/);
  if (!match) throw new Error(`Invalid cutoff: ${value}`);
  const epochMs = Date.parse(text);
  if (!Number.isFinite(epochMs)) throw new Error(`Invalid cutoff timestamp: ${value}`);
  return { raw: text, date: match[1], hasTime: true, epochMs };
}

function fiscalIndex(period) {
  const match = String(period || '').match(/^(20\d{2})Q([1-4])$/);
  return match ? Number(match[1]) * 4 + Number(match[2]) : -1;
}

function eventObservedDate(event) {
  return event.published_date || (event.published_at ? String(event.published_at).slice(0, 10) : null) || event.fallback_known_date || event.effective_trading_date || null;
}

function eventAvailableByCutoff(event, cutoffValue) {
  const cutoff = typeof cutoffValue === 'object' && cutoffValue.date ? cutoffValue : normalizeCutoff(cutoffValue);
  if (cutoff.hasTime && event.published_at && ['second', 'minute'].includes(event.timestamp_precision)) {
    const eventMs = Date.parse(event.published_at);
    return Number.isFinite(eventMs) && eventMs <= cutoff.epochMs;
  }
  const effective = event.effective_trading_date || eventObservedDate(event);
  return Boolean(effective && effective <= cutoff.date);
}

function confidenceRank(event) {
  return CONFIDENCE_RANK[event?.availability_confidence] ?? 99;
}

function compareEventQuality(a, b) {
  const ar = confidenceRank(a), br = confidenceRank(b);
  if (ar !== br) return ar - br;
  const ad = String(a.published_at || a.published_date || a.fallback_known_date || '');
  const bd = String(b.published_at || b.published_date || b.fallback_known_date || '');
  return bd.localeCompare(ad);
}

function dedupeEvents(events) {
  const byId = new Map();
  for (const event of events) {
    if (!event || !event.event_id) continue;
    const existing = byId.get(event.event_id);
    if (!existing || compareEventQuality(event, existing) < 0) byId.set(event.event_id, event);
  }
  return [...byId.values()];
}

function loadEventsForStock(stockId, roots = DEFAULT_EVENT_ROOTS) {
  const events = [];
  for (const root of roots) {
    const dir = path.join(root, String(stockId));
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter(name => /^20\d{2}\.json$/.test(name)).sort()) {
      const payload = readJson(path.join(dir, name), {});
      for (const event of payload.events || []) events.push(event);
    }
  }
  return dedupeEvents(events);
}

function latestByPeriod(events, field) {
  return [...events].sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')) || compareEventQuality(a, b))[0] || null;
}

function latestByFiscalPeriod(events) {
  return [...events].sort((a, b) => fiscalIndex(b.fiscal_period) - fiscalIndex(a.fiscal_period) || compareEventQuality(a, b))[0] || null;
}

function bestFinancialEvent(preliminary, formal) {
  const candidates = [preliminary, formal].filter(Boolean);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => {
    const periodDelta = fiscalIndex(b.fiscal_period) - fiscalIndex(a.fiscal_period);
    if (periodDelta) return periodDelta;
    if (a.event_type !== b.event_type) return a.event_type === 'formal_financial_report' ? -1 : 1;
    return compareEventQuality(a, b);
  })[0];
}

function resolveFundamentalState(events, cutoffValue) {
  const cutoff = normalizeCutoff(cutoffValue);
  const available = dedupeEvents(events).filter(event => eventAvailableByCutoff(event, cutoff));
  const monthly = available.filter(event => event.event_type === 'monthly_revenue' && event.period);
  const preliminary = available.filter(event => event.event_type === 'preliminary_earnings' && event.fiscal_period);
  const formal = available.filter(event => event.event_type === 'formal_financial_report' && event.fiscal_period);
  const conferences = available.filter(event => event.event_type === 'investor_conference');
  const material = available.filter(event => event.event_type === 'material_information');

  const latestMonthlyRevenue = latestByPeriod(monthly, 'period');
  const latestPreliminaryEarnings = latestByFiscalPeriod(preliminary);
  const latestFormalFinancialReport = latestByFiscalPeriod(formal);
  const latestInvestorConference = [...conferences].sort((a, b) => String(b.published_at || b.published_date || '').localeCompare(String(a.published_at || a.published_date || '')))[0] || null;
  const latestMaterialInformation = [...material].sort((a, b) => String(b.published_at || b.published_date || '').localeCompare(String(a.published_at || a.published_date || '')))[0] || null;

  const bestFinancial = bestFinancialEvent(latestPreliminaryEarnings, latestFormalFinancialReport);
  return {
    schema_version: 1,
    dataset: 'latest_known_fundamental_state',
    cutoff: cutoff.raw,
    cutoff_date: cutoff.date,
    available_event_count: available.length,
    latest_monthly_revenue: latestMonthlyRevenue,
    latest_preliminary_earnings: latestPreliminaryEarnings,
    latest_formal_financial_report: latestFormalFinancialReport,
    latest_financial_information: bestFinancial,
    latest_investor_conference: latestInvestorConference,
    latest_material_information: latestMaterialInformation,
    availability_summary: {
      financial_period: bestFinancial?.fiscal_period || null,
      financial_event_type: bestFinancial?.event_type || null,
      financial_confidence: bestFinancial?.availability_confidence || null,
      monthly_period: latestMonthlyRevenue?.period || null,
      monthly_confidence: latestMonthlyRevenue?.availability_confidence || null,
    },
  };
}

function resolveFundamentalStateAt(stockId, cutoffValue, roots = DEFAULT_EVENT_ROOTS) {
  const events = loadEventsForStock(stockId, roots);
  return { stock_id: String(stockId), ...resolveFundamentalState(events, cutoffValue) };
}

module.exports = {
  DEFAULT_EVENT_ROOTS,
  CONFIDENCE_RANK,
  normalizeCutoff,
  fiscalIndex,
  eventAvailableByCutoff,
  loadEventsForStock,
  resolveFundamentalState,
  resolveFundamentalStateAt,
};
