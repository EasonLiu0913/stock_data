#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
const numberOrNull = (s) => {
  const t = clean(s).replace(/,/g, '');
  if (!t || t === '-' || t === '--') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

function extractRows(html) {
  return [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => clean(c[1]))
  ).filter((cells) => cells.length >= 5);
}

function parseBrokerBlocks(html) {
  const rows = extractRows(html);
  const blocks = [];
  for (const cells of rows) {
    for (const offset of [0, 5]) {
      if (cells.length < offset + 5) continue;
      const broker = clean(cells[offset]);
      if (!broker || /券商|買進|賣出|買賣超|均價/.test(broker)) continue;
      const raw = {
        buy: clean(cells[offset + 1]),
        sell: clean(cells[offset + 2]),
        net: clean(cells[offset + 3]),
        avg_price: clean(cells[offset + 4]),
      };
      if (!Object.values(raw).some(Boolean)) continue;
      const parsed = {
        broker,
        buy: numberOrNull(raw.buy),
        sell: numberOrNull(raw.sell),
        net: numberOrNull(raw.net),
        avg_price: numberOrNull(raw.avg_price),
      };
      const missing_fields = ['buy', 'sell', 'net', 'avg_price'].filter((key) => parsed[key] === null);
      blocks.push({ ...parsed, missing_fields, raw_source_values: raw });
    }
  }
  return { rows, blocks };
}

function summarize(blocks) {
  const complete = blocks.filter((b) => b.missing_fields.length === 0);
  const incomplete = blocks.filter((b) => b.missing_fields.length > 0);
  const missingFieldPatterns = {};
  for (const b of incomplete) {
    const key = b.missing_fields.join('+') || 'none';
    missingFieldPatterns[key] = (missingFieldPatterns[key] || 0) + 1;
  }
  return {
    broker_blocks: blocks.length,
    complete_records: complete.length,
    incomplete_records: incomplete.length,
    missing_field_patterns: missingFieldPatterns,
    complete_samples: complete.slice(0, 3),
    incomplete_samples: incomplete.slice(0, 6),
  };
}

async function main() {
  const stock = arg('stock');
  const date = arg('date');
  const output = arg('output');
  const delayMs = Number(arg('delay-ms', '1800'));
  const jitterMs = Number(arg('jitter-ms', '1200'));
  if (!/^\d{4}$/.test(stock)) throw new Error('stock must be 4 digits');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  if (!output) throw new Error('--output is required');
  const compact = date.replaceAll('-', '');
  const wait = delayMs + Math.floor(Math.random() * (jitterMs + 1));
  await sleep(wait);
  const url = `https://histock.tw/stock/branch.aspx?from=${compact}&no=${stock}&to=${compact}`;
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 institutional-withdrawal-validation-research/1.0' }, redirect: 'follow' });
  const text = await response.text();
  const parsed = parseBrokerBlocks(text);
  const payload = {
    schema_version: 1,
    research: 'institutional-withdrawal-validation-coverage-v1',
    evidence_scope: 'outcome_blind_histock_legacy_incomplete_row_probe',
    stock,
    date,
    source_url: url,
    fetched_at: new Date().toISOString(),
    request_delay_ms: wait,
    diagnostics: {
      http_status: response.status,
      final_url: response.url,
      response_bytes: Buffer.byteLength(text),
      date_visible: text.includes(compact) || text.includes(date.replaceAll('-', '/')),
      broker_keywords_visible: /券商|買進|賣出|買賣超|均價/.test(text),
      table_rows: parsed.rows.length,
      ...summarize(parsed.blocks),
    },
    guardrails: [
      'No lifecycle outcomes, future returns, drawdowns, or validation metrics were read or generated.',
      'Blank source cells remain blank/null; the probe does not impute zero or change Broker feature semantics.',
    ],
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
}

if (args.includes('--self-test')) {
  const fixture = '<table><tr><th>券商</th><th>買進</th><th>賣出</th><th>買賣超</th><th>均價</th></tr><tr><td>A</td><td></td><td>9</td><td>-9</td><td>66.41</td><td>B</td><td>4</td><td>3</td><td>1</td><td>67.24</td></tr></table>';
  const p = parseBrokerBlocks(fixture);
  const s = summarize(p.blocks);
  if (p.rows.length !== 2 || s.complete_records !== 1 || s.incomplete_records !== 1 || s.missing_field_patterns.buy !== 1) throw new Error('self-test failed');
  console.log('probe_histock_broker_incomplete_rows self-test passed');
} else {
  main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
}
