#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const stocks = getArg('stocks', '2330,2317,2454,2382,2303,2449').split(',').map((x) => x.trim()).filter(Boolean);
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-08-21');
const output = getArg('output');
const githubOutput = getArg('github-output');
const fixtureDates = getArg('fixture-dates');
const PAGE = 'https://www.tdcc.com.tw/portal/zh/smWeb/qryStock';

function compactDate(v) { return String(v).replaceAll('-', '').replaceAll('/', ''); }
function isoDate(v) { const s = compactDate(v); return /^\d{8}$/.test(s) ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : null; }
function parseDateOptions(html) {
  const out = new Set();
  for (const m of html.matchAll(/<option\b[^>]*value=["']?(\d{8})["']?[^>]*>/gi)) out.add(m[1]);
  return [...out].sort();
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function validatePayload(file, stock, date) {
  const p = readJson(file);
  if (!p) return 'invalid_json';
  if (p.source !== 'tdcc_official_historical_query') return 'wrong_source';
  if (p.stock !== stock) return 'wrong_stock';
  if (p.observed_date !== isoDate(date)) return 'wrong_observed_date';
  if (p.historical_backfill !== true) return 'not_historical_backfill';
  if (!p.derived || !Number.isFinite(Number(p.derived.large_holder_pct)) || !Number.isFinite(Number(p.derived.small_holder_pct))) return 'invalid_derived';
  if (!Array.isArray(p.levels) || p.levels.length < 15) return 'insufficient_levels';
  return null;
}
async function availableDates() {
  if (fixtureDates) {
    const p = readJson(fixtureDates);
    if (!Array.isArray(p)) throw new Error('--fixture-dates must be a JSON array of YYYYMMDD strings');
    return [...new Set(p.map(String))].filter((d) => /^\d{8}$/.test(d)).sort();
  }
  const r = await fetch(PAGE, { headers: { 'user-agent': 'Mozilla/5.0 stock_data-tdcc-coverage-plan/1.0', accept: 'text/html,*/*' } });
  if (!r.ok) throw new Error(`TDCC coverage plan GET HTTP ${r.status}`);
  return parseDateOptions(await r.text());
}
function writeGithubOutputs(plan) {
  if (!githubOutput) return;
  const lines = [
    `matrix=${JSON.stringify({ include: plan.missing_stocks })}`,
    `missing_count=${plan.counts.stocks_with_gaps}`,
    `missing_dates_total=${plan.counts.missing_or_invalid_dates}`,
    `expected_dates_count=${plan.counts.expected_dates}`,
  ];
  fs.appendFileSync(githubOutput, `${lines.join('\n')}\n`);
}

(async () => {
  if (!stocks.length || stocks.some((s) => !/^\d{4}$/.test(s))) throw new Error(`Invalid stocks: ${stocks.join(',')}`);
  const from = compactDate(start);
  const to = compactDate(end);
  if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to) || from > to) throw new Error(`Invalid range: ${start}..${end}`);

  const expectedDates = (await availableDates()).filter((d) => d >= from && d <= to);
  if (!expectedDates.length) throw new Error(`No official TDCC historical dates available in ${start}..${end}`);

  const stockCoverage = [];
  const missingStocks = [];
  let missingTotal = 0;
  for (const stock of stocks) {
    const root = path.join('data_tdcc_shareholding', 'history', stock);
    const missingDates = [];
    const invalidDates = [];
    const validDates = [];
    for (const date of expectedDates) {
      const file = path.join(root, `${date}.json`);
      if (!fs.existsSync(file)) {
        missingDates.push(date);
        continue;
      }
      const reason = validatePayload(file, stock, date);
      if (reason) invalidDates.push({ date, reason });
      else validDates.push(date);
    }
    const unresolvedDates = [...missingDates, ...invalidDates.map((x) => x.date)].sort();
    missingTotal += unresolvedDates.length;
    const row = {
      stock,
      expected_dates: expectedDates.length,
      valid_dates: validDates.length,
      missing_dates: missingDates,
      invalid_dates: invalidDates,
      coverage_ratio: Number((validDates.length / expectedDates.length).toFixed(4)),
    };
    stockCoverage.push(row);
    if (unresolvedDates.length) {
      missingStocks.push({
        stock,
        expected_dates: expectedDates.join(','),
        unresolved_dates: unresolvedDates.join(','),
        unresolved_count: unresolvedDates.length,
      });
    }
  }

  const plan = {
    schema_version: 1,
    source: 'tdcc_official_historical_query_date_coverage',
    range: { start, end },
    expected_dates: expectedDates,
    counts: {
      stocks: stocks.length,
      expected_dates: expectedDates.length,
      theoretical_stock_dates: stocks.length * expectedDates.length,
      valid_stock_dates: stockCoverage.reduce((s, x) => s + x.valid_dates, 0),
      missing_or_invalid_dates: missingTotal,
      stocks_with_gaps: missingStocks.length,
    },
    stocks: stockCoverage,
    missing_stocks: missingStocks,
    generated_at: new Date().toISOString(),
  };

  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
  }
  writeGithubOutputs(plan);
  console.log(JSON.stringify(plan, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
