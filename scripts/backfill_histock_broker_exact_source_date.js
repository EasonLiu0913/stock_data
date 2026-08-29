#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateDailyPayload, QUALITY_VERSION } = require('./lib/histock_broker_quality');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const stock = arg('stock');
const date = arg('date');
const outRoot = arg('out', path.join('data_research', 'institutional-flow', 'histock', stock));
const delayMs = Number(arg('delay-ms', '1800'));
const jitterMs = Number(arg('jitter-ms', '1200'));
const maxRetries = Number(arg('max-retries', '2'));

if (!/^\d{4}$/.test(stock)) throw new Error(`Invalid stock: ${stock}`);
if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
if (!Number.isFinite(delayMs) || delayMs < 1000) throw new Error('delay-ms must be >=1000');
if (!Number.isFinite(jitterMs) || jitterMs < 0 || jitterMs > 10000) throw new Error('jitter-ms must be 0..10000');
if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 6) throw new Error('max-retries must be 0..6');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compact = date.replaceAll('-', '');

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}
function stripHtml(value) {
  return decodeHtml(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}
function num(value) {
  const text = String(value ?? '').replaceAll(',', '').replace('+', '').trim();
  if (!text || /^(?:N\/?A|NA|--|-)$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
function extractRows(html) {
  const rows = [];
  for (const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((x) => stripHtml(x[1]));
    if (cells.some((x) => x !== '')) rows.push(cells);
  }
  return rows;
}
function parseBrokerRows(html) {
  const records = [];
  const incomplete = [];
  const seen = new Set();
  const seenIncomplete = new Set();
  for (const cells of extractRows(html)) {
    for (const offset of [0, 5]) {
      if (cells.length < offset + 5) continue;
      const broker = cells[offset];
      if (!broker || /券商名稱/.test(broker)) continue;
      const raw = { buy: cells[offset + 1] ?? '', sell: cells[offset + 2] ?? '', net: cells[offset + 3] ?? '', avg_price: cells[offset + 4] ?? '' };
      const buy = num(raw.buy), sell = num(raw.sell), net = num(raw.net), avgPrice = num(raw.avg_price);
      const missing = [];
      if (buy === null) missing.push('buy');
      if (sell === null) missing.push('sell');
      if (net === null) missing.push('net');
      if (avgPrice === null) missing.push('avg_price');
      if (missing.length) {
        if (!Object.values(raw).some((v) => String(v).trim() !== '')) continue;
        const key = `${broker}|${raw.buy}|${raw.sell}|${raw.net}|${raw.avg_price}`;
        if (seenIncomplete.has(key)) continue;
        seenIncomplete.add(key);
        incomplete.push({ broker, buy, sell, net, avg_price: avgPrice, missing_fields: missing, reason: `${missing.join('_')}_missing_at_source`, raw_source_values: raw });
        continue;
      }
      const key = `${broker}|${buy}|${sell}|${net}|${avgPrice}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({ broker, buy, sell, net, avg_price: avgPrice });
    }
  }
  return { records, incomplete };
}

async function fetchOnce() {
  const url = `https://histock.tw/stock/branch.aspx?from=${compact}&no=${encodeURIComponent(stock)}&to=${compact}`;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; stock_data validation-coverage/1.0)',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7',
    },
  });
  const html = await response.text();
  const text = stripHtml(html);
  const diagnostics = {
    http_status: response.status,
    final_url: response.url,
    response_bytes: Buffer.byteLength(html),
    date_visible: [compact, date, date.replaceAll('-', '/')].some((token) => html.includes(token) || text.includes(token)),
    broker_keywords_visible: /券商|買進|賣出|買超|賣超/.test(text),
    table_rows: extractRows(html).length,
  };
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.diagnostics = diagnostics;
    throw error;
  }
  if (!diagnostics.date_visible) {
    const error = new Error('requested date not visible');
    error.retryable = true;
    error.diagnostics = diagnostics;
    throw error;
  }
  const parsed = parseBrokerRows(html);
  if (!parsed.records.length) {
    const error = new Error('no_broker_records_on_source_session');
    error.retryable = true;
    error.diagnostics = { ...diagnostics, incomplete_records: parsed.incomplete.length };
    throw error;
  }
  const payload = {
    schema_version: 4,
    source: 'histock',
    source_type: 'third_party_public_page',
    research_only: true,
    stock,
    date,
    calendar_provenance: 'exact date supplied by source-derived TWSE foreign/OHLCV coverage planner; no data_history_sma calendar read',
    fetched_at: new Date().toISOString(),
    source_url: url,
    response_bytes: diagnostics.response_bytes,
    record_count: parsed.records.length,
    incomplete_record_count: parsed.incomplete.length,
    records: parsed.records,
    incomplete_records: parsed.incomplete,
  };
  const check = validateDailyPayload(payload, { stock, date });
  if (!check.valid) {
    const error = new Error(`hard data-quality gate failed: ${JSON.stringify(check.reasons)}`);
    error.diagnostics = { ...diagnostics, record_quality: check.record_quality };
    throw error;
  }
  return { payload, diagnostics };
}

(async () => {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const { payload, diagnostics } = await fetchOnce();
      const dailyDir = path.join(outRoot, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });
      const file = path.join(dailyDir, `${compact}.json`);
      fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
      console.log(JSON.stringify({ stock, date, file, quality_version: QUALITY_VERSION, diagnostics }, null, 2));
      return;
    } catch (error) {
      lastError = error;
      const retryableStatus = error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
      const canRetry = attempt < maxRetries && (error.retryable === true || error.status === undefined || retryableStatus);
      if (!canRetry) break;
      const wait = Math.min(30000, Math.max(4000, delayMs * (2 ** attempt))) + Math.floor(Math.random() * (jitterMs + 1));
      console.log(`retry ${attempt + 1}/${maxRetries} after ${wait}ms: ${error.message}`);
      await sleep(wait);
    }
  }
  console.error(JSON.stringify({ stock, date, error: lastError?.message || 'unknown', diagnostics: lastError?.diagnostics || null }, null, 2));
  process.exit(2);
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
