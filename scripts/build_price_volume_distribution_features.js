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
const calendarRoot = getArg('calendar-root', 'data_twse_foreign_investors');

const normalizeDate = (v) => String(v).replaceAll('/', '-');
const slashDate = (v) => normalizeDate(v).replaceAll('-', '/');
const ymd = (v) => normalizeDate(v).replaceAll('-', '');
const iso = (v) => `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`;
const num = (v) => { const n = Number(String(v ?? '').replaceAll(',', '').trim()); return Number.isFinite(n) ? n : null; };
const round = (v, d = 4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

function discoverTradingDays() {
  return fs.readdirSync(calendarRoot)
    .filter((name) => /^\d{8}_twse_foreign_investors\.json$/.test(name))
    .map((name) => ({ name, rawDate: name.slice(0, 8), date: iso(name.slice(0, 8)) }))
    .filter((x) => x.date >= start && x.date <= end)
    .filter((x) => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(calendarRoot, x.name), 'utf8'));
        return p.stat === 'OK' && String(p.date) === x.rawDate && Array.isArray(p.data);
      } catch { return false; }
    })
    .map((x) => x.date)
    .sort();
}
function pct(a, b) { return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? round((a / b - 1) * 100, 4) : null; }
function isPresent(x) { return Boolean(x?.source_present && Number.isFinite(x.close) && Number.isFinite(x.volume)); }

function parseDaily(file, date) {
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = new Map();
  for (const stock of stocks) {
    const raw = p[stock]?.[slashDate(date)];
    if (!raw) continue;
    const close = num(raw.Price); const open = num(raw.Open); const high = num(raw.High); const low = num(raw.Low); const volume = num(raw.Volume);
    if (![close, open, high, low, volume].every(Number.isFinite) || close <= 0 || open <= 0 || high <= 0 || low <= 0 || volume < 0) continue;
    out.set(stock, { stock, date, source_present: true, close, open, high, low, volume });
  }
  return out;
}

function distributionFlag(series, tradingDays, x) {
  const idx = tradingDays.indexOf(x.date);
  const prior = idx >= 20 ? series.slice(idx - 20, idx) : [];
  if (prior.length !== 20 || !prior.every(isPresent)) return null;
  const base = mean(prior.map((y) => y.volume));
  const priorDay = idx >= 1 && isPresent(series[idx - 1]) ? series[idx - 1] : null;
  const r1 = priorDay ? pct(x.close, priorDay.close) : null;
  const vr = base > 0 ? x.volume / base : null;
  return Number.isFinite(vr) && Number.isFinite(r1) ? { down: vr >= 1.5 && r1 <= -1, flat: vr >= 1.5 && Math.abs(r1) <= 1 } : null;
}

function build() {
  const tradingDays = discoverTradingDays();
  const dayMaps = new Map();
  const sourceMissingDates = [];
  for (const date of tradingDays) {
    const file = path.join(root, `fubon_${ymd(date)}_sma.json`);
    if (!fs.existsSync(file)) { sourceMissingDates.push(date); continue; }
    dayMaps.set(date, parseDaily(file, date));
  }

  const rows = [];
  const coverage = {};
  const sourceRowGaps = [];
  for (const stock of stocks) {
    const series = tradingDays.map((date) => dayMaps.get(date)?.get(stock) || { stock, date, source_present: false });
    const missingDates = series.filter((x) => !isPresent(x)).map((x) => x.date);
    sourceRowGaps.push(...missingDates.map((date) => ({ stock, date })));
    coverage[stock] = {
      expected_trading_days: tradingDays.length,
      present_days: tradingDays.length - missingDates.length,
      missing_days: missingDates.length,
      missing_dates: missingDates,
      ratio: tradingDays.length ? round((tradingDays.length - missingDates.length) / tradingDays.length, 4) : null,
    };

    for (let i = 0; i < series.length; i += 1) {
      const curr = series[i];
      if (!isPresent(curr)) continue;
      const prev = i >= 1 && isPresent(series[i - 1]) ? series[i - 1] : null;
      const prev5 = i >= 5 && isPresent(series[i - 5]) ? series[i - 5] : null;
      const prev10 = i >= 10 && isPresent(series[i - 10]) ? series[i - 10] : null;
      const prior20 = i >= 20 ? series.slice(i - 20, i) : [];
      const prior20Complete = prior20.length === 20 && prior20.every(isPresent);
      const prior20VolumeMean = prior20Complete ? mean(prior20.map((x) => x.volume)) : null;
      const prior20High = prior20Complete ? Math.max(...prior20.map((x) => x.high)) : null;
      const return1d = prev ? pct(curr.close, prev.close) : null;
      const return5d = prev5 ? pct(curr.close, prev5.close) : null;
      const return10d = prev10 ? pct(curr.close, prev10.close) : null;
      const volumeRatio = Number.isFinite(prior20VolumeMean) && prior20VolumeMean > 0 ? round(curr.volume / prior20VolumeMean, 4) : null;
      const highVolumeDownDay = Number.isFinite(volumeRatio) && Number.isFinite(return1d) && volumeRatio >= 1.5 && return1d <= -1;
      const highVolumeFlatDay = Number.isFinite(volumeRatio) && Number.isFinite(return1d) && volumeRatio >= 1.5 && Math.abs(return1d) <= 1;
      const trailing5 = i >= 4 ? series.slice(i - 4, i + 1) : [];
      const trailing10 = i >= 9 ? series.slice(i - 9, i + 1) : [];
      const trailing5Complete = trailing5.length === 5 && trailing5.every(isPresent);
      const trailing10Complete = trailing10.length === 10 && trailing10.every(isPresent);
      const flags5 = trailing5Complete ? trailing5.map((x) => distributionFlag(series, tradingDays, x)) : null;
      const flags10 = trailing10Complete ? trailing10.map((x) => distributionFlag(series, tradingDays, x)) : null;
      const dist5 = flags5 && flags5.every(Boolean) ? flags5.filter((x) => x.down).length : null;
      const dist10 = flags10 && flags10.every(Boolean) ? flags10.filter((x) => x.down).length : null;
      const absorb10 = flags10 && flags10.every(Boolean) ? flags10.filter((x) => x.flat).length : null;
      rows.push({
        stock, date: curr.date, source_present: true,
        close: curr.close, open: curr.open, high: curr.high, low: curr.low, volume: curr.volume,
        return_1d_pct: return1d, return_5d_pct: return5d, return_10d_pct: return10d,
        prior_20d_volume_mean: round(prior20VolumeMean, 2), volume_ratio_20d: volumeRatio,
        close_vs_prior_20d_high_pct: Number.isFinite(prior20High) ? pct(curr.close, prior20High) : null,
        high_volume_down_day: highVolumeDownDay, high_volume_flat_day: highVolumeFlatDay,
        distribution_days_5d: dist5, distribution_days_10d: dist10, absorption_days_10d: absorb10,
        price_volume_confirm: Boolean((Number.isFinite(dist10) && dist10 >= 2) || (Number.isFinite(volumeRatio) && volumeRatio >= 1.5 && Number.isFinite(return5d) && return5d < 0)),
      });
    }
  }

  const payload = {
    schema_version: 3,
    methodology: 'institutional-withdrawal-v5-price-volume-features-v3-source-derived-calendar-gap-preserving',
    research_only: true,
    range: { start, end }, universe: stocks,
    source: 'Fubon SMA daily OHLCV snapshots',
    calendar_policy: 'Trading dates are independently discovered from valid in-range TWSE foreign-investor daily files, not stale data_history_sma/trading_days.json.',
    trading_dates: tradingDays,
    no_lookahead: 'Previous-20-session baselines exclude current. Missing OHLCV rows preserve their trading-calendar position and invalidate affected rolling windows; gaps are never compressed or imputed.',
    counts: { trading_days: tradingDays.length, source_missing_dates: sourceMissingDates.length, source_row_gaps: sourceRowGaps.length, feature_rows: rows.length },
    source_missing_dates: sourceMissingDates, source_row_gaps: sourceRowGaps, coverage, rows,
    generated_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ first: tradingDays[0], last: tradingDays.at(-1), counts: payload.counts, coverage, source_row_gaps: sourceRowGaps }, null, 2));
  return payload;
}

if (require.main === module) build();
module.exports = { build };