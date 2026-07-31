#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://www.taifex.com.tw';

function stripHtml(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x25B2;|&#9650;/gi, '▲')
    .replace(/&#x25BC;|&#9660;/gi, '▼')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeHtml(html, targetDate) {
  const text = stripHtml(html);
  const targetSlash = `${targetDate.slice(0, 4)}/${targetDate.slice(4, 6)}/${targetDate.slice(6, 8)}`;
  const dates = [...new Set(text.match(/20\d{2}[/-]\d{2}[/-]\d{2}/g) || [])].slice(0, 30);
  const txIndex = text.indexOf('臺股期貨');
  const tableIndex = text.search(/TX\s+20\d{4}/);
  const aroundIndex = tableIndex >= 0 ? tableIndex : txIndex;
  return {
    title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim(),
    text_length: text.length,
    dates,
    contains_target_date: text.includes(targetSlash) || text.includes(targetDate),
    contains_tx: /臺股期貨|\bTX\b/.test(text),
    contains_after_hours: /盤後交易時段|15:00~次日05:00/.test(text),
    contains_regular_session: /一般交易時段/.test(text),
    relevant_excerpt: aroundIndex >= 0
      ? text.slice(Math.max(0, aroundIndex - 240), aroundIndex + 1400)
      : text.slice(0, 1200),
  };
}

async function request(name, url, options, targetDate) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/vnd.ms-excel,*/*',
        'user-agent': 'Mozilla/5.0 (compatible; EasonLiu0913-stock_data/1.0)',
        ...(options?.headers || {}),
      },
      ...options,
    });
    const body = await response.text();
    return {
      name,
      ok: response.ok,
      status: response.status,
      final_url: response.url,
      content_type: response.headers.get('content-type'),
      content_disposition: response.headers.get('content-disposition'),
      body_bytes: Buffer.byteLength(body),
      ...summarizeHtml(body, targetDate),
    };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

function formBody(entries) {
  return new URLSearchParams(entries).toString();
}

async function probeDateQuery(targetDate) {
  if (!/^20\d{6}$/.test(targetDate)) throw new Error('date must be YYYYMMDD');
  const slash = `${targetDate.slice(0, 4)}/${targetDate.slice(4, 6)}/${targetDate.slice(6, 8)}`;
  const encoded = encodeURIComponent(slash);
  const candidates = [
    ['excel_get_lower', `${BASE}/cht/3/futDailyMarketExcel?commodity_id=TX&marketCode=1&queryDate=${encoded}`],
    ['excel_get_upper_market', `${BASE}/cht/3/futDailyMarketExcel?commodity_id=TX&MarketCode=1&queryDate=${encoded}`],
    ['excel_get_commodity_id_date', `${BASE}/cht/3/futDailyMarketExcel?commodityId=TX&marketCode=1&queryDate=${encoded}`],
    ['report_get_lower', `${BASE}/cht/3/futDailyMarketReport?commodity_id=TX&marketCode=1&queryDate=${encoded}`],
    ['report_get_commodity_id', `${BASE}/cht/3/futDailyMarketReport?commodityId=TX&marketCode=1&queryDate=${encoded}`],
  ];
  const results = [];
  for (const [name, url] of candidates) {
    results.push(await request(name, url, { method: 'GET' }, targetDate));
  }

  const postBodies = [
    ['report_post_lower', {
      queryDate: slash, marketCode: '1', commodity_id: 'TX', commodityId: 'TX', action: 'query',
    }],
    ['report_post_upper_market', {
      queryDate: slash, MarketCode: '1', commodity_id: 'TX', commodityId: 'TX', action: 'query',
    }],
    ['report_post_query_type', {
      queryType: '2', queryDate: slash, marketCode: '1', commodity_id: 'TX', commodityId: 'TX',
    }],
  ];
  for (const [name, values] of postBodies) {
    results.push(await request(name, `${BASE}/cht/3/futDailyMarketReport`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody(values),
    }, targetDate));
  }

  return {
    schema_version: 1,
    target_date: targetDate,
    generated_at: new Date().toISOString(),
    candidates: results,
    successful_target_candidates: results
      .filter((item) => item.ok && item.contains_target_date && item.contains_tx && item.contains_after_hours)
      .map((item) => item.name),
  };
}

async function main(argv = process.argv.slice(2)) {
  const dateIndex = argv.indexOf('--date');
  const outputIndex = argv.indexOf('--output');
  const date = dateIndex >= 0 ? argv[dateIndex + 1] : '';
  const outputArg = outputIndex >= 0 ? argv[outputIndex + 1] : '';
  const result = await probeDateQuery(date);
  if (outputArg) {
    const output = path.resolve(ROOT, outputArg);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({
    target_date: result.target_date,
    successful_target_candidates: result.successful_target_candidates,
    candidates: result.candidates.map((item) => ({
      name: item.name,
      ok: item.ok,
      status: item.status,
      final_url: item.final_url,
      dates: item.dates,
      contains_target_date: item.contains_target_date,
      contains_tx: item.contains_tx,
      contains_after_hours: item.contains_after_hours,
      error: item.error,
    })),
  }, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { stripHtml, summarizeHtml, probeDateQuery, main };
