#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const stock = getArg('stock', '2449');
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-07-31');
const root = path.join('data_research', 'institutional-flow', 'histock', stock);
const dailyDir = path.join(root, 'daily');
const statusDir = path.join(root, 'batch-status');
const tradingPath = path.join('data_history_sma', 'trading_days.json');
const nonTradingPath = path.join('data_history_sma', 'non_trading_days.json');
const normalize = (v) => String(v).replaceAll('/', '-');
const ymd = (d) => d.replaceAll('-', '');

function loadCalendar(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { payload, dates: new Set(Object.values(payload).flat().map(normalize)) };
}
function readDaily(date) {
  const file = path.join(dailyDir, `${ymd(date)}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (p.source !== 'histock' || p.research_only !== true || p.stock !== stock || p.date !== date || !Array.isArray(p.records) || p.records.length === 0) return null;
    return p;
  } catch {
    return null;
  }
}
function aggregateWindow(days, endIndex, window) {
  const slice = days.slice(Math.max(0, endIndex - window + 1), endIndex + 1);
  const map = new Map();
  for (const day of slice) {
    for (const r of day.records) {
      const a = map.get(r.broker) || { broker: r.broker, total_net: 0, total_buy: 0, total_sell: 0, appearances: 0, sell_days: 0, buy_days: 0 };
      a.total_net += Number(r.net || 0); a.total_buy += Number(r.buy || 0); a.total_sell += Number(r.sell || 0); a.appearances += 1;
      if (r.net < 0) a.sell_days += 1; if (r.net > 0) a.buy_days += 1;
      map.set(r.broker, a);
    }
  }
  const rows = [...map.values()].map((a) => ({ ...a, sell_ratio: a.appearances ? a.sell_days / a.appearances : 0, buy_ratio: a.appearances ? a.buy_days / a.appearances : 0 }));
  return {
    window,
    available_trading_days: slice.length,
    from: slice[0]?.date || null,
    to: slice.at(-1)?.date || null,
    persistent_sellers: rows.filter((x) => x.total_net < 0 && x.sell_days >= 2).sort((a, b) => a.total_net - b.total_net).slice(0, 20),
    persistent_buyers: rows.filter((x) => x.total_net > 0 && x.buy_days >= 2).sort((a, b) => b.total_net - a.total_net).slice(0, 20),
  };
}
function loadLatestDiagnostics() {
  const map = new Map();
  if (!fs.existsSync(statusDir)) return map;
  const files = fs.readdirSync(statusDir).filter((n) => n.endsWith('.json')).sort();
  for (const name of files) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(statusDir, name), 'utf8'));
      const items = Array.isArray(p.unresolved) ? p.unresolved : (p.unresolved ? [p.unresolved] : []);
      for (const item of items) if (item?.date) map.set(item.date, item);
    } catch {}
  }
  return map;
}
function isSourceGap(item) {
  const d = item?.diagnostics || {};
  return item?.reason === 'no_broker_records_on_trading_day' && d.http_status === 200 && d.date_visible === true && d.broker_keywords_visible === true && Number(d.table_rows) <= 1 && Number(d.response_bytes) > 0;
}

const trading = loadCalendar(tradingPath);
const nonTrading = loadCalendar(nonTradingPath);
const requested = [...trading.dates].filter((d) => d >= start && d <= end).sort();
const conflicts = requested.filter((d) => nonTrading.dates.has(d));
if (conflicts.length) throw new Error(`Trading/non-trading conflict: ${conflicts.join(',')}`);
const days = requested.map(readDaily).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
const parsedSet = new Set(days.map((d) => d.date));
const missing = requested.filter((d) => !parsedSet.has(d));
const diagnosticMap = loadLatestDiagnostics();
const unresolved = missing.map((date) => diagnosticMap.get(date) || { date, reason: 'missing_without_batch_diagnostics', diagnostics: null });
const sourceGaps = unresolved.filter(isSourceGap);
const hardFailures = unresolved.filter((x) => !isSourceGap(x));
const rolling = days.map((day, index) => ({ date: day.date, windows: [5, 10, 20].map((w) => aggregateWindow(days, index, w)) }));
const analysis = {
  schema_version: 3,
  methodology: 'histock-top-broker-rolling-persistence-plan-batch-v1',
  source: 'histock', source_type: 'third_party_public_page', research_only: true,
  stock, requested_range: { start, end },
  calendar: { trading_days_file: tradingPath, non_trading_days_file: nonTradingPath, selection: 'trading_days_whitelist_with_non_trading_conflict_guard' },
  generated_at: new Date().toISOString(),
  counts: { requested_trading_days: requested.length, parsed_trading_days: days.length, source_gaps: sourceGaps.length, hard_failures: hardFailures.length, unresolved_trading_days: unresolved.length, skipped: 0, failed: hardFailures.length },
  coverage_ratio: requested.length ? days.length / requested.length : 0,
  complete: missing.length === 0,
  usable_research: hardFailures.length === 0,
  unresolved, source_gaps: sourceGaps, hard_failures: hardFailures,
  limitations: [
    'HiStock exposes ranked broker rows rather than the complete official TWSE BSR ledger.',
    'Absence of a broker from a parsed day means it was outside the exposed ranking, not necessarily zero trading.',
    'Documented source gaps remain missing observations and are never imputed as zero.',
  ],
  rolling,
};
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'manifest.json'), `${JSON.stringify({ schema_version: 3, source: 'histock', research_only: true, stock, range: { start, end }, daily_files: days.map((d) => `daily/${ymd(d.date)}.json`), analysis_file: 'analysis.json', counts: analysis.counts, complete: analysis.complete, usable_research: analysis.usable_research }, null, 2)}\n`);
console.log(JSON.stringify(analysis.counts, null, 2));
console.log(`coverage=${(analysis.coverage_ratio * 100).toFixed(1)}% complete=${analysis.complete} usable_research=${analysis.usable_research}`);
if (sourceGaps.length) console.log(`source gaps: ${sourceGaps.map((x) => x.date).join(', ')}`);
if (hardFailures.length) {
  console.error(`hard failures: ${hardFailures.map((x) => `${x.date}:${x.reason}`).join(', ')}`);
  process.exitCode = 2;
}
