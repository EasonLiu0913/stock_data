#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const stock = arg('stock', '1598');
const tasksRaw = arg('tasks');
const output = arg('output', path.join(process.cwd(), 'histock-probe.json'));
const delayMinMs = Number(arg('delay-min-ms', '2500'));
const delayMaxMs = Number(arg('delay-max-ms', '5500'));

if (!/^\d{4,6}$/.test(stock)) throw new Error(`Invalid stock: ${stock}`);
if (!tasksRaw) throw new Error('--tasks is required');
if (!Number.isFinite(delayMinMs) || !Number.isFinite(delayMaxMs) || delayMinMs < 1000 || delayMaxMs < delayMinMs) {
  throw new Error('invalid delay range');
}

const dates = tasksRaw.split(',').map((x) => x.trim()).filter(Boolean);
if (!dates.length || dates.length > 5) throw new Error('each fresh-runner probe batch must contain 1..5 dates');
for (const date of dates) if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const decodeHtml = (value) => String(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#39;/gi, "'")
  .replace(/&quot;/gi, '"');
const stripHtml = (value) => decodeHtml(String(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());

function extractRows(html) {
  const rows = [];
  for (const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map((x) => stripHtml(x[1]));
    if (cells.some((x) => x !== '')) rows.push(cells);
  }
  return rows;
}

async function probe(date) {
  const compact = date.replaceAll('-', '');
  const url = `https://histock.tw/stock/branch.aspx?from=${compact}&no=${encodeURIComponent(stock)}&to=${compact}`;
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    });
    const html = await response.text();
    const text = stripHtml(html);
    const rows = extractRows(html);
    const brokerTraceMatches = [...html.matchAll(/brokertrace\.aspx\?[^"'<>\s]+/gi)].map((m) => m[0]);
    const result = {
      stock,
      date,
      url,
      ok: response.ok,
      http_status: response.status,
      final_url: response.url,
      elapsed_ms: Date.now() - started,
      response_bytes: Buffer.byteLength(html),
      date_visible: [compact, date, date.replaceAll('-', '/')].some((token) => html.includes(token) || text.includes(token)),
      broker_keywords_visible: /券商|買進|賣出|買超|賣超/.test(text),
      table_rows: rows.length,
      brokertrace_link_count: brokerTraceMatches.length,
      known_1598_tokens: stock === '1598' ? {
        kgi_xizhi: html.includes('凱基-汐止') || text.includes('凱基-汐止'),
        mega_datong: html.includes('兆豐-大同') || text.includes('兆豐-大同'),
        broker_9226: html.includes('bno=9226'),
        broker_700S: html.includes('bno=700S'),
      } : null,
      html_signals: {
        viewstate: /__VIEWSTATE/.test(html),
        eventtarget: /__EVENTTARGET/.test(html),
        ajax: /ajax|xmlhttprequest|\.asmx|\.ashx|fetch\(|\.ajax\(/i.test(html),
      },
      first_rows: rows.slice(0, 3),
    };
    return result;
  } catch (error) {
    return {
      stock,
      date,
      url,
      ok: false,
      network_error: error?.message || String(error),
      elapsed_ms: Date.now() - started,
    };
  }
}

(async () => {
  const results = [];
  for (let i = 0; i < dates.length; i += 1) {
    const result = await probe(dates[i]);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
    if (i + 1 < dates.length) {
      const wait = delayMinMs + Math.floor(Math.random() * (delayMaxMs - delayMinMs + 1));
      console.log(`probe cooldown ${wait}ms`);
      await sleep(wait);
    }
  }
  const payload = {
    schema_version: 1,
    methodology: 'histock-broker-fresh-runner-probe-v1',
    diagnostic_only: true,
    writes_production_data: false,
    stock,
    runner: {
      run_id: process.env.GITHUB_RUN_ID || null,
      job: process.env.GITHUB_JOB || null,
      runner_name: process.env.RUNNER_NAME || null,
    },
    dates,
    counts: {
      requests: results.length,
      http_200: results.filter((r) => r.http_status === 200).length,
      table_rows_gt_1: results.filter((r) => Number(r.table_rows) > 1).length,
      brokertrace_present: results.filter((r) => Number(r.brokertrace_link_count) > 0).length,
      network_errors: results.filter((r) => r.network_error).length,
    },
    results,
    generated_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ summary: payload.counts, output }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
