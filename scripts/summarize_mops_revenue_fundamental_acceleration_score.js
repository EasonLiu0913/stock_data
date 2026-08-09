#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const OUTPUT = path.join(SIGNAL_ROOT, 'fundamental-acceleration-score-experiment.json');
const COMPACT_OUTPUT = path.join(SIGNAL_ROOT, 'fundamental-acceleration-score-summary.json');
const HORIZONS = ['d1', 'd3', 'd5', 'd10', 'd20'];

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function parseArgs(argv) { const out = new Map(); for (let i = 0; i < argv.length; i += 1) { if (!argv[i].startsWith('--')) continue; out.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true); } return out; }
function prevMonth(month, n = 1) { let y = Number(month.slice(0, 4)); let m = Number(month.slice(4, 6)); for (let i = 0; i < n; i += 1) { m -= 1; if (m === 0) { m = 12; y -= 1; } } return `${y}${String(m).padStart(2, '0')}`; }
function revenueHigh(stockMap, month, lookback) { const values = []; for (let i = 0; i < lookback; i += 1) { const row = stockMap?.get(prevMonth(month, i)); const value = Number(row?.monthly_revenue_thousand_twd); if (!Number.isFinite(value)) return false; values.push(value); } return values[0] === Math.max(...values); }
function loadRevenueHistory() { const byStock = new Map(); if (!fs.existsSync(REVENUE_ROOT)) return byStock; const months = fs.readdirSync(REVENUE_ROOT, { withFileTypes: true }).filter(e => e.isDirectory() && /^20\d{4}$/.test(e.name)).map(e => e.name).sort(); for (const month of months) { const payload = readJson(path.join(REVENUE_ROOT, month, 'monthly_revenue.json'), {}); for (const row of payload.companies || []) { const code = String(row.stock_code); if (!byStock.has(code)) byStock.set(code, new Map()); byStock.get(code).set(month, row); } } return byStock; }
function loadStudyMonths(start, end) { return fs.readdirSync(SIGNAL_ROOT).filter(name => /^20\d{4}\.json$/.test(name)).map(name => name.slice(0, 6)).filter(month => (!start || month >= start) && (!end || month <= end)).sort().map(month => ({ month, payload: readJson(path.join(SIGNAL_ROOT, `${month}.json`), {}) })); }

function scoreComponents(event, month, stockMap) {
  const yoy = Number(event.factors?.yoy_pct);
  const mom = Number(event.factors?.mom_pct);
  const acceleration = Number(event.factors?.yoy_acceleration_pct_points);
  let yoyScore = 0;
  if (yoy >= 20) yoyScore = 1;
  if (yoy >= 40) yoyScore = 2;
  if (yoy >= 70) yoyScore = 3;
  if (yoy >= 100) yoyScore = 4;
  let momScore = 0;
  if (mom > 0) momScore = 1;
  if (mom >= 10) momScore = 2;
  if (mom >= 30) momScore = 3;
  let accelerationScore = 0;
  if (acceleration > 0) accelerationScore = 1;
  if (acceleration >= 10) accelerationScore = 2;
  if (acceleration >= 20) accelerationScore = 3;
  let highScore = 0;
  if (revenueHigh(stockMap, month, 3)) highScore = 1;
  if (revenueHigh(stockMap, month, 6)) highScore = 2;
  if (revenueHigh(stockMap, month, 12)) highScore = 3;
  const persistenceScore = Number(event.factors?.yoy_pct) >= 20 && Number(event.factors?.previous_month_yoy_pct) >= 20 ? 1 : 0;
  const total = yoyScore + momScore + accelerationScore + highScore + persistenceScore;
  return { yoy_score: yoyScore, mom_score: momScore, acceleration_score: accelerationScore, revenue_high_score: highScore, persistence_score: persistenceScore, total_score: total };
}

function mean(values) { const v = values.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
function round(value, digits = 4) { return Number.isFinite(value) ? Number(value.toFixed(digits)) : null; }
function summarizeBucket(study, minScore, horizon) {
  const rows = [];
  const monthly = [];
  for (const { month, events } of study) {
    const universe = events.filter(e => e.returns?.[horizon]?.status === 'complete');
    const selected = universe.filter(e => e._fas.total_score >= minScore);
    if (!selected.length) continue;
    const sr = selected.map(e => e.returns[horizon]);
    const ur = universe.map(e => e.returns[horizon]);
    const win = sr.filter(r => r.outperformed_market === true).length / sr.length * 100;
    const uwin = ur.filter(r => r.outperformed_market === true).length / ur.length * 100;
    const ex = mean(sr.map(r => Number(r.excess_return_pct)));
    const uex = mean(ur.map(r => Number(r.excess_return_pct)));
    monthly.push({ month, samples: sr.length, relative_win_rate: round(win), universe_relative_win_rate: round(uwin), relative_win_rate_uplift_pp: round(win - uwin), avg_excess_return_pct: round(ex), universe_avg_excess_return_pct: round(uex), avg_excess_uplift_pct: round(ex - uex) });
    rows.push(...sr.map(r => ({ ...r, _uWin: uwin, _uEx: uex })));
  }
  if (!rows.length) return { min_score: minScore, horizon, samples: 0, covered_months: 0 };
  const n = rows.length;
  const win = rows.filter(r => r.outperformed_market === true).length / n * 100;
  const ex = mean(rows.map(r => Number(r.excess_return_pct)));
  const uwin = rows.reduce((s, r) => s + r._uWin, 0) / n;
  const uex = rows.reduce((s, r) => s + r._uEx, 0) / n;
  const posWin = monthly.filter(m => m.relative_win_rate_uplift_pp > 0).length / monthly.length * 100;
  const posEx = monthly.filter(m => m.avg_excess_uplift_pct > 0).length / monthly.length * 100;
  return { min_score: minScore, horizon, samples: n, covered_months: monthly.length, relative_win_rate: round(win), universe_relative_win_rate: round(uwin), relative_win_rate_uplift_pp: round(win - uwin), avg_excess_return_pct: round(ex), universe_avg_excess_return_pct: round(uex), avg_excess_uplift_pct: round(ex - uex), positive_win_uplift_month_rate: round(posWin), positive_excess_uplift_month_rate: round(posEx), stability_score: round((posWin + posEx) / 2), monthly };
}

function compactRow(row) {
  return {
    min_score: row.min_score,
    horizon: row.horizon,
    samples: row.samples,
    covered_months: row.covered_months,
    relative_win_rate: row.relative_win_rate,
    universe_relative_win_rate: row.universe_relative_win_rate,
    relative_win_rate_uplift_pp: row.relative_win_rate_uplift_pp,
    avg_excess_return_pct: row.avg_excess_return_pct,
    universe_avg_excess_return_pct: row.universe_avg_excess_return_pct,
    avg_excess_uplift_pct: row.avg_excess_uplift_pct,
    positive_win_uplift_month_rate: row.positive_win_uplift_month_rate,
    positive_excess_uplift_month_rate: row.positive_excess_uplift_month_rate,
    stability_score: row.stability_score,
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv); const start = args.get('start-month') || null; const end = args.get('end-month') || null;
  const history = loadRevenueHistory();
  const study = loadStudyMonths(start, end).map(({ month, payload }) => ({ month, events: (payload.events || []).map(event => ({ ...event, _fas: scoreComponents(event, month, history.get(String(event.stock_code))) })) }));
  if (!study.length) throw new Error('No study months found');
  const thresholds = [3,4,5,6,7,8,9,10,11,12];
  const rankings = HORIZONS.flatMap(h => thresholds.map(score => summarizeBucket(study, score, h)));
  const methodology = { status: 'research_only', baseline: 'same-month listed-stock universe', purpose: 'replace brittle all-AND thresholds with an interpretable revenue momentum score', scoring: { yoy_score: '0..4 for YoY <20, >=20, >=40, >=70, >=100', mom_score: '0..3 for MoM <=0, >0, >=10, >=30', acceleration_score: '0..3 for YoY acceleration <=0, >0, >=10pp, >=20pp', revenue_high_score: '0..3 for no high, 3m, 6m, 12m high', persistence_score: '1 when current and previous month YoY are both >=20%' }, maximum_score: 14, caution: 'research score only; weights are heuristic and must be validated before any production use' };
  const generatedAt = new Date().toISOString();
  const output = { schema_version: 1, dataset: 'mops_monthly_revenue_fundamental_acceleration_score_experiment', generated_at: generatedAt, start_month: study[0].month, end_month: study.at(-1).month, methodology, thresholds, horizons: HORIZONS, rankings };
  const compact = { schema_version: 1, dataset: 'mops_monthly_revenue_fundamental_acceleration_score_summary', generated_at: generatedAt, start_month: study[0].month, end_month: study.at(-1).month, thresholds, horizons: HORIZONS, rankings: rankings.map(compactRow) };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  fs.writeFileSync(COMPACT_OUTPUT, `${JSON.stringify(compact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), compact_output: path.relative(ROOT, COMPACT_OUTPUT), rows: rankings.length }, null, 2));
}

if (require.main === module) { try { main(); } catch (e) { console.error(e.stack || e.message); process.exitCode = 1; } }
module.exports = { scoreComponents, summarizeBucket, revenueHigh, prevMonth, compactRow };
