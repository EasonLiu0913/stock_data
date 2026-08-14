#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VALUATION_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'valuation-backtest.json');
const OUT_JSON = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'pe-applicability-study.json');
const OUT_MD = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'pe-applicability-study.md');

const EPSILON = 1e-6;
const MAX_GROWTH = 3;
const DYNAMIC_METHODS = new Set(['current_pe20', 'hist_p20', 'hist_q25_q75']);
const CAPS = [30, 40, 50, 75, 100, 150, 200, 300, 500, 1000];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function round(v, d = 4) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }
function quantile(values, q) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (p - lo);
}
function stats(rows) {
  const errs = rows.map(r => Number(r.range_error_pct)).filter(Number.isFinite);
  return {
    samples: rows.length,
    events: new Set(rows.map(r => `${r.stock_code}:${r.fiscal_period}`)).size,
    hit_rate_pct: round(rows.length ? rows.filter(r => r.hit_range).length / rows.length * 100 : 0, 2),
    mean_range_error_pct: errs.length ? round(errs.reduce((a, b) => a + b, 0) / errs.length) : null,
    p50_range_error_pct: round(quantile(errs, .5)),
    p90_range_error_pct: round(quantile(errs, .9)),
    p95_range_error_pct: round(quantile(errs, .95)),
    p99_range_error_pct: round(quantile(errs, .99)),
    max_range_error_pct: errs.length ? round(Math.max(...errs)) : null,
  };
}
function approximatePeAnchor(row) {
  const low = Number(row.pe_low), high = Number(row.pe_high);
  if (!(low > 0) || !(high > 0)) return null;
  if (row.pe_method === 'hist_p20' || row.pe_method === 'current_pe20') return (low + high) / 2;
  if (row.pe_method === 'hist_q25_q75') return Math.max(low, high);
  return null;
}
function guardedYoyRow(row) {
  if (row.eps_method !== 'yoy_scaled_remaining') return true;
  // Shadow rows already encode estimated annual EPS but not denominator/growth context.
  // Reconstruct growth from rows by using a value injected into prior research is unavailable here;
  // therefore PE study operates on all non-pathological finite rows and separately reports dynamic PE caps.
  return Number.isFinite(Number(row.estimated_annual_eps)) && Number(row.estimated_annual_eps) > EPSILON;
}
function studyMethod(rows, method) {
  const base = rows.filter(r => r.pe_method === method && guardedYoyRow(r));
  return {
    pe_method: method,
    pe_method_label: base[0]?.pe_method_label || method,
    baseline: stats(base),
    caps: CAPS.map(cap => {
      const kept = base.filter(r => {
        const anchor = approximatePeAnchor(r);
        return Number.isFinite(anchor) && anchor <= cap;
      });
      return {
        max_pe: cap,
        kept_samples: kept.length,
        kept_sample_pct: round(base.length ? kept.length / base.length * 100 : 0, 2),
        ...stats(kept),
      };
    }),
  };
}
function main() {
  const payload = readJson(VALUATION_FILE);
  if (!Array.isArray(payload.rows)) throw new Error('valuation-backtest.json rows missing');

  const yoy = payload.rows.filter(r => r.eps_method === 'yoy_scaled_remaining');
  const dynamic = yoy.filter(r => DYNAMIC_METHODS.has(r.pe_method));
  const methods = [...DYNAMIC_METHODS].map(method => studyMethod(yoy, method));

  const peValues = dynamic.map(approximatePeAnchor).filter(Number.isFinite);
  const top = [...dynamic]
    .map(r => ({ ...r, pe_anchor: approximatePeAnchor(r) }))
    .filter(r => Number.isFinite(r.pe_anchor))
    .sort((a, b) => b.pe_anchor - a.pe_anchor)
    .slice(0, 30)
    .map(r => ({
      stock_code: r.stock_code,
      fiscal_period: r.fiscal_period,
      pe_method: r.pe_method,
      pe_method_label: r.pe_method_label,
      pe_anchor: round(r.pe_anchor, 4),
      pe_low: r.pe_low,
      pe_high: r.pe_high,
      estimated_annual_eps: r.estimated_annual_eps,
      base_close: r.base_close,
      future_high: r.future_high,
      range_error_pct: r.range_error_pct,
    }));

  const report = {
    schema_version: 1,
    dataset: 'eps_pe_applicability_study',
    generated_at: new Date().toISOString(),
    source_generated_at: payload.generated_at || null,
    note: 'PE cap sensitivity on yoy_scaled_remaining dynamic PE methods. Formal formula is unchanged.',
    pe_anchor_distribution: {
      count: peValues.length,
      p50: round(quantile(peValues, .5)),
      p75: round(quantile(peValues, .75)),
      p90: round(quantile(peValues, .9)),
      p95: round(quantile(peValues, .95)),
      p99: round(quantile(peValues, .99)),
      max: peValues.length ? round(Math.max(...peValues)) : null,
    },
    methods,
    top_pe_outliers: top,
  };

  writeJson(OUT_JSON, report);
  const lines = ['# EPS P/E 適用區間研究', '', `產生時間：${report.generated_at}`, '', '## P/E anchor 分布', '', '```json', JSON.stringify(report.pe_anchor_distribution, null, 2), '```', ''];
  for (const m of methods) {
    lines.push(`## ${m.pe_method_label}`, '', '| P/E上限 | 保留樣本% | 命中率% | Mean | P95 | P99 | MAX |', '|---:|---:|---:|---:|---:|---:|---:|');
    for (const x of m.caps) lines.push(`| ${x.max_pe} | ${x.kept_sample_pct} | ${x.hit_rate_pct} | ${x.mean_range_error_pct ?? '—'} | ${x.p95_range_error_pct ?? '—'} | ${x.p99_range_error_pct ?? '—'} | ${x.max_range_error_pct ?? '—'} |`);
    lines.push('');
  }
  lines.push('> 本研究只做 P/E 適用區間敏感度分析，不修改正式公式。', '');
  fs.writeFileSync(OUT_MD, `${lines.join('\n')}\n`);
  console.log(JSON.stringify({ output_json: path.relative(ROOT, OUT_JSON), methods: methods.length, pe_distribution: report.pe_anchor_distribution, top_outlier: top[0] || null }, null, 2));
}

if (require.main === module) { try { main(); } catch (e) { console.error(e.stack || e.message); process.exitCode = 1; } }
