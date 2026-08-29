#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const stocks = getArg('stocks', '2330,2317,2454,2382,2303,2449').split(',').map((x) => x.trim()).filter(Boolean);
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-08-21');
const output = getArg('output', path.join('data_research', 'institutional-flow', 'features', 'foreign-flow-v5.json'));
const root = getArg('root', 'data_twse_foreign_investors');
const tradingPath = getArg('trading-days', path.join('data_history_sma', 'trading_days.json'));

const normalizeDate = (v) => String(v).replaceAll('/', '-');
const ymd = (v) => normalizeDate(v).replaceAll('-', '');
const num = (v) => {
  const n = Number(String(v ?? '').replaceAll(',', '').trim());
  return Number.isFinite(n) ? n : null;
};
const round = (v, d = 4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;

function loadTradingDays() {
  const p = JSON.parse(fs.readFileSync(tradingPath, 'utf8'));
  return Object.values(p).flat().map(normalizeDate).filter((d) => d >= start && d <= end).sort();
}

function parseFile(file, expectedDate) {
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (p.stat !== 'OK') throw new Error(`${file}: stat=${p.stat}`);
  if (String(p.date) !== expectedDate) throw new Error(`${file}: payload date ${p.date} != ${expectedDate}`);
  if (!Array.isArray(p.data)) throw new Error(`${file}: data is not an array`);
  const out = new Map();
  for (const row of p.data) {
    if (!Array.isArray(row) || row.length < 12) continue;
    const stock = String(row[1] ?? '').trim();
    if (!stocks.includes(stock)) continue;
    const values = row.slice(3, 12).map(num);
    if (values.some((x) => x === null)) continue;
    out.set(stock, {
      stock,
      name: String(row[2] ?? '').trim(),
      ex_dealer: { buy: values[0], sell: values[1], net: values[2] },
      dealer: { buy: values[3], sell: values[4], net: values[5] },
      total: { buy: values[6], sell: values[7], net: values[8] },
    });
  }
  return out;
}

function sum(values) { return values.reduce((a, b) => a + b, 0); }
function rolling(series, index, window) {
  if (index - window + 1 < 0) return null;
  const slice = series.slice(index - window + 1, index + 1);
  if (slice.length !== window || slice.some((x) => !x.source_present)) return null;
  const total = slice.map((x) => x.total_net);
  const exDealer = slice.map((x) => x.ex_dealer_net);
  const dealer = slice.map((x) => x.dealer_net);
  return {
    sessions: window,
    total_net: sum(total),
    total_sell_days: total.filter((x) => x < 0).length,
    total_sell_ratio: round(total.filter((x) => x < 0).length / window, 3),
    ex_dealer_net: sum(exDealer),
    dealer_net: sum(dealer),
  };
}

function build() {
  const tradingDays = loadTradingDays();
  const dayMaps = new Map();
  const sourceMissingDates = [];
  for (const date of tradingDays) {
    const file = path.join(root, `${ymd(date)}_twse_foreign_investors.json`);
    if (!fs.existsSync(file)) { sourceMissingDates.push(date); continue; }
    dayMaps.set(date, parseFile(file, ymd(date)));
  }

  const rows = [];
  const coverage = {};
  for (const stock of stocks) {
    const series = tradingDays.map((date) => {
      const r = dayMaps.get(date)?.get(stock) || null;
      return {
        stock,
        date,
        source_present: Boolean(r),
        ex_dealer_net: r?.ex_dealer.net ?? null,
        dealer_net: r?.dealer.net ?? null,
        total_net: r?.total.net ?? null,
      };
    });
    let present = 0;
    for (let i = 0; i < series.length; i += 1) {
      const r = series[i];
      if (!r.source_present) continue;
      present += 1;
      const w5 = rolling(series, i, 5);
      const w10 = rolling(series, i, 10);
      const prev5 = i >= 9 ? rolling(series, i - 5, 5) : null;
      rows.push({
        ...r,
        rolling_5d: w5,
        rolling_10d: w10,
        total_5d_acceleration: w5 && prev5 ? w5.total_net - prev5.total_net : null,
        foreign_confirm: Boolean(w5 && w10 && w5.total_net < 0 && w5.total_sell_ratio >= 0.6 && w10.total_net < 0),
      });
    }
    coverage[stock] = {
      expected_trading_days: tradingDays.length,
      present_days: present,
      missing_days: tradingDays.length - present,
      ratio: tradingDays.length ? round(present / tradingDays.length, 4) : null,
    };
  }

  const payload = {
    schema_version: 1,
    methodology: 'institutional-withdrawal-v5-foreign-flow-features-v1',
    research_only: true,
    range: { start, end },
    universe: stocks,
    source: 'TWSE foreign and mainland investor daily net buy/sell summary',
    field_mapping: {
      ex_dealer: 'row indexes 3/4/5',
      dealer: 'row indexes 6/7/8',
      total: 'row indexes 9/10/11',
      note: 'All three repeated buy/sell/net groups are preserved; combined total is the primary confirmation family.',
    },
    no_lookahead: 'All rolling features use current and prior trading sessions only; missing source days invalidate the affected rolling window and are never imputed as zero.',
    counts: { trading_days: tradingDays.length, source_missing_dates: sourceMissingDates.length, feature_rows: rows.length },
    source_missing_dates: sourceMissingDates,
    coverage,
    rows,
    generated_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ counts: payload.counts, coverage }, null, 2));
  return payload;
}

if (require.main === module) build();
module.exports = { build };
