#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const matrixFile = getArg('matrix', path.join('data_research', 'institutional-flow', 'backtests', 'institutional-withdrawal-v5-feature-matrix.json'));
const output = getArg('output', path.join('data_research', 'institutional-flow', 'backtests', 'institutional-withdrawal-v6-distribution-absorption.json'));
const report = getArg('report', path.join('data_research', 'institutional-flow', 'backtests', 'institutional-withdrawal-v6-distribution-absorption.md'));

const matrix = JSON.parse(fs.readFileSync(matrixFile, 'utf8'));
const horizons = [5, 10, 20];
const round = (v, d = 4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

function summarize(rows) {
  const out = { observations: rows.length, horizons: {}, path: {} };
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
  const dd = rows.map((r) => r.outcome?.max_drawdown_20d_pct).filter(Number.isFinite);
  const gain = rows.map((r) => r.outcome?.max_gain_20d_pct).filter(Number.isFinite);
  out.path = {
    drawdown_n: dd.length,
    mean_max_drawdown_20d_pct: round(mean(dd), 2),
    median_max_drawdown_20d_pct: round(median(dd), 2),
    drawdown_10pct_rate: dd.length ? round(dd.filter((x) => x <= -10).length / dd.length, 3) : null,
    gain_n: gain.length,
    mean_max_gain_20d_pct: round(mean(gain), 2),
    median_max_gain_20d_pct: round(median(gain), 2),
  };
  return out;
}

function edge(a, b) {
  const out = {};
  for (const h of horizons) {
    const k = `${h}d`;
    const x = a.horizons[k];
    const y = b.horizons[k];
    out[k] = {
      mean_return_edge_pp: Number.isFinite(x.mean_pct) && Number.isFinite(y.mean_pct) ? round(x.mean_pct - y.mean_pct, 2) : null,
      negative_rate_edge: Number.isFinite(x.negative_rate) && Number.isFinite(y.negative_rate) ? round(x.negative_rate - y.negative_rate, 3) : null,
      decline_5pct_rate_edge: Number.isFinite(x.decline_5pct_rate) && Number.isFinite(y.decline_5pct_rate) ? round(x.decline_5pct_rate - y.decline_5pct_rate, 3) : null,
    };
  }
  out.path = {
    mean_max_drawdown_edge_pp: Number.isFinite(a.path.mean_max_drawdown_20d_pct) && Number.isFinite(b.path.mean_max_drawdown_20d_pct)
      ? round(a.path.mean_max_drawdown_20d_pct - b.path.mean_max_drawdown_20d_pct, 2) : null,
    drawdown_10pct_rate_edge: Number.isFinite(a.path.drawdown_10pct_rate) && Number.isFinite(b.path.drawdown_10pct_rate)
      ? round(a.path.drawdown_10pct_rate - b.path.drawdown_10pct_rate, 3) : null,
  };
  return out;
}

function finite(v) { return Number.isFinite(Number(v)); }
function classify(row) {
  const t = row.tdcc || {};
  const b = row.broker || {};
  const pv = row.price_volume || {};
  const c = row.confirmations || {};

  const persistentTransfer = Boolean(
    Number(t.large_decline_streak) >= 2 &&
    Number(t.small_increase_streak) >= 2 &&
    finite(t.large_change_2obs_pp) && Number(t.large_change_2obs_pp) < 0 &&
    finite(t.small_change_2obs_pp) && Number(t.small_change_2obs_pp) > 0
  );
  const strongPersistentTransfer = Boolean(persistentTransfer && (
    Number(t.large_change_2obs_pp) <= -1 ||
    Number(t.small_change_2obs_pp) >= 1 ||
    Number(t.transfer_streak) >= 3
  ));
  const brokerPressure = Boolean(c.broker_pressure_confirm || Number(b.score) >= 3);
  const withdrawalPressure = Boolean(brokerPressure && persistentTransfer);

  const strongChecks = [
    Number(pv.absorption_days_10d) >= 2,
    Number(pv.distribution_days_10d) >= 2,
    Number(pv.volume_ratio_20d) >= 1,
    finite(pv.return_10d_pct) && Number(pv.return_10d_pct) >= -2,
    finite(pv.close_vs_prior_20d_high_pct) && Number(pv.close_vs_prior_20d_high_pct) >= -8,
  ];
  const weakChecks = [
    Number(pv.distribution_days_10d) >= 3,
    Number(pv.absorption_days_10d) <= 1,
    finite(pv.return_10d_pct) && Number(pv.return_10d_pct) <= -5,
    finite(pv.close_vs_prior_20d_high_pct) && Number(pv.close_vs_prior_20d_high_pct) <= -10,
  ];
  const strongAbsorptionScore = strongChecks.filter(Boolean).length;
  const weakAbsorptionScore = weakChecks.filter(Boolean).length;
  const strongAbsorption = strongAbsorptionScore >= 3;
  const weakAbsorption = !strongAbsorption && weakAbsorptionScore >= 2;

  let structure = 'other';
  if (withdrawalPressure && strongAbsorption) structure = 'absorbed_distribution';
  else if (withdrawalPressure && weakAbsorption) structure = 'fragile_distribution';
  else if (withdrawalPressure) structure = 'unclassified_distribution';
  else if (c.pressure_baseline && !persistentTransfer) structure = 'pressure_without_persistence';
  else if (persistentTransfer && !brokerPressure) structure = 'persistent_transfer_without_broker_pressure';

  return {
    persistent_transfer: persistentTransfer,
    strong_persistent_transfer: strongPersistentTransfer,
    broker_pressure: brokerPressure,
    withdrawal_pressure: withdrawalPressure,
    strong_absorption: strongAbsorption,
    weak_absorption: weakAbsorption,
    strong_absorption_score: strongAbsorptionScore,
    weak_absorption_score: weakAbsorptionScore,
    structure,
  };
}

function eventView(row) {
  return {
    stock: row.stock,
    tdcc_observed_date: row.tdcc_observed_date,
    market_feature_date: row.market_feature_date,
    classification: row.v6,
    tdcc: row.tdcc,
    broker: row.broker,
    foreign: row.foreign,
    price_volume: row.price_volume,
    outcome: row.outcome,
  };
}

const rows = matrix.rows.filter((r) => r.analysis_eligible).map((r) => ({ ...r, v6: classify(r) }));
const allStats = summarize(rows);
const pressureRows = rows.filter((r) => r.confirmations?.pressure_baseline);
const pressureStats = summarize(pressureRows);

const groups = {
  all_eligible: rows,
  v5_pressure_baseline: pressureRows,
  persistent_tdcc_transfer: rows.filter((r) => r.v6.persistent_transfer),
  withdrawal_pressure: rows.filter((r) => r.v6.withdrawal_pressure),
  absorbed_distribution: rows.filter((r) => r.v6.structure === 'absorbed_distribution'),
  fragile_distribution: rows.filter((r) => r.v6.structure === 'fragile_distribution'),
  strong_persistent_transfer_plus_broker: rows.filter((r) => r.v6.strong_persistent_transfer && r.v6.broker_pressure),
  withdrawal_pressure_plus_foreign: rows.filter((r) => r.v6.withdrawal_pressure && r.confirmations?.foreign_confirm),
  pressure_without_persistence: rows.filter((r) => r.v6.structure === 'pressure_without_persistence'),
  persistent_transfer_without_broker_pressure: rows.filter((r) => r.v6.structure === 'persistent_transfer_without_broker_pressure'),
};

const results = {};
for (const [name, rs] of Object.entries(groups)) {
  const s = summarize(rs);
  results[name] = {
    observations: rs.length,
    stats: s,
    edge_vs_all_eligible: edge(s, allStats),
    edge_vs_v5_pressure: edge(s, pressureStats),
    events: rs.map(eventView),
  };
}

const structureCounts = {};
for (const r of rows) structureCounts[r.v6.structure] = (structureCounts[r.v6.structure] || 0) + 1;

const candidateRanking = Object.entries(results)
  .filter(([name, v]) => !['all_eligible', 'v5_pressure_baseline'].includes(name) && v.stats.horizons['10d'].n >= 2)
  .map(([name, v]) => ({
    name,
    observations: v.observations,
    n10: v.stats.horizons['10d'].n,
    mean10: v.stats.horizons['10d'].mean_pct,
    edge10_vs_pressure: v.edge_vs_v5_pressure['10d'].mean_return_edge_pp,
    negative_rate10: v.stats.horizons['10d'].negative_rate,
    mean_max_drawdown20: v.stats.path.mean_max_drawdown_20d_pct,
    drawdown10_rate: v.stats.path.drawdown_10pct_rate,
  }))
  .sort((a, b) => (a.edge10_vs_pressure ?? Infinity) - (b.edge10_vs_pressure ?? Infinity));

const payload = {
  schema_version: 1,
  methodology: 'institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1',
  research_only: true,
  production_safe: false,
  source_matrix_methodology: matrix.methodology,
  universe: matrix.universe,
  range: matrix.range,
  pre_registered_spec: 'data_research/institutional-flow/v6-distribution-absorption-spec.md',
  eligible_rows: rows.length,
  structure_counts: structureCounts,
  results,
  candidate_ranking_descriptive_only: candidateRanking,
  guardrails: [
    'Forward returns and path outcomes are labels only and do not construct v6 features.',
    'Historical TDCC is association-only because original publication timestamps are unknown.',
    'Broker branches cannot identify beneficial owners.',
    'Small-n structure groups are descriptive only; no candidate is production-safe without untouched or walk-forward validation.',
  ],
  generated_at: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);

const lines = [];
lines.push('# Institutional Withdrawal v6 — Persistent Transfer & Distribution/Absorption');
lines.push('');
lines.push(`- Analysis-eligible TDCC anchors: **${rows.length}**`);
lines.push(`- v5 Broker+TDCC pressure anchors: **${pressureRows.length}**`);
lines.push(`- Persistent TDCC transfer anchors: **${groups.persistent_tdcc_transfer.length}**`);
lines.push(`- Withdrawal-pressure anchors (broker + persistent TDCC): **${groups.withdrawal_pressure.length}**`);
lines.push(`- Absorbed distribution: **${groups.absorbed_distribution.length}**`);
lines.push(`- Fragile distribution: **${groups.fragile_distribution.length}**`);
lines.push('');
lines.push('## Comparison');
lines.push('');
lines.push('| Group | Obs | 5D n / mean | 10D n / mean | 20D n / mean | 10D edge vs v5 pressure | Mean max DD 20D |');
lines.push('|---|---:|---:|---:|---:|---:|---:|');
for (const [name, v] of Object.entries(results)) {
  const h5 = v.stats.horizons['5d'];
  const h10 = v.stats.horizons['10d'];
  const h20 = v.stats.horizons['20d'];
  lines.push(`| ${name} | ${v.observations} | ${h5.n} / ${h5.mean_pct ?? 'n/a'}% | ${h10.n} / ${h10.mean_pct ?? 'n/a'}% | ${h20.n} / ${h20.mean_pct ?? 'n/a'}% | ${v.edge_vs_v5_pressure['10d'].mean_return_edge_pp ?? 'n/a'}pp | ${v.stats.path.mean_max_drawdown_20d_pct ?? 'n/a'}% |`);
}
lines.push('');
lines.push('## Interpretation guardrails');
lines.push('');
lines.push('- This is a development-sample diagnostic. Negative return edge, higher future negative-rate, or deeper future drawdown are consistent with the withdrawal hypothesis, but are not sufficient for production promotion.');
lines.push('- `absorbed_distribution` explicitly means supply is present while contemporaneous price/volume still shows absorption; it is not expected to imply immediate price decline.');
lines.push('- `fragile_distribution` is the candidate structure most consistent with supply overwhelming demand, but small sample sizes must remain descriptive.');
lines.push('- Outcomes never construct the classifications above.');
lines.push('');
lines.push('## Descriptive candidate ranking');
lines.push('');
for (const x of candidateRanking) lines.push(`- ${x.name}: obs=${x.observations}, 10D n=${x.n10}, mean=${x.mean10 ?? 'n/a'}%, edge vs pressure=${x.edge10_vs_pressure ?? 'n/a'}pp, mean max DD20=${x.mean_max_drawdown20 ?? 'n/a'}%`);
fs.writeFileSync(report, `${lines.join('\n')}\n`);

console.log(JSON.stringify({
  eligible_rows: rows.length,
  structure_counts: structureCounts,
  groups: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, {
    obs: v.observations,
    h10: v.stats.horizons['10d'],
    h20: v.stats.horizons['20d'],
    path: v.stats.path,
    edge10_vs_pressure: v.edge_vs_v5_pressure['10d'],
  }])),
  candidate_ranking: candidateRanking,
}, null, 2));
