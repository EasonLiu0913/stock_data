#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { FACTORS } = require('./summarize_mops_revenue_industry_breakdown');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT = path.join(SIGNAL_ROOT, 'market-regime-breakdown.json');
const HORIZONS = ['d5', 'd10', 'd20'];
const TARGET_INDUSTRIES = ['航運業', '電腦及週邊設備業', '生技醫療業', '其他電子業'];
const REGIMES = ['strong', 'sideways', 'weak'];
const MIN_SAMPLES = 20;
const MIN_MONTHS = 2;
const LOOKBACK_TRADING_DAYS = 20;
const STRONG_THRESHOLD_PCT = 3;
const WEAK_THRESHOLD_PCT = -3;

const mean = xs => {
  const a = xs.filter(Number.isFinite);
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
};
const round = (v, d = 4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function parseArgs(argv) {
  const m = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    m.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
  }
  return m;
}
function prevMonth(month, n = 1) {
  let y = Number(month.slice(0, 4)), m = Number(month.slice(4, 6));
  for (let i = 0; i < n; i++) { m--; if (m === 0) { m = 12; y--; } }
  return `${y}${String(m).padStart(2, '0')}`;
}
function loadRevenueHistory() {
  const months = fs.readdirSync(REVENUE_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^20\d{4}$/.test(e.name)).map(e => e.name).sort();
  const byMonth = new Map(), byStock = new Map();
  for (const month of months) {
    const payload = readJson(path.join(REVENUE_ROOT, month, 'monthly_revenue.json'), {});
    const map = new Map();
    for (const row of payload.companies || []) {
      const code = String(row.stock_code);
      map.set(code, row);
      if (!byStock.has(code)) byStock.set(code, new Map());
      byStock.get(code).set(month, row);
    }
    byMonth.set(month, map);
  }
  return { byMonth, byStock };
}
function loadStudy(start, end) {
  return fs.readdirSync(SIGNAL_ROOT)
    .filter(n => /^20\d{4}\.json$/.test(n)).map(n => n.slice(0, 6))
    .filter(m => (!start || m >= start) && (!end || m <= end)).sort()
    .map(month => ({ month, payload: readJson(path.join(SIGNAL_ROOT, `${month}.json`), {}) }));
}
function loadMarketRows() {
  const payload = readJson(MARKET_FILE, {});
  return (payload.data || [])
    .filter(r => /^20\d{6}$/.test(String(r.date)) && Number.isFinite(Number(r.close)))
    .map(r => ({ date: String(r.date), close: Number(r.close) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function trailingMarketRegime(marketRows, baseTradingDate, lookback = LOOKBACK_TRADING_DAYS) {
  const index = marketRows.findIndex(r => r.date === baseTradingDate);
  if (index < lookback || index < 0) return null;
  const start = marketRows[index - lookback];
  const end = marketRows[index];
  if (!Number.isFinite(start?.close) || start.close <= 0 || !Number.isFinite(end?.close)) return null;
  const returnPct = ((end.close / start.close) - 1) * 100;
  const code = returnPct >= STRONG_THRESHOLD_PCT ? 'strong' : returnPct <= WEAK_THRESHOLD_PCT ? 'weak' : 'sideways';
  return {
    code,
    label: code === 'strong' ? '市場偏強' : code === 'weak' ? '市場偏弱' : '市場震盪',
    base_trading_date: baseTradingDate,
    lookback_start_date: start.date,
    lookback_trading_days: lookback,
    trailing_return_pct: round(returnPct),
  };
}
function factorMatch(factor, event, row, stockMap, month) {
  return factor.test({ ...event, revenue_month: month }, row, stockMap);
}
function summarizeGroup(months, history, marketRows, factor, horizon, industry, regime) {
  const allFactor = [], allIndustry = [], monthly = [];
  for (const { month, payload } of months) {
    const revMap = history.byMonth.get(month) || new Map();
    const complete = (payload.events || []).filter(e => e.returns?.[horizon]?.status === 'complete');
    const representative = complete.find(e => e.base_trading_date);
    if (!representative) continue;
    const regimeInfo = trailingMarketRegime(marketRows, representative.base_trading_date);
    if (!regimeInfo || regimeInfo.code !== regime) continue;
    const industryEvents = complete.filter(e => (revMap.get(String(e.stock_code))?.industry || '未分類') === industry);
    const factorEvents = industryEvents.filter(e => factorMatch(
      factor,
      e,
      revMap.get(String(e.stock_code)),
      history.byStock.get(String(e.stock_code)),
      month,
    ));
    if (!factorEvents.length || !industryEvents.length) continue;
    const fr = factorEvents.map(e => e.returns[horizon]);
    const ir = industryEvents.map(e => e.returns[horizon]);
    const win = rs => rs.length ? rs.filter(r => r.outperformed_market === true).length / rs.length * 100 : null;
    const ex = rs => mean(rs.map(r => Number(r.excess_return_pct)));
    monthly.push({
      month,
      regime: regimeInfo,
      samples: fr.length,
      industry_samples: ir.length,
      factor_win_rate: round(win(fr)),
      industry_win_rate: round(win(ir)),
      industry_win_uplift_pp: round(win(fr) - win(ir)),
      factor_avg_excess_pct: round(ex(fr)),
      industry_avg_excess_pct: round(ex(ir)),
      industry_excess_uplift_pct: round(ex(fr) - ex(ir)),
    });
    allFactor.push(...fr);
    allIndustry.push(...ir);
  }
  const samples = allFactor.length;
  if (!samples) return null;
  const coveredMonths = monthly.length;
  const credible = samples >= MIN_SAMPLES && coveredMonths >= MIN_MONTHS;
  const win = rs => rs.length ? rs.filter(r => r.outperformed_market === true).length / rs.length * 100 : null;
  const ex = rs => mean(rs.map(r => Number(r.excess_return_pct)));
  const positiveWinMonths = monthly.filter(m => m.industry_win_uplift_pp > 0).length / coveredMonths * 100;
  const positiveExcessMonths = monthly.filter(m => m.industry_excess_uplift_pct > 0).length / coveredMonths * 100;
  return {
    factor_id: factor.id,
    factor_name: factor.name,
    industry,
    horizon,
    regime,
    regime_label: regime === 'strong' ? '市場偏強' : regime === 'weak' ? '市場偏弱' : '市場震盪',
    samples,
    covered_months: coveredMonths,
    credible,
    min_samples: MIN_SAMPLES,
    min_months: MIN_MONTHS,
    factor_relative_win_rate: round(win(allFactor)),
    industry_relative_win_rate: round(win(allIndustry)),
    industry_win_uplift_pp: round(win(allFactor) - win(allIndustry)),
    factor_avg_excess_pct: round(ex(allFactor)),
    industry_avg_excess_pct: round(ex(allIndustry)),
    industry_excess_uplift_pct: round(ex(allFactor) - ex(allIndustry)),
    positive_industry_win_uplift_month_rate: round(positiveWinMonths),
    positive_industry_excess_uplift_month_rate: round(positiveExcessMonths),
    monthly,
  };
}
function buildCrossRegimeSummary(rows) {
  const groups = new Map();
  for (const row of rows.filter(r => r.credible)) {
    const key = [row.factor_id, row.industry, row.horizon].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map(group => {
    const first = group[0];
    const positive = group.filter(r => r.industry_win_uplift_pp > 0 && r.industry_excess_uplift_pct > 0);
    return {
      factor_id: first.factor_id,
      factor_name: first.factor_name,
      industry: first.industry,
      horizon: first.horizon,
      credible_regimes: group.length,
      positive_regimes: positive.length,
      all_credible_regimes_positive: group.length >= 2 && positive.length === group.length,
      avg_industry_win_uplift_pp: round(mean(group.map(r => r.industry_win_uplift_pp))),
      avg_industry_excess_uplift_pct: round(mean(group.map(r => r.industry_excess_uplift_pct))),
      regimes: group.map(r => ({
        regime: r.regime,
        samples: r.samples,
        covered_months: r.covered_months,
        industry_win_uplift_pp: r.industry_win_uplift_pp,
        industry_excess_uplift_pct: r.industry_excess_uplift_pct,
      })),
    };
  }).sort((a, b) => Number(b.all_credible_regimes_positive) - Number(a.all_credible_regimes_positive)
    || b.positive_regimes - a.positive_regimes
    || (b.avg_industry_win_uplift_pp || -Infinity) - (a.avg_industry_win_uplift_pp || -Infinity));
}
function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const start = args.get('start-month') || null;
  const end = args.get('end-month') || null;
  const history = loadRevenueHistory();
  const months = loadStudy(start, end);
  const marketRows = loadMarketRows();
  if (!months.length) throw new Error('No study months found');
  if (!marketRows.length) throw new Error('No TAIEX market rows found');
  const rows = [];
  for (const horizon of HORIZONS) {
    for (const factor of FACTORS) {
      for (const industry of TARGET_INDUSTRIES) {
        for (const regime of REGIMES) {
          const row = summarizeGroup(months, history, marketRows, factor, horizon, industry, regime);
          if (row) rows.push(row);
        }
      }
    }
  }
  const out = {
    schema_version: 1,
    dataset: 'mops_monthly_revenue_market_regime_breakdown',
    generated_at: new Date().toISOString(),
    start_month: months[0].month,
    end_month: months.at(-1).month,
    methodology: {
      purpose: 'research whether selected revenue factors retain same-industry uplift across market regimes; never used as a strategy gate',
      selected_industries: TARGET_INDUSTRIES,
      market_regime_source: 'TAIEX closes known on or before the signal base trading date',
      market_regime_rule: `trailing ${LOOKBACK_TRADING_DAYS}-trading-day TAIEX return ending at signal base date: strong >= ${STRONG_THRESHOLD_PCT}%, weak <= ${WEAK_THRESHOLD_PCT}%, otherwise sideways`,
      no_future_leakage: true,
      primary_baseline: 'same-industry observations in the same regime months and horizon',
      credibility_rule: `samples >= ${MIN_SAMPLES} and covered_months >= ${MIN_MONTHS}`,
      caution: 'market regime is descriptive research context only and must not exclude candidates from prediction strategy lists',
    },
    horizons: HORIZONS,
    regimes: REGIMES,
    industries: TARGET_INDUSTRIES,
    factors: FACTORS.map(({ id, name }) => ({ id, name })),
    rows,
    cross_regime_summary: buildCrossRegimeSummary(rows),
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT),
    rows: rows.length,
    credible_rows: rows.filter(r => r.credible).length,
    robust_cross_regime_rows: out.cross_regime_summary.filter(r => r.all_credible_regimes_positive).length,
  }, null, 2));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = {
  trailingMarketRegime,
  summarizeGroup,
  buildCrossRegimeSummary,
  LOOKBACK_TRADING_DAYS,
  STRONG_THRESHOLD_PCT,
  WEAK_THRESHOLD_PCT,
};
