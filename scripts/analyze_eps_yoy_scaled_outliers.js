#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VALUATION_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'valuation-backtest.json');
const FIN_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const OUT_JSON = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'yoy-scaled-outlier-study.json');
const OUT_MD = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'yoy-scaled-outlier-study.md');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function periodParts(period) {
  const m = String(period || '').match(/^(20\d{2})Q([1-4])$/);
  return m ? { year: Number(m[1]), quarter: Number(m[2]) } : null;
}
function periodKey(year, quarter) { return `${year}Q${quarter}`; }
function quantile(values, q) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const pos = (xs.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return xs[lo];
  return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo);
}
function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}
function stats(values) {
  const xs = values.filter(Number.isFinite);
  if (!xs.length) return { count: 0, min: null, p25: null, p50: null, p75: null, p90: null, p95: null, p99: null, max: null, mean: null };
  const sum = xs.reduce((a, b) => a + b, 0);
  return {
    count: xs.length,
    min: round(Math.min(...xs)),
    p25: round(quantile(xs, .25)),
    p50: round(quantile(xs, .5)),
    p75: round(quantile(xs, .75)),
    p90: round(quantile(xs, .9)),
    p95: round(quantile(xs, .95)),
    p99: round(quantile(xs, .99)),
    max: round(Math.max(...xs)),
    mean: round(sum / xs.length),
  };
}
function loadQuarterEps(stock) {
  const dir = path.join(FIN_ROOT, stock);
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    if (!/^20\d{2}Q[1-4]\.json$/.test(file)) continue;
    const payload = readJson(path.join(dir, file), {});
    const period = payload.fiscal_period || file.slice(0, -5);
    const eps = Number(payload.standalone_quarter?.eps);
    if (periodParts(period) && Number.isFinite(eps)) map.set(period, eps);
  }
  return map;
}
function buildGrowthContext(stock, period, cache) {
  if (!cache.has(stock)) cache.set(stock, loadQuarterEps(stock));
  const epsMap = cache.get(stock);
  const p = periodParts(period);
  if (!p) return null;
  let ytd = 0, pyYtd = 0;
  const currentParts = [], priorParts = [];
  for (let q = 1; q <= p.quarter; q += 1) {
    const current = epsMap.get(periodKey(p.year, q));
    const prior = epsMap.get(periodKey(p.year - 1, q));
    if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
    ytd += current;
    pyYtd += prior;
    currentParts.push(current);
    priorParts.push(prior);
  }
  if (!(pyYtd > 0)) return { ytd, py_ytd: pyYtd, growth_multiplier: null, current_parts: currentParts, prior_parts: priorParts };
  return {
    ytd: round(ytd, 6),
    py_ytd: round(pyYtd, 6),
    growth_multiplier: round(ytd / pyYtd, 8),
    current_parts: currentParts,
    prior_parts: priorParts,
  };
}
function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}
function summarizePe(rows) {
  const groups = groupBy(rows, r => r.pe_method);
  return [...groups.entries()].map(([pe_method, group]) => ({
    pe_method,
    pe_method_label: group[0]?.pe_method_label || pe_method,
    samples: group.length,
    range_error_pct: stats(group.map(r => Number(r.range_error_pct))),
    center_error_pct: stats(group.map(r => Number(r.center_error_pct))),
  })).sort((a, b) => a.pe_method.localeCompare(b.pe_method));
}
function thresholdStudy(eventRows, formulaRows) {
  const thresholds = [1.5, 2, 3, 4, 5, 10, 20, 50, 100];
  return thresholds.map(maxGrowth => {
    const eligibleEvents = eventRows.filter(r => Number.isFinite(r.growth_multiplier) && r.growth_multiplier <= maxGrowth);
    const eventKeys = new Set(eligibleEvents.map(r => `${r.stock_code}:${r.fiscal_period}`));
    const kept = formulaRows.filter(r => eventKeys.has(`${r.stock_code}:${r.fiscal_period}`));
    const errors = kept.map(r => Number(r.range_error_pct)).filter(Number.isFinite);
    return {
      max_growth_multiplier: maxGrowth,
      kept_events: eligibleEvents.length,
      kept_event_pct: round(eventRows.length ? eligibleEvents.length / eventRows.length * 100 : 0, 2),
      kept_formula_rows: kept.length,
      range_error_mean_pct: errors.length ? round(errors.reduce((a, b) => a + b, 0) / errors.length, 4) : null,
      range_error_median_pct: round(quantile(errors, .5), 4),
      range_error_p90_pct: round(quantile(errors, .9), 4),
      range_error_p95_pct: round(quantile(errors, .95), 4),
      range_error_p99_pct: round(quantile(errors, .99), 4),
      range_error_max_pct: errors.length ? round(Math.max(...errors), 4) : null,
    };
  });
}
function denominatorStudy(eventRows, formulaRows) {
  const floors = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
  return floors.map(minPyYtd => {
    const eligibleEvents = eventRows.filter(r => Number.isFinite(r.py_ytd) && r.py_ytd >= minPyYtd);
    const eventKeys = new Set(eligibleEvents.map(r => `${r.stock_code}:${r.fiscal_period}`));
    const kept = formulaRows.filter(r => eventKeys.has(`${r.stock_code}:${r.fiscal_period}`));
    const errors = kept.map(r => Number(r.range_error_pct)).filter(Number.isFinite);
    return {
      min_prior_ytd_eps: minPyYtd,
      kept_events: eligibleEvents.length,
      kept_event_pct: round(eventRows.length ? eligibleEvents.length / eventRows.length * 100 : 0, 2),
      kept_formula_rows: kept.length,
      range_error_mean_pct: errors.length ? round(errors.reduce((a, b) => a + b, 0) / errors.length, 4) : null,
      range_error_median_pct: round(quantile(errors, .5), 4),
      range_error_p95_pct: round(quantile(errors, .95), 4),
      range_error_p99_pct: round(quantile(errors, .99), 4),
      range_error_max_pct: errors.length ? round(Math.max(...errors), 4) : null,
    };
  });
}
function markdown(report) {
  const lines = [];
  lines.push('# EPS YoY Scaled Remaining 異常值研究');
  lines.push('');
  lines.push(`產生時間：${report.generated_at}`);
  lines.push(`研究事件：${report.event_count}；公式列：${report.formula_row_count}`);
  lines.push('');
  lines.push('## Growth multiplier 分布');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(report.growth_multiplier_stats, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## 去年同期 YTD EPS 分布');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(report.prior_ytd_eps_stats, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## 六種 P/E 誤差分布');
  lines.push('');
  lines.push('| P/E | 樣本 | Range P50 | P90 | P95 | P99 | MAX |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const row of report.pe_method_stats) {
    const s = row.range_error_pct;
    lines.push(`| ${row.pe_method_label} | ${row.samples} | ${s.p50 ?? '—'} | ${s.p90 ?? '—'} | ${s.p95 ?? '—'} | ${s.p99 ?? '—'} | ${s.max ?? '—'} |`);
  }
  lines.push('');
  lines.push('## 最大異常事件 Top 30');
  lines.push('');
  lines.push('| 股票 | 季度 | 去年YTD EPS | 今年YTD EPS | Growth | 預估全年EPS | 最大Range誤差% | P/E方法 |');
  lines.push('|---|---|---:|---:|---:|---:|---:|---|');
  for (const row of report.top_outlier_events) {
    lines.push(`| ${row.stock_code} | ${row.fiscal_period} | ${row.py_ytd ?? '—'} | ${row.ytd ?? '—'} | ${row.growth_multiplier ?? '—'} | ${row.estimated_annual_eps ?? '—'} | ${row.max_range_error_pct ?? '—'} | ${row.max_error_pe_method_label || '—'} |`);
  }
  lines.push('');
  lines.push('## Growth cutoff 候選');
  lines.push('');
  lines.push('| 最大Growth | 保留事件% | 平均Range誤差% | P95 | P99 | MAX |');
  lines.push('|---:|---:|---:|---:|---:|---:|');
  for (const row of report.growth_threshold_study) lines.push(`| ${row.max_growth_multiplier} | ${row.kept_event_pct} | ${row.range_error_mean_pct ?? '—'} | ${row.range_error_p95_pct ?? '—'} | ${row.range_error_p99_pct ?? '—'} | ${row.range_error_max_pct ?? '—'} |`);
  lines.push('');
  lines.push('## 去年 YTD EPS 分母下限候選');
  lines.push('');
  lines.push('| 最低去年YTD EPS | 保留事件% | 平均Range誤差% | P95 | P99 | MAX |');
  lines.push('|---:|---:|---:|---:|---:|---:|');
  for (const row of report.denominator_floor_study) lines.push(`| ${row.min_prior_ytd_eps} | ${row.kept_event_pct} | ${row.range_error_mean_pct ?? '—'} | ${row.range_error_p95_pct ?? '—'} | ${row.range_error_p99_pct ?? '—'} | ${row.range_error_max_pct ?? '—'} |`);
  lines.push('');
  lines.push('> 本報告只做異常值診斷與門檻敏感度研究，不會修改正式估值公式。');
  return `${lines.join('\n')}\n`;
}

function main() {
  const valuation = readJson(VALUATION_FILE);
  if (!valuation || !Array.isArray(valuation.rows)) throw new Error(`Missing or invalid ${path.relative(ROOT, VALUATION_FILE)}`);
  const formulaRows = valuation.rows.filter(r => r.eps_method === 'yoy_scaled_remaining');
  if (!formulaRows.length) throw new Error('No yoy_scaled_remaining rows found');

  const uniqueEvents = new Map();
  for (const row of formulaRows) {
    const key = `${row.stock_code}:${row.fiscal_period}`;
    if (!uniqueEvents.has(key)) uniqueEvents.set(key, { stock_code: row.stock_code, fiscal_period: row.fiscal_period });
  }
  const epsCache = new Map();
  const eventRows = [];
  for (const event of uniqueEvents.values()) {
    const context = buildGrowthContext(event.stock_code, event.fiscal_period, epsCache);
    if (!context) continue;
    const matching = formulaRows.filter(r => r.stock_code === event.stock_code && r.fiscal_period === event.fiscal_period);
    const worst = matching.reduce((best, row) => !best || Number(row.range_error_pct) > Number(best.range_error_pct) ? row : best, null);
    eventRows.push({
      ...event,
      ...context,
      estimated_annual_eps: worst ? Number(worst.estimated_annual_eps) : null,
      max_range_error_pct: worst ? Number(worst.range_error_pct) : null,
      max_error_pe_method: worst?.pe_method || null,
      max_error_pe_method_label: worst?.pe_method_label || null,
    });
  }

  const growths = eventRows.map(r => Number(r.growth_multiplier)).filter(Number.isFinite);
  const priorYtd = eventRows.map(r => Number(r.py_ytd)).filter(Number.isFinite);
  const topOutliers = [...eventRows]
    .filter(r => Number.isFinite(r.max_range_error_pct))
    .sort((a, b) => b.max_range_error_pct - a.max_range_error_pct)
    .slice(0, 30);

  const report = {
    schema_version: 1,
    dataset: 'eps_yoy_scaled_outlier_study',
    generated_at: new Date().toISOString(),
    source_generated_at: valuation.generated_at || null,
    event_count: eventRows.length,
    formula_row_count: formulaRows.length,
    growth_multiplier_stats: stats(growths),
    prior_ytd_eps_stats: stats(priorYtd),
    growth_threshold_counts: [1.5,2,3,4,5,10,20,50,100,1000].map(t => ({ threshold: t, events_above: growths.filter(v => v > t).length, pct_above: round(growths.length ? growths.filter(v => v > t).length / growths.length * 100 : 0, 2) })),
    denominator_risk_counts: [1,0.5,0.25,0.1,0.05,0.01].map(t => ({ threshold: t, events_below: priorYtd.filter(v => v > 0 && v < t).length, pct_below: round(priorYtd.length ? priorYtd.filter(v => v > 0 && v < t).length / priorYtd.length * 100 : 0, 2) })),
    pe_method_stats: summarizePe(formulaRows),
    top_outlier_events: topOutliers,
    growth_threshold_study: thresholdStudy(eventRows, formulaRows),
    denominator_floor_study: denominatorStudy(eventRows, formulaRows),
  };
  writeJson(OUT_JSON, report);
  fs.writeFileSync(OUT_MD, markdown(report), 'utf8');
  console.log(JSON.stringify({
    output_json: path.relative(ROOT, OUT_JSON),
    output_markdown: path.relative(ROOT, OUT_MD),
    events: report.event_count,
    formula_rows: report.formula_row_count,
    max_growth: report.growth_multiplier_stats.max,
    p99_growth: report.growth_multiplier_stats.p99,
    top_outlier: report.top_outlier_events[0] || null,
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
