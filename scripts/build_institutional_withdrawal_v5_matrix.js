#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const stocks = getArg('stocks', '2330,2317,2454,2382,2303,2449').split(',').map((x) => x.trim()).filter(Boolean);
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-08-21');
const foreignFile = getArg('foreign', path.join('data_research', 'institutional-flow', 'features', 'foreign-flow-v5.json'));
const priceVolumeFile = getArg('price-volume', path.join('data_research', 'institutional-flow', 'features', 'price-volume-v5.json'));
const output = getArg('output', path.join('data_research', 'institutional-flow', 'backtests', 'institutional-withdrawal-v5-feature-matrix.json'));
const tradingPath = path.join('data_history_sma', 'trading_days.json');

const normalizeDate = (v) => String(v).replaceAll('/', '-');
const ymd = (v) => normalizeDate(v).replaceAll('-', '');
const round = (v, d = 4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function loadTradingDays() {
  const p = readJson(tradingPath);
  return Object.values(p).flat().map(normalizeDate).sort();
}
function latestTradingDay(days, date) {
  let out = null;
  for (const d of days) { if (d > date) break; out = d; }
  return out;
}
function brokerEvidence(stock, tradingDays, marketDate) {
  const eligible = tradingDays.filter((d) => d >= start && d <= marketDate);
  const last5 = eligible.slice(-5);
  const days = [];
  for (const date of last5) {
    const file = path.join('data_research', 'institutional-flow', 'histock', stock, 'daily', `${ymd(date)}.json`);
    if (!fs.existsSync(file)) continue;
    const p = readJson(file);
    if (!Array.isArray(p.records)) continue;
    days.push({ date, records: p.records.filter((r) => Number.isFinite(Number(r.net))) });
  }
  const curr = days.find((d) => d.date === marketDate) || null;
  if (!curr) return { available: false, window_days: days.length, score: null };
  const negative = curr.records.filter((r) => Number(r.net) < 0);
  const dailyNegativeNet = negative.reduce((s, r) => s + Number(r.net), 0);
  const map = new Map();
  for (const day of days) {
    for (const r of day.records) {
      const key = String(r.broker);
      const a = map.get(key) || { total_net: 0, sell_days: 0 };
      a.total_net += Number(r.net);
      if (Number(r.net) < 0) a.sell_days += 1;
      map.set(key, a);
    }
  }
  const persistent = [...map.values()].filter((x) => x.total_net < 0 && x.sell_days >= 2);
  const persistentNet = persistent.reduce((s, x) => s + x.total_net, 0);
  const flags = {
    daily_negative_breadth: negative.length >= 8,
    daily_negative_net: dailyNegativeNet <= -6000,
    persistent_5d_sellers: persistent.length >= 5,
    persistent_5d_net: persistentNet <= -8000,
  };
  return {
    available: true,
    window_days: days.length,
    score: Object.values(flags).filter(Boolean).length,
    daily_negative_breadth: negative.length,
    daily_negative_net: round(dailyNegativeNet),
    persistent_5d_sellers: persistent.length,
    persistent_5d_net: round(persistentNet),
    flags,
  };
}
function tdccScore(large, small) {
  if (!Number.isFinite(large) || !Number.isFinite(small)) return 0;
  let score = 0;
  if (large <= -1) score += 1;
  if (small >= 0.75) score += 1;
  if (large <= -2 && small >= 2) score += 2;
  if (large <= -5 && small >= 5) score += 3;
  return score;
}
function loadTdcc(stock) {
  const root = path.join('data_tdcc_shareholding', 'history', stock);
  return fs.readdirSync(root).filter((n) => /^\d{8}\.json$/.test(n)).sort().map((n) => readJson(path.join(root, n)))
    .filter((p) => p.source === 'tdcc_official_historical_query' && p.stock === stock && p.observed_date >= start && p.observed_date <= end)
    .map((p) => ({ date: p.observed_date, large: Number(p.derived?.large_holder_pct), small: Number(p.derived?.small_holder_pct), source: p.source }));
}
function loadPrices(stock) {
  const p = readJson(path.join('data_history_sma', `${stock}.json`));
  return Object.entries(p).map(([date, row]) => ({ date: normalizeDate(date), close: Number(row.price) }))
    .filter((x) => /^20\d{2}-\d{2}-\d{2}$/.test(x.date) && Number.isFinite(x.close) && x.close > 0).sort((a, b) => a.date.localeCompare(b.date));
}
function outcome(prices, date) {
  const i = prices.findIndex((x) => x.date === date);
  const out = { anchor_date: date };
  for (const h of [5, 10, 20]) {
    out[`return_${h}d_pct`] = i >= 0 && i + h < prices.length ? round((prices[i + h].close / prices[i].close - 1) * 100, 2) : null;
  }
  if (i >= 0) {
    const slice = prices.slice(i + 1, Math.min(prices.length, i + 21));
    const rs = slice.map((x) => (x.close / prices[i].close - 1) * 100);
    out.path_sessions = rs.length;
    out.max_gain_20d_pct = rs.length ? round(Math.max(...rs), 2) : null;
    out.max_drawdown_20d_pct = rs.length ? round(Math.min(...rs), 2) : null;
  } else {
    out.path_sessions = 0; out.max_gain_20d_pct = null; out.max_drawdown_20d_pct = null;
  }
  return out;
}

function main() {
  const foreign = readJson(foreignFile);
  const priceVolume = readJson(priceVolumeFile);
  const foreignMap = new Map(foreign.rows.map((r) => [`${r.stock}:${r.date}`, r]));
  const priceMap = new Map(priceVolume.rows.map((r) => [`${r.stock}:${r.date}`, r]));
  const tradingDays = loadTradingDays();
  const rows = [];
  const coverage = {};

  for (const stock of stocks) {
    const tdcc = loadTdcc(stock);
    const prices = loadPrices(stock);
    let largeDeclineStreak = 0; let smallIncreaseStreak = 0; let transferStreak = 0;
    let eligible = 0; let complete = 0;
    for (let i = 0; i < tdcc.length; i += 1) {
      const curr = tdcc[i]; const prev = tdcc[i - 1]; const prev2 = tdcc[i - 2];
      const large1 = prev ? round(curr.large - prev.large) : null;
      const small1 = prev ? round(curr.small - prev.small) : null;
      const large2 = prev2 ? round(curr.large - prev2.large) : null;
      const small2 = prev2 ? round(curr.small - prev2.small) : null;
      largeDeclineStreak = Number.isFinite(large1) && large1 < 0 ? largeDeclineStreak + 1 : 0;
      smallIncreaseStreak = Number.isFinite(small1) && small1 > 0 ? smallIncreaseStreak + 1 : 0;
      transferStreak = Number.isFinite(large1) && Number.isFinite(small1) && large1 < 0 && small1 > 0 ? transferStreak + 1 : 0;
      const prevLargeDelta = prev && prev2 ? round(prev.large - prev2.large) : null;
      const prevSmallDelta = prev && prev2 ? round(prev.small - prev2.small) : null;
      const marketDate = latestTradingDay(tradingDays, curr.date);
      const broker = brokerEvidence(stock, tradingDays, marketDate);
      const f = foreignMap.get(`${stock}:${marketDate}`) || null;
      const pv = priceMap.get(`${stock}:${marketDate}`) || null;
      const tdccS = tdccScore(large1, small1);
      const featureComplete = Boolean(marketDate && broker.available && f && pv);
      if (featureComplete) complete += 1;
      const analysisEligible = Boolean(featureComplete && broker.window_days >= 5 && f.rolling_10d && Number.isFinite(pv.volume_ratio_20d) && Number.isFinite(pv.distribution_days_10d));
      if (analysisEligible) eligible += 1;
      const tdccPersistenceConfirm = largeDeclineStreak >= 2 && smallIncreaseStreak >= 2;
      const brokerPressureConfirm = Number.isFinite(broker.score) && broker.score >= 3;
      const foreignConfirm = Boolean(f?.foreign_confirm);
      const priceVolumeConfirm = Boolean(pv?.price_volume_confirm);
      const pressureBaseline = Boolean(brokerPressureConfirm && tdccS >= 1);
      const independentConfirmations = [foreignConfirm, tdccPersistenceConfirm, priceVolumeConfirm].filter(Boolean).length;
      rows.push({
        stock,
        tdcc_observed_date: curr.date,
        market_feature_date: marketDate,
        market_lag_calendar_days: marketDate ? Math.round((Date.parse(`${curr.date}T00:00:00Z`) - Date.parse(`${marketDate}T00:00:00Z`)) / 86400000) : null,
        feature_complete: featureComplete,
        analysis_eligible: analysisEligible,
        broker: {
          score: broker.score, window_days: broker.window_days,
          daily_negative_breadth: broker.daily_negative_breadth ?? null,
          daily_negative_net: broker.daily_negative_net ?? null,
          persistent_5d_sellers: broker.persistent_5d_sellers ?? null,
          persistent_5d_net: broker.persistent_5d_net ?? null,
        },
        tdcc: {
          large_holder_pct: curr.large, small_holder_pct: curr.small,
          large_change_1obs_pp: large1, small_change_1obs_pp: small1,
          large_change_2obs_pp: large2, small_change_2obs_pp: small2,
          large_change_acceleration_pp: Number.isFinite(large1) && Number.isFinite(prevLargeDelta) ? round(large1 - prevLargeDelta) : null,
          small_change_acceleration_pp: Number.isFinite(small1) && Number.isFinite(prevSmallDelta) ? round(small1 - prevSmallDelta) : null,
          large_decline_streak: largeDeclineStreak, small_increase_streak: smallIncreaseStreak, transfer_streak: transferStreak,
          v4_score: tdccS,
        },
        foreign: f ? {
          total_net: f.total_net, ex_dealer_net: f.ex_dealer_net, dealer_net: f.dealer_net,
          net_5d: f.rolling_5d?.total_net ?? null, sell_ratio_5d: f.rolling_5d?.total_sell_ratio ?? null,
          net_10d: f.rolling_10d?.total_net ?? null, sell_ratio_10d: f.rolling_10d?.total_sell_ratio ?? null,
          net_5d_acceleration: f.total_5d_acceleration,
        } : null,
        price_volume: pv ? {
          return_1d_pct: pv.return_1d_pct, return_5d_pct: pv.return_5d_pct, return_10d_pct: pv.return_10d_pct,
          volume_ratio_20d: pv.volume_ratio_20d,
          distribution_days_5d: pv.distribution_days_5d, distribution_days_10d: pv.distribution_days_10d,
          absorption_days_10d: pv.absorption_days_10d, close_vs_prior_20d_high_pct: pv.close_vs_prior_20d_high_pct,
        } : null,
        confirmations: {
          broker_pressure_confirm: brokerPressureConfirm,
          foreign_confirm: foreignConfirm,
          tdcc_persistence_confirm: tdccPersistenceConfirm,
          price_volume_confirm: priceVolumeConfirm,
          independent_confirmation_count: independentConfirmations,
          pressure_baseline: pressureBaseline,
          pressure_plus_foreign: pressureBaseline && foreignConfirm,
          pressure_plus_tdcc_persistence: pressureBaseline && tdccPersistenceConfirm,
          pressure_plus_price_volume: pressureBaseline && priceVolumeConfirm,
          pressure_plus_two_independent: pressureBaseline && independentConfirmations >= 2,
          pressure_plus_all_three: pressureBaseline && independentConfirmations === 3,
        },
        outcome: outcome(prices, marketDate),
      });
    }
    coverage[stock] = { tdcc_anchors: tdcc.length, feature_complete: complete, analysis_eligible: eligible };
  }

  const counts = {
    anchors: rows.length,
    feature_complete: rows.filter((r) => r.feature_complete).length,
    analysis_eligible: rows.filter((r) => r.analysis_eligible).length,
    pressure_baseline: rows.filter((r) => r.analysis_eligible && r.confirmations.pressure_baseline).length,
  };
  const payload = {
    schema_version: 1,
    methodology: 'institutional-withdrawal-v5-tdcc-anchored-feature-matrix-v1',
    research_only: true,
    production_safe: false,
    universe: stocks, range: { start, end },
    anchor_policy: 'Every official historical TDCC observation in range; market features use latest Taiwan trading day <= observed_date.',
    no_lookahead: 'Feature columns use only evidence dated on or before the anchor. outcome is a separate analysis-only object and must never be used to construct confirmations.',
    development_sample_warning: 'This period has already been inspected. Candidate findings require untouched/walk-forward validation before production promotion.',
    counts, coverage, rows,
    generated_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ counts, coverage }, null, 2));
}

main();
