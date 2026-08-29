#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const getArg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const stocks = getArg('stocks', '2330,2317,2454,2382,2303,2449').split(',').map((s) => s.trim()).filter(Boolean);
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-08-21');
const output = getArg('output', path.join('data_research', 'institutional-flow', 'backtests', 'official-historical-event-diagnostics.json'));
const tempRoot = getArg('temp-root', path.join('/tmp', 'institutional-distribution-event-diagnostics'));
const horizons = [5, 10, 20];
const rank = { watch: 0, yellow: 1, orange: 2, red: 3 };

const round = (v, n = 4) => Number.isFinite(v) ? Number(v.toFixed(n)) : null;
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function normalizeDate(v) { return String(v).replaceAll('/', '-'); }
function rawLevel(score) { if (score >= 8) return 'red'; if (score >= 5) return 'orange'; if (score >= 3) return 'yellow'; return 'watch'; }
function loadPrices(stock) {
  const p = readJson(path.join('data_history_sma', `${stock}.json`));
  return Object.entries(p).map(([date, row]) => ({ date: normalizeDate(date), price: Number(row.price) }))
    .filter((x) => /^20\d{2}-\d{2}-\d{2}$/.test(x.date) && Number.isFinite(x.price) && x.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
function forwardReturn(prices, date, h) {
  const i = prices.findIndex((x) => x.date === date);
  if (i < 0 || i + h >= prices.length) return null;
  return round((prices[i + h].price / prices[i].price - 1) * 100, 2);
}
function pathExcursion(prices, date, h = 20) {
  const i = prices.findIndex((x) => x.date === date);
  if (i < 0) return { max_gain_pct: null, max_drawdown_pct: null, sessions: 0 };
  const base = prices[i].price;
  const slice = prices.slice(i + 1, Math.min(prices.length, i + h + 1));
  const returns = slice.map((x) => (x.price / base - 1) * 100);
  return {
    max_gain_pct: returns.length ? round(Math.max(...returns), 2) : null,
    max_drawdown_pct: returns.length ? round(Math.min(...returns), 2) : null,
    sessions: returns.length,
  };
}
function summarize(rows, field) {
  const xs = rows.map((x) => x[field]).filter(Number.isFinite);
  return {
    n: xs.length,
    mean_pct: round(mean(xs), 2),
    median_pct: round(median(xs), 2),
    negative_rate: xs.length ? round(xs.filter((x) => x < 0).length / xs.length, 3) : null,
    decline_5pct_rate: xs.length ? round(xs.filter((x) => x <= -5).length / xs.length, 3) : null,
  };
}
function aggregate(rows) {
  const out = { observations: rows.length, horizons: {} };
  for (const h of horizons) out.horizons[`${h}d`] = summarize(rows, `return_${h}d_pct`);
  return out;
}
function edge(signal, baseline) {
  const out = {};
  for (const h of horizons) {
    const k = `${h}d`; const s = signal.horizons[k]; const b = baseline.horizons[k];
    out[k] = {
      mean_return_edge_pp: s.mean_pct === null || b.mean_pct === null ? null : round(s.mean_pct - b.mean_pct, 2),
      negative_rate_edge: s.negative_rate === null || b.negative_rate === null ? null : round(s.negative_rate - b.negative_rate, 3),
    };
  }
  return out;
}
function buildEvents(rows, scoreField) {
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const curr = rows[i]; const prev = rows[i - 1];
    const level = rawLevel(curr[scoreField]); const prevLevel = prev ? rawLevel(prev[scoreField]) : 'watch';
    const orangeEntry = rank[level] >= 2 && rank[prevLevel] < 2;
    const redEscalation = level === 'red' && prevLevel !== 'red';
    if (orangeEntry || redEscalation) out.push({ ...curr, variant_level: level, event_type: redEscalation ? 'red_escalation' : 'orange_entry' });
  }
  return out;
}
function classifyEvent(e) {
  const available = horizons.map((h) => e[`return_${h}d_pct`]).filter(Number.isFinite);
  if (!available.length) return 'insufficient_followup';
  const r5 = e.return_5d_pct;
  const longest = available[available.length - 1];
  const negatives = available.filter((x) => x < 0).length;
  if (negatives >= 2 && longest <= 0) return 'sustained_distribution';
  if (Number.isFinite(r5) && r5 < 0 && longest > 0) return 'temporary_pressure';
  if (Number.isFinite(r5) && r5 >= 0 && longest > 0) return 'false_positive';
  if (Number.isFinite(r5) && r5 >= 0 && longest <= 0) return 'late_weakness';
  return 'mixed';
}
function runScore(stock) {
  fs.mkdirSync(tempRoot, { recursive: true });
  const file = path.join(tempRoot, `${stock}.json`);
  execFileSync(process.execPath, ['scripts/build_institutional_distribution_score.js', '--stock', stock, '--start', start, '--end', end, '--tdcc-mode', 'historical', '--output', file], { stdio: ['ignore', 'pipe', 'inherit'] });
  return readJson(file);
}
function indicatorScores(row) {
  const broker = row.evidence.broker; const tdcc = row.evidence.tdcc;
  const dailyBreadth = broker.daily_negative_breadth >= 8 ? 1 : 0;
  const dailyNet = broker.daily_negative_net <= -6000 ? 1 : 0;
  const persistentSellers = broker.persistent_5d_sellers >= 5 ? 1 : 0;
  const persistentNet = broker.persistent_5d_net <= -8000 ? 1 : 0;
  return {
    broker_score: broker.score,
    tdcc_score: tdcc.score,
    daily_breadth_score: dailyBreadth,
    daily_net_score: dailyNet,
    persistent_sellers_score: persistentSellers,
    persistent_net_score: persistentNet,
  };
}
function main() {
  const allRows = []; const baselineRows = [];
  for (const stock of stocks) {
    const score = runScore(stock); const prices = loadPrices(stock);
    for (const row of score.timeline) {
      const factors = indicatorScores(row);
      const decorated = {
        stock,
        observed_date: row.observed_date,
        full_score: row.score,
        ...factors,
        without_tdcc_score: factors.broker_score,
        without_broker_score: factors.tdcc_score,
        without_daily_breadth_score: row.score - factors.daily_breadth_score,
        without_daily_net_score: row.score - factors.daily_net_score,
        without_persistent_sellers_score: row.score - factors.persistent_sellers_score,
        without_persistent_net_score: row.score - factors.persistent_net_score,
        broker_reasons: row.evidence.broker.reasons,
        tdcc_reasons: row.evidence.tdcc.reasons,
        broker_metrics: {
          daily_negative_breadth: row.evidence.broker.daily_negative_breadth,
          daily_negative_net: row.evidence.broker.daily_negative_net,
          persistent_5d_sellers: row.evidence.broker.persistent_5d_sellers,
          persistent_5d_net: row.evidence.broker.persistent_5d_net,
        },
        tdcc_metrics: {
          large_change_pp: row.evidence.tdcc.large_change_pp,
          small_change_pp: row.evidence.tdcc.small_change_pp,
        },
      };
      for (const h of horizons) decorated[`return_${h}d_pct`] = forwardReturn(prices, row.observed_date, h);
      decorated.path_20d = pathExcursion(prices, row.observed_date, 20);
      allRows.push(decorated); baselineRows.push(decorated);
    }
  }
  const variants = {
    full: 'full_score',
    broker_only: 'without_tdcc_score',
    tdcc_only: 'without_broker_score',
    without_daily_breadth: 'without_daily_breadth_score',
    without_daily_net: 'without_daily_net_score',
    without_persistent_sellers: 'without_persistent_sellers_score',
    without_persistent_net: 'without_persistent_net_score',
  };
  const baseline = aggregate(baselineRows);
  const variantResults = {};
  let fullEvents = [];
  for (const [name, field] of Object.entries(variants)) {
    const events = [];
    for (const stock of stocks) {
      const rows = allRows.filter((x) => x.stock === stock).sort((a, b) => a.observed_date.localeCompare(b.observed_date));
      events.push(...buildEvents(rows, field));
    }
    const stats = aggregate(events);
    variantResults[name] = { score_field: field, events: events.length, stats, edge_vs_baseline: edge(stats, baseline) };
    if (name === 'full') fullEvents = events;
  }
  const eventDetails = fullEvents.map((e) => ({
    stock: e.stock,
    observed_date: e.observed_date,
    event_type: e.event_type,
    full_score: e.full_score,
    variant_level: e.variant_level,
    broker_score: e.broker_score,
    tdcc_score: e.tdcc_score,
    broker_reasons: e.broker_reasons,
    tdcc_reasons: e.tdcc_reasons,
    broker_metrics: e.broker_metrics,
    tdcc_metrics: e.tdcc_metrics,
    return_5d_pct: e.return_5d_pct,
    return_10d_pct: e.return_10d_pct,
    return_20d_pct: e.return_20d_pct,
    path_20d: e.path_20d,
    classification: classifyEvent(e),
  }));
  const classifications = {};
  for (const e of eventDetails) classifications[e.classification] = (classifications[e.classification] || 0) + 1;
  const componentPresence = {
    events: eventDetails.length,
    broker_contributed: eventDetails.filter((e) => e.broker_score > 0).length,
    tdcc_contributed: eventDetails.filter((e) => e.tdcc_score > 0).length,
    both_contributed: eventDetails.filter((e) => e.broker_score > 0 && e.tdcc_score > 0).length,
    broker_only_at_event: eventDetails.filter((e) => e.broker_score >= 5 && e.tdcc_score === 0).length,
    tdcc_only_at_event: eventDetails.filter((e) => e.tdcc_score >= 5 && e.broker_score === 0).length,
  };
  const payload = {
    schema_version: 1,
    methodology: 'institutional-distribution-event-diagnostics-v1',
    research_only: true,
    production_safe: false,
    universe: stocks,
    range: { start, end },
    scope_note: 'Current score v4 contains Broker + TDCC only. Foreign flow is not included in this attribution and must not be implied.',
    classification_policy: {
      sustained_distribution: 'At least two available forward horizons are negative and the longest available horizon is non-positive.',
      temporary_pressure: '5D is negative but the longest available horizon is positive.',
      false_positive: '5D is non-negative and the longest available horizon is positive.',
      late_weakness: '5D is non-negative but the longest available horizon is non-positive.',
      insufficient_followup: 'No forward-return horizon is available.',
    },
    baseline,
    component_presence_at_full_events: componentPresence,
    classifications,
    variants: variantResults,
    events: eventDetails,
    generated_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ events: eventDetails.length, classifications, componentPresence, variants: Object.fromEntries(Object.entries(variantResults).map(([k, v]) => [k, { events: v.events, edge_5d_pp: v.edge_vs_baseline['5d'].mean_return_edge_pp, edge_10d_pp: v.edge_vs_baseline['10d'].mean_return_edge_pp, edge_20d_pp: v.edge_vs_baseline['20d'].mean_return_edge_pp }])) }, null, 2));
}

main();
