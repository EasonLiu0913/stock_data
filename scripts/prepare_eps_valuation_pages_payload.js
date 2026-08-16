#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, value, pretty = false) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`, 'utf8'); }
function uniq(values) { return [...new Set(values.filter(v => v != null && v !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant')); }
function round(v, d = 4) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }
function quantile(values, q) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (p - lo);
}
function summarizeRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.eps_method}__${row.pe_method}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([formula, a]) => {
    const range = a.map(x => Number(x.range_error_pct)).filter(Number.isFinite);
    const center = a.map(x => Number(x.center_error_pct)).filter(Number.isFinite);
    return {
      formula,
      eps_method: a[0]?.eps_method,
      eps_method_label: a[0]?.eps_method_label,
      pe_method: a[0]?.pe_method,
      pe_method_label: a[0]?.pe_method_label,
      stocks: new Set(a.map(x => x.stock_code)).size,
      events: new Set(a.map(x => `${x.stock_code}:${x.fiscal_period}`)).size,
      samples: a.length,
      hit_rate_pct: round(a.length ? a.filter(x => x.hit_range).length / a.length * 100 : 0, 2),
      mean_range_error_pct: range.length ? round(range.reduce((s, x) => s + x, 0) / range.length, 2) : null,
      median_range_error_pct: round(quantile(range, .5), 2),
      p95_range_error_pct: round(quantile(range, .95), 2),
      p99_range_error_pct: round(quantile(range, .99), 2),
      median_center_error_pct: round(quantile(center, .5), 2),
    };
  }).sort((a, b) => (a.median_range_error_pct ?? Infinity) - (b.median_range_error_pct ?? Infinity) || (a.p95_range_error_pct ?? Infinity) - (b.p95_range_error_pct ?? Infinity) || b.hit_rate_pct - a.hit_rate_pct);
}
function buildPolicyFilter(policy) {
  const excludedYoy = new Set(policy?.yoy_scaled_remaining?.excluded_event_keys || []);
  const dynamicMethods = new Set(policy?.dynamic_pe?.methods || []);
  const maxDynamicPe = Number(policy?.dynamic_pe?.max_pe);
  return row => {
    if (row.eps_method === 'yoy_scaled_remaining' && excludedYoy.has(`${row.stock_code}:${row.fiscal_period}`)) return false;
    if (dynamicMethods.has(row.pe_method) && Number.isFinite(maxDynamicPe)) {
      const low = Number(row.pe_low), high = Number(row.pe_high);
      if (!(low > 0) || !(high > 0) || Math.max(low, high) > maxDynamicPe) return false;
    }
    return true;
  };
}
function decorateFormulaSummaries(summaries, displayPolicy) {
  const primary = new Map((displayPolicy?.primary_formulas || []).map(item => [item.formula, item]));
  const researchOnly = new Map((displayPolicy?.research_only_eps_methods || []).map(item => [item.eps_method, item]));
  const duplicates = new Map((displayPolicy?.duplicate_eps_methods || []).map(item => [item.eps_method, item]));
  const baselinePe = new Set(displayPolicy?.baseline_only_pe_methods || []);
  return summaries.map(summary => {
    const selected = primary.get(summary.formula);
    const duplicate = duplicates.get(summary.eps_method);
    const research = researchOnly.get(summary.eps_method);
    let display_role = selected?.role || 'research_detail';
    let display_note = selected?.display_note || null;
    if (!selected && duplicate) {
      display_role = 'duplicate';
      display_note = duplicate.reason || null;
    } else if (!selected && research) {
      display_role = 'research_only';
      display_note = research.reason || null;
    } else if (!selected && baselinePe.has(summary.pe_method)) {
      display_role = 'baseline_only';
    }
    return {
      ...summary,
      display_role,
      display_label: selected?.display_label || null,
      display_note,
      default_visible: Boolean(selected),
    };
  });
}
function compactValuationSummary(payload, rows, policy, displayPolicy = null) {
  const summaries = decorateFormulaSummaries(summarizeRows(rows), displayPolicy);
  return {
    schema_version: 3,
    dataset: 'eps_valuation_pages_summary',
    generated_at: payload.generated_at || null,
    methodology: {
      ...(payload.methodology || {}),
      display_applicability_policy: policy ? {
        generated_at: policy.generated_at || null,
        yoy_max_growth_multiplier: policy.yoy_scaled_remaining?.max_growth_multiplier ?? null,
        yoy_excluded_events: policy.yoy_scaled_remaining?.excluded_events ?? null,
        dynamic_pe_max: policy.dynamic_pe?.max_pe ?? null,
      } : null,
      ranking_rule: 'Default research ranking uses median range error, then P95 range error, then hit rate. Mean is retained for reference but is not the primary rank key.',
      formula_display_policy_version: displayPolicy?.policy_version || null,
    },
    formula_display_policy: displayPolicy ? {
      schema_version: displayPolicy.schema_version || 1,
      policy_version: displayPolicy.policy_version || null,
      decision: displayPolicy.decision || null,
      primary_formulas: displayPolicy.primary_formulas || [],
      research_only_eps_methods: displayPolicy.research_only_eps_methods || [],
      duplicate_eps_methods: displayPolicy.duplicate_eps_methods || [],
      baseline_only_pe_methods: displayPolicy.baseline_only_pe_methods || [],
      default_main_formula_count: displayPolicy.default_main_formula_count || 0,
    } : null,
    formula_count: summaries.length,
    stock_count: new Set(rows.map(row => row.stock_code)).size,
    planned_stock_count: payload.planned_stock_count || 0,
    sample_count: rows.length,
    original_sample_count: Array.isArray(payload.rows) ? payload.rows.length : 0,
    excluded_sample_count: Math.max(0, (Array.isArray(payload.rows) ? payload.rows.length : 0) - rows.length),
    formula_summary: summaries,
    stock_codes: uniq(rows.map(row => row.stock_code)),
    fiscal_periods: uniq(rows.map(row => row.fiscal_period)),
    eps_methods: uniq(rows.map(row => row.eps_method)).map(value => ({ value, label: rows.find(item => item.eps_method === value)?.eps_method_label || value })),
    pe_methods: uniq(rows.map(row => row.pe_method)).map(value => ({ value, label: rows.find(item => item.pe_method === value)?.pe_method_label || value })),
  };
}
function splitValuation(root) {
  const dir = path.join(root, 'data_prediction_analysis', 'eps-valuation');
  const source = path.join(dir, 'valuation-backtest.json');
  if (!fs.existsSync(source)) return { dataset: 'eps_valuation', skipped: true, reason: 'source_missing' };
  const payload = readJson(source);
  if (payload?.dataset !== 'eps_valuation_backtest' || !Array.isArray(payload.rows)) throw new Error('valuation-backtest.json has unexpected shape');
  const policy = readJson(path.join(dir, 'valuation-applicability-policy.json'));
  const displayPolicy = readJson(path.join(dir, 'formula-display-policy.json'));
  const keep = buildPolicyFilter(policy);
  const filteredRows = payload.rows.filter(keep);
  const byStock = new Map();
  for (const row of filteredRows) {
    const stock = String(row.stock_code || '');
    if (!/^\d{4,6}$/.test(stock)) continue;
    if (!byStock.has(stock)) byStock.set(stock, []);
    byStock.get(stock).push(row);
  }
  const outputDir = path.join(dir, 'valuation-by-stock');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  let rowsWritten = 0;
  for (const [stock, rows] of byStock) {
    writeJson(path.join(outputDir, `${stock}.json`), { schema_version: 2, dataset: 'eps_valuation_stock_rows', generated_at: payload.generated_at || null, policy_generated_at: policy?.generated_at || null, display_policy_version: displayPolicy?.policy_version || null, stock_code: stock, sample_count: rows.length, rows });
    rowsWritten += rows.length;
  }
  writeJson(path.join(dir, 'valuation-summary.json'), compactValuationSummary(payload, filteredRows, policy, displayPolicy));
  fs.rmSync(source, { force: true });
  return { dataset: 'eps_valuation', stocks: byStock.size, original_rows: payload.rows.length, rows: rowsWritten, excluded_rows: payload.rows.length - rowsWritten, policy_applied: Boolean(policy), display_policy_applied: Boolean(displayPolicy), removed_source: 'valuation-backtest.json' };
}
function splitCoverage(root) {
  const dir = path.join(root, 'data_prediction_analysis', 'eps-valuation');
  const source = path.join(dir, 'coverage-report.json');
  if (!fs.existsSync(source)) return { dataset: 'eps_coverage', skipped: true, reason: 'source_missing' };
  const payload = readJson(source);
  if (!payload?.summary || !Array.isArray(payload.stocks)) throw new Error('coverage-report.json has unexpected shape');
  const outputDir = path.join(dir, 'coverage-by-stock');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  let count = 0; const stockIndex = [];
  for (const stock of payload.stocks) {
    const code = String(stock.stock_code || '');
    if (!/^\d{4,6}$/.test(code)) continue;
    writeJson(path.join(outputDir, `${code}.json`), { schema_version: 1, dataset: 'eps_coverage_stock', generated_at: payload.generated_at || null, stock });
    stockIndex.push({ stock_code: code, stock_name: stock.stock_name || '', industry: stock.industry || '' }); count += 1;
  }
  writeJson(path.join(dir, 'coverage-summary.json'), { schema_version: 1, dataset: 'eps_coverage_pages_summary', generated_at: payload.generated_at || null, summary: payload.summary, stock_index: stockIndex });
  fs.rmSync(source, { force: true });
  return { dataset: 'eps_coverage', stocks: count, removed_source: 'coverage-report.json' };
}
function run(root) { const valuation = splitValuation(root); const coverage = splitCoverage(root); const output = { root, valuation, coverage }; console.log(JSON.stringify(output, null, 2)); return output; }
function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eps-pages-payload-'));
  const dir = path.join(root, 'data_prediction_analysis', 'eps-valuation'); fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'valuation-backtest.json'), {
    dataset: 'eps_valuation_backtest', generated_at: '2026-01-01T00:00:00Z', planned_stock_count: 2,
    rows: [
      { stock_code: '1101', fiscal_period: '2025Q1', eps_method: 'yoy_scaled_remaining', eps_method_label: 'YoY', pe_method: 'fixed_10_20', pe_method_label: 'Fixed', pe_low: 10, pe_high: 20, range_error_pct: 10, center_error_pct: 12, hit_range: false },
      { stock_code: '1101', fiscal_period: '2025Q2', eps_method: 'ttm', eps_method_label: 'TTM', pe_method: 'current_pe20', pe_method_label: 'Current', pe_low: 60, pe_high: 80, range_error_pct: 20, center_error_pct: 22, hit_range: false },
      { stock_code: '2330', fiscal_period: '2025Q1', eps_method: 'ttm', eps_method_label: 'TTM', pe_method: 'fixed_10_20', pe_method_label: 'Fixed', pe_low: 10, pe_high: 20, range_error_pct: 0, center_error_pct: 5, hit_range: true },
    ],
  });
  writeJson(path.join(dir, 'valuation-applicability-policy.json'), { yoy_scaled_remaining: { excluded_event_keys: ['1101:2025Q1'] }, dynamic_pe: { methods: ['current_pe20'], max_pe: 100 } });
  writeJson(path.join(dir, 'formula-display-policy.json'), {
    schema_version: 1,
    policy_version: 'self-test-v1',
    primary_formulas: [
      { formula: 'ttm__current_pe20', role: 'benchmark', display_label: 'Price benchmark', display_note: 'test' },
      { formula: 'ttm__fixed_10_20', role: 'core', display_label: 'Core', display_note: 'test' },
    ],
    research_only_eps_methods: [{ eps_method: 'yoy_scaled_remaining', reason: 'research' }],
    duplicate_eps_methods: [],
    baseline_only_pe_methods: [],
    default_main_formula_count: 2,
  });
  writeJson(path.join(dir, 'coverage-report.json'), { generated_at: '2026-01-01T00:00:00Z', summary: { total_stocks: 2, reason_counts: [] }, stocks: [{ stock_code: '1101' }, { stock_code: '2330' }] });
  const result = run(root);
  if (result.valuation.rows !== 2 || result.valuation.excluded_rows !== 1) throw new Error('policy filter self-test failed');
  if (!result.valuation.display_policy_applied) throw new Error('display policy was not applied');
  const summary = readJson(path.join(dir, 'valuation-summary.json'));
  if (summary.sample_count !== 2 || summary.formula_display_policy?.policy_version !== 'self-test-v1') throw new Error('display policy summary self-test failed');
  const benchmark = summary.formula_summary.find(item => item.formula === 'ttm__current_pe20');
  const core = summary.formula_summary.find(item => item.formula === 'ttm__fixed_10_20');
  if (benchmark?.display_role !== 'benchmark' || core?.display_role !== 'core') throw new Error('formula role decoration self-test failed');
  if (!fs.existsSync(path.join(dir, 'valuation-by-stock', '2330.json'))) throw new Error('valuation stock file missing');
  if (fs.existsSync(path.join(dir, 'valuation-backtest.json'))) throw new Error('large valuation source was not removed');
  if (!fs.existsSync(path.join(dir, 'coverage-summary.json'))) throw new Error('coverage summary missing');
  console.log('prepare_eps_valuation_pages_payload self-test passed'); fs.rmSync(root, { recursive: true, force: true });
}

if (require.main === module) { try { if (process.argv.includes('--self-test')) selfTest(); else { const i = process.argv.indexOf('--site'); run(path.resolve(i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : '_site')); } } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; } }
module.exports = { summarizeRows, buildPolicyFilter, decorateFormulaSummaries, compactValuationSummary, splitValuation, splitCoverage, run };
