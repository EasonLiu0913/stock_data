#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_eia_crude_spot');
const LOOKBACK_DAYS = 120;

const SERIES = {
  wti_spot: {
    id: 'PET.RWTC.D',
    name: 'Cushing, OK WTI Spot Price FOB',
    benchmark: 'WTI',
    unit: 'usd_per_barrel',
  },
  brent_spot: {
    id: 'PET.RBRTE.D',
    name: 'Europe Brent Spot Price FOB',
    benchmark: 'Brent',
    unit: 'usd_per_barrel',
  },
};

const PUBLICATION_POLICY = {
  cadence: 'weekly_wednesday_us_eastern',
  normal_lag_calendar_days: 8,
  stale_after_calendar_days: 8,
  description: 'EIA publishes these daily spot observations in weekly batches. A multi-day lag is expected until the next Wednesday U.S. release window.',
};

function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
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

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function calendarDayDiff(olderDate, newerDate) {
  const older = new Date(`${compactToIso(compactDate(olderDate))}T00:00:00Z`);
  const newer = new Date(`${compactToIso(compactDate(newerDate))}T00:00:00Z`);
  return Math.round((newer - older) / 86400000);
}

function buildSourceFreshness(requestedDate, benchmarks) {
  const rows = (Array.isArray(benchmarks) ? benchmarks : []).map(item => {
    const lagDays = calendarDayDiff(item.latest_date, requestedDate);
    return {
      id: item.id,
      latest_date: item.latest_date,
      lag_calendar_days: lagDays,
      status: lagDays > PUBLICATION_POLICY.stale_after_calendar_days
        ? 'stale_warning'
        : lagDays === 0
          ? 'current_observation'
          : 'expected_weekly_publication_lag',
    };
  });
  return {
    policy: PUBLICATION_POLICY,
    requested_date: requestedDate,
    overall_status: rows.some(item => item.status === 'stale_warning')
      ? 'stale_warning'
      : rows.some(item => item.status === 'expected_weekly_publication_lag')
        ? 'expected_weekly_publication_lag'
        : 'current_observation',
    benchmarks: rows,
  };
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
    headers: { accept: 'application/json', 'user-agent': 'stock-data-eia-crude-spot/1.0' },
  });
  if (!response.ok) throw new Error(`EIA ${seriesId}: ${response.status} ${response.statusText}`);
  const payload = await response.json();
  const rows = (payload?.response?.data || []).map(row => ({
    date: isoToCompact(row.period),
    iso_date: row.period,
    price: Number(row.value),
  })).filter(row => /^\d{8}$/.test(row.date) && Number.isFinite(row.price) && row.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) throw new Error(`EIA ${seriesId}: no valid daily observations returned.`);
  return rows;
}

function changeFrom(rows, offset) {
  const latest = rows.at(-1);
  const previous = rows.at(-1 - offset);
  if (!latest || !previous || previous.price === 0) return { change: null, change_pct: null };
  const change = latest.price - previous.price;
  return { change: round(change), change_pct: round((change / previous.price) * 100) };
}

function buildBenchmark(key, rows) {
  const config = SERIES[key];
  const latest = rows.at(-1);
  const previous = rows.at(-2) || null;
  const one = changeFrom(rows, 1);
  const five = changeFrom(rows, 5);
  const twenty = changeFrom(rows, 20);
  return {
    id: key,
    eia_series_id: config.id,
    name: config.name,
    benchmark: config.benchmark,
    instrument_type: 'spot',
    unit: config.unit,
    latest_date: latest.date,
    latest_iso_date: latest.iso_date,
    latest_price: round(latest.price),
    previous_date: previous?.date || null,
    previous_price: previous ? round(previous.price) : null,
    change: one.change,
    change_pct: one.change_pct,
    change_5d: five.change,
    change_pct_5d: five.change_pct,
    change_20d: twenty.change,
    change_pct_20d: twenty.change_pct,
    observations: rows.slice(-80),
  };
}

function refreshIndexes(generatedAt) {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const dateDirs = fs.readdirSync(OUTPUT_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map(entry => entry.name).sort();
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'files.json'), `${JSON.stringify(dateDirs.map(date => `${date}/crude_spot.json`), null, 2)}\n`);
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    generated_at: generatedAt,
    latest_date: dateDirs.at(-1) || null,
    latest_file: dateDirs.length ? `data_eia_crude_spot/${dateDirs.at(-1)}/crude_spot.json` : null,
    available_dates: dateDirs,
  }, null, 2)}\n`);
}

async function main() {
  const args = parseArgs();
  const requestedDate = compactDate(args.get('date') || todayCompact());
  const force = args.has('force');
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error('EIA_API_KEY is required.');

  const endIso = compactToIso(requestedDate);
  const startIso = shiftIsoDate(endIso, -LOOKBACK_DAYS);
  const [wtiRows, brentRows] = await Promise.all([
    fetchSeries(SERIES.wti_spot.id, startIso, endIso, apiKey),
    fetchSeries(SERIES.brent_spot.id, startIso, endIso, apiKey),
  ]);

  const benchmarks = [buildBenchmark('wti_spot', wtiRows), buildBenchmark('brent_spot', brentRows)];
  const sourceFreshness = buildSourceFreshness(requestedDate, benchmarks);
  const snapshotDate = benchmarks.map(item => item.latest_date).sort().at(-1);
  const outputDir = path.join(OUTPUT_ROOT, snapshotDate);
  const outputFile = path.join(outputDir, 'crude_spot.json');

  if (!force && fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0) {
    console.log(JSON.stringify({ reused: true, requested_date: requestedDate, snapshot_date: snapshotDate, source_freshness: sourceFreshness, output: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'), benchmarks: benchmarks.map(({ id, latest_date }) => ({ id, latest_date })) }));
    return;
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 2,
    generated_at: generatedAt,
    requested_date: requestedDate,
    snapshot_date: snapshotDate,
    role: 'canonical_crude_spot_market_data',
    provider: 'U.S. Energy Information Administration Open Data API',
    source_url: 'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm',
    publication_policy: PUBLICATION_POLICY,
    source_freshness: sourceFreshness,
    series: SERIES,
    benchmarks,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
  refreshIndexes(generatedAt);
  console.log(JSON.stringify({ reused: false, requested_date: requestedDate, snapshot_date: snapshotDate, source_freshness: sourceFreshness, output: path.relative(ROOT, outputFile).replaceAll(path.sep, '/'), benchmarks: benchmarks.map(({ id, latest_date }) => ({ id, latest_date })) }));
}

if (require.main === module) {
  main().catch(error => { console.error(`Failed to crawl EIA crude spot: ${error.message}`); process.exitCode = 1; });
}

module.exports = { SERIES, PUBLICATION_POLICY, compactDate, calendarDayDiff, buildSourceFreshness, changeFrom, buildBenchmark };