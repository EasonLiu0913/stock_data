#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { getDailyPrice, clearCaches } = require('./lib/stock_price_provider');

const ROOT = path.resolve(__dirname, '..');
const STOCKS = [
  { code: '3583', name: '辛耘' },
  { code: '2467', name: '志聖' },
  { code: '6196', name: '帆宣' },
  { code: '6139', name: '亞翔' },
  { code: '6691', name: '洋基工程' },
  { code: '2404', name: '漢唐' },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pctReturn(start, end) {
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(end)) return null;
  return Number((((end / start) - 1) * 100).toFixed(2));
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function loadMarketRows(root = ROOT) {
  const file = path.join(root, 'data_twse_market_chart', 'market_chart.json');
  const payload = readJson(file);
  return (payload.data || [])
    .map(row => ({ date: String(row.date || ''), close: Number(row.close) }))
    .filter(row => /^20\d{6}$/.test(row.date) && Number.isFinite(row.close) && row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function priceAt(stockCode, row, root = ROOT) {
  return row ? getDailyPrice(stockCode, row.date, { root }) : null;
}

function classify(stock20d, excess20d) {
  if (!Number.isFinite(stock20d) || !Number.isFinite(excess20d)) return 'no_data';
  if (stock20d > 0 && excess20d > 0) return 'strong';
  if (stock20d < 0 && excess20d < 0) return 'weak';
  return 'neutral';
}

function buildStock(stock, rows, root = ROOT) {
  const latestIndex = rows.length - 1;
  const latestRow = rows[latestIndex];
  const prevRow = rows[latestIndex - 1];
  const row5 = rows[latestIndex - 5];
  const row20 = rows[latestIndex - 20];
  const latest = priceAt(stock.code, latestRow, root);
  const prev = priceAt(stock.code, prevRow, root);
  const p5 = priceAt(stock.code, row5, root);
  const p20 = priceAt(stock.code, row20, root);
  const oneDay = pctReturn(prev?.close, latest?.close);
  const fiveDay = pctReturn(p5?.close, latest?.close);
  const twentyDay = pctReturn(p20?.close, latest?.close);
  const market20d = pctReturn(row20?.close, latestRow?.close);
  const excess20d = Number.isFinite(twentyDay) && Number.isFinite(market20d)
    ? round(twentyDay - market20d)
    : null;
  return {
    code: stock.code,
    name: stock.name,
    trading_date: latestRow?.date || null,
    close: latest?.close ?? null,
    return_1d_pct: oneDay,
    return_5d_pct: fiveDay,
    return_20d_pct: twentyDay,
    market_return_20d_pct: market20d,
    excess_return_20d_pct: excess20d,
    state: classify(twentyDay, excess20d),
    source: latest?.source || null,
    source_file: latest?.source_file || null,
  };
}

function buildPayload(root = ROOT) {
  clearCaches();
  const rows = loadMarketRows(root);
  if (rows.length < 21) throw new Error(`Need at least 21 TAIEX trading rows, got ${rows.length}`);
  const stocks = STOCKS.map(stock => buildStock(stock, rows, root));
  const complete1d = stocks.filter(stock => Number.isFinite(stock.return_1d_pct));
  const rising = complete1d.filter(stock => stock.return_1d_pct > 0).length;
  const complete20d = stocks.filter(stock => Number.isFinite(stock.excess_return_20d_pct));
  const outperforming = complete20d.filter(stock => stock.excess_return_20d_pct > 0).length;
  const avgExcess = complete20d.length
    ? round(complete20d.reduce((sum, stock) => sum + stock.excess_return_20d_pct, 0) / complete20d.length)
    : null;
  let priceConfirmation = 'no_data';
  if (complete20d.length) {
    if (outperforming > complete20d.length / 2 && avgExcess > 0) priceConfirmation = 'strong';
    else if (outperforming < complete20d.length / 2 && avgExcess < 0) priceConfirmation = 'weak';
    else priceConfirmation = 'mixed';
  }
  return {
    schema_version: 1,
    dataset: 'tsmc_equipment_demand_twse_dashboard',
    generated_at: new Date().toISOString(),
    trading_date: rows.at(-1).date,
    scope: 'TWSE listed stocks only',
    benchmark: {
      code: 'TAIEX',
      source: 'data_twse_market_chart/market_chart.json',
      return_20d_pct: pctReturn(rows.at(-21).close, rows.at(-1).close),
    },
    summary: {
      tracked: STOCKS.length,
      price_complete_1d: complete1d.length,
      rising_count: rising,
      price_complete_20d: complete20d.length,
      outperforming_20d_count: outperforming,
      average_excess_return_20d_pct: avgExcess,
      price_confirmation: priceConfirmation,
    },
    stocks,
  };
}

function writePayload(payload, root = ROOT) {
  const output = path.join(root, 'data_prediction_analysis', 'tsmc-equipment-demand', 'dashboard.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return output;
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsmc-dashboard-'));
  fs.mkdirSync(path.join(tmp, 'data_twse_market_chart'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'data_twse_mi_index'), { recursive: true });
  const data = [];
  for (let i = 0; i < 25; i += 1) {
    const date = `202601${String(i + 1).padStart(2, '0')}`;
    data.push({ date, close: 1000 + i * 10 });
    const fields = ['證券代號', '開盤價', '最高價', '最低價', '收盤價', '成交股數'];
    const quoteRows = STOCKS.map((stock, idx) => [stock.code, '100', '110', '90', String(100 + i + idx), '1000']);
    fs.writeFileSync(
      path.join(tmp, 'data_twse_mi_index', `${date}_twse_mi_index.json`),
      JSON.stringify({ tables: [{ fields, data: quoteRows }] })
    );
  }
  fs.writeFileSync(path.join(tmp, 'data_twse_market_chart', 'market_chart.json'), JSON.stringify({ data }));
  const payload = buildPayload(tmp);
  if (payload.stocks.length !== 6 || payload.trading_date !== '20260125') throw new Error('self-test stock/date mismatch');
  if (!Number.isFinite(payload.stocks[0].return_20d_pct)) throw new Error('self-test missing 20D return');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('build_tsmc_equipment_demand_dashboard_data self-test passed');
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const payload = buildPayload(ROOT);
  const output = writePayload(payload, ROOT);
  console.log(JSON.stringify({
    output: path.relative(ROOT, output),
    trading_date: payload.trading_date,
    summary: payload.summary,
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { STOCKS, buildPayload, buildStock, classify, pctReturn };
