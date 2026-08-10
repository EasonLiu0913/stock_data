#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { scoreComponents } = require('./summarize_mops_revenue_fundamental_acceleration_score');
const { summarize } = require('./summarize_mops_revenue_yoy20_subfactors');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const MASTER_FILE = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'financial-quality-master.json');
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-long-horizon-summary.json');
const HORIZONS = ['d40', 'd60'];

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function parseArgs(argv) { const out = new Map(); for (let i = 0; i < argv.length; i += 1) { if (!argv[i].startsWith('--')) continue; out.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true); } return out; }
function loadRevenueHistory() {
  const byStock = new Map();
  if (!fs.existsSync(REVENUE_ROOT)) return byStock;
  const months = fs.readdirSync(REVENUE_ROOT, { withFileTypes: true }).filter(e => e.isDirectory() && /^20\d{4}$/.test(e.name)).map(e => e.name).sort();
  for (const month of months) {
    const p = readJson(path.join(REVENUE_ROOT, month, 'monthly_revenue.json'), {});
    for (const row of p.companies || []) {
      const id = String(row.stock_code);
      if (!byStock.has(id)) byStock.set(id, new Map());
      byStock.get(id).set(month, row);
    }
  }
  return byStock;
}
function loadFinancialMaster() {
  const master = readJson(MASTER_FILE);
  if (!master || !Array.isArray(master.stocks)) throw new Error(`Missing or invalid ${path.relative(ROOT, MASTER_FILE)}`);
  return new Map(master.stocks.map(s => [String(s.stock_id), s.rows || []]));
}
function latestKnownFinancial(rows, eventDate) {
  if (!eventDate) return null;
  return rows.filter(r => r.conservative_known_date && r.conservative_known_date <= eventDate)
    .sort((a, b) => String(a.conservative_known_date).localeCompare(String(b.conservative_known_date)) || String(a.fiscal_period).localeCompare(String(b.fiscal_period)))
    .at(-1) || null;
}
function loadStudy(start, end, revenueHistory, financialByStock) {
  return fs.readdirSync(SIGNAL_ROOT)
    .filter(name => /^20\d{4}\.json$/.test(name))
    .map(name => name.slice(0, 6))
    .filter(month => (!start || month >= start) && (!end || month <= end))
    .sort()
    .map(month => {
      const payload = readJson(path.join(SIGNAL_ROOT, `${month}.json`), {});
      const events = (payload.events || []).map(event => {
        const stockId = String(event.stock_code);
        const monthly = scoreComponents(event, month, revenueHistory.get(stockId));
        const eventDate = event.effective_trading_date || event.conservative_availability_date || null;
        const fq = latestKnownFinancial(financialByStock.get(stockId) || [], eventDate);
        return { ...event, _two_stage: { monthly_score: monthly.total_score, event_date: eventDate, financial: fq } };
      });
      return { month, events };
    });
}

const FACTORS = [
  { id: 'monthly_ge_8', name: '月營收加速分數 ≥8', test: e => e._two_stage.monthly_score >= 8 },
  { id: 'financial_ge_8', name: '最新可知財報品質分數 ≥8', test: e => Number(e._two_stage.financial?.financial_quality_score) >= 8 },
  { id: 'financial_ge_10', name: '最新可知財報品質分數 ≥10', test: e => Number(e._two_stage.financial?.financial_quality_score) >= 10 },
  { id: 'monthly8_financial8', name: '月營收 ≥8 + 財報品質 ≥8', test: e => e._two_stage.monthly_score >= 8 && Number(e._two_stage.financial?.financial_quality_score) >= 8 },
  { id: 'monthly8_financial10', name: '月營收 ≥8 + 財報品質 ≥10', test: e => e._two_stage.monthly_score >= 8 && Number(e._two_stage.financial?.financial_quality_score) >= 10 },
  { id: 'monthly9_financial10', name: '月營收 ≥9 + 財報品質 ≥10', test: e => e._two_stage.monthly_score >= 9 && Number(e._two_stage.financial?.financial_quality_score) >= 10 },
  { id: 'monthly8_financial9_jump5', name: '月營收 ≥8 + 財報品質 ≥9 + QoQ 分數跳升 ≥5', test: e => e._two_stage.monthly_score >= 8 && Number(e._two_stage.financial?.financial_quality_score) >= 9 && Number(e._two_stage.financial?.score_jump_qoq) >= 5 },
  { id: 'monthly8_financial10_jump3', name: '月營收 ≥8 + 財報品質 ≥10 + QoQ 分數跳升 ≥3', test: e => e._two_stage.monthly_score >= 8 && Number(e._two_stage.financial?.financial_quality_score) >= 10 && Number(e._two_stage.financial?.score_jump_qoq) >= 3 },
];

function rankRows(rows) {
  return rows.slice().sort((a, b) => {
    const ex = Number(b.avg_excess_uplift_pct ?? -Infinity) - Number(a.avg_excess_uplift_pct ?? -Infinity);
    if (ex) return ex;
    const win = Number(b.relative_win_rate_uplift_pp ?? -Infinity) - Number(a.relative_win_rate_uplift_pp ?? -Infinity);
    if (win) return win;
    return Number(b.samples || 0) - Number(a.samples || 0);
  });
}
function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const start = args.get('start-month') || '202401';
  const end = args.get('end-month') || '202606';
  const revenueHistory = loadRevenueHistory();
  const financialByStock = loadFinancialMaster();
  const study = loadStudy(start, end, revenueHistory, financialByStock);
  const rankings = HORIZONS.flatMap(horizon => FACTORS.map(factor => summarize(study, factor, horizon)));
  const byHorizon = {};
  for (const horizon of HORIZONS) byHorizon[horizon] = rankRows(rankings.filter(row => row.horizon === horizon)).map((row, index) => ({ rank_within_horizon: index + 1, ...row }));
  const coverage = {};
  for (const horizon of HORIZONS) {
    const events = study.flatMap(x => x.events);
    coverage[horizon] = {
      complete_events: events.filter(e => e.returns?.[horizon]?.status === 'complete').length,
      pending_market_data: events.filter(e => e.returns?.[horizon]?.status === 'pending_market_data').length,
      missing_stock_price: events.filter(e => e.returns?.[horizon]?.status === 'missing_stock_price').length,
    };
  }
  const output = {
    schema_version: 1,
    dataset: 'two_stage_fundamental_quality_long_horizon_summary',
    generated_at: new Date().toISOString(),
    start_month: start,
    end_month: end,
    methodology: {
      status: 'research_only',
      anti_lookahead: 'financial rows are joined only when conservative_known_date <= monthly event date',
      return_extension: 'D40/D60 reuse the exact base_trading_date from existing monthly signal events, TAIEX benchmark, and unified stock price provider',
      interpretation: 'compare persistence or decay of the previously observed D20 two-stage effect at approximately 2-3 month horizons',
    },
    coverage,
    factors: FACTORS.map(({ id, name }) => ({ id, name })),
    horizons: HORIZONS,
    rankings,
    focus_d40_d60: HORIZONS.flatMap(h => byHorizon[h]),
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), coverage, rankings: rankings.length }, null, 2));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = { FACTORS, HORIZONS, latestKnownFinancial, loadStudy, rankRows };
