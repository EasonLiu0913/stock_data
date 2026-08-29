#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const stocks = getArg('stocks', '2330,2317,2454,2382,2303,2449').split(',').map((x) => x.trim()).filter(Boolean);
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-08-21');
const output = getArg('output', path.join('data_research', 'institutional-flow', 'features', 'price-volume-v5.json'));
const root = getArg('root', 'data_fubon');
const tradingPath = getArg('trading-days', path.join('data_history_sma', 'trading_days.json'));

const normalizeDate = (v) => String(v).replaceAll('/', '-');
const slashDate = (v) => normalizeDate(v).replaceAll('-', '/');
const ymd = (v) => normalizeDate(v).replaceAll('-', '');
const num = (v) => { const n = Number(String(v ?? '').replaceAll(',', '').trim()); return Number.isFinite(n) ? n : null; };
const round = (v, d = 4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

function loadTradingDays() {
  const p = JSON.parse(fs.readFileSync(tradingPath, 'utf8'));
  return Object.values(p).flat().map(normalizeDate).filter((d) => d >= start && d <= end).sort();
}
function pct(a, b) { return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? round((a / b - 1) * 100, 4) : null; }

function parseDaily(file, date) {
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = new Map();
  for (const stock of stocks) {
    const node = p[stock];
    const raw = node?.[slashDate(date)];
    if (!raw) continue;
    const close = num(raw.Price); const open = num(raw.Open); const high = num(raw.High); const low = num(raw.Low); const volume = num(raw.Volume);
    if (![close, open, high, low, volume].every(Number.isFinite) || close <= 0 || open <= 0 || high <= 0 || low <= 0 || volume < 0) continue;
    out.set(stock, { stock, date, close, open, high, low, volume });
  }
  return out;
}

function build() {
  const tradingDays = loadTradingDays();
  const dayMaps = new Map();
  const sourceMissingDates = [];
  for (const date of tradingDays) {
    const file = path.join(root, `fubon_${ymd(date)}_sma.json`);
    if (!fs.existsSync(file)) { sourceMissingDates.push(date); continue; }
    dayMaps.set(date, parseDaily(file, date));
  }
  const rows = [];
  const coverage = {};
  for (const stock of stocks) {
    const series = tradingDays.map((date) => dayMaps.get(date)?.get(stock) || { stock, date, source_present: false });
    let present = 0;
    for (let i = 0; i < series.length; i += 1) {
      const curr = series[i];
      if (!Number.isFinite(curr.close)) continue;
      present += 1;
      const prev = i > 0 && Number.isFinite(series[i - 1].close) ? series[i - 1] : null;
      const prev5 = i >= 5 && Number.isFinite(series[i - 5].close) ? series[i - 5] : null;
      const prev10 = i >= 10 && Number.isFinite(series[i - 10].close) ? series[i - 10] : null;
      const prior20 = i >= 20 ? series.slice(i - 20, i) : [];
      const prior20Complete = prior20.length === 20 && prior20.every((x) => Number.isFinite(x.volume) && Number.isFinite(x.high));
      const prior20VolumeMean = prior20Complete ? mean(prior20.map((x) => x.volume)) : null;
      const prior20High = prior20Complete ? Math.max(...prior20.map((x) => x.high)) : null;
      const return1d = prev ? pct(curr.close, prev.close) : null;
      const return5d = prev5 ? pct(curr.close, prev5.close) : null;
      const return10d = prev10 ? pct(curr.close, prev10.close) : null;
      const volumeRatio = prior20VolumeMean && prior20VolumeMean > 0 ? round(curr.volume / prior20VolumeMean, 4) : null;
      const highVolumeDownDay = Number.isFinite(volumeRatio) && Number.isFinite(return1d) && volumeRatio >= 1.5 && return1d <= -1;
      const highVolumeFlatDay = Number.isFinite(volumeRatio) && Number.isFinite(return1d) && volumeRatio >= 1.5 && Math.abs(return1d) <= 1;
      rows.push({
        stock, date: curr.date,
        close: curr.close, open: curr.open, high: curr.high, low: curr.low, volume: curr.volume,
        return_1d_pct: return1d,
        return_5d_pct: return5d,
        return_10d_pct: return10d,
        prior_20d_volume_mean: round(prior20VolumeMean, 2),
        volume_ratio_20d: volumeRatio,
        close_vs_prior_20d_high_pct: Number.isFinite(prior20High) ? pct(curr.close, prior20High) : null,
        high_volume_down_day: highVolumeDownDay,
        high_volume_flat_day: highVolumeFlatDay,
      });
    }
    const missingDates = series.filter((x) => !Number.isFinite(x.close)).map((x) => x.date);
    coverage[stock] = {
      expected_trading_days: tradingDays.length,
      present_days: present,
      missing_days: missingDates.length,
      missing_dates: missingDates,
      ratio: tradingDays.length ? round(present / tradingDays.length, 4) : null,
    };
  }

  const byStock = new Map(stocks.map((s) => [s, rows.filter((r) => r.stock === s).sort((a, b) => a.date.localeCompare(b.date))]));
  const enriched = [];
  for (const stock of stocks) {
    const s = byStock.get(stock);
    for (let i = 0; i < s.length; i += 1) {
      const r = s[i];
      const prev5 = s.slice(Math.max(0, i - 4), i + 1);
      const prev10 = s.slice(Math.max(0, i - 9), i + 1);
      const complete10 = prev10.length === 10 && prev10.every((x, j) => j === 0 || x.date > prev10[j - 1].date);
      const dist5 = prev5.filter((x) => x.high_volume_down_day).length;
      const dist10 = prev10.filter((x) => x.high_volume_down_day).length;
      enriched.push({
        ...r,
        distribution_days_5d: prev5.length === 5 ? dist5 : null,
        distribution_days_10d: complete10 ? dist10 : null,
        absorption_days_10d: complete10 ? prev10.filter((x) => x.high_volume_flat_day).length : null,
        price_volume_confirm: Boolean((complete10 && dist10 >= 2) || (Number.isFinite(r.volume_ratio_20d) && r.volume_ratio_20d >= 1.5 && Number.isFinite(r.return_5d_pct) && r.return_5d_pct < 0)),
      });
    }
  }

  const payload = {
    schema_version: 1,
    methodology: 'institutional-withdrawal-v5-price-volume-features-v1',
    research_only: true,
    range: { start, end }, universe: stocks,
    source: 'Fubon SMA daily OHLCV snapshots',
    no_lookahead: 'Volume baseline uses the previous 20 sessions and excludes the current session. Price-return and distribution windows are backward-looking only. Missing source rows are never imputed.',
    counts: { trading_days: tradingDays.length, source_missing_dates: sourceMissingDates.length, feature_rows: enriched.length },
    source_missing_dates: sourceMissingDates,
    coverage,
    rows: enriched,
    generated_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ counts: payload.counts, coverage }, null, 2));
  return payload;
}

if (require.main === module) build();
module.exports = { build };
