#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  HORIZONS,
  classifyObservedTiming,
  generateMonth,
} = require('./generate_mops_revenue_event_returns');

const ROOT = path.resolve(__dirname, '..');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const EVENT_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'events');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function listRevenueMonths() {
  try {
    return fs.readdirSync(REVENUE_ROOT, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^20\d{4}$/.test(entry.name))
      .map(entry => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function hasUsableLiveTiming(month, source) {
  return (source?.companies || []).some(row => classifyObservedTiming(month, row.first_seen_at).usable);
}

function eventMonthNeedsRefresh(month, existing, source) {
  if (!hasUsableLiveTiming(month, source)) return false;
  if (!existing) return true;

  const sourceCount = Array.isArray(source?.companies) ? source.companies.length : 0;
  if (existing.counts?.total !== sourceCount) return true;

  const liveEvents = (existing.events || []).filter(event => event.event_timing_status === 'observed_during_reporting_window');
  if (!liveEvents.length) return true;

  return liveEvents.some(event => {
    if (event.evaluation_status === 'pending_next_trading_day') return true;
    return HORIZONS.some(horizon => event.returns?.[`d${horizon}`]?.status !== 'complete');
  });
}

function main() {
  const months = listRevenueMonths();
  const selected = [];
  for (const month of months) {
    const source = readJson(path.join(REVENUE_ROOT, month, 'monthly_revenue.json'), null);
    if (!source) continue;
    const existing = readJson(path.join(EVENT_ROOT, `${month}.json`), null);
    if (eventMonthNeedsRefresh(month, existing, source)) selected.push(month);
  }

  const results = selected.map(month => ({ month, ...generateMonth(month) }));
  const changed = results.filter(item => item.changed);
  console.log(JSON.stringify({ selected_months: selected, changed_months: changed.map(item => item.month), results }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { eventMonthNeedsRefresh, hasUsableLiveTiming };
