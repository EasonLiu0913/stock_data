#!/usr/bin/env node

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
const delayMs = Number(getArg('delay-ms', '900'));
const jitterMs = Number(getArg('jitter-ms', '600'));
const maxRetries = Number(getArg('max-retries', '3'));
const maxConsecutiveFailures = Number(getArg('max-consecutive-failures', '4'));
const outRoot = getArg('out', path.join('data_research', 'institutional-flow', 'histock', stock));
const tradingCalendarPath = path.join('data_history_sma', 'trading_days.json');
const nonTradingCalendarPath = path.join('data_history_sma', 'non_trading_days.json');

if (!/^[0-9A-Za-z]{4,6}$/.test(stock)) throw new Error(`Invalid stock: ${stock}`);
if (!/^20\d{2}-\d{2}-\d{2}$/.test(startDate) || !/^20\d{2}-\d{2}-\d{2}$/.test(endDate)) throw new Error('Dates must be YYYY-MM-DD');
if (startDate > endDate) throw new Error('start must be <= end');
if (!Number.isFinite(delayMs) || delayMs < 300) throw new Error('delay-ms must be >= 300');
if (!Number.isFinite(jitterMs) || jitterMs < 0 || jitterMs > 10000) throw new Error('jitter-ms must be between 0 and 10000');
if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 6) throw new Error('max-retries must be between 0 and 6');
if (!Number.isInteger(maxConsecutiveFailures) || maxConsecutiveFailures < 1 || maxConsecutiveFailures > 20) throw new Error('max-consecutive-failures must be between 1 and 20');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (d) => d.toISOString().slice(0, 10);
const ymd = (s) => s.replaceAll('-', '');
const normalizeCalendarDate = (value) => String(value).replaceAll('/', '-');
const randomJitter = (max) => (max > 0 ? Math.floor(Math.random() * (max + 1)) : 0);

function weekdaysBetween(start, end) {
  const result = [];
  for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) result.push(fmt(d));
  }
  return result;
}

function loadCalendar(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Trading calendar file missing: ${filePath}`);
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

function calendarTradingDaysBetween(start, end, tradingCalendar, nonTradingCalendar) {
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  for (let year = startYear; year <= endYear; year += 1) {
    if (!Array.isArray(tradingCalendar.payload[String(year)])) {
      throw new Error(`Trading calendar missing year ${year}: ${tradingCalendarPath}`);
    }
  }

  const requested = [...tradingCalendar.dates]
    .filter((date) => date >= start && date <= end)
    .sort();
  const conflicts = requested.filter((date) => nonTradingCalendar.dates.has(date));
  if (conflicts.length) {
    throw new Error(`Trading/non-trading calendar conflict: ${conflicts.join(', ')}`);
  }
  if (!requested.length) {
    throw new Error(`No trading days found in requested range ${start} to ${end}`);
  }
  return requested;
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}
function stripHtml(value) {
  return decodeHtml(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
function num(value) {
  const n = Number(String(value ?? '').replaceAll(',', '').replace('+', '').trim());
  return Number.isFinite(n) ? n : null;
}
function extractRows(html) {
  const rows = [];
  for (const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((x) => stripHtml(x[1])).filter(Boolean);
    if (cells.length) rows.push(cells);
  }
  return rows;
}
function parseBrokerRecords(html) {
  const records = [];
  const seen = new Set();
  for (const cells of extractRows(html)) {
    for (const offset of [0, 5]) {
      if (cells.length < offset + 5) continue;
      const broker = cells[offset];
      const buy = num(cells[offset + 1]);
      const sell = num(cells[offset + 2]);
      const net = num(cells[offset + 3]);
      const avgPrice = num(cells[offset + 4]);
      if (!broker || /券商名稱/.test(broker) || buy === null || sell === null || net === null) continue;
      const key = `${broker}|${buy}|${sell}|${net}|${avgPrice}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({ broker, buy, sell, net, avg_price: avgPrice });
    }
  }
  return records;
}

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchDateOnce(date) {
  const compact = ymd(date);
  const url = `https://histock.tw/stock/branch.aspx?from=${compact}&no=${encodeURIComponent(stock)}&to=${compact}`;
  const response = await fetch(url, { headers: {
    'user-agent': 'Mozilla/5.0 (compatible; stock_data research/1.0)',
    accept: 'text/html,application/xhtml+xml',
    'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7',
  }});
  const html = await response.text();
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const pageText = stripHtml(html);
  const dateVisible = [compact, date, date.replaceAll('-', '/')].some((token) => html.includes(token) || pageText.includes(token));
  if (!dateVisible) throw new Error('requested date not visible');
  const records = parseBrokerRecords(html);
  return { url, bytes: Buffer.byteLength(html), records };
}

async function fetchDate(date) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fetchDateOnce(date);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < maxRetries && (error.status === undefined || retryableStatus(error.status));
      if (!canRetry) break;
      const backoffMs = Math.min(8000, delayMs * (2 ** attempt)) + randomJitter(jitterMs);
      console.log(`retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms (${error.message})`);
      await sleep(backoffMs);
    }
  }
  throw lastError;
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
  const rows = [...map.values()].map((a) => ({
    ...a,
    sell_ratio: a.appearances ? a.sell_days / a.appearances : 0,
    buy_ratio: a.appearances ? a.buy_days / a.appearances : 0,
  }));
  return {
    window,
    available_trading_days: slice.length,
    from: slice[0]?.date || null,
    to: slice.at(-1)?.date || null,
    persistent_sellers: rows.filter((x) => x.total_net < 0 && x.sell_days >= 2).sort((a, b) => a.total_net - b.total_net).slice(0, 20),
    persistent_buyers: rows.filter((x) => x.total_net > 0 && x.buy_days >= 2).sort((a, b) => b.total_net - a.total_net).slice(0, 20),
  };
}

function removeStaleDailyFilesForRange(dailyDir, start, end, allowedTradingDays) {
  if (!fs.existsSync(dailyDir)) return [];
  const removed = [];
  for (const name of fs.readdirSync(dailyDir)) {
    const match = name.match(/^(20\d{6})\.json$/);
    if (!match) continue;
    const date = `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`;
    if (date < start || date > end || allowedTradingDays.has(date)) continue;
    fs.unlinkSync(path.join(dailyDir, name));
    removed.push(date);
  }
  return removed;
}

async function main() {
  const dailyDir = path.join(outRoot, 'daily');
  fs.mkdirSync(dailyDir, { recursive: true });

  const tradingCalendar = loadCalendar(tradingCalendarPath);
  const nonTradingCalendar = loadCalendar(nonTradingCalendarPath);
  const weekdayCandidates = weekdaysBetween(startDate, endDate);
  const requested = calendarTradingDaysBetween(startDate, endDate, tradingCalendar, nonTradingCalendar);
  const requestedSet = new Set(requested);
  const excludedNonTradingDays = weekdayCandidates.filter((date) => !requestedSet.has(date));
  const removedStaleDailyFiles = removeStaleDailyFilesForRange(dailyDir, startDate, endDate, requestedSet);

  console.log(`Calendar-selected trading days: ${requested.length}/${weekdayCandidates.length} weekday candidates`);
  if (excludedNonTradingDays.length) console.log(`Excluded non-trading weekdays: ${excludedNonTradingDays.join(', ')}`);
  if (removedStaleDailyFiles.length) console.log(`Removed stale non-trading daily files: ${removedStaleDailyFiles.join(', ')}`);

  const days = [];
  const skipped = [];
  const failed = [];
  let consecutiveFailures = 0;
  let abortReason = null;
  let attempted = 0;

  for (let i = 0; i < requested.length; i += 1) {
    const date = requested[i];
    attempted += 1;
    process.stdout.write(`[${i + 1}/${requested.length}] ${date} ... `);
    try {
      const fetched = await fetchDate(date);
      consecutiveFailures = 0;
      if (fetched.records.length === 0) {
        skipped.push({ date, reason: 'no_broker_records' });
        console.log('skip (no records)');
      } else {
        const payload = {
          schema_version: 1,
          source: 'histock',
          source_type: 'third_party_public_page',
          research_only: true,
          stock,
          date,
          fetched_at: new Date().toISOString(),
          source_url: fetched.url,
          response_bytes: fetched.bytes,
          record_count: fetched.records.length,
          records: fetched.records,
        };
        fs.writeFileSync(path.join(dailyDir, `${ymd(date)}.json`), `${JSON.stringify(payload, null, 2)}\n`);
        days.push(payload);
        console.log(`ok (${fetched.records.length})`);
      }
    } catch (error) {
      consecutiveFailures += 1;
      failed.push({ date, reason: error.message });
      console.log(`failed: ${error.message}`);
      if (consecutiveFailures >= maxConsecutiveFailures) {
        abortReason = `Stopped after ${consecutiveFailures} consecutive failures at ${date}`;
        console.log(`❌ ${abortReason}`);
        break;
      }
    }
    if (i < requested.length - 1) {
      const waitMs = delayMs + randomJitter(jitterMs);
      console.log(`delay ${waitMs}ms`);
      await sleep(waitMs);
    }
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  const rolling = days.map((day, index) => ({
    date: day.date,
    windows: [5, 10, 20].map((w) => aggregateWindow(days, index, w)),
  }));
  const analysis = {
    schema_version: 1,
    methodology: 'histock-top-broker-rolling-persistence-v1',
    source: 'histock',
    source_type: 'third_party_public_page',
    research_only: true,
    stock,
    requested_range: { start: startDate, end: endDate },
    calendar: {
      trading_days_file: tradingCalendarPath,
      non_trading_days_file: nonTradingCalendarPath,
      selection: 'trading_days_whitelist_with_non_trading_conflict_guard',
      excluded_non_trading_weekdays: excludedNonTradingDays,
      removed_stale_non_trading_daily_files: removedStaleDailyFiles,
    },
    request_policy: {
      base_delay_ms: delayMs,
      jitter_ms: jitterMs,
      max_retries: maxRetries,
      max_consecutive_failures: maxConsecutiveFailures,
    },
    generated_at: new Date().toISOString(),
    counts: {
      requested_weekdays: weekdayCandidates.length,
      requested_trading_days: requested.length,
      attempted_trading_days: attempted,
      parsed_trading_days: days.length,
      skipped: skipped.length,
      failed: failed.length,
    },
    aborted: Boolean(abortReason),
    abort_reason: abortReason,
    limitations: [
      'HiStock exposes ranked broker rows rather than the complete official TWSE BSR ledger.',
      'Absence from a day means the broker was outside the exposed ranking, not necessarily zero trading.',
      'This dataset is research-only and must not be merged with official TWSE broker-trade raw data without provenance.',
    ],
    skipped,
    failed,
    rolling,
  };
  fs.writeFileSync(path.join(outRoot, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
  fs.writeFileSync(path.join(outRoot, 'manifest.json'), `${JSON.stringify({
    schema_version: 1,
    source: 'histock', research_only: true, stock,
    range: { start: startDate, end: endDate },
    calendar: analysis.calendar,
    daily_files: days.map((d) => `daily/${ymd(d.date)}.json`),
    analysis_file: 'analysis.json', counts: analysis.counts,
  }, null, 2)}\n`);

  console.log('\n=== Backfill summary ===');
  console.log(JSON.stringify(analysis.counts, null, 2));
  if (failed.length) {
    console.log('Failed dates:');
    for (const x of failed) console.log(`- ${x.date}: ${x.reason}`);
  }
  const latest = rolling.at(-1);
  if (latest) {
    for (const w of latest.windows) {
      console.log(`\nLatest ${w.window}d persistent sellers:`);
      for (const x of w.persistent_sellers.slice(0, 8)) console.log(`- ${x.broker}: net=${x.total_net}, sell_days=${x.sell_days}/${x.appearances}`);
    }
  }
  if (abortReason) throw new Error(abortReason);
  if (failed.length > Math.max(3, Math.floor(requested.length * 0.1))) {
    throw new Error(`Too many failed dates: ${failed.length}/${requested.length}`);
  }
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});