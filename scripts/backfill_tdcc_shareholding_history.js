#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const stock = getArg('stock', '2449');
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-08-21');
const outputRoot = getArg('output-root', path.join('data_tdcc_shareholding', 'history', stock));
const delayMs = Number(getArg('delay-ms', '1800'));
const jitterMs = Number(getArg('jitter-ms', '1200'));
const capturedAt = getArg('captured-at', new Date().toISOString());
const fixtureDir = getArg('fixture-dir');
const PAGE = 'https://www.tdcc.com.tw/portal/zh/smWeb/qryStock';

function cleanText(v) { return String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim(); }
function compactDate(v) { return String(v).replaceAll('-', '').replaceAll('/', ''); }
function isoDate(v) { const s = compactDate(v); return /^\d{8}$/.test(s) ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : null; }
function num(v) { const n = Number(cleanText(v).replaceAll(',', '').replace('%','')); return Number.isFinite(n) ? n : null; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function jitter() { return delayMs + Math.floor(Math.random() * Math.max(1, jitterMs + 1)); }
function parseToken(html) {
  const m = html.match(/name=["']SYNCHRONIZER_TOKEN["'][^>]*value=["']([^"']+)["']/i) || html.match(/value=["']([^"']+)["'][^>]*name=["']SYNCHRONIZER_TOKEN["']/i);
  return m?.[1] || null;
}
function parseSynchronizerUri(html) {
  const m = html.match(/name=["']SYNCHRONIZER_URI["'][^>]*value=["']([^"']+)["']/i) || html.match(/value=["']([^"']+)["'][^>]*name=["']SYNCHRONIZER_URI["']/i);
  return m?.[1] || '/portal/zh/smWeb/qryStock';
}
function parseDateOptions(html) {
  const out = new Set();
  for (const m of html.matchAll(/<option\b[^>]*value=["']?(\d{8})["']?[^>]*>/gi)) out.add(m[1]);
  return [...out].sort();
}
function parseRows(html) {
  const rows = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cleanText(m[1]));
    if (cells.length < 5) continue;
    const level = num(cells[0]);
    if (!Number.isInteger(level) || level < 1 || level > 17) continue;
    const holders = num(cells[cells.length - 3]);
    const shares = num(cells[cells.length - 2]);
    const ratio = num(cells[cells.length - 1]);
    if (holders === null || shares === null || ratio === null) continue;
    rows.push({ level, range: cells[1], holders, shares, ratio_pct: ratio });
  }
  return rows.sort((a,b) => a.level - b.level);
}
function derive(rows) {
  const map = new Map(rows.map((r) => [r.level, r]));
  const large = map.get(15)?.ratio_pct;
  const small = [1,2,3,4,5,6,7,8,9].reduce((s,l) => s + (map.get(l)?.ratio_pct || 0), 0);
  return {
    large_holder_definition: 'TDCC level 15: 1,000,001 shares or more (more than 1,000 lots)',
    small_holder_definition: 'TDCC levels 1-9: up to 100,000 shares (up to 100 lots)',
    large_holder_pct: Number(Number(large || 0).toFixed(2)),
    small_holder_pct: Number(small.toFixed(2)),
    levels_present: rows.map((r) => r.level),
  };
}
function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  return values.map((x) => x.split(';')[0]).join('; ');
}
async function getPage() {
  const r = await fetch(PAGE, { headers: { 'user-agent': 'Mozilla/5.0 stock_data-tdcc-history/1.0', accept: 'text/html,*/*' } });
  if (!r.ok) throw new Error(`TDCC history GET HTTP ${r.status}`);
  return { html: await r.text(), cookie: cookieHeader(r) };
}
async function fetchDate(date) {
  if (fixtureDir) return fs.readFileSync(path.join(fixtureDir, `${date}.html`), 'utf8');
  const session = await getPage();
  const token = parseToken(session.html);
  if (!token) throw new Error('TDCC history page missing SYNCHRONIZER_TOKEN');
  const body = new URLSearchParams({ method: 'submit', firDate: date, scaDate: date, sqlMethod: 'StockNo', stockNo: stock, stockName: '', SYNCHRONIZER_URI: parseSynchronizerUri(session.html), SYNCHRONIZER_TOKEN: token });
  const r = await fetch(PAGE, { method: 'POST', headers: { 'user-agent': 'Mozilla/5.0 stock_data-tdcc-history/1.0', 'content-type': 'application/x-www-form-urlencoded', cookie: session.cookie, referer: PAGE }, body });
  if (!r.ok) throw new Error(`TDCC history POST ${date} HTTP ${r.status}`);
  return r.text();
}
async function availableDates() {
  if (fixtureDir) return fs.readdirSync(fixtureDir).filter((x) => /^\d{8}\.html$/.test(x)).map((x) => x.slice(0,8)).sort();
  const { html } = await getPage();
  return parseDateOptions(html);
}

(async () => {
  if (!/^\d{4}$/.test(stock)) throw new Error(`Invalid stock: ${stock}`);
  const from = compactDate(start); const to = compactDate(end);
  const dates = (await availableDates()).filter((d) => d >= from && d <= to);
  if (!dates.length) throw new Error(`No TDCC historical dates available in ${start}..${end}`);
  fs.mkdirSync(outputRoot, { recursive: true });
  const summary = { schema_version: 1, source: 'tdcc_official_historical_query', stock, range: { start, end }, captured_at: capturedAt, requested_dates: dates.length, parsed_dates: 0, skipped_existing: 0, failed_dates: [], files: [] };
  for (const date of dates) {
    const out = path.join(outputRoot, `${date}.json`);
    if (fs.existsSync(out)) { summary.skipped_existing += 1; summary.files.push(out); continue; }
    try {
      const html = await fetchDate(date);
      const rows = parseRows(html);
      if (rows.length < 15) throw new Error(`expected >=15 TDCC levels, got ${rows.length}`);
      const payload = {
        schema_version: 1,
        source: 'tdcc_official_historical_query',
        source_type: 'official_historical_web_query',
        stock,
        observed_date: isoDate(date),
        captured_at: capturedAt,
        historical_backfill: true,
        production_no_lookahead_safe: false,
        availability_policy: 'historical query captured after the fact; original publication timestamp is unknown and must not be inferred',
        derived: derive(rows),
        levels: rows,
      };
      fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
      summary.parsed_dates += 1; summary.files.push(out);
    } catch (error) {
      summary.failed_dates.push({ date, error: error.message });
    }
    if (!fixtureDir) await sleep(jitter());
  }
  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed_dates.length) process.exitCode = 2;
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
