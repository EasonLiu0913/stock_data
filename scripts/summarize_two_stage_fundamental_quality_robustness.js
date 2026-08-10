#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { scoreComponents } = require('./summarize_mops_revenue_fundamental_acceleration_score');
const { latestKnownFinancial } = require('./summarize_two_stage_fundamental_quality_long_horizons');
const { trailingMarketRegime } = require('./summarize_mops_revenue_market_regime_breakdown');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const MASTER_FILE = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'financial-quality-master.json');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-robustness.json');
const HORIZONS = ['d20', 'd40', 'd60'];
const FACTORS = [
  { id: 'monthly8_financial10', name: '月營收 ≥8 + 財報品質 ≥10', test: e => e.monthly_score >= 8 && e.financial_score >= 10 },
  { id: 'monthly9_financial10', name: '月營收 ≥9 + 財報品質 ≥10', test: e => e.monthly_score >= 9 && e.financial_score >= 10 },
];
const ELECTRONIC_INDUSTRIES = new Set([
  '半導體業', '電腦及週邊設備業', '光電業', '通信網路業', '電子零組件業', '電子通路業', '資訊服務業', '其他電子業', '電子工業',
]);

const mean = xs => { const a = xs.filter(Number.isFinite); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; };
const median = xs => { const a = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const round = (v, d = 4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function parseArgs(argv) { const out = new Map(); for (let i = 0; i < argv.length; i += 1) { if (!argv[i].startsWith('--')) continue; out.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true); } return out; }
function loadRevenueHistory() {
  const byMonth = new Map(), byStock = new Map();
  const months = fs.readdirSync(REVENUE_ROOT, { withFileTypes: true }).filter(e => e.isDirectory() && /^20\d{4}$/.test(e.name)).map(e => e.name).sort();
  for (const month of months) {
    const payload = readJson(path.join(REVENUE_ROOT, month, 'monthly_revenue.json'), {});
    const map = new Map();
    for (const row of payload.companies || []) {
      const id = String(row.stock_code);
      map.set(id, row);
      if (!byStock.has(id)) byStock.set(id, new Map());
      byStock.get(id).set(month, row);
    }
    byMonth.set(month, map);
  }
  return { byMonth, byStock };
}
function loadFinancialMaster() {
  const payload = readJson(MASTER_FILE);
  if (!payload || !Array.isArray(payload.stocks)) throw new Error(`Missing ${path.relative(ROOT, MASTER_FILE)}`);
  return new Map(payload.stocks.map(s => [String(s.stock_id), s.rows || []]));
}
function loadMarketRows() {
  const payload = readJson(MARKET_FILE, {});
  return (payload.data || []).filter(r => /^20\d{6}$/.test(String(r.date)) && Number.isFinite(Number(r.close)))
    .map(r => ({ date: String(r.date), close: Number(r.close) })).sort((a, b) => a.date.localeCompare(b.date));
}
function loadEvents(start, end, revenueHistory, financialByStock, marketRows) {
  const events = [];
  const months = fs.readdirSync(SIGNAL_ROOT).filter(n => /^20\d{4}\.json$/.test(n)).map(n => n.slice(0, 6))
    .filter(m => (!start || m >= start) && (!end || m <= end)).sort();
  for (const month of months) {
    const payload = readJson(path.join(SIGNAL_ROOT, `${month}.json`), {});
    const revMap = revenueHistory.byMonth.get(month) || new Map();
    for (const event of payload.events || []) {
      const stockId = String(event.stock_code);
      const revenueRow = revMap.get(stockId) || {};
      const monthly = scoreComponents(event, month, revenueHistory.byStock.get(stockId));
      const eventDate = event.effective_trading_date || event.conservative_availability_date || null;
      const financial = latestKnownFinancial(financialByStock.get(stockId) || [], eventDate);
      const baseDate = event.base_trading_date || eventDate;
      const regime = trailingMarketRegime(marketRows, baseDate);
      const industry = revenueRow.industry || '未分類';
      events.push({
        month,
        year: month.slice(0, 4),
        stock_id: stockId,
        stock_name: revenueRow.stock_name || event.stock_name || null,
        industry,
        is_electronic: ELECTRONIC_INDUSTRIES.has(industry),
        market_regime: regime?.code || 'unknown',
        market_regime_label: regime?.label || '未知',
        monthly_score: Number(monthly.total_score),
        financial_score: Number(financial?.financial_quality_score),
        financial_period: financial?.fiscal_period || null,
        financial_known_date: financial?.conservative_known_date || null,
        returns: event.returns || {},
      });
    }
  }
  return events;
}
function stats(events, horizon) {
  const returns = events.map(e => e.returns?.[horizon]).filter(r => r?.status === 'complete');
  if (!returns.length) return { samples: 0 };
  return {
    samples: returns.length,
    relative_win_rate: round(returns.filter(r => r.outperformed_market === true).length / returns.length * 100),
    avg_excess_return_pct: round(mean(returns.map(r => Number(r.excess_return_pct)))),
    median_excess_return_pct: round(median(returns.map(r => Number(r.excess_return_pct)))),
    avg_stock_return_pct: round(mean(returns.map(r => Number(r.stock_return_pct)))),
    avg_market_return_pct: round(mean(returns.map(r => Number(r.market_return_pct)))),
  };
}
function comparison(factorEvents, baselineEvents, horizon) {
  const factor = stats(factorEvents, horizon), baseline = stats(baselineEvents, horizon);
  return {
    ...factor,
    baseline_samples: baseline.samples,
    baseline_relative_win_rate: baseline.relative_win_rate ?? null,
    baseline_avg_excess_return_pct: baseline.avg_excess_return_pct ?? null,
    relative_win_rate_uplift_pp: round((factor.relative_win_rate ?? NaN) - (baseline.relative_win_rate ?? NaN)),
    avg_excess_uplift_pct: round((factor.avg_excess_return_pct ?? NaN) - (baseline.avg_excess_return_pct ?? NaN)),
  };
}
function groupRows(events, factor, horizon, dimension, keyFn) {
  const groups = new Map();
  for (const event of events) {
    const key = keyFn(event);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  return [...groups.entries()].map(([group, baselineEvents]) => {
    const factorEvents = baselineEvents.filter(factor.test);
    return { dimension, group, factor_id: factor.id, factor_name: factor.name, horizon, ...comparison(factorEvents, baselineEvents, horizon) };
  }).filter(r => r.samples > 0).sort((a, b) => String(a.group).localeCompare(String(b.group)));
}
function exclusionRow(events, factor, horizon, id, label, filterFn) {
  const subset = events.filter(filterFn);
  return { test_id: id, label, factor_id: factor.id, factor_name: factor.name, horizon, ...comparison(subset.filter(factor.test), subset, horizon) };
}
function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const start = args.get('start-month') || '202401';
  const end = args.get('end-month') || '202606';
  const revenueHistory = loadRevenueHistory();
  const financialByStock = loadFinancialMaster();
  const marketRows = loadMarketRows();
  if (!marketRows.length) throw new Error('No TAIEX market rows found');
  const events = loadEvents(start, end, revenueHistory, financialByStock, marketRows);
  const yearly = [], industry = [], market_regime = [], exclusions = [], overall = [];
  for (const factor of FACTORS) {
    for (const horizon of HORIZONS) {
      overall.push({ factor_id: factor.id, factor_name: factor.name, horizon, ...comparison(events.filter(factor.test), events, horizon) });
      yearly.push(...groupRows(events, factor, horizon, 'year', e => e.year));
      industry.push(...groupRows(events, factor, horizon, 'industry', e => e.industry));
      market_regime.push(...groupRows(events.filter(e => e.market_regime !== 'unknown'), factor, horizon, 'market_regime', e => e.market_regime));
      exclusions.push(
        exclusionRow(events, factor, horizon, 'exclude_2026', '排除 2026', e => e.year !== '2026'),
        exclusionRow(events, factor, horizon, 'exclude_electronics', '排除電子股', e => !e.is_electronic),
        exclusionRow(events, factor, horizon, 'exclude_2026_and_electronics', '同時排除 2026 與電子股', e => e.year !== '2026' && !e.is_electronic),
      );
    }
  }
  const out = {
    schema_version: 1,
    dataset: 'two_stage_fundamental_quality_robustness',
    generated_at: new Date().toISOString(),
    start_month: start,
    end_month: end,
    methodology: {
      status: 'research_only',
      factors: FACTORS.map(({ id, name }) => ({ id, name })),
      horizons: HORIZONS,
      anti_lookahead: 'financial score uses only conservative_known_date <= monthly event date; market regime uses trailing TAIEX data ending at the signal base date',
      market_regime_rule: 'reuse existing trailing 20-trading-day TAIEX regime: strong >= +3%, weak <= -3%, otherwise sideways',
      electronic_industries: [...ELECTRONIC_INDUSTRIES],
      baselines: 'overall uses all mature events; yearly/industry/regime rows use the corresponding subgroup universe as baseline; exclusion tests use the remaining universe after exclusion',
      caution: 'market regime is descriptive research context only, not a strategy gate',
    },
    coverage: Object.fromEntries(HORIZONS.map(h => [h, { complete_events: events.filter(e => e.returns?.[h]?.status === 'complete').length }])),
    overall,
    yearly,
    industry,
    market_regime,
    exclusions,
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT),
    events: events.length,
    coverage: out.coverage,
    rows: { overall: overall.length, yearly: yearly.length, industry: industry.length, market_regime: market_regime.length, exclusions: exclusions.length },
  }, null, 2));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = { FACTORS, HORIZONS, ELECTRONIC_INDUSTRIES, stats, comparison };
