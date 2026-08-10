#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-experiment.json');
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-summary.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function compactRanking(row) {
  const out = { ...row };
  delete out.monthly;
  return out;
}

function rankingSort(a, b) {
  const aEx = Number(a.avg_excess_uplift_pct ?? -Infinity);
  const bEx = Number(b.avg_excess_uplift_pct ?? -Infinity);
  if (bEx !== aEx) return bEx - aEx;
  const aWin = Number(a.relative_win_rate_uplift_pp ?? -Infinity);
  const bWin = Number(b.relative_win_rate_uplift_pp ?? -Infinity);
  if (bWin !== aWin) return bWin - aWin;
  return Number(b.samples || 0) - Number(a.samples || 0);
}

function main() {
  const input = readJson(INPUT);
  const rankings = (input.rankings || []).map(compactRanking);
  if (!rankings.length) throw new Error('two-stage experiment has zero rankings');

  const byHorizon = {};
  for (const horizon of input.horizons || []) {
    byHorizon[horizon] = rankings.filter(row => row.horizon === horizon).sort(rankingSort);
  }

  const focus = ['d10', 'd20'].flatMap(horizon => (byHorizon[horizon] || []).map((row, index) => ({
    rank_within_horizon: index + 1,
    ...row,
  })));

  const output = {
    schema_version: 1,
    dataset: 'two_stage_fundamental_quality_summary',
    generated_at: new Date().toISOString(),
    source_dataset: input.dataset,
    start_month: input.start_month,
    end_month: input.end_month,
    methodology: input.methodology,
    coverage: input.coverage,
    factors: input.factors,
    horizons: input.horizons,
    rankings,
    focus_d10_d20: focus,
  };

  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT),
    rankings: rankings.length,
    focus_rows: focus.length,
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { compactRanking, rankingSort };
