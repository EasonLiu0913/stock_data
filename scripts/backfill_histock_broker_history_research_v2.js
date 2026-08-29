#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const stock = getArg('stock', '2449');
const startDate = getArg('start', '2026-04-01');
const endDate = getArg('end', '2026-07-31');
const delayMs = Number(getArg('delay-ms', '2500'));
const jitterMs = Number(getArg('jitter-ms', '2500'));
const maxRetries = Number(getArg('max-retries', '3'));
const maxConsecutiveFailures = Number(getArg('max-consecutive-failures', '4'));
const outRoot = getArg('out', path.join('data_research', 'institutional-flow', 'histock', stock));
const tradingCalendarPath = path.join('data_history_sma', 'trading_days.json');
const nonTradingCalendarPath = path.join('data_history_sma', 'non_trading_days.json');

if (!/^[0-9A-Za-z]{4,6}$/.test(stock)) throw new Error(`Invalid stock: ${stock}`);
if (!/^20\d{2}-\d{2}-\d{2}$/.test(startDate) || !/^20\d{2}-\d{2}-\d{2}$/.test(endDate)) throw new Error('Dates must be YYYY-MM-DD');
if (startDate > endDate) throw new Error('start must be <= end');
if (!Number.isFinite(delayMs) || delayMs < 1000) throw new Error('delay-ms must be >= 1000');
if (!Number.isFinite(jitterMs) || jitterMs < 0 || jitterMs > 10000) throw new Error('jitter-ms must be between 0 and 10000');
if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 6) throw new Error('max-retries must be between 0 and 6');
if (!Number.isInteger(maxConsecutiveFailures) || maxConsecutiveFailures < 1 || maxConsecutiveFailures > 20) throw new Error('max-consecutive-failures must be between 1 and 20');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ymd = (s) => s.replaceAll('-', '');
const normalizeCalendarDate = (value) => String(value).replaceAll('/', '-');
const randomJitter = (max) => (max > 0 ? Math.floor(Math.random() * (max + 1)) : 0);

function loadCalendar(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Calendar file missing: ${filePath}`);
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const dates = new Set();
  for (const entries of Object.values(payload)) {
    if (!Array.isArray(entries)) continue;
    for (const value of entries) {
      const normalized = normalizeCalendarDate(value);
      if (/^20\d{2}-\d{2}-\d{2}$/.test(normalized)) dates.add(normalized);
    }
  }
  return { payload, dates };
}

function tradingDaysBetween(start, end, tradingCalendar, nonTradingCalendar) {
  for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year += 1) {
    if (!Array.isArray(tradingCalendar.payload[String(year)])) throw new Error(`Trading calendar missing year ${year}`);
  }
  const dates = [...tradingCalendar.dates].filter((date) => date >= start && date <= end).sort();
  const conflicts = dates.filter((date) => nonTradingCalendar.dates.has(date));
  if (conflicts.length) throw new Error(`Trading/non-trading calendar conflict: ${conflicts.join(', ')}`);
  if (!dates.length) throw new Error(`No trading days found in ${start} to ${end}`);
  return dates;
}

function decodeHtml(value) {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;/gi, "'").replace(/&quot;/gi, '"');
}
function stripHtml(value) {
  return decodeHtml(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
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
    if (cells.some((cell) => cell !== '')) rows.push(cells);
  }
  return rows;
}
function parseBrokerRows(html) {
  const records = [];
  const incompleteRecords = [];
  const seen = new Set();
  const seenIncomplete = new Set();
  for (const cells of extractRows(html)) {
    for (const offset of [0, 5]) {
      if (cells.length < offset + 5) continue;
      const broker = cells[offset];
      if (!broker || /券商名稱/.test(broker)) continue;
      const raw = {
        buy: cells[offset + 1] ?? '',
        sell: cells[offset + 2] ?? '',
        net: cells[offset + 3] ?? '',
        avg_price: cells[offset + 4] ?? '',
      };
      const buy = num(raw.buy);
      const sell = num(raw.sell);
      const net = num(raw.net);
      const avgPrice = num(raw.avg_price);
      const missingFields = [];
      if (buy === null) missingFields.push('buy');
      if (sell === null) missingFields.push('sell');
      if (net === null) missingFields.push('net');
      if (avgPrice === null) missingFields.push('avg_price');
      if (missingFields.length) {
        const hasSourceValue = Object.values(raw).some((value) => String(value).trim() !== '');
        if (!hasSourceValue) continue;
        const key = `${broker}|${raw.buy}|${raw.sell}|${raw.net}|${raw.avg_price}`;
        if (seenIncomplete.has(key)) continue;
        seenIncomplete.add(key);
        incompleteRecords.push({
          broker,
          buy,
          sell,
          net,
          avg_price: avgPrice,
          missing_fields: missingFields,
          reason: `${missingFields.join('_')}_missing_at_source`,
          raw_source_values: raw,
        });
        continue;
      }
      const key = `${broker}|${buy}|${sell}|${net}|${avgPrice}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({ broker, buy, sell, net, avg_price: avgPrice });
    }
  }
  return { records, incompleteRecords };
}

function makeDiagnostics(html, response, date) {
  const text = stripHtml(html);
  const compact = ymd(date);
  return {
    http_status: response.status,
    final_url: response.url,
    response_bytes: Buffer.byteLength(html),
    date_visible: [compact, date, date.replaceAll('-', '/')].some((token) => html.includes(token) || text.includes(token)),
    broker_keywords_visible: /券商|買進|賣出|買超|賣超/.test(text),
    table_rows: extractRows(html).length,
    page_title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 160),
  };
}

async function fetchDateOnce(date) {
  const compact = ymd(date);
  const url = `https://histock.tw/stock/branch.aspx?from=${compact}&no=${encodeURIComponent(stock)}&to=${compact}`;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; stock_data research/2.0)',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7',
    },
  });
  const html = await response.text();
  const diagnostics = makeDiagnostics(html, response, date);
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
  if (parsed.records.length === 0) {
    const error = new Error('no_broker_records_on_trading_day');
    error.retryable = true;
    error.diagnostics = { ...diagnostics, incomplete_records: parsed.incompleteRecords.length };
    throw error;
  }
  return { url, bytes: diagnostics.response_bytes, records: parsed.records, incompleteRecords: parsed.incompleteRecords };
}

const retryableStatus = (status) => status === 408 || status === 425 || status === 429 || status >= 500;
async function fetchDate(date) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetchDateOnce(date);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < maxRetries && (error.retryable === true || error.status === undefined || retryableStatus(error.status));
      if (!canRetry) break;
      const wait = Math.min(30000, Math.max(4000, delayMs * (2 ** attempt))) + randomJitter(jitterMs);
      console.log(`retry ${attempt + 1}/${maxRetries} after ${wait}ms (${error.message}; bytes=${error.diagnostics?.response_bytes ?? 'n/a'}; rows=${error.diagnostics?.table_rows ?? 'n/a'})`);
      await sleep(wait);
    }
  }
  throw lastError;
}

function readExistingDaily(dailyDir, date) {
  const file = path.join(dailyDir, `${ymd(date)}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (payload.source !== 'histock' || payload.stock !== stock || payload.date !== date || !Array.isArray(payload.records) || payload.records.length === 0) return null;
    return payload;
  } catch {
    return null;
  }
}

function aggregateWindow(days, endIndex, window) {
  const slice = days.slice(Math.max(0, endIndex - window + 1), endIndex + 1);
  const map = new Map();
  for (const day of slice) {
    for (const r of day.records) {
      const a = map.get(r.broker) || { broker: r.broker, total_net: 0, total_buy: 0, total_sell: 0, appearances: 0, sell_days: 0, buy_days: 0 };
      a.total_net += r.net;
      a.total_buy += r.buy;
      a.total_sell += r.sell;
      a.appearances += 1;
      if (r.net < 0) a.sell_days += 1;
      if (r.net > 0) a.buy_days += 1;
      map.set(r.broker, a);
    }
  }
  const rows = [...map.values()].map((a) => ({ ...a, sell_ratio: a.appearances ? a.sell_days / a.appearances : 0, buy_ratio: a.appearances ? a.buy_days / a.appearances : 0 }));
  return {
    window,
    available_trading_days: slice.length,
    from: slice[0]?.date || null,
    to: slice.at(-1)?.date || null,
    persistent_sellers: rows.filter((x) => x.total_net < 0 && x.sell_days >= 2).sort((a, b) => a.total_net - b.total_net).slice(0, 20),
    persistent_buyers: rows.filter((x) => x.total_net > 0 && x.buy_days >= 2).sort((a, b) => b.total_net - a.total_net).slice(0, 20),
  };
}

async function main() {
  const dailyDir = path.join(outRoot, 'daily');
  fs.mkdirSync(dailyDir, { recursive: true });
  const tradingCalendar = loadCalendar(tradingCalendarPath);
  const nonTradingCalendar = loadCalendar(nonTradingCalendarPath);
  const requested = tradingDaysBetween(startDate, endDate, tradingCalendar, nonTradingCalendar);
  const days = [];
  const unresolved = [];
  let reused = 0;
  let remote = 0;
  let consecutiveFailures = 0;
  let abortReason = null;

  for (let i = 0; i < requested.length; i += 1) {
    const date = requested[i];
    const existing = readExistingDaily(dailyDir, date);
    if (existing) {
      reused += 1;
      days.push(existing);
      console.log(`[${i + 1}/${requested.length}] ${date} reuse (${existing.records.length})`);
      continue;
    }

    remote += 1;
    process.stdout.write(`[${i + 1}/${requested.length}] ${date} fetch ... `);
    try {
      const fetched = await fetchDate(date);
      const payload = {
        schema_version: 3,
        source: 'histock',
        source_type: 'third_party_public_page',
        research_only: true,
        stock,
        date,
        fetched_at: new Date().toISOString(),
        source_url: fetched.url,
        response_bytes: fetched.bytes,
        record_count: fetched.records.length,
        incomplete_record_count: fetched.incompleteRecords.length,
        records: fetched.records,
        incomplete_records: fetched.incompleteRecords,
      };
      fs.writeFileSync(path.join(dailyDir, `${ymd(date)}.json`), `${JSON.stringify(payload, null, 2)}\n`);
      days.push(payload);
      consecutiveFailures = 0;
      console.log(`ok (${fetched.records.length}; incomplete=${fetched.incompleteRecords.length})`);
    } catch (error) {
      consecutiveFailures += 1;
      unresolved.push({ date, reason: error.message, diagnostics: error.diagnostics || null });
      console.log(`unresolved: ${error.message}; ${JSON.stringify(error.diagnostics || {})}`);
      if (consecutiveFailures >= maxConsecutiveFailures) {
        abortReason = `Stopped after ${consecutiveFailures} consecutive unresolved trading days at ${date}`;
        console.log(`❌ ${abortReason}`);
        break;
      }
    }

    if (i < requested.length - 1) {
      const wait = delayMs + randomJitter(jitterMs);
      console.log(`delay ${wait}ms`);
      await sleep(wait);
    }
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  const rolling = days.map((day, index) => ({ date: day.date, windows: [5, 10, 20].map((w) => aggregateWindow(days, index, w)) }));
  const complete = !abortReason && unresolved.length === 0 && days.length === requested.length;
  const analysis = {
    schema_version: 2,
    methodology: 'histock-top-broker-rolling-persistence-v2',
    source: 'histock',
    source_type: 'third_party_public_page',
    research_only: true,
    stock,
    requested_range: { start: startDate, end: endDate },
    calendar: {
      trading_days_file: tradingCalendarPath,
      non_trading_days_file: nonTradingCalendarPath,
      selection: 'trading_days_whitelist_with_non_trading_conflict_guard',
    },
    request_policy: {
      base_delay_ms: delayMs,
      jitter_ms: jitterMs,
      max_retries: maxRetries,
      max_consecutive_failures: maxConsecutiveFailures,
      zero_records_on_trading_day: 'retry_then_unresolved',
      existing_valid_daily_files: 'reuse_without_request',
      incomplete_source_rows: 'preserve_for_provenance_exclude_from_rolling',
    },
    generated_at: new Date().toISOString(),
    counts: {
      requested_trading_days: requested.length,
      reused_daily_files: reused,
      remote_requests_attempted: remote,
      parsed_trading_days: days.length,
      unresolved_trading_days: unresolved.length,
      incomplete_records: days.reduce((sum, day) => sum + (Array.isArray(day.incomplete_records) ? day.incomplete_records.length : 0), 0),
      failed: unresolved.length,
      skipped: 0,
    },
    complete,
    aborted: Boolean(abortReason),
    abort_reason: abortReason,
    unresolved,
    limitations: [
      'HiStock exposes ranked broker rows rather than the complete official TWSE BSR ledger.',
      'Absence of a broker from a parsed day means it was outside the exposed ranking, not necessarily zero trading.',
      'A whitelisted trading day with zero parsed broker rows is an unresolved fetch, never a valid skip.',
      'Source rows with missing numeric fields are preserved in incomplete_records and excluded from rolling calculations.',
      'This dataset is research-only and must not be merged with official TWSE broker-trade raw data without provenance.',
    ],
    rolling,
  };

  fs.writeFileSync(path.join(outRoot, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
  fs.writeFileSync(path.join(outRoot, 'manifest.json'), `${JSON.stringify({
    schema_version: 2,
    source: 'histock',
    research_only: true,
    stock,
    range: { start: startDate, end: endDate },
    daily_files: days.map((d) => `daily/${ymd(d.date)}.json`),
    analysis_file: 'analysis.json',
    counts: analysis.counts,
    complete,
  }, null, 2)}\n`);

  console.log('\n=== Backfill summary ===');
  console.log(JSON.stringify(analysis.counts, null, 2));
  console.log(`Complete: ${complete}`);
  if (unresolved.length) {
    console.log('Unresolved trading days:');
    for (const item of unresolved) console.log(`- ${item.date}: ${item.reason} ${JSON.stringify(item.diagnostics || {})}`);
  }
  const latest = rolling.at(-1);
  if (latest) {
    for (const w of latest.windows) {
      console.log(`\nLatest ${w.window}d persistent sellers:`);
      for (const x of w.persistent_sellers.slice(0, 8)) console.log(`- ${x.broker}: net=${x.total_net}, sell_days=${x.sell_days}/${x.appearances}`);
    }
  }

  if (!complete) throw new Error(`Incomplete HiStock backfill: ${days.length}/${requested.length} trading days parsed; unresolved=${unresolved.length}${abortReason ? `; ${abortReason}` : ''}`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});