#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VALUATION_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'valuation-backtest.json');
const FIN_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const OUT_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'valuation-applicability-policy.json');
const EPSILON = 1e-6;
const MAX_GROWTH = 3;
const MAX_DYNAMIC_PE = 100;
const DYNAMIC_PE_METHODS = ['current_pe20', 'hist_p20', 'hist_q25_q75'];

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function periodParts(period) { const m = String(period || '').match(/^(20\d{2})Q([1-4])$/); return m ? { year: +m[1], quarter: +m[2] } : null; }
function periodKey(y, q) { return `${y}Q${q}`; }
function loadEps(stock, cache) {
  if (cache.has(stock)) return cache.get(stock);
  const map = new Map(), dir = path.join(FIN_ROOT, String(stock));
  if (fs.existsSync(dir)) for (const file of fs.readdirSync(dir)) {
    if (!/^20\d{2}Q[1-4]\.json$/.test(file)) continue;
    const p = readJson(path.join(dir, file), {}), period = p.fiscal_period || file.slice(0, -5), eps = Number(p.standalone_quarter?.eps);
    if (periodParts(period) && Number.isFinite(eps)) map.set(period, eps);
  }
  cache.set(stock, map); return map;
}
function eventContext(stock, period, cache) {
  const p = periodParts(period); if (!p) return null;
  const epsMap = loadEps(stock, cache); let ytd = 0, pyYtd = 0;
  for (let q = 1; q <= p.quarter; q++) {
    const cur = epsMap.get(periodKey(p.year, q)), prior = epsMap.get(periodKey(p.year - 1, q));
    if (!Number.isFinite(cur) || !Number.isFinite(prior)) return null;
    ytd += cur; pyYtd += prior;
  }
  return { ytd, py_ytd: pyYtd, growth_multiplier: pyYtd > EPSILON ? ytd / pyYtd : null };
}
function main() {
  const payload = readJson(VALUATION_FILE);
  if (!payload || !Array.isArray(payload.rows)) throw new Error('valuation-backtest.json rows missing');
  const cache = new Map(), events = new Map();
  for (const row of payload.rows) {
    if (row.eps_method !== 'yoy_scaled_remaining') continue;
    const key = `${row.stock_code}:${row.fiscal_period}`;
    if (events.has(key)) continue;
    const ctx = eventContext(row.stock_code, row.fiscal_period, cache);
    let reason = null;
    if (!ctx || !Number.isFinite(ctx.py_ytd) || ctx.py_ytd <= EPSILON) reason = 'nonpositive_or_near_zero_prior_ytd';
    else if (!Number.isFinite(ctx.growth_multiplier) || ctx.growth_multiplier <= 0) reason = 'nonpositive_growth';
    else if (ctx.growth_multiplier > MAX_GROWTH) reason = 'growth_above_cap';
    events.set(key, { key, stock_code: row.stock_code, fiscal_period: row.fiscal_period, eligible: !reason, exclusion_reason: reason, ...(ctx || {}) });
  }
  const excluded = [...events.values()].filter(x => !x.eligible);
  const policy = {
    schema_version: 1,
    dataset: 'eps_valuation_applicability_policy',
    generated_at: new Date().toISOString(),
    source_generated_at: payload.generated_at || null,
    yoy_scaled_remaining: {
      min_prior_ytd_eps_exclusive: EPSILON,
      max_growth_multiplier: MAX_GROWTH,
      total_events: events.size,
      eligible_events: events.size - excluded.length,
      excluded_events: excluded.length,
      excluded_event_keys: excluded.map(x => x.key),
      exclusion_reason_counts: excluded.reduce((acc, x) => { acc[x.exclusion_reason] = (acc[x.exclusion_reason] || 0) + 1; return acc; }, {}),
    },
    dynamic_pe: {
      methods: DYNAMIC_PE_METHODS,
      max_pe: MAX_DYNAMIC_PE,
      rationale: 'Empirical applicability cap near the guarded-sample P95; removes near-zero-EPS P/E explosions while retaining about 95% of dynamic-PE observations.',
    },
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(policy, null, 2)}\n`);
  console.log(JSON.stringify({ output: path.relative(ROOT, OUT_FILE), excluded_yoy_events: excluded.length, dynamic_pe_max: MAX_DYNAMIC_PE }, null, 2));
}

if (require.main === module) { try { main(); } catch (e) { console.error(e.stack || e.message); process.exitCode = 1; } }
