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
const output = getArg('output', path.join('data_research', 'institutional-flow', 'backtests', 'official-historical-universe.json'));
const tempRoot = getArg('temp-root', path.join('/tmp', 'institutional-distribution-universe'));
const horizons = [5, 10, 20];
const levelRank = { watch: 0, yellow: 1, orange: 2, red: 3 };
const round = (v, n = 4) => (Number.isFinite(v) ? Number(v.toFixed(n)) : null);
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function normalizeDate(s) { return String(s).replaceAll('/', '-'); }
function loadPrices(stock) {
  const file = path.join('data_history_sma', `${stock}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing SMA price history for ${stock}`);
  const p = readJson(file);
  return Object.entries(p)
    .map(([date, row]) => ({ date: normalizeDate(date), price: Number(row.price) }))
    .filter((x) => /^20\d{2}-\d{2}-\d{2}$/.test(x.date) && Number.isFinite(x.price) && x.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
function forwardReturn(prices, date, horizon) {
  const i = prices.findIndex((x) => x.date === date);
  if (i < 0 || i + horizon >= prices.length) return null;
  return round((prices[i + horizon].price / prices[i].price - 1) * 100, 2);
}
function buildEvents(timeline) {
  const events = [];
  for (let i = 0; i < timeline.length; i += 1) {
    const curr = timeline[i];
    const prev = timeline[i - 1];
    const currRank = levelRank[curr.raw_level] ?? 0;
    const prevRank = prev ? (levelRank[prev.raw_level] ?? 0) : 0;
    const orangeEntry = currRank >= 2 && prevRank < 2;
    const redEscalation = currRank === 3 && prevRank < 3;
    if (orangeEntry || redEscalation) events.push({ ...curr, event_type: redEscalation ? 'red_escalation' : 'orange_entry' });
  }
  return events;
}
function summarizeReturns(rows, field) {
  const values = rows.map((x) => x[field]).filter(Number.isFinite);
  return {
    n: values.length,
    mean_pct: round(mean(values), 2),
    median_pct: round(median(values), 2),
    negative_rate: values.length ? round(values.filter((x) => x < 0).length / values.length, 3) : null,
    decline_5pct_rate: values.length ? round(values.filter((x) => x <= -5).length / values.length, 3) : null,
  };
}
function evaluateTimeline(stock, scorePayload) {
  const prices = loadPrices(stock);
  const decorate = (row) => {
    const out = { stock, observed_date: row.observed_date, score: row.score, raw_level: row.raw_level, level: row.level };
    for (const h of horizons) out[`return_${h}d_pct`] = forwardReturn(prices, row.observed_date, h);
    return out;
  };
  const events = buildEvents(scorePayload.timeline).map((x) => ({ ...decorate(x), event_type: x.event_type }));
  const baseline = scorePayload.timeline.map(decorate);
  return { events, baseline };
}
function aggregate(rows) {
  const out = { observations: rows.length, horizons: {} };
  for (const h of horizons) out.horizons[`${h}d`] = summarizeReturns(rows, `return_${h}d_pct`);
  return out;
}
function edge(signalStats, baselineStats) {
  const out = {};
  for (const h of horizons) {
    const key = `${h}d`; const s = signalStats.horizons[key]; const b = baselineStats.horizons[key];
    out[key] = {
      mean_return_edge_pp: s.mean_pct === null || b.mean_pct === null ? null : round(s.mean_pct - b.mean_pct, 2),
      negative_rate_edge: s.negative_rate === null || b.negative_rate === null ? null : round(s.negative_rate - b.negative_rate, 3),
      interpretation: 'More-negative mean return and higher negative-rate are favorable for a bearish distribution signal.',
    };
  }
  return out;
}
function runScore(stock) {
  fs.mkdirSync(tempRoot, { recursive: true });
  const out = path.join(tempRoot, `${stock}.json`);
  execFileSync(process.execPath, [
    'scripts/build_institutional_distribution_score.js', '--stock', stock, '--start', start, '--end', end,
    '--tdcc-mode', 'historical', '--output', out,
  ], { stdio: ['ignore', 'pipe', 'inherit'] });
  return readJson(out);
}
function main() {
  const perStock = []; const allEvents = []; const allBaseline = []; const skipped = [];
  for (const stock of stocks) {
    try {
      const score = runScore(stock);
      const { events, baseline } = evaluateTimeline(stock, score);
      allEvents.push(...events); allBaseline.push(...baseline);
      perStock.push({ stock, tdcc_observations: score.timeline.length, events: events.length, event_stats: aggregate(events), baseline_stats: aggregate(baseline) });
    } catch (error) {
      skipped.push({ stock, reason: error.message });
    }
  }
  const eventStats = aggregate(allEvents); const baselineStats = aggregate(allBaseline);
  const payload = {
    schema_version: 1,
    methodology: 'institutional-distribution-multistock-association-backtest-v1',
    research_only: true,
    production_safe: false,
    universe_policy: 'fixed liquid electronics validation universe chosen before outcome evaluation',
    universe: stocks,
    range: { start, end },
    no_lookahead_warning: 'Historical TDCC publication timestamps are unavailable. This backtest measures evidence-date association only and must not be interpreted as executable historical trading performance.',
    event_definition: 'New raw Orange-or-higher threshold entry, plus Red escalation when the prior raw level was below Red.',
    outcome_definition: 'Close-to-close forward return from TDCC observed_date over 5/10/20 trading sessions using data_history_sma.',
    bearish_success_direction: 'Negative forward returns are favorable to the distribution hypothesis.',
    stocks_completed: perStock.length,
    stocks_skipped: skipped,
    per_stock: perStock,
    aggregate: { events: eventStats, baseline: baselineStats, edge_vs_baseline: edge(eventStats, baselineStats) },
    events: allEvents,
    generated_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ stocks_completed: payload.stocks_completed, skipped, events: allEvents.length, aggregate: payload.aggregate }, null, 2));
  if (perStock.length < 3) process.exitCode = 2;
}

if (require.main === module) main();
module.exports = { forwardReturn, buildEvents, summarizeReturns, aggregate, edge };
