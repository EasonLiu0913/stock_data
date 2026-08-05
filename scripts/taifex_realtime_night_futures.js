#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LANDING_URL = 'https://mis.taifex.com.tw/futures/AfterHoursSession/EquityIndices/FuturesDomestic';
const QUOTE_URL = 'https://mis.taifex.com.tw/futures/api/getQuoteList';
const TAIPEI_TIME_ZONE = 'Asia/Taipei';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/127 Safari/537.36';

function compactDate(value) {
  const compact = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}

function addCalendarDays(compact, days) {
  const date = new Date(`${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function taipeiTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  return values.map((value) => value.split(';')[0]).join('; ');
}

function normalizeQuote(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    symbol_id: String(row.SymbolID || '').trim(),
    display_name: String(row.DispCName || '').trim(),
    status: String(row.Status || '').trim(),
    bid_price_1: finiteNumber(row.CBidPrice1),
    bid_size_1: finiteNumber(row.CBidSize1),
    ask_price_1: finiteNumber(row.CAskPrice1),
    ask_size_1: finiteNumber(row.CAskSize1),
    last_price: finiteNumber(row.CLastPrice),
    change: finiteNumber(row.CDiff),
    change_percent: finiteNumber(row.CDiffRate),
    amplitude_percent: finiteNumber(row.CAmpRate),
    volume_so_far: finiteNumber(row.CTotalVolume),
    open_price: finiteNumber(row.COpenPrice),
    high_so_far: finiteNumber(row.CHighPrice),
    low_so_far: finiteNumber(row.CLowPrice),
    reference_price: finiteNumber(row.CRefPrice),
    source_calendar_date: compactDate(row.CDate),
    source_time: String(row.CTime || '').replace(/[^0-9]/g, '').padStart(6, '0'),
  };
}

function selectRealtimeTxQuote(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeQuote)
    .filter(Boolean)
    .filter((row) => /^TXF.+-M$/.test(row.symbol_id))
    .filter((row) => row.last_price !== null && row.source_time !== '000000')
    .sort((left, right) => (right.volume_so_far ?? 0) - (left.volume_so_far ?? 0)
      || left.symbol_id.localeCompare(right.symbol_id))[0] || null;
}

function quoteTimestamp(quote) {
  if (!quote?.source_calendar_date || !/^\d{6}$/.test(quote.source_time || '')) return null;
  const hour = Number(quote.source_time.slice(0, 2));
  const quoteDate = hour < 5 ? addCalendarDays(quote.source_calendar_date, 1) : quote.source_calendar_date;
  return `${quoteDate.slice(0, 4)}-${quoteDate.slice(4, 6)}-${quoteDate.slice(6, 8)}T${quote.source_time.slice(0, 2)}:${quote.source_time.slice(2, 4)}:${quote.source_time.slice(4, 6)}+08:00`;
}

async function fetchRealtimeTxNight({ forecastDate, sessionStatus = 'in_progress', observedAt = new Date() } = {}) {
  const tradingDate = compactDate(forecastDate);
  if (!tradingDate) throw new Error('forecastDate must be YYYYMMDD');

  const landingResponse = await fetch(LANDING_URL, {
    headers: { accept: 'text/html,*/*', 'user-agent': USER_AGENT },
    redirect: 'follow',
  });
  const cookie = cookieHeader(landingResponse);
  const payload = {
    MarketType: '1',
    SymbolType: 'F',
    KindID: '1',
    CID: 'TXF',
    ExpireMonth: '',
    RowSize: '全部',
    PageNo: '',
    SortColumn: '',
    AscDesc: 'A',
  };
  const response = await fetch(QUOTE_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      referer: LANDING_URL,
      origin: 'https://mis.taifex.com.tw',
      'user-agent': USER_AGENT,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`TAIFEX realtime quote HTTP ${response.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  const rows = Array.isArray(json?.RtData?.QuoteList) ? json.RtData.QuoteList : [];
  const quote = selectRealtimeTxQuote(rows);
  const observedAtIso = taipeiTimestamp(observedAt);

  if (!quote) {
    return {
      schema_version: 2,
      target_date: tradingDate,
      trading_date: tradingDate,
      generated_at: observedAt.toISOString(),
      observed_at: observedAtIso,
      calculation_status: 'unavailable',
      available: false,
      session_status: sessionStatus,
      is_final: false,
      warning: '期交所即時夜盤端點沒有可用的 TX 近月成交快照。',
      source: { provider: 'TAIFEX', endpoint: QUOTE_URL, source_type: 'realtime_after_hours_quote' },
      source_status: { http_status: response.status, quote_count: rows.length, landing_http_status: landingResponse.status },
    };
  }

  const sessionStart = quote.source_calendar_date || null;
  const sessionEnd = sessionStart ? addCalendarDays(sessionStart, 1) : null;
  return {
    schema_version: 2,
    target_date: tradingDate,
    trading_date: tradingDate,
    generated_at: observedAt.toISOString(),
    observed_at: observedAtIso,
    quote_timestamp: quoteTimestamp(quote),
    calculation_status: 'completed',
    available: true,
    contract: 'TX',
    selected_contract_month: quote.display_name || quote.symbol_id,
    symbol_id: quote.symbol_id,
    trading_session: '盤後交易時段',
    session_status: sessionStatus,
    session_start_date: sessionStart,
    session_end_date: sessionEnd,
    session_time: '15:00~次日05:00',
    is_final: false,
    finalization_status: sessionStatus === 'closed_realtime' ? 'realtime_close_snapshot' : 'prediction_time_snapshot',
    last: quote.last_price,
    change: quote.change,
    change_percent: quote.change_percent,
    open: quote.open_price,
    high: quote.high_so_far,
    low: quote.low_so_far,
    volume: quote.volume_so_far,
    reference_price: quote.reference_price,
    bid_price_1: quote.bid_price_1,
    bid_size_1: quote.bid_size_1,
    ask_price_1: quote.ask_price_1,
    ask_size_1: quote.ask_size_1,
    source_calendar_date: quote.source_calendar_date,
    source_time: quote.source_time,
    warning: null,
    source: { provider: 'TAIFEX', endpoint: QUOTE_URL, landing_page: LANDING_URL, source_type: 'realtime_after_hours_quote' },
    source_status: { http_status: response.status, quote_count: rows.length, landing_http_status: landingResponse.status },
  };
}

function parseArgs(argv) {
  const options = { forecastDate: '', output: '', sessionStatus: 'in_progress' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--forecast-date') options.forecastDate = argv[++index] || '';
    else if (arg === '--output') options.output = argv[++index] || '';
    else if (arg === '--session-status') options.sessionStatus = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await fetchRealtimeTxNight(options);
  if (options.output) {
    const output = path.resolve(ROOT, options.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(result));
  if (!result.available) process.exitCode = 3;
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  LANDING_URL,
  QUOTE_URL,
  compactDate,
  finiteNumber,
  addCalendarDays,
  normalizeQuote,
  selectRealtimeTxQuote,
  quoteTimestamp,
  fetchRealtimeTxNight,
  main,
};
