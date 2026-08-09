#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}

function periodToParts(period) {
  const m = String(period || '').match(/^(20\d{2})Q([1-4])$/);
  if (!m) throw new Error(`Invalid quarter: ${period}`);
  return { year: Number(m[1]), quarter: Number(m[2]) };
}

function periodIndex(period) {
  const { year, quarter } = periodToParts(period);
  return year * 4 + quarter - 1;
}

function enumeratePeriods(start, end) {
  const a = periodIndex(start), b = periodIndex(end);
  if (a > b) throw new Error(`start-quarter must not exceed end-quarter: ${start} > ${end}`);
  return Array.from({ length: b - a + 1 }, (_, i) => `${Math.floor((a + i) / 4)}Q${(a + i) % 4 + 1}`);
}

function round(v, d = 4) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }
function pctChange(a, b) { return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a / b - 1) * 100 : null; }
function diff(a, b) { return Number.isFinite(a) && Number.isFinite(b) ? a - b : null; }

function loadQuarter(stockId, period) {
  const file = path.join(DATA_ROOT, stockId, `${period}.json`);
  if (!fs.existsSync(file)) return null;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { file, meta: j, q: j.standalone_quarter || null };
}

function scoreRow(metrics) {
  let score = 0;
  const reasons = [];
  const add = (pts, reason) => { score += pts; reasons.push({ points: pts, reason }); };

  if (Number.isFinite(metrics.revenue_yoy_pct)) {
    if (metrics.revenue_yoy_pct >= 50) add(2, 'revenue_yoy>=50%');
    else if (metrics.revenue_yoy_pct >= 25) add(1, 'revenue_yoy>=25%');
  }
  if (Number.isFinite(metrics.operating_income_yoy_pct)) {
    if (metrics.operating_income_yoy_pct >= 75) add(2, 'operating_income_yoy>=75%');
    else if (metrics.operating_income_yoy_pct >= 35) add(1, 'operating_income_yoy>=35%');
  }
  if (Number.isFinite(metrics.eps_yoy_pct)) {
    if (metrics.eps_yoy_pct >= 75) add(2, 'eps_yoy>=75%');
    else if (metrics.eps_yoy_pct >= 35) add(1, 'eps_yoy>=35%');
  }
  if (Number.isFinite(metrics.gross_margin_yoy_pp)) {
    if (metrics.gross_margin_yoy_pp >= 5) add(2, 'gross_margin_yoy>=+5pp');
    else if (metrics.gross_margin_yoy_pp >= 2) add(1, 'gross_margin_yoy>=+2pp');
  }
  if (Number.isFinite(metrics.operating_margin_yoy_pp)) {
    if (metrics.operating_margin_yoy_pp >= 5) add(2, 'operating_margin_yoy>=+5pp');
    else if (metrics.operating_margin_yoy_pp >= 2) add(1, 'operating_margin_yoy>=+2pp');
  }
  if (Number.isFinite(metrics.gross_margin_qoq_pp) && metrics.gross_margin_qoq_pp >= 2) add(1, 'gross_margin_qoq>=+2pp');
  if (Number.isFinite(metrics.operating_margin_qoq_pp) && metrics.operating_margin_qoq_pp >= 2) add(1, 'operating_margin_qoq>=+2pp');
  if (Number.isFinite(metrics.operating_income_yoy_pct) && Number.isFinite(metrics.revenue_yoy_pct) && metrics.operating_income_yoy_pct - metrics.revenue_yoy_pct >= 15) add(1, 'operating_leverage_yoy>=15pp');
  if (Number.isFinite(metrics.eps_yoy_pct) && Number.isFinite(metrics.revenue_yoy_pct) && metrics.eps_yoy_pct - metrics.revenue_yoy_pct >= 15) add(1, 'eps_growth_outpaces_revenue>=15pp');

  return { score, max_score: 14, reasons };
}

function buildTimeline(stockId, start, end) {
  const periods = enumeratePeriods(start, end);
  const loaded = new Map();
  for (const period of periods) {
    const item = loadQuarter(stockId, period);
    if (item) loaded.set(period, item);
  }

  const rows = [];
  for (const period of periods) {
    const cur = loaded.get(period);
    if (!cur?.q) continue;
    const idx = periodIndex(period);
    const prevPeriod = `${Math.floor((idx - 1) / 4)}Q${(idx - 1) % 4 + 1}`;
    const yoyPeriod = `${Math.floor((idx - 4) / 4)}Q${(idx - 4) % 4 + 1}`;
    const prev = loaded.get(prevPeriod)?.q || null;
    const yoy = loaded.get(yoyPeriod)?.q || null;
    const q = cur.q;
    const metrics = {
      revenue_qoq_pct: round(pctChange(q.revenue, prev?.revenue)),
      revenue_yoy_pct: round(pctChange(q.revenue, yoy?.revenue)),
      operating_income_qoq_pct: round(pctChange(q.operating_income, prev?.operating_income)),
      operating_income_yoy_pct: round(pctChange(q.operating_income, yoy?.operating_income)),
      eps_qoq_pct: round(pctChange(q.eps, prev?.eps)),
      eps_yoy_pct: round(pctChange(q.eps, yoy?.eps)),
      gross_margin_qoq_pp: round(diff(q.gross_margin_pct, prev?.gross_margin_pct)),
      gross_margin_yoy_pp: round(diff(q.gross_margin_pct, yoy?.gross_margin_pct)),
      operating_margin_qoq_pp: round(diff(q.operating_margin_pct, prev?.operating_margin_pct)),
      operating_margin_yoy_pp: round(diff(q.operating_margin_pct, yoy?.operating_margin_pct)),
    };
    const score = scoreRow(metrics);
    rows.push({
      fiscal_period: period,
      conservative_known_date: cur.meta?.methodology?.conservative_known_date || null,
      revenue: q.revenue,
      gross_margin_pct: q.gross_margin_pct,
      operating_margin_pct: q.operating_margin_pct,
      eps: q.eps,
      metrics,
      financial_quality_score: score.score,
      financial_quality_max_score: score.max_score,
      score_reasons: score.reasons,
      source_file: path.relative(ROOT, cur.file).replaceAll(path.sep, '/'),
    });
  }
  return rows;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const stockId = String(args.get('stock-id') || '2059').trim();
  const start = args.get('start-quarter') || '2023Q1';
  const end = args.get('end-quarter') || '2026Q2';
  const rows = buildTimeline(stockId, start, end);
  if (!rows.length) throw new Error(`No financial-quality rows for ${stockId} ${start}-${end}`);
  const outputDir = path.join(DATA_ROOT, stockId);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, 'financial-quality-score-timeline.json');
  const payload = {
    schema_version: 1,
    dataset: 'financial_quality_score_timeline',
    generated_at: new Date().toISOString(),
    status: 'research_only',
    stock_id: stockId,
    start_quarter: start,
    end_quarter: end,
    methodology: {
      purpose: 'rank quarterly earnings quality without forward estimates',
      availability: 'uses the conservative known date already stored in each quarterly source file',
      max_score: 14,
      dimensions: ['revenue growth', 'operating income growth', 'EPS growth', 'gross margin expansion', 'operating margin expansion', 'operating leverage'],
      warning: 'weights are exploratory and must be validated cross-sectionally before becoming a production strategy',
    },
    rows,
  };
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, outputFile), rows: rows.length }, null, 2));
}

if (require.main === module) main();

module.exports = { pctChange, diff, scoreRow, buildTimeline };
