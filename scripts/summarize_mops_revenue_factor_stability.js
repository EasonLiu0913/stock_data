#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const INPUT = path.join(SIGNAL_ROOT, 'yoy20-subfactor-experiment.json');
const OUTPUT = path.join(SIGNAL_ROOT, 'factor-stability.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function mean(values) {
  const xs = values.filter(Number.isFinite);
  return xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : null;
}
function stddev(values) {
  const xs = values.filter(Number.isFinite);
  if (!xs.length) return null;
  const avg = mean(xs);
  return Math.sqrt(xs.reduce((sum, value) => sum + (value - avg) ** 2, 0) / xs.length);
}
function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
function summarizeRow(row) {
  const monthly = Array.isArray(row.monthly) ? row.monthly : [];
  const winUplifts = monthly.map(item => Number(item.relative_win_rate_uplift_pp)).filter(Number.isFinite);
  const excessUplifts = monthly.map(item => Number(item.avg_excess_uplift_pct)).filter(Number.isFinite);
  const sampleCounts = monthly.map(item => Number(item.samples)).filter(Number.isFinite);
  const avgWinUplift = mean(winUplifts);
  const avgExcessUplift = mean(excessUplifts);
  const winStd = stddev(winUplifts);
  const excessStd = stddev(excessUplifts);
  const positiveWinMonths = winUplifts.filter(value => value > 0).length;
  const positiveExcessMonths = excessUplifts.filter(value => value > 0).length;
  const worstWinUplift = winUplifts.length ? Math.min(...winUplifts) : null;
  const worstExcessUplift = excessUplifts.length ? Math.min(...excessUplifts) : null;
  const sampleEfficiency = Number(row.samples) > 0
    ? ((Number(row.relative_win_rate_uplift_pp) || 0) + (Number(row.avg_excess_uplift_pct) || 0) * 5) * Math.log10(Number(row.samples) + 1)
    : null;
  const consistency = monthly.length
    ? ((positiveWinMonths / monthly.length) + (positiveExcessMonths / monthly.length)) / 2 * 100
    : null;
  const volatilityPenalty = clamp((Number(winStd) || 0) * 5 + (Number(excessStd) || 0) * 20, 0, 100);
  const effectScore = clamp(50 + (Number(avgWinUplift) || 0) * 4 + (Number(avgExcessUplift) || 0) * 15, 0, 100);
  const sampleScore = clamp(Math.log10(Math.max(Number(row.samples) || 1, 1)) / 3 * 100, 0, 100);
  const stabilityScore = monthly.length
    ? clamp(0.45 * consistency + 0.35 * effectScore + 0.20 * sampleScore - 0.25 * volatilityPenalty, 0, 100)
    : null;

  return {
    factor_id: row.factor_id,
    factor_name: row.factor_name,
    horizon: row.horizon,
    samples: row.samples || 0,
    covered_months: monthly.length,
    aggregate_relative_win_rate_uplift_pp: row.relative_win_rate_uplift_pp ?? null,
    aggregate_avg_excess_uplift_pct: row.avg_excess_uplift_pct ?? null,
    avg_monthly_win_uplift_pp: round(avgWinUplift),
    avg_monthly_excess_uplift_pct: round(avgExcessUplift),
    win_uplift_stddev_pp: round(winStd),
    excess_uplift_stddev_pct: round(excessStd),
    positive_win_uplift_month_rate: monthly.length ? round(positiveWinMonths / monthly.length * 100) : null,
    positive_excess_uplift_month_rate: monthly.length ? round(positiveExcessMonths / monthly.length * 100) : null,
    worst_month_win_uplift_pp: round(worstWinUplift),
    worst_month_excess_uplift_pct: round(worstExcessUplift),
    sample_efficiency_score: round(sampleEfficiency),
    consistency_score: round(consistency),
    volatility_penalty: round(volatilityPenalty),
    stability_score: round(stabilityScore),
    monthly: monthly.map(item => ({
      month: item.month,
      samples: item.samples,
      relative_win_rate_uplift_pp: item.relative_win_rate_uplift_pp,
      avg_excess_uplift_pct: item.avg_excess_uplift_pct,
    })),
  };
}

function main() {
  const source = readJson(INPUT);
  const rows = (source.rankings || []).map(summarizeRow);
  const output = {
    schema_version: 1,
    dataset: 'mops_monthly_revenue_factor_stability',
    generated_at: new Date().toISOString(),
    start_month: source.start_month,
    end_month: source.end_month,
    methodology: {
      source: 'yoy20-subfactor-experiment.json',
      comparison: 'factor uplift versus same-month listed-stock universe',
      stability_score: '45% monthly consistency + 35% effect size + 20% sample score - 25% volatility penalty',
      caution: 'research stability metric only; not a production trading score',
    },
    horizons: source.horizons || [],
    factors: source.factors || [],
    rows,
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), rows: rows.length }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { mean, stddev, summarizeRow };
