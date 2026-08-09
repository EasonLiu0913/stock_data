#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { summarize } = require('./summarize_mops_revenue_yoy20_subfactors');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const OUTPUT = path.join(SIGNAL_ROOT, 'fundamental-acceleration-breakout-experiment.json');
const HORIZONS = ['d1', 'd3', 'd5', 'd10', 'd20'];

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    out.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
  }
  return out;
}
function prevMonth(month, n = 1) {
  let y = Number(month.slice(0, 4));
  let m = Number(month.slice(4, 6));
  for (let i = 0; i < n; i += 1) {
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return `${y}${String(m).padStart(2, '0')}`;
}
function revenueHigh(stockMap, month, lookback) {
  const values = [];
  for (let i = 0; i < lookback; i += 1) {
    const row = stockMap?.get(prevMonth(month, i));
    const value = Number(row?.monthly_revenue_thousand_twd);
    if (!Number.isFinite(value)) return false;
    values.push(value);
  }
  return values[0] === Math.max(...values);
}
function loadRevenueHistory() {
  const byStock = new Map();
  if (!fs.existsSync(REVENUE_ROOT)) return byStock;
  const months = fs.readdirSync(REVENUE_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^20\d{4}$/.test(entry.name))
    .map(entry => entry.name)
    .sort();
  for (const month of months) {
    const payload = readJson(path.join(REVENUE_ROOT, month, 'monthly_revenue.json'), {});
    for (const row of payload.companies || []) {
      const code = String(row.stock_code);
      if (!byStock.has(code)) byStock.set(code, new Map());
      byStock.get(code).set(month, row);
    }
  }
  return byStock;
}
function loadStudyMonths(start, end) {
  if (!fs.existsSync(SIGNAL_ROOT)) return [];
  return fs.readdirSync(SIGNAL_ROOT)
    .filter(name => /^20\d{4}\.json$/.test(name))
    .map(name => name.slice(0, 6))
    .filter(month => (!start || month >= start) && (!end || month <= end))
    .sort()
    .map(month => ({ month, payload: readJson(path.join(SIGNAL_ROOT, `${month}.json`), {}) }));
}

function evaluateSignal(event, month, stockMap) {
  const yoy = Number(event.factors?.yoy_pct);
  const mom = Number(event.factors?.mom_pct);
  const acceleration = Number(event.factors?.yoy_acceleration_pct_points);
  const accelerating = event.factors?.yoy_accelerating === true;
  const high3 = revenueHigh(stockMap, month, 3);
  const high6 = revenueHigh(stockMap, month, 6);
  const high12 = revenueHigh(stockMap, month, 12);
  return {
    acceleration_base: yoy >= 20 && mom > 0 && accelerating,
    acceleration_3m_high: yoy >= 20 && mom > 0 && accelerating && high3,
    acceleration_6m_high: yoy >= 20 && mom > 0 && accelerating && high6,
    acceleration_12m_high: yoy >= 20 && mom > 0 && accelerating && high12,
    acceleration_breakout: yoy >= 30 && mom >= 10 && acceleration >= 10 && high6,
    acceleration_breakout_strong: yoy >= 50 && mom >= 20 && acceleration >= 20 && high6,
  };
}

const FACTORS = [
  { id: 'acceleration_base', name: 'YoY ≥20% + MoM >0 + YoY 加速' },
  { id: 'acceleration_3m_high', name: '基本面加速 + 營收3月新高' },
  { id: 'acceleration_6m_high', name: '基本面加速 + 營收6月新高' },
  { id: 'acceleration_12m_high', name: '基本面加速 + 營收12月新高' },
  { id: 'acceleration_breakout', name: '基本面加速突破：YoY ≥30%、MoM ≥10%、YoY加速度 ≥10pp、營收6月新高' },
  { id: 'acceleration_breakout_strong', name: '強基本面加速突破：YoY ≥50%、MoM ≥20%、YoY加速度 ≥20pp、營收6月新高' },
].map(factor => ({ ...factor, test: event => event._fab?.[factor.id] === true }));

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const start = args.get('start-month') || null;
  const end = args.get('end-month') || null;
  const history = loadRevenueHistory();
  const study = loadStudyMonths(start, end).map(({ month, payload }) => ({
    month,
    events: (payload.events || []).map(event => ({
      ...event,
      _fab: evaluateSignal(event, month, history.get(String(event.stock_code))),
    })),
  }));
  if (!study.length) throw new Error('No study months found');

  const rankings = HORIZONS.flatMap(horizon => FACTORS.map(factor => summarize(study, factor, horizon)));
  const output = {
    schema_version: 1,
    dataset: 'mops_monthly_revenue_fundamental_acceleration_breakout_experiment',
    generated_at: new Date().toISOString(),
    start_month: study[0].month,
    end_month: study.at(-1).month,
    methodology: {
      status: 'research_only',
      hypothesis: 'companies with simultaneously accelerating YoY growth, positive MoM growth and new revenue highs may represent an early fundamental breakout pattern',
      baseline: 'same-month listed-stock universe',
      availability: 'inherits the conservative next-month day-15 availability rule from monthly signal details',
      thresholds: {
        acceleration_base: 'YoY >= 20%, MoM > 0, YoY accelerating',
        acceleration_breakout: 'YoY >= 30%, MoM >= 10%, YoY acceleration >= 10 percentage points, 6-month revenue high',
        acceleration_breakout_strong: 'YoY >= 50%, MoM >= 20%, YoY acceleration >= 20 percentage points, 6-month revenue high',
      },
      limitation: 'This first version covers the revenue-acceleration leg only. Gross-margin, EPS, product-mix and shipment/capacity signals require a separate financial-statement/operational dataset and must not be inferred from monthly revenue.',
      promotion_rule: 'Do not promote to a production strategy until long-history stability, industry robustness and later financial-statement enrichment are validated.',
    },
    factors: FACTORS.map(({ id, name }) => ({ id, name })),
    horizons: HORIZONS,
    rankings,
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), rows: rankings.length }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { FACTORS, evaluateSignal, prevMonth, revenueHigh };
