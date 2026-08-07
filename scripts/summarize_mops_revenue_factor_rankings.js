#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const OUTPUT = path.join(SIGNAL_ROOT, 'factor-rankings.json');
const HORIZONS = ['d1', 'd3', 'd5', 'd10', 'd20'];
const FACTORS = [
  { id: 'yoy_positive', name: 'YoY > 0', test: e => Number(e.factors?.yoy_pct) > 0 },
  { id: 'yoy_ge_10', name: 'YoY ≥ 10%', test: e => Number(e.factors?.yoy_pct) >= 10 },
  { id: 'yoy_ge_20', name: 'YoY ≥ 20%', test: e => Number(e.factors?.yoy_pct) >= 20 },
  { id: 'yoy_ge_30', name: 'YoY ≥ 30%', test: e => Number(e.factors?.yoy_pct) >= 30 },
  { id: 'mom_positive', name: 'MoM > 0', test: e => Number(e.factors?.mom_pct) > 0 },
  { id: 'yoy_mom_positive', name: 'YoY + MoM 同為正', test: e => e.factors?.yoy_and_mom_positive === true },
  { id: 'yoy_accelerating', name: 'YoY 加速', test: e => e.factors?.yoy_accelerating === true },
  { id: 'yoy_acceleration_ge_10', name: 'YoY 加速 ≥ 10pp', test: e => Number(e.factors?.yoy_acceleration_pct_points) >= 10 },
];

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function mean(values) {
  const xs = values.filter(Number.isFinite);
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}
function median(values) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}
function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}
function parseArgs(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    map.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
  }
  return map;
}
function loadMonths(startMonth, endMonth) {
  const files = fs.readdirSync(SIGNAL_ROOT)
    .filter(name => /^20\d{4}\.json$/.test(name))
    .map(name => name.replace('.json', ''))
    .filter(month => (!startMonth || month >= startMonth) && (!endMonth || month <= endMonth))
    .sort();
  return files.map(month => ({ month, payload: readJson(path.join(SIGNAL_ROOT, `${month}.json`), {}) }));
}
function summarizeFactor(months, factor, horizon) {
  const all = [];
  const monthly = [];
  for (const { month, payload } of months) {
    const rows = (payload.events || []).filter(event => factor.test(event) && event.returns?.[horizon]?.status === 'complete');
    const results = rows.map(event => event.returns[horizon]);
    const excess = results.map(r => Number(r.excess_return_pct)).filter(Number.isFinite);
    const relativeWins = results.filter(r => r.outperformed_market === true).length;
    const absoluteWins = results.filter(r => r.stock_positive === true).length;
    if (rows.length) {
      monthly.push({
        month,
        samples: rows.length,
        relative_win_rate: round(relativeWins / rows.length * 100),
        avg_excess_return_pct: round(mean(excess)),
        median_excess_return_pct: round(median(excess)),
      });
      all.push(...results);
    }
  }
  const sampleCount = all.length;
  const excess = all.map(r => Number(r.excess_return_pct)).filter(Number.isFinite);
  const relativeWinRate = sampleCount ? all.filter(r => r.outperformed_market === true).length / sampleCount * 100 : null;
  const absoluteWinRate = sampleCount ? all.filter(r => r.stock_positive === true).length / sampleCount * 100 : null;
  const positiveMonths = monthly.filter(row => Number(row.avg_excess_return_pct) > 0).length;
  const outperformMonths = monthly.filter(row => Number(row.relative_win_rate) > 50).length;
  const coveredMonths = monthly.length;
  const stability = coveredMonths ? (positiveMonths / coveredMonths + outperformMonths / coveredMonths) / 2 * 100 : null;
  const sampleScore = Math.min(100, Math.log10(Math.max(sampleCount, 1)) / 3 * 100);
  const winScore = Number.isFinite(relativeWinRate) ? Math.max(0, Math.min(100, relativeWinRate)) : 0;
  const excessScore = Number.isFinite(mean(excess)) ? Math.max(0, Math.min(100, 50 + mean(excess) * 10)) : 0;
  const stabilityScore = Number.isFinite(stability) ? stability : 0;
  const rankingScore = sampleCount
    ? 0.35 * winScore + 0.30 * excessScore + 0.25 * stabilityScore + 0.10 * sampleScore
    : null;

  return {
    factor_id: factor.id,
    factor_name: factor.name,
    horizon,
    samples: sampleCount,
    covered_months: coveredMonths,
    relative_win_rate: round(relativeWinRate),
    absolute_win_rate: round(absoluteWinRate),
    avg_excess_return_pct: round(mean(excess)),
    median_excess_return_pct: round(median(excess)),
    positive_excess_month_rate: coveredMonths ? round(positiveMonths / coveredMonths * 100) : null,
    outperform_month_rate: coveredMonths ? round(outperformMonths / coveredMonths * 100) : null,
    stability_score: round(stability),
    ranking_score: round(rankingScore),
    monthly,
  };
}
function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const startMonth = args.get('start-month') || null;
  const endMonth = args.get('end-month') || null;
  const months = loadMonths(startMonth, endMonth);
  if (!months.length) throw new Error('No monthly signal files found');
  const rankings = HORIZONS.flatMap(horizon => FACTORS.map(factor => summarizeFactor(months, factor, horizon)));
  const payload = {
    schema_version: 1,
    dataset: 'mops_monthly_revenue_factor_rankings',
    generated_at: new Date().toISOString(),
    start_month: months[0].month,
    end_month: months[months.length - 1].month,
    methodology: {
      sample_rule: 'only status=complete observations are included',
      benchmark: 'TAIEX',
      ranking_score: '35% relative win rate + 30% average excess-return score + 25% cross-month stability + 10% sample-size score',
      caution: 'ranking_score is a research prioritization metric, not a production trading score',
    },
    horizons: HORIZONS,
    factors: FACTORS.map(({ id, name }) => ({ id, name })),
    rankings,
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), start_month: payload.start_month, end_month: payload.end_month, rows: rankings.length }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { FACTORS, HORIZONS, summarizeFactor };
