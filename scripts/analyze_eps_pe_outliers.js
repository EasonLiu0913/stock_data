#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VALUATION_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'valuation-backtest.json');
const FIN_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const OUT_JSON = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'pe-applicability-study.json');
const OUT_MD = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'pe-applicability-study.md');

const EPSILON = 1e-6;
const MAX_GROWTH = 3;
const DYNAMIC_METHODS = new Set(['current_pe20', 'hist_p20', 'hist_q25_q75']);
const CAPS = [30, 40, 50, 75, 100, 150, 200, 300, 500, 1000];

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
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
function periodParts(period) {
  const m = String(period || '').match(/^(20\d{2})Q([1-4])$/);
  return m ? { year: Number(m[1]), quarter: Number(m[2]) } : null;
}
function periodKey(year, quarter) { return `${year}Q${quarter}`; }
function loadQuarterEps(stock, cache) {
  if (cache.has(stock)) return cache.get(stock);
  const map = new Map();
  const dir = path.join(FIN_ROOT, String(stock));
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!/^20\d{2}Q[1-4]\.json$/.test(file)) continue;
      const payload = readJson(path.join(dir, file), {});
      const period = payload.fiscal_period || file.slice(0, -5);
      const eps = Number(payload.standalone_quarter?.eps);
      if (periodParts(period) && Number.isFinite(eps)) map.set(period, eps);
    }
  }
  cache.set(stock, map);
  return map;
}
function growthContext(row, cache) {
  const p = periodParts(row.fiscal_period);
  if (!p) return null;
  const eps = loadQuarterEps(row.stock_code, cache);
  let ytd = 0, pyYtd = 0;
  for (let q = 1; q <= p.quarter; q += 1) {
    const current = eps.get(periodKey(p.year, q));
    const prior = eps.get(periodKey(p.year - 1, q));
    if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
    ytd += current;
    pyYtd += prior;
  }
  const growth = pyYtd > EPSILON ? ytd / pyYtd : null;
  return { ytd, py_ytd: pyYtd, growth_multiplier: growth };
}
function approximatePeAnchor(row) {
  const low = Number(row.pe_low), high = Number(row.pe_high);
  if (!(low > 0) || !(high > 0)) return null;
  if (row.pe_method === 'hist_p20' || row.pe_method === 'current_pe20') return (low + high) / 2;
  if (row.pe_method === 'hist_q25_q75') return Math.max(low, high);
  return null;
}
function studyMethod(rows, method) {
  const base = rows.filter(r => r.pe_method === method);
  return {
    pe_method: method,
    pe_method_label: base[0]?.pe_method_label || method,
    baseline_after_eps_guard: stats(base),
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
  if (!payload || !Array.isArray(payload.rows)) throw new Error('valuation-backtest.json rows missing');

  const cache = new Map();
  const yoy = payload.rows.filter(r => r.eps_method === 'yoy_scaled_remaining');
  const eventGuard = new Map();
  for (const row of yoy) {
    const key = `${row.stock_code}:${row.fiscal_period}`;
    if (eventGuard.has(key)) continue;
    const ctx = growthContext(row, cache);
    const eligible = Boolean(ctx && Number.isFinite(ctx.growth_multiplier) && ctx.py_ytd > EPSILON && ctx.growth_multiplier <= MAX_GROWTH);
    eventGuard.set(key, { eligible, ...(ctx || {}) });
  }
  const guarded = yoy.filter(r => eventGuard.get(`${r.stock_code}:${r.fiscal_period}`)?.eligible);
  const dynamic = guarded.filter(r => DYNAMIC_METHODS.has(r.pe_method));
  const methods = [...DYNAMIC_METHODS].map(method => studyMethod(guarded, method));

  const peValues = dynamic.map(approximatePeAnchor).filter(Number.isFinite);
  const top = [...dynamic]
    .map(r => ({ ...r, pe_anchor: approximatePeAnchor(r), growth_multiplier: eventGuard.get(`${r.stock_code}:${r.fiscal_period}`)?.growth_multiplier ?? null }))
    .filter(r => Number.isFinite(r.pe_anchor))
    .sort((a, b) => b.pe_anchor - a.pe_anchor)
    .slice(0, 30)
    .map(r => ({
      stock_code: r.stock_code,
      fiscal_period: r.fiscal_period,
      pe_method: r.pe_method,
      pe_method_label: r.pe_method_label,
      pe_anchor: round(r.pe_anchor),
      pe_low: r.pe_low,
      pe_high: r.pe_high,
      growth_multiplier: round(r.growth_multiplier),
      estimated_annual_eps: r.estimated_annual_eps,
      base_close: r.base_close,
      future_high: r.future_high,
      range_error_pct: r.range_error_pct,
    }));

  const report = {
    schema_version: 2,
    dataset: 'eps_pe_applicability_study',
    generated_at: new Date().toISOString(),
    source_generated_at: payload.generated_at || null,
    prerequisite_eps_guard: { epsilon: EPSILON, max_growth_multiplier: MAX_GROWTH },
    guarded_event_count: new Set(guarded.map(r => `${r.stock_code}:${r.fiscal_period}`)).size,
    guarded_formula_rows: guarded.length,
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
  const lines = ['# EPS P/E 適用區間研究', '', `產生時間：${report.generated_at}`, '', `前置 EPS guard：pyYTD > ${EPSILON} 且 growth <= ${MAX_GROWTH}x`, '', '## P/E anchor 分布', '', '```json', JSON.stringify(report.pe_anchor_distribution, null, 2), '```', ''];
  for (const m of methods) {
    lines.push(`## ${m.pe_method_label}`, '', '| P/E上限 | 保留樣本% | 命中率% | Mean | P95 | P99 | MAX |', '|---:|---:|---:|---:|---:|---:|---:|');
    for (const x of m.caps) lines.push(`| ${x.max_pe} | ${x.kept_sample_pct} | ${x.hit_rate_pct} | ${x.mean_range_error_pct ?? '—'} | ${x.p95_range_error_pct ?? '—'} | ${x.p99_range_error_pct ?? '—'} | ${x.max_range_error_pct ?? '—'} |`);
    lines.push('');
  }
  lines.push('> 本研究先固定 EPS guard，再研究 P/E 適用區間；正式公式仍未修改。', '');
  fs.writeFileSync(OUT_MD, `${lines.join('\n')}\n`);
  console.log(JSON.stringify({ output_json: path.relative(ROOT, OUT_JSON), guarded_events: report.guarded_event_count, pe_distribution: report.pe_anchor_distribution, top_outlier: top[0] || null }, null, 2));
}

if (require.main === module) { try { main(); } catch (e) { console.error(e.stack || e.message); process.exitCode = 1; } }
