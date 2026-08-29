#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const matrixFile = getArg('matrix', path.join('data_research', 'institutional-flow', 'backtests', 'institutional-withdrawal-v5-feature-matrix.json'));
const output = getArg('output', path.join('data_research', 'institutional-flow', 'backtests', 'institutional-withdrawal-v5-analysis.json'));
const report = getArg('report', path.join('data_research', 'institutional-flow', 'backtests', 'institutional-withdrawal-v5-analysis.md'));
const p = JSON.parse(fs.readFileSync(matrixFile, 'utf8'));
const horizons = [5, 10, 20];
const round = (v, d = 4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const median = (xs) => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

function stats(rows) {
  const out = { observations: rows.length, horizons: {} };
  for (const h of horizons) {
    const xs = rows.map((r) => r.outcome?.[`return_${h}d_pct`]).filter(Number.isFinite);
    out.horizons[`${h}d`] = {
      n: xs.length,
      mean_pct: round(mean(xs), 2),
      median_pct: round(median(xs), 2),
      negative_rate: xs.length ? round(xs.filter((x) => x < 0).length / xs.length, 3) : null,
      decline_5pct_rate: xs.length ? round(xs.filter((x) => x <= -5).length / xs.length, 3) : null,
    };
  }
  return out;
}
function edges(a, b) {
  const out = {};
  for (const h of horizons) {
    const k = `${h}d`; const x = a.horizons[k]; const y = b.horizons[k];
    out[k] = {
      mean_return_edge_pp: Number.isFinite(x.mean_pct) && Number.isFinite(y.mean_pct) ? round(x.mean_pct - y.mean_pct, 2) : null,
      negative_rate_edge: Number.isFinite(x.negative_rate) && Number.isFinite(y.negative_rate) ? round(x.negative_rate - y.negative_rate, 3) : null,
      decline_5pct_rate_edge: Number.isFinite(x.decline_5pct_rate) && Number.isFinite(y.decline_5pct_rate) ? round(x.decline_5pct_rate - y.decline_5pct_rate, 3) : null,
    };
  }
  return out;
}
function selected(rows, predicate) { return rows.filter(predicate); }
function eventRefs(rows) { return rows.map((r) => ({ stock: r.stock, tdcc_observed_date: r.tdcc_observed_date, market_feature_date: r.market_feature_date, outcome: r.outcome })); }
function variant(rows, predicate, baseline, pressureStats) {
  const picked = selected(rows, predicate); const s = stats(picked);
  return { observations: picked.length, stats: s, edge_vs_all_eligible: edges(s, baseline), edge_vs_pressure: edges(s, pressureStats), selected: eventRefs(picked) };
}
function countOutsideTdcc(stock, start, end) {
  const root = path.join('data_tdcc_shareholding', 'history', stock);
  if (!fs.existsSync(root)) return { before: 0, after: 0 };
  const dates = fs.readdirSync(root).filter((n) => /^\d{8}\.json$/.test(n)).map((n) => `${n.slice(0,4)}-${n.slice(4,6)}-${n.slice(6,8)}`);
  return { before: dates.filter((d) => d < start).length, after: dates.filter((d) => d > end).length };
}

const rows = p.rows.filter((r) => r.analysis_eligible);
const baseline = stats(rows);
const pressurePredicate = (r) => r.confirmations.pressure_baseline;
const pressureRows = selected(rows, pressurePredicate);
const pressureStats = stats(pressureRows);

const predicates = {
  v4_like_orange: (r) => Number(r.broker?.score) + Number(r.tdcc?.v4_score) >= 5,
  broker_tdcc_pressure: pressurePredicate,
  pressure_plus_foreign: (r) => r.confirmations.pressure_plus_foreign,
  pressure_plus_tdcc_persistence: (r) => r.confirmations.pressure_plus_tdcc_persistence,
  pressure_plus_price_volume: (r) => r.confirmations.pressure_plus_price_volume,
  pressure_plus_two_independent: (r) => r.confirmations.pressure_plus_two_independent,
  pressure_plus_all_three: (r) => r.confirmations.pressure_plus_all_three,
};
const variants = {};
for (const [name, pred] of Object.entries(predicates)) variants[name] = variant(rows, pred, baseline, pressureStats);

const factorScreens = {
  foreign_confirm_within_pressure: variant(pressureRows, (r) => r.confirmations.foreign_confirm, pressureStats, pressureStats),
  tdcc_persistence_within_pressure: variant(pressureRows, (r) => r.confirmations.tdcc_persistence_confirm, pressureStats, pressureStats),
  price_volume_within_pressure: variant(pressureRows, (r) => r.confirmations.price_volume_confirm, pressureStats, pressureStats),
};

const outside = Object.fromEntries(p.universe.map((s) => [s, countOutsideTdcc(s, p.range.start, p.range.end)]));
const minBefore = Math.min(...Object.values(outside).map((x) => x.before));
const minAfter = Math.min(...Object.values(outside).map((x) => x.after));
const validationReady = minBefore >= 10 || minAfter >= 10;

const sortable = Object.entries(variants)
  .filter(([name, v]) => name !== 'broker_tdcc_pressure' && v.stats.horizons['10d'].n >= 3)
  .map(([name, v]) => ({ name, n10: v.stats.horizons['10d'].n, edge10: v.edge_vs_pressure['10d'].mean_return_edge_pp, neg10: v.edge_vs_pressure['10d'].negative_rate_edge, n20: v.stats.horizons['20d'].n, edge20: v.edge_vs_pressure['20d'].mean_return_edge_pp }))
  .sort((a, b) => (a.edge10 ?? Infinity) - (b.edge10 ?? Infinity));

const payload = {
  schema_version: 1,
  methodology: 'institutional-withdrawal-v5-combination-study-v1',
  research_only: true,
  production_safe: false,
  universe: p.universe,
  range: p.range,
  eligible_rows: rows.length,
  baseline,
  pressure_baseline: pressureStats,
  variants,
  factor_screens: factorScreens,
  candidate_ranking_descriptive_only: sortable,
  untouched_validation: {
    ready: validationReady,
    policy: 'Development outcomes were already inspected. Production promotion requires a separate untouched or walk-forward sample with adequate follow-up; outside-development TDCC coverage is reported here only as a readiness audit.',
    outside_development_tdcc_observations: outside,
    minimum_before_per_stock: minBefore,
    minimum_after_per_stock: minAfter,
  },
  interpretation_guardrails: [
    'More-negative return edge and higher negative/decline rates are favorable for a bearish withdrawal hypothesis.',
    'Small-n combinations are descriptive only and must not be selected as production thresholds.',
    'Broker branches cannot identify beneficial owners.',
    'Historical TDCC availability is association-only because original publication timestamps are unknown.',
  ],
  generated_at: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);

const lines = [];
lines.push('# Institutional Withdrawal v5 Analysis');
lines.push('');
lines.push(`- Eligible TDCC-anchored rows: **${rows.length}** / ${p.counts.anchors}`);
lines.push(`- Broker+TDCC pressure rows: **${pressureRows.length}**`);
lines.push(`- Untouched validation ready from currently archived TDCC history: **${validationReady ? 'yes' : 'no'}**`);
lines.push('');
lines.push('## Combination results');
lines.push('');
lines.push('| Variant | Obs | 5D n / mean | 10D n / mean | 20D n / mean | 10D edge vs pressure |');
lines.push('|---|---:|---:|---:|---:|---:|');
for (const [name, v] of Object.entries(variants)) {
  const h5=v.stats.horizons['5d'], h10=v.stats.horizons['10d'], h20=v.stats.horizons['20d'];
  lines.push(`| ${name} | ${v.observations} | ${h5.n} / ${h5.mean_pct ?? 'n/a'}% | ${h10.n} / ${h10.mean_pct ?? 'n/a'}% | ${h20.n} / ${h20.mean_pct ?? 'n/a'}% | ${v.edge_vs_pressure['10d'].mean_return_edge_pp ?? 'n/a'}pp |`);
}
lines.push('');
lines.push('## Research interpretation');
lines.push('');
lines.push('- This table is a **development-sample diagnostic**, not a production scorecard.');
lines.push('- Candidate confirmation families are pre-registered in `data_research/institutional-flow/v5-research-spec.md`; outcomes are kept in a separate matrix object and do not construct features.');
lines.push('- A combination with very few observations is not considered validated even if its average return looks strongly bearish.');
lines.push('- v4 remains a distribution-pressure alert until a candidate survives untouched/walk-forward validation.');
lines.push('');
lines.push('## Untouched validation readiness');
lines.push('');
lines.push(`Minimum archived official TDCC observations before the development range per stock: **${minBefore}**.`);
lines.push(`Minimum archived official TDCC observations after the development range per stock: **${minAfter}**.`);
lines.push('');
lines.push(validationReady ? 'An outside-development TDCC window exists, but it still requires matching broker/foreign/OHLCV coverage and sufficient future outcomes before validation can be run.' : 'Current archived TDCC history does not yet provide a sufficiently broad untouched window for all six stocks. Do not promote any v5 candidate from this development study.');
fs.writeFileSync(report, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ eligible_rows: rows.length, pressure_rows: pressureRows.length, variants: Object.fromEntries(Object.entries(variants).map(([k,v])=>[k,{obs:v.observations, h10:v.stats.horizons['10d'], edge10:v.edge_vs_pressure['10d']}])) , untouched_validation: payload.untouched_validation }, null, 2));
