#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const {
  EVENT_TYPES,
  normalizeStockId,
  parseRocDate,
  parseTime,
  taipeiIso,
  discoverTradingDates,
  pick,
  classifyMaterialInformation,
  finalizeEvent,
} = require('./fundamental_event_timeline');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_fundamental_events');
const TWSE = {
  monthly: 'https://openapi.twse.com.tw/v1/opendata/t187ap05_L',
  material: 'https://openapi.twse.com.tw/v1/opendata/t187ap04_L',
};
const TPEX = {
  monthly: 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O',
  material: 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap04_O',
};

function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out.set(key, true);
    else { out.set(key, next); i += 1; }
  }
  return out;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function getJsonOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json', 'User-Agent': 'stock_data fundamental-event-shadow/1.0' } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`HTTP ${res.statusCode} ${url}: ${body.slice(0, 300)}`);
          error.httpStatus = res.statusCode;
          return reject(error);
        }
        try { resolve(JSON.parse(body)); }
        catch (error) { reject(new Error(`Invalid JSON ${url}: ${error.message}; body=${body.slice(0, 300)}`)); }
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error(`Request timeout: ${url}`)));
    req.on('error', reject);
  });
}

async function getJson(url, maxAttempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try { return await getJsonOnce(url); }
    catch (error) {
      lastError = error;
      const status = Number(error.httpStatus || 0);
      const retryable = status === 429 || status >= 500 || /timeout|ECONNRESET|ETIMEDOUT|socket hang up/i.test(error.message);
      if (!retryable || attempt === maxAttempts) throw error;
      await sleep([1500, 4000, 8000][Math.min(attempt - 1, 2)] + Math.floor(Math.random() * 400));
    }
  }
  throw lastError;
}

function numberValue(value) {
  if (value == null || value === '') return null;
  const number = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

function normalizePeriod(value) {
  const text = String(value || '').replace(/[^0-9]/g, '');
  if (text.length >= 5) {
    const y = Number(text.slice(0, text.length - 2));
    const m = Number(text.slice(-2));
    const year = y < 1911 ? y + 1911 : y;
    if (year >= 2000 && m >= 1 && m <= 12) return `${year}${String(m).padStart(2, '0')}`;
  }
  return null;
}

function inferMonthlyRevenuePeriod(text) {
  const value = String(text || '');
  let match = value.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);
  if (match) return `${match[1]}${String(match[2]).padStart(2, '0')}`;
  match = value.match(/民國\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月/);
  if (match) return `${Number(match[1]) + 1911}${String(match[2]).padStart(2, '0')}`;
  return null;
}

function normalizeMonthlyRevenue(row, market, provider, tradingDates) {
  const stockId = normalizeStockId(pick(row, ['公司代號', '公司代碼', '證券代號', 'SecuritiesCompanyCode', 'Code']));
  if (!stockId) return null;
  const snapshotDate = parseRocDate(pick(row, ['出表日期', '資料日期', 'Date', 'ReportDate']));
  const period = normalizePeriod(pick(row, ['資料年月', '年月', 'YearMonth', 'RevenueMonth']));
  if (!period) return null;
  return finalizeEvent({
    stock_id: stockId,
    stock_name: pick(row, ['公司名稱', '公司簡稱', 'CompanyName']),
    market,
    event_type: EVENT_TYPES.MONTHLY_REVENUE,
    period,
    published_at: null,
    published_date: null,
    timestamp_precision: 'fallback',
    fallback_known_date: snapshotDate,
    availability_confidence: snapshotDate ? 'aggregate_snapshot_date' : 'unknown',
    title: `${period} 月營收（官方彙總值）`,
    metrics: {
      revenue: numberValue(pick(row, ['當月營收', '本月營業收入淨額', '營業收入-當月營收', 'CurrentMonthRevenue'])),
      previous_month_revenue: numberValue(pick(row, ['上月營收', '營業收入-上月營收', 'PreviousMonthRevenue'])),
      previous_year_revenue: numberValue(pick(row, ['去年當月營收', '去年同月營收', '營業收入-去年當月營收', 'PreviousYearRevenue'])),
      yoy_pct: numberValue(pick(row, ['去年同月增減(%)', '去年同月增減％', '營業收入-去年同月增減(%)', 'YoY'])),
      mom_pct: numberValue(pick(row, ['上月比較增減(%)', '上月比較增減％', '營業收入-上月比較增減(%)', 'MoM'])),
    },
    source: {
      provider,
      dataset: market === 'TWSE' ? 't187ap05_L' : 'mopsfin_t187ap05_O',
      role: 'official_monthly_revenue_value_snapshot',
      observed_date: snapshotDate,
      warning: 'OpenAPI 出表日期 is treated as aggregate snapshot date, not company publication time',
    },
    raw: row,
  }, tradingDates);
}

function normalizeMaterial(row, market, provider, tradingDates) {
  const stockId = normalizeStockId(pick(row, ['公司代號', '公司代碼', '證券代號', 'SecuritiesCompanyCode', 'Code']));
  if (!stockId) return null;
  const date = parseRocDate(pick(row, ['發言日期', '發布日期', 'Date', 'SpokeDate']));
  const time = parseTime(pick(row, ['發言時間', '發布時間', 'Time', 'SpokeTime']));
  const title = String(pick(row, ['主旨', '標題', 'Subject']) || '').trim();
  const description = String(pick(row, ['說明', '內容', 'Description']) || '').trim();
  const eventType = classifyMaterialInformation(title, description);
  const period = eventType === EVENT_TYPES.MONTHLY_REVENUE
    ? inferMonthlyRevenuePeriod(`${title}\n${description}`)
    : null;
  return finalizeEvent({
    stock_id: stockId,
    stock_name: pick(row, ['公司名稱', '公司簡稱', 'CompanyName']),
    market,
    event_type: eventType,
    period,
    published_at: date && time ? taipeiIso(date, time) : null,
    published_date: date,
    timestamp_precision: date && time ? 'second' : 'date',
    availability_confidence: date && time ? 'official_timestamp' : date ? 'official_date' : 'unknown',
    title,
    description,
    source: {
      provider,
      dataset: market === 'TWSE' ? 't187ap04_L' : 'mopsfin_t187ap04_O',
      role: eventType === EVENT_TYPES.MONTHLY_REVENUE ? 'official_monthly_revenue_disclosure' : 'official_material_information',
      sequence: pick(row, ['序號', 'SeqNo', 'Sequence']),
      fact_date: parseRocDate(pick(row, ['事實發生日', 'FactDate'])),
      article: pick(row, ['符合條款', '符合條款第幾款', 'Article']),
    },
    raw: row,
  }, tradingDates);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function fallbackFormalEvents(stockId, tradingDates, asOfDate) {
  const stockDir = path.join(ROOT, 'data_finmind_quarterly_financial_quality', stockId);
  if (!fs.existsSync(stockDir)) return [];
  const events = [];
  for (const name of fs.readdirSync(stockDir).filter(name => /^20\d{2}Q[1-4]\.json$/.test(name)).sort()) {
    const payload = readJson(path.join(stockDir, name));
    if (!payload) continue;
    const period = name.replace('.json', '');
    const fallbackDate = payload.methodology?.conservative_known_date || null;
    if (!fallbackDate || fallbackDate > asOfDate) continue;
    events.push(finalizeEvent({
      stock_id: stockId,
      market: null,
      event_type: EVENT_TYPES.FORMAL_FINANCIAL_REPORT,
      fiscal_period: period,
      published_at: null,
      published_date: null,
      timestamp_precision: 'fallback',
      fallback_known_date: fallbackDate,
      availability_confidence: 'fallback_deadline',
      title: `${period} 正式財報（availability fallback）`,
      metrics: payload.standalone_quarter || null,
      source: {
        provider: payload.source?.provider || 'FinMind',
        dataset: payload.source?.dataset || payload.dataset || 'quarterly_financial_quality',
        role: 'financial_values_with_fallback_availability',
        source_file: `data_finmind_quarterly_financial_quality/${stockId}/${name}`,
      },
      raw: null,
    }, tradingDates));
  }
  return events;
}

function readSupplementalEvents(file, tradingDates) {
  if (!file || !fs.existsSync(file)) return [];
  const payload = readJson(file);
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.events) ? payload.events : [];
  return rows.map(row => finalizeEvent({
    ...row,
    availability_confidence: row.availability_confidence || 'curated_supplemental',
    source: { ...(row.source || {}), role: row.source?.role || 'supplemental_ir_or_mops_event' },
  }, tradingDates));
}

function dedupeEvents(events) {
  const byId = new Map();
  const confidenceOrder = ['official_timestamp','official_date','curated_supplemental','aggregate_snapshot_date','fallback_deadline','unknown'];
  for (const event of events) {
    const existing = byId.get(event.event_id);
    if (!existing) { byId.set(event.event_id, event); continue; }
    const existingRank = confidenceOrder.indexOf(existing.availability_confidence);
    const newRank = confidenceOrder.indexOf(event.availability_confidence);
    if (newRank !== -1 && (existingRank === -1 || newRank < existingRank)) byId.set(event.event_id, event);
  }
  return [...byId.values()].sort((a, b) => String(a.published_at || a.published_date || a.fallback_known_date || '').localeCompare(String(b.published_at || b.published_date || b.fallback_known_date || '')) || a.event_id.localeCompare(b.event_id));
}

function writeStockEvents(stockId, events, asOfDate) {
  const byYear = new Map();
  for (const event of events) {
    const date = event.published_date || event.fallback_known_date || event.effective_trading_date || asOfDate;
    const year = String(date || asOfDate).slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(event);
  }
  const written = [];
  for (const [year, rows] of byYear) {
    const dir = path.join(OUTPUT_ROOT, stockId);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${year}.json`);
    const payload = {
      schema_version: 1,
      dataset: 'fundamental_event_timeline',
      generated_at: new Date().toISOString(),
      shadow_mode: true,
      stock_id: stockId,
      year,
      as_of_date: asOfDate,
      event_count: rows.length,
      events: rows,
    };
    fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
    written.push(path.relative(ROOT, file));
  }
  return written;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const asOfDate = String(args.get('as-of-date') || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())).trim();
  const stockIdsArg = String(args.get('stock-ids') || '').trim();
  const requestedStocks = new Set(stockIdsArg.split(',').map(normalizeStockId).filter(Boolean));
  const offline = args.get('offline') === true || String(args.get('offline') || '') === 'true';
  const supplemental = args.get('supplemental-file') ? path.resolve(ROOT, String(args.get('supplemental-file'))) : null;
  const tradingDates = discoverTradingDates(ROOT);
  const allEvents = [];
  const sourceStatus = [];

  const sourceSpecs = [
    ['TWSE', 'TWSE OpenAPI', TWSE],
    ['TPEx', 'TPEx OpenAPI', TPEX],
  ];
  if (!offline) {
    for (const [market, provider, spec] of sourceSpecs) {
      for (const [kind, url] of Object.entries(spec)) {
        try {
          const rows = await getJson(url);
          if (!Array.isArray(rows)) throw new Error(`Expected array from ${url}`);
          let accepted = 0;
          for (const row of rows) {
            const event = kind === 'monthly' ? normalizeMonthlyRevenue(row, market, provider, tradingDates) : normalizeMaterial(row, market, provider, tradingDates);
            if (!event) continue;
            if (requestedStocks.size && !requestedStocks.has(event.stock_id)) continue;
            const visibleDate = event.published_date || event.fallback_known_date || event.effective_trading_date;
            if (visibleDate && visibleDate > asOfDate) continue;
            allEvents.push(event);
            accepted += 1;
          }
          sourceStatus.push({ market, kind, url, status: 'ok', rows: rows.length, accepted });
        } catch (error) {
          sourceStatus.push({ market, kind, url, status: 'error', error: error.message });
          console.warn(`[source-error] ${market} ${kind}: ${error.message}`);
        }
      }
    }
  }

  const supplementalEvents = readSupplementalEvents(supplemental, tradingDates)
    .filter(event => !requestedStocks.size || requestedStocks.has(event.stock_id))
    .filter(event => (event.published_date || event.fallback_known_date || asOfDate) <= asOfDate);
  allEvents.push(...supplementalEvents);

  const stockIds = requestedStocks.size ? [...requestedStocks] : [...new Set(allEvents.map(event => event.stock_id))];
  for (const stockId of stockIds) allEvents.push(...fallbackFormalEvents(stockId, tradingDates, asOfDate));

  const byStock = new Map();
  for (const event of dedupeEvents(allEvents)) {
    if (!byStock.has(event.stock_id)) byStock.set(event.stock_id, []);
    byStock.get(event.stock_id).push(event);
  }

  const written = [];
  for (const [stockId, events] of byStock) written.push(...writeStockEvents(stockId, events, asOfDate));
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const allRows = [...byStock.values()].flat();
  const summary = {
    schema_version: 1,
    dataset: 'fundamental_event_timeline_build_summary',
    generated_at: new Date().toISOString(),
    shadow_mode: true,
    as_of_date: asOfDate,
    requested_stock_ids: [...requestedStocks],
    stock_count: byStock.size,
    event_count: allRows.length,
    event_type_counts: Object.fromEntries(Object.values(EVENT_TYPES).map(type => [type, allRows.filter(event => event.event_type === type).length])),
    source_status: sourceStatus,
    trading_date_count: tradingDates.length,
    supplemental_event_count: supplementalEvents.length,
    written_files: written,
    production_integration: false,
  };
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'build-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));

  const successfulOfficialSources = sourceStatus.filter(item => item.status === 'ok').length;
  if (!offline && successfulOfficialSources === 0) process.exitCode = 2;
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exit(1); });

module.exports = { normalizeMonthlyRevenue, normalizeMaterial, normalizePeriod, inferMonthlyRevenuePeriod, fallbackFormalEvents, dedupeEvents };
