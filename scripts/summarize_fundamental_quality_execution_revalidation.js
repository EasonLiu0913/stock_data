#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  getDailyPrice,
  clearCaches,
  loadFromHistorySma,
  loadFromLegacyFubon,
  loadFromTwseMiIndex,
} = require('./lib/stock_price_provider');
const { scoreComponents } = require('./summarize_mops_revenue_fundamental_acceleration_score');
const { latestKnownFinancial } = require('./summarize_two_stage_fundamental_quality_long_horizons');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const MASTER_FILE = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'financial-quality-master.json');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'fundamental-quality-execution-revalidation.json');
const PRICE_LOADERS = [loadFromHistorySma, loadFromLegacyFubon, loadFromTwseMiIndex];
const HORIZONS = [1, 3, 5, 10, 20, 40, 60];
const POLICIES = [
  { id: 'signal_close', label: '訊號日收盤', timing: 'benchmark_only' },
  { id: 'next_open', label: '隔日開盤', timing: 'earliest_executable' },
  { id: 'next_close', label: '隔日收盤', timing: 'executable' },
];
const ELECTRONIC_INDUSTRIES = new Set([
  '半導體業','電腦及週邊設備業','光電業','通信網路業','電子零組件業','電子通路業','資訊服務業','其他電子業','電子工業',
]);

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function mean(values) {
  const xs = values.filter(Number.isFinite);
  return xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : null;
}
function median(values) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}
function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}
function pct(count, total) {
  return total ? round(count / total * 100) : null;
}
function parseArgs(argv) {
  const out = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    const key = argv[index].slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
    out.set(key, value);
  }
  return out;
}
function loadRevenueHistory(root = ROOT) {
  const revenueRoot = path.join(root, 'data_mops_monthly_revenue');
  const byMonth = new Map();
  const byStock = new Map();
  for (const entry of fs.readdirSync(revenueRoot, { withFileTypes: true }).filter(item => item.isDirectory() && /^20\d{4}$/.test(item.name))) {
    const payload = readJson(path.join(revenueRoot, entry.name, 'monthly_revenue.json'), {});
    const monthMap = new Map();
    for (const row of payload.companies || []) {
      const id = String(row.stock_code);
      monthMap.set(id, row);
      if (!byStock.has(id)) byStock.set(id, new Map());
      byStock.get(id).set(entry.name, row);
    }
    byMonth.set(entry.name, monthMap);
  }
  return { byMonth, byStock };
}
function loadFinancialMaster(root = ROOT) {
  const payload = readJson(path.join(root, 'data_prediction_analysis', 'quarterly-financial-quality', 'financial-quality-master.json'));
  if (!payload || !Array.isArray(payload.stocks)) throw new Error('Missing financial-quality-master.json');
  return new Map(payload.stocks.map(stock => [String(stock.stock_id), stock.rows || []]));
}
function loadMarketRows(root = ROOT) {
  const payload = readJson(path.join(root, 'data_twse_market_chart', 'market_chart.json'), {});
  return (payload.data || [])
    .filter(row => /^20\d{6}$/.test(String(row.date)) && Number.isFinite(Number(row.close)))
    .map(row => ({ date: String(row.date), close: Number(row.close) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function getPrice(stockId, date, root = ROOT) {
  return getDailyPrice(stockId, date, { root, loaders: PRICE_LOADERS });
}
function loadCandidates(startMonth, endMonth, history, financialByStock, root = ROOT) {
  const signalRoot = path.join(root, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
  const events = [];
  const diagnostics = { electronic_fas8_events: 0, missing_known_financial: 0, financial_below_10: 0, included: 0 };
  const months = fs.readdirSync(signalRoot)
    .filter(name => /^20\d{4}\.json$/.test(name))
    .map(name => name.slice(0, 6))
    .filter(month => (!startMonth || month >= startMonth) && (!endMonth || month <= endMonth))
    .sort();
  for (const month of months) {
    const payload = readJson(path.join(signalRoot, `${month}.json`), {});
    const revenueMap = history.byMonth.get(month) || new Map();
    for (const event of payload.events || []) {
      const stockId = String(event.stock_code);
      const revenue = revenueMap.get(stockId) || {};
      if (!ELECTRONIC_INDUSTRIES.has(revenue.industry || '未分類')) continue;
      const monthly = scoreComponents(event, month, history.byStock.get(stockId));
      if (Number(monthly.total_score) < 8) continue;
      diagnostics.electronic_fas8_events += 1;
      const eventDate = event.effective_trading_date || event.conservative_availability_date || null;
      const financial = latestKnownFinancial(financialByStock.get(stockId) || [], eventDate);
      if (!financial || !Number.isFinite(Number(financial.financial_quality_score))) {
        diagnostics.missing_known_financial += 1;
        continue;
      }
      if (Number(financial.financial_quality_score) < 10) {
        diagnostics.financial_below_10 += 1;
        continue;
      }
      if (!event.base_trading_date) continue;
      events.push({
        month,
        stock_id: stockId,
        stock_name: revenue.company_name || event.company_name || null,
        signal_date: String(event.base_trading_date),
        fas_score: Number(monthly.total_score),
        fq_score: Number(financial.financial_quality_score),
        financial_period: financial.period || financial.financial_period || null,
      });
      diagnostics.included += 1;
    }
  }
  return { events, diagnostics };
}

function buildExecutionEvent(event, marketRows, indexByDate, root = ROOT) {
  const signalIndex = indexByDate.get(event.signal_date);
  if (!Number.isInteger(signalIndex)) return null;
  const nextDate = marketRows[signalIndex + 1]?.date;
  if (!nextDate) return null;
  const signalPrice = getPrice(event.stock_id, event.signal_date, root);
  const nextPrice = getPrice(event.stock_id, nextDate, root);
  if (!Number.isFinite(signalPrice?.close) || !Number.isFinite(nextPrice?.open) || !Number.isFinite(nextPrice?.close)) return null;
  const gapPct = (nextPrice.open / signalPrice.close - 1) * 100;
  return {
    ...event,
    signal_index: signalIndex,
    execution_date: nextDate,
    signal_close: signalPrice.close,
    next_open: nextPrice.open,
    next_close: nextPrice.close,
    overnight_gap_pct: gapPct,
    next_close_vs_signal_close_pct: (nextPrice.close / signalPrice.close - 1) * 100,
    sources: {
      signal: signalPrice.source,
      next: nextPrice.source,
    },
  };
}

function entryForPolicy(executionEvent, policyId) {
  if (!executionEvent) return null;
  if (policyId === 'signal_close') {
    return { entry_index: executionEvent.signal_index, entry_date: executionEvent.signal_date, entry_price: executionEvent.signal_close };
  }
  if (policyId === 'next_open') {
    return { entry_index: executionEvent.signal_index + 1, entry_date: executionEvent.execution_date, entry_price: executionEvent.next_open };
  }
  if (policyId === 'next_close') {
    return { entry_index: executionEvent.signal_index + 1, entry_date: executionEvent.execution_date, entry_price: executionEvent.next_close };
  }
  throw new Error(`Unknown execution policy: ${policyId}`);
}

function pathStats(stockId, entryIndex, entryPrice, horizon, marketRows, root = ROOT) {
  const exitIndex = entryIndex + horizon;
  if (!marketRows[exitIndex] || !Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  let maxHigh = -Infinity;
  let minLow = Infinity;
  for (let index = entryIndex + 1; index <= exitIndex; index += 1) {
    const date = marketRows[index]?.date;
    if (!date) return null;
    const price = getPrice(stockId, date, root);
    if (!price) return null;
    if (Number.isFinite(price.high)) maxHigh = Math.max(maxHigh, price.high);
    if (Number.isFinite(price.low)) minLow = Math.min(minLow, price.low);
  }
  const exitPrice = getPrice(stockId, marketRows[exitIndex].date, root);
  if (!Number.isFinite(exitPrice?.close) || !Number.isFinite(maxHigh) || !Number.isFinite(minLow)) return null;
  return {
    endpoint_pct: (exitPrice.close / entryPrice - 1) * 100,
    mfe_pct: (maxHigh / entryPrice - 1) * 100,
    mae_pct: (minLow / entryPrice - 1) * 100,
  };
}

function summarizeTrades(trades) {
  const n = trades.length;
  return {
    trades: n,
    endpoint: {
      average_pct: round(mean(trades.map(item => item.stats.endpoint_pct))),
      median_pct: round(median(trades.map(item => item.stats.endpoint_pct))),
      positive_rate_pct: pct(trades.filter(item => item.stats.endpoint_pct > 0).length, n),
      ge10_rate_pct: pct(trades.filter(item => item.stats.endpoint_pct >= 10).length, n),
      ge30_rate_pct: pct(trades.filter(item => item.stats.endpoint_pct >= 30).length, n),
    },
    mfe: {
      average_pct: round(mean(trades.map(item => item.stats.mfe_pct))),
      median_pct: round(median(trades.map(item => item.stats.mfe_pct))),
    },
    mae: {
      average_pct: round(mean(trades.map(item => item.stats.mae_pct))),
      median_pct: round(median(trades.map(item => item.stats.mae_pct))),
    },
  };
}

function gapBucket(gapPct) {
  if (!Number.isFinite(gapPct)) return 'missing';
  if (gapPct <= 0) return 'gap_le_0';
  if (gapPct <= 2) return 'gap_0_2';
  if (gapPct <= 5) return 'gap_2_5';
  return 'gap_gt_5';
}

function buildRows(executionEvents, marketRows, root = ROOT) {
  const rows = [];
  for (const horizon of HORIZONS) {
    const eligible = executionEvents.filter(event => marketRows[event.signal_index + 1 + horizon]);
    const byPolicy = new Map();
    for (const policy of POLICIES) {
      const trades = [];
      for (const event of eligible) {
        const entry = entryForPolicy(event, policy.id);
        const stats = pathStats(event.stock_id, entry.entry_index, entry.entry_price, horizon, marketRows, root);
        if (stats) trades.push({ event, entry, stats });
      }
      const summary = summarizeTrades(trades);
      const row = { policy_id: policy.id, policy_label: policy.label, timing: policy.timing, horizon: `d${horizon}`, eligible_events: eligible.length, ...summary };
      byPolicy.set(policy.id, row);
      rows.push(row);
    }
    const benchmark = byPolicy.get('signal_close');
    for (const policyId of ['next_open', 'next_close']) {
      const row = byPolicy.get(policyId);
      row.vs_signal_close = {
        average_endpoint_delta_pct: round(row.endpoint.average_pct - benchmark.endpoint.average_pct),
        median_endpoint_delta_pct: round(row.endpoint.median_pct - benchmark.endpoint.median_pct),
        positive_rate_delta_pp: round(row.endpoint.positive_rate_pct - benchmark.endpoint.positive_rate_pct),
        median_mfe_delta_pct: round(row.mfe.median_pct - benchmark.mfe.median_pct),
        median_mae_delta_pct: round(row.mae.median_pct - benchmark.mae.median_pct),
      };
    }
  }
  return rows;
}

function buildGapAnalysis(executionEvents, marketRows, root = ROOT) {
  const bucketOrder = ['gap_le_0', 'gap_0_2', 'gap_2_5', 'gap_gt_5'];
  const result = {
    overall: {
      events: executionEvents.length,
      average_gap_pct: round(mean(executionEvents.map(event => event.overnight_gap_pct))),
      median_gap_pct: round(median(executionEvents.map(event => event.overnight_gap_pct))),
      gap_gt_5_rate_pct: pct(executionEvents.filter(event => event.overnight_gap_pct > 5).length, executionEvents.length),
    },
    horizons: {},
  };
  for (const horizon of [5, 20, 60]) {
    result.horizons[`d${horizon}`] = [];
    for (const bucket of bucketOrder) {
      const trades = [];
      for (const event of executionEvents.filter(item => gapBucket(item.overnight_gap_pct) === bucket && marketRows[item.signal_index + 1 + horizon])) {
        const entry = entryForPolicy(event, 'next_open');
        const stats = pathStats(event.stock_id, entry.entry_index, entry.entry_price, horizon, marketRows, root);
        if (stats) trades.push({ event, entry, stats });
      }
      result.horizons[`d${horizon}`].push({ bucket, ...summarizeTrades(trades) });
    }
  }
  return result;
}

function chooseProductionRecommendation(rows) {
  const result = { policy_id: null, status: 'insufficient_evidence', rationale: [] };
  const focusHorizons = ['d5', 'd20', 'd60'];
  const comparisons = focusHorizons.map(horizon => ({
    horizon,
    open: rows.find(row => row.policy_id === 'next_open' && row.horizon === horizon),
    close: rows.find(row => row.policy_id === 'next_close' && row.horizon === horizon),
  })).filter(item => item.open?.trades && item.close?.trades);
  if (!comparisons.length) return result;
  let openWins = 0;
  let closeWins = 0;
  for (const item of comparisons) {
    const openScore = (item.open.endpoint.median_pct || 0) + (item.open.endpoint.positive_rate_pct || 0) / 10;
    const closeScore = (item.close.endpoint.median_pct || 0) + (item.close.endpoint.positive_rate_pct || 0) / 10;
    if (openScore >= closeScore) openWins += 1; else closeWins += 1;
    result.rationale.push({
      horizon: item.horizon,
      next_open_median_pct: item.open.endpoint.median_pct,
      next_close_median_pct: item.close.endpoint.median_pct,
      next_open_positive_rate_pct: item.open.endpoint.positive_rate_pct,
      next_close_positive_rate_pct: item.close.endpoint.positive_rate_pct,
    });
  }
  if (openWins >= closeWins) {
    result.policy_id = 'next_open';
    result.status = 'recommended';
    result.reason = '隔日開盤是最早可執行價格，且在主要 horizons 的中位報酬與勝率綜合比較未劣於隔日收盤。';
  } else {
    result.policy_id = 'next_close';
    result.status = 'recommended';
    result.reason = '隔日收盤在主要 horizons 的中位報酬與勝率綜合比較較佳，足以補償延後一天內的價格風險。';
  }
  return result;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const startMonth = args.get('start-month') || '202401';
  const endMonth = args.get('end-month') || '202606';
  const history = loadRevenueHistory(ROOT);
  const financialByStock = loadFinancialMaster(ROOT);
  const marketRows = loadMarketRows(ROOT);
  const indexByDate = new Map(marketRows.map((row, index) => [row.date, index]));
  const loaded = loadCandidates(startMonth, endMonth, history, financialByStock, ROOT);
  const executionEvents = [];
  let processed = 0;
  for (const event of loaded.events) {
    const built = buildExecutionEvent(event, marketRows, indexByDate, ROOT);
    if (built) executionEvents.push(built);
    if (++processed % 20 === 0) clearCaches();
  }
  clearCaches();
  const rows = buildRows(executionEvents, marketRows, ROOT);
  clearCaches();
  const gapAnalysis = buildGapAnalysis(executionEvents, marketRows, ROOT);
  clearCaches();
  const productionRecommendation = chooseProductionRecommendation(rows);
  const output = {
    schema_version: 1,
    dataset: 'fundamental_quality_execution_revalidation',
    generated_at: new Date().toISOString(),
    start_month: startMonth,
    end_month: endMonth,
    strategy_id: 'two_stage_fundamental_quality_direct_entry_v1',
    strategy_label: '財報品質訊號',
    methodology: {
      universe: '電子股 FAS >= 8 + corrected latest-known FQ >= 10',
      signal_close_role: 'benchmark_only; production V1 is generated after the signal-day close',
      execution_policies: POLICIES,
      horizons: HORIZONS.map(value => `d${value}`),
      holding_rule: 'D1/D3/D5/D10/D20/D40/D60 are measured from each policy actual entry timestamp using later trading-day closes.',
      fair_sample_rule: 'A horizon is compared only when enough market history exists through next trading day plus that holding horizon. Missing required OHLC excludes the trade.',
      anti_lookahead: 'candidate membership uses corrected latest-known FQ; next-open/next-close prices are read only from the next trading session.',
      gap_definition: 'next_open / signal_close - 1',
    },
    coverage: {
      candidate_events: loaded.events.length,
      execution_price_complete_events: executionEvents.length,
      execution_price_coverage_pct: pct(executionEvents.length, loaded.events.length),
      diagnostics: loaded.diagnostics,
    },
    execution_events: executionEvents.map(event => ({
      month: event.month,
      stock_id: event.stock_id,
      stock_name: event.stock_name,
      signal_date: event.signal_date,
      execution_date: event.execution_date,
      fas_score: event.fas_score,
      fq_score: event.fq_score,
      financial_period: event.financial_period,
      signal_close: event.signal_close,
      next_open: event.next_open,
      next_close: event.next_close,
      overnight_gap_pct: round(event.overnight_gap_pct),
      next_close_vs_signal_close_pct: round(event.next_close_vs_signal_close_pct),
      gap_bucket: gapBucket(event.overnight_gap_pct),
      sources: event.sources,
    })),
    rows,
    gap_analysis: gapAnalysis,
    production_recommendation: productionRecommendation,
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT),
    candidates: loaded.events.length,
    execution_price_complete_events: executionEvents.length,
    rows: rows.length,
    recommendation: productionRecommendation,
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error?.stack || error); process.exitCode = 1; }
}

module.exports = {
  HORIZONS,
  POLICIES,
  buildExecutionEvent,
  entryForPolicy,
  gapBucket,
  summarizeTrades,
  chooseProductionRecommendation,
};
