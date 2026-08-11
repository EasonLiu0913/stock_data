#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  EVENT_TYPES,
  parseRocDate,
  parseTime,
  taipeiIso,
  classifyMaterialInformation,
  finalizeEvent,
  discoverTradingDates,
} = require('./fundamental_event_timeline');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_fundamental_events_historical');

function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out.set(key, true);
    else { out.set(key, next); i += 1; }
  }
  return out;
}

function deriveFiscalPeriod(text, publishedDate) {
  const source = String(text || '');
  let match = source.match(/(20\d{2})\s*年?\s*第?\s*([1-4])\s*季/i);
  if (match) return `${match[1]}Q${match[2]}`;
  match = source.match(/(20\d{2})\s*Q\s*([1-4])/i);
  if (match) return `${match[1]}Q${match[2]}`;
  if (!publishedDate) return null;
  const year = Number(publishedDate.slice(0, 4));
  const month = Number(publishedDate.slice(5, 7));
  if (/第二季|2Q|Q2/i.test(source)) return `${year}Q2`;
  if (/第三季|3Q|Q3/i.test(source)) return `${year}Q3`;
  if (/第一季|1Q|Q1/i.test(source)) return `${year}Q1`;
  if (/第四季|4Q|Q4/i.test(source)) return `${month <= 3 ? year - 1 : year}Q4`;
  return null;
}

function deriveRevenuePeriod(text, publishedDate) {
  const source = String(text || '');
  let match = source.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月.*營收/);
  if (match) return `${match[1]}${String(match[2]).padStart(2, '0')}`;
  if (!publishedDate) return null;
  const monthOnly = source.match(/(\d{1,2})\s*月.*營收/);
  if (!monthOnly) return null;
  const publishedYear = Number(publishedDate.slice(0, 4));
  const revenueMonth = Number(monthOnly[1]);
  const publishedMonth = Number(publishedDate.slice(5, 7));
  const revenueYear = revenueMonth > publishedMonth ? publishedYear - 1 : publishedYear;
  return `${revenueYear}${String(revenueMonth).padStart(2, '0')}`;
}

function normalizeHistoricalRow(row, stockId, tradingDates) {
  const date = parseRocDate(row.date);
  const time = parseTime(row.time);
  if (!date) return null;
  const title = String(row.title || '').trim();
  const description = String(row.description || '').trim();
  let eventType = classifyMaterialInformation(title, description);
  if (/月營收|營收報告|monthly\s*(sales|revenue)/i.test(`${title}\n${description}`)) eventType = EVENT_TYPES.MONTHLY_REVENUE;
  const fiscalPeriod = [EVENT_TYPES.PRELIMINARY_EARNINGS, EVENT_TYPES.INVESTOR_CONFERENCE].includes(eventType)
    ? deriveFiscalPeriod(`${title}\n${description}`, date)
    : null;
  const period = eventType === EVENT_TYPES.MONTHLY_REVENUE ? deriveRevenuePeriod(`${title}\n${description}`, date) : null;
  return finalizeEvent({
    stock_id: stockId,
    stock_name: row.stock_name || null,
    market: row.market || null,
    event_type: eventType,
    period,
    fiscal_period: fiscalPeriod,
    published_at: time ? taipeiIso(date, time) : null,
    published_date: date,
    timestamp_precision: time ? 'minute' : 'date',
    availability_confidence: time ? 'official_timestamp' : 'official_date',
    title,
    description,
    source: {
      provider: 'MOPS',
      role: 'historical_material_information',
      url: row.url || null,
    },
    raw: row,
  }, tradingDates);
}

async function scrapeYear(page, stockId, year) {
  const rocYear = year - 1911;
  const url = `https://mops.twse.com.tw/mops/web/t05st01?TYPEK=all&co_id=${encodeURIComponent(stockId)}&encodeURIComponent=1&firstin=1&inpuType=co_id&off=1&step=1&year=${rocYear}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);
  return page.evaluate(({ stockId, url }) => {
    const rows = [];
    for (const tr of document.querySelectorAll('tr')) {
      const cells = [...tr.querySelectorAll('td')].map(td => td.innerText.replace(/\s+/g, ' ').trim());
      if (!cells.length) continue;
      const joined = cells.join(' | ');
      if (!joined.includes(stockId)) continue;
      const dt = joined.match(/(\d{3}\/\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
      if (!dt) continue;
      const link = tr.querySelector('a[href]');
      let title = cells[cells.length - 1] || '';
      const stockIndex = cells.findIndex(cell => cell.includes(stockId));
      if (stockIndex >= 0 && cells[stockIndex + 3]) title = cells[stockIndex + 3];
      rows.push({
        stock_code: stockId,
        stock_name: stockIndex >= 0 ? cells[stockIndex + 1] || null : null,
        date: dt[1],
        time: dt[2],
        title,
        description: '',
        url: link ? new URL(link.getAttribute('href'), location.href).href : url,
      });
    }
    return rows;
  }, { stockId, url });
}

function writeEvents(stockId, year, events) {
  const dir = path.join(OUTPUT_ROOT, stockId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${year}.json`);
  const payload = {
    schema_version: 1,
    dataset: 'mops_historical_fundamental_events',
    generated_at: new Date().toISOString(),
    shadow_mode: true,
    stock_id: stockId,
    year: String(year),
    event_count: events.length,
    events,
  };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return path.relative(ROOT, file);
}

async function main(argv = process.argv.slice(2)) {
  // Keep Playwright optional for pure parsing/state-resolver consumers and unit tests.
  // The browser dependency is required only when the historical crawler is executed.
  const { chromium } = require('playwright');
  const args = parseArgs(argv);
  const stockIds = String(args.get('stock-ids') || '2330,2317,2454,2059').split(',').map(v => v.trim()).filter(Boolean);
  const startYear = Number(args.get('start-year') || 2024);
  const endYear = Number(args.get('end-year') || 2026);
  const tradingDates = discoverTradingDates(ROOT);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'zh-TW' });
  const summary = [];
  try {
    for (const stockId of stockIds) {
      for (let year = startYear; year <= endYear; year += 1) {
        let rawRows = [];
        let error = null;
        try { rawRows = await scrapeYear(page, stockId, year); }
        catch (err) { error = err.message; }
        const events = rawRows.map(row => normalizeHistoricalRow(row, stockId, tradingDates)).filter(Boolean);
        const output = writeEvents(stockId, year, events);
        summary.push({ stock_id: stockId, year, raw_rows: rawRows.length, events: events.length, output, error });
      }
    }
  } finally {
    await browser.close();
  }
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'build-summary.json'), `${JSON.stringify({ schema_version: 1, dataset: 'mops_historical_fundamental_events_build_summary', generated_at: new Date().toISOString(), shadow_mode: true, rows: summary }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exit(1); });

module.exports = { deriveFiscalPeriod, deriveRevenuePeriod, normalizeHistoricalRow };
