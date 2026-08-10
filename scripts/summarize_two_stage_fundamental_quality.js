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
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-experiment.json');
const HORIZONS = ['d1', 'd3', 'd5', 'd10', 'd20'];

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

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const start = args.get('start-month') || '202401';
  const end = args.get('end-month') || '202606';
  const revenueHistory = loadRevenueHistory();
  const financialByStock = loadFinancialMaster();
  const study = loadStudy(start, end, revenueHistory, financialByStock);
  const rankings = HORIZONS.flatMap(horizon => FACTORS.map(factor => summarize(study, factor, horizon)));
  const joinedEvents = study.flatMap(({ month, events }) => events.map(e => ({
    month,
    stock_code: String(e.stock_code),
    stock_name: e.stock_name || null,
    event_date: e._two_stage.event_date,
    monthly_score: e._two_stage.monthly_score,
    financial_period: e._two_stage.financial?.fiscal_period || null,
    financial_known_date: e._two_stage.financial?.conservative_known_date || null,
    financial_quality_score: e._two_stage.financial?.financial_quality_score ?? null,
    financial_score_jump_qoq: e._two_stage.financial?.score_jump_qoq ?? null,
  })));
  const withFinancial = joinedEvents.filter(e => Number.isFinite(Number(e.financial_quality_score))).length;
  const output = {
    schema_version: 1,
    dataset: 'two_stage_fundamental_quality_experiment',
    generated_at: new Date().toISOString(),
    start_month: start,
    end_month: end,
    methodology: {
      status: 'research_only',
      hypothesis: 'monthly revenue acceleration can discover candidates early, while the latest financial statement known at the event date can confirm earnings quality or a quality regime change',
      anti_lookahead: 'financial rows are joined only when conservative_known_date <= monthly event effective_trading_date/conservative_availability_date',
      baseline: 'same-month listed-stock universe with complete return horizon',
      current_horizons: HORIZONS,
      limitation: 'existing monthly-signal files currently provide D1/D3/D5/D10/D20; D40/D60 require extending the underlying return-enrichment dataset before those horizons can be tested without inventing data',
    },
    coverage: { total_monthly_events: joinedEvents.length, events_with_known_financial_score: withFinancial },
    factors: FACTORS.map(({ id, name }) => ({ id, name })),
    horizons: HORIZONS,
    rankings,
    joined_events: joinedEvents,
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), rankings: rankings.length, total_monthly_events: joinedEvents.length, events_with_known_financial_score: withFinancial }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
