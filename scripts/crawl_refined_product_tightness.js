#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_refined_product_tightness');
const BARRELS_PER_GALLON = 42;
const LOOKBACK_DAYS = 365 * 5 + 30;

const SERIES = {
  jet: {
    id: 'PET.EER_EPJK_PF4_RGC_DPG.D',
    name: 'U.S. Gulf Coast Kerosene-Type Jet Fuel Spot Price FOB',
    unit: 'usd_per_gallon',
  },
  diesel: {
    id: 'PET.EER_EPD2DXL0_PF4_RGC_DPG.D',
    name: 'U.S. Gulf Coast Ultra-Low Sulfur No. 2 Diesel Spot Price',
    unit: 'usd_per_gallon',
  },
  brent: {
    id: 'PET.RBRTE.D',
    name: 'Europe Brent Spot Price FOB',
    unit: 'usd_per_barrel',
  },
};

function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      i += 1;
    }
  }
  return args;
}

function compactDate(value) {
  const text = String(value || '').replace(/[^\d]/g, '');
  if (!/^\d{8}$/.test(text)) throw new Error(`Invalid date: ${value}`);
  return text;
}

function compactToIso(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function isoToCompact(value) {
  return String(value || '').replaceAll('-', '');
}

function shiftIsoDate(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayCompact() {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function percentileRank(values, current) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length || !Number.isFinite(current)) return null;
  let less = 0;
  let equal = 0;
  for (const value of clean) {
    if (value < current) less += 1;
    else if (value === current) equal += 1;
  }
  return ((less + equal * 0.5) / clean.length) * 100;
}

function difference(values, periods) {
  if (!Array.isArray(values) || values.length <= periods) return null;
  const latest = values.at(-1);
  const previous = values.at(-(periods + 1));
  return Number.isFinite(latest) && Number.isFinite(previous) ? latest - previous : null;
}

function rollingDifferences(values, periods) {
  const output = [];
  for (let i = periods; i < values.length; i += 1) {
    if (!Number.isFinite(values[i]) || !Number.isFinite(values[i - periods])) continue;
    output.push(values[i] - values[i - periods]);
  }
  return output;
}

function classifyScore(score) {
  if (!Number.isFinite(score)) return { code: 'unavailable', label: '資料不足' };
  if (score >= 80) return { code: 'very_tight', label: '非常緊張' };
  if (score >= 60) return { code: 'tight', label: '偏緊' };
  if (score >= 40) return { code: 'balanced', label: '中性' };
  if (score >= 20) return { code: 'loose', label: '偏鬆' };
  return { code: 'very_loose', label: '非常寬鬆' };
}

function buildFactor(rows, targetDate) {
  if (!Array.isArray(rows) || rows.length < 25) {
    throw new Error('At least 25 aligned observations are required.');
  }

  const eligible = rows.filter((row) => row.date <= targetDate);
  if (eligible.length < 25) throw new Error(`Insufficient aligned observations through ${targetDate}.`);

  const jetCracks = eligible.map((row) => row.jet_crack_usd_per_barrel);
  const dieselCracks = eligible.map((row) => row.diesel_crack_usd_per_barrel);
  const latest = eligible.at(-1);

  const jetLevelPct = percentileRank(jetCracks, latest.jet_crack_usd_per_barrel);
  const dieselLevelPct = percentileRank(dieselCracks, latest.diesel_crack_usd_per_barrel);
  const jet20d = difference(jetCracks, 20);
  const diesel20d = difference(dieselCracks, 20);
  const jetMomentumPct = percentileRank(rollingDifferences(jetCracks, 20), jet20d);
  const dieselMomentumPct = percentileRank(rollingDifferences(dieselCracks, 20), diesel20d);

  const levelScore = (jetLevelPct + dieselLevelPct) / 2;
  const momentumScore = Number.isFinite(jetMomentumPct) && Number.isFinite(dieselMomentumPct)
    ? (jetMomentumPct + dieselMomentumPct) / 2
    : 50;
  const score = Math.max(0, Math.min(100, levelScore * 0.7 + momentumScore * 0.3));
  const state = classifyScore(score);

  const jet5d = difference(jetCracks, 5);
  const diesel5d = difference(dieselCracks, 5);
  const jet60d = difference(jetCracks, 60);
  const diesel60d = difference(dieselCracks, 60);
  const bothRising20d = jet20d > 0 && diesel20d > 0;
  const bothFalling20d = jet20d < 0 && diesel20d < 0;

  return {
    observation_date: latest.date,
    score: round(score, 1),
    state,
    level_score: round(levelScore, 1),
    momentum_score: round(momentumScore, 1),
    confirmation: bothRising20d ? 'both_rising_20d' : bothFalling20d ? 'both_falling_20d' : 'mixed_20d',
    jet: {
      spot_usd_per_gallon: round(latest.jet_usd_per_gallon, 4),
      crack_usd_per_barrel: round(latest.jet_crack_usd_per_barrel),
      percentile_5y: round(jetLevelPct, 1),
      change_5d_usd_per_barrel: round(jet5d),
      change_20d_usd_per_barrel: round(jet20d),
      change_60d_usd_per_barrel: round(jet60d),
      momentum_20d_percentile_5y: round(jetMomentumPct, 1),
    },
    diesel: {
      spot_usd_per_gallon: round(latest.diesel_usd_per_gallon, 4),
      crack_usd_per_barrel: round(latest.diesel_crack_usd_per_barrel),
      percentile_5y: round(dieselLevelPct, 1),
      change_5d_usd_per_barrel: round(diesel5d),
      change_20d_usd_per_barrel: round(diesel20d),
      change_60d_usd_per_barrel: round(diesel60d),
      momentum_20d_percentile_5y: round(dieselMomentumPct, 1),
    },
    brent: {
      spot_usd_per_barrel: round(latest.brent_usd_per_barrel),
    },
  };
}

function alignSeries(jetRows, dieselRows, brentRows) {
  const jet = new Map(jetRows.map((row) => [row.date, row.value]));
  const diesel = new Map(dieselRows.map((row) => [row.date, row.value]));
  const brent = new Map(brentRows.map((row) => [row.date, row.value]));
  const dates = [...jet.keys()].filter((date) => diesel.has(date) && brent.has(date)).sort();
  return dates.map((date) => {
    const jetValue = jet.get(date);
    const dieselValue = diesel.get(date);
    const brentValue = brent.get(date);
    return {
      date,
      jet_usd_per_gallon: jetValue,
      diesel_usd_per_gallon: dieselValue,
      brent_usd_per_barrel: brentValue,
      jet_crack_usd_per_barrel: jetValue * BARRELS_PER_GALLON - brentValue,
      diesel_crack_usd_per_barrel: dieselValue * BARRELS_PER_GALLON - brentValue,
    };
  });
}

async function fetchSeries(seriesId, startIso, endIso, apiKey) {
  const url = new URL(`https://api.eia.gov/v2/seriesid/${encodeURIComponent(seriesId)}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('start', startIso);
  url.searchParams.set('end', endIso);
  url.searchParams.set('offset', '0');
  url.searchParams.set('length', '5000');
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'asc');

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'stock-data-refined-product-tightness/1.0',
    },
  });
  if (!response.ok) throw new Error(`EIA ${seriesId}: ${response.status} ${response.statusText}`);
  const payload = await response.json();
  const data = payload?.response?.data || [];
  const rows = data.map((row) => ({
    date: isoToCompact(row.period),
    value: Number(row.value),
  })).filter((row) => /^\d{8}$/.test(row.date) && Number.isFinite(row.value));
  if (!rows.length) throw new Error(`EIA ${seriesId}: no daily observations returned.`);
  return rows;
}

function refreshIndexes(generatedAt) {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const dateDirs = fs.readdirSync(OUTPUT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'files.json'), `${JSON.stringify(
    dateDirs.map((date) => `${date}/refined_product_tightness.json`), null, 2
  )}\n`);
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    generated_at: generatedAt,
    latest_date: dateDirs.at(-1) || null,
    available_dates: dateDirs,
  }, null, 2)}\n`);
}

async function main() {
  const args = parseArgs();
  const targetDate = compactDate(args.get('date') || todayCompact());
  const force = args.has('force');
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error('EIA_API_KEY is required. Register a free EIA Open Data API key and provide it as an environment variable.');

  const endIso = compactToIso(targetDate);
  const startIso = shiftIsoDate(endIso, -LOOKBACK_DAYS);
  const [jetRows, dieselRows, brentRows] = await Promise.all([
    fetchSeries(SERIES.jet.id, startIso, endIso, apiKey),
    fetchSeries(SERIES.diesel.id, startIso, endIso, apiKey),
    fetchSeries(SERIES.brent.id, startIso, endIso, apiKey),
  ]);

  const aligned = alignSeries(jetRows, dieselRows, brentRows);
  const factor = buildFactor(aligned, targetDate);
  const outputDir = path.join(OUTPUT_ROOT, factor.observation_date);
  const outputFile = path.join(outputDir, 'refined_product_tightness.json');

  if (!force && fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0) {
    console.log(JSON.stringify({
      reused: true,
      output: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
      requested_date: targetDate,
      observation_date: factor.observation_date,
      reason: 'observation-date artifact already exists; use --force to refresh a revised EIA observation',
    }));
    return;
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    methodology_version: 'refined_product_tightness_v1',
    generated_at: generatedAt,
    requested_date: targetDate,
    observation_date: factor.observation_date,
    role: 'research_market_context_only',
    interpretation_warning: 'This factor describes refined-product market tightness. It is not a production strategy gate and does not isolate demand from refinery outages, geopolitics, seasonality, or other supply effects.',
    methodology: {
      jet_crack: 'US Gulf Coast jet spot USD/gal * 42 - Brent spot USD/bbl',
      diesel_crack: 'US Gulf Coast ULSD spot USD/gal * 42 - Brent spot USD/bbl',
      history_window: 'approximately trailing 5 years of aligned EIA daily observations',
      score: '70% average crack level percentile + 30% average 20-trading-day crack-change percentile',
      state_bands: { very_loose: '<20', loose: '20-39.9', balanced: '40-59.9', tight: '60-79.9', very_tight: '>=80' },
    },
    sources: {
      provider: 'U.S. Energy Information Administration Open Data API',
      series: SERIES,
    },
    factor,
    aligned_observation_count: aligned.length,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
  refreshIndexes(generatedAt);
  console.log(JSON.stringify({
    reused: false,
    output: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'),
    observation_date: factor.observation_date,
    score: factor.score,
    state: factor.state.code,
  }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Failed to generate refined product tightness factor: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  BARRELS_PER_GALLON,
  SERIES,
  percentileRank,
  difference,
  rollingDifferences,
  classifyScore,
  alignSeries,
  buildFactor,
};
