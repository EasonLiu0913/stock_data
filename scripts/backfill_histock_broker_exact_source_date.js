#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateDailyPayload, QUALITY_VERSION } = require('./lib/histock_broker_quality');
const { POLICY_VERSION, classifyNoRecordResponse } = require('./lib/histock_broker_status_policy');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function runKnownPositiveRegression() {
  const fixture = path.join(__dirname, 'fixtures', 'histock', '1598-20260507-known-positive.html');
  const html = fs.readFileSync(fixture, 'utf8');
  const parsed = parseBrokerRows(html);
  const kh = parsed.records.find((r) => r.broker === '凱基-汐止');
  const mega = parsed.records.find((r) => r.broker === '兆豐-大同');
  if (!kh || kh.net !== -74 || kh.avg_price !== 20.49) throw new Error(`1598 regression failed for 凱基-汐止: ${JSON.stringify(kh)}`);
  if (!mega || mega.net !== 206 || mega.avg_price !== 20.76) throw new Error(`1598 regression failed for 兆豐-大同: ${JSON.stringify(mega)}`);
  const degraded = classifyNoRecordResponse({
    text: '2026/05/07 券商買進賣出明細',
    diagnostics: { http_status: 200, response_bytes: 69876, date_visible: true, broker_keywords_visible: true, table_rows: 1 },
  });
  if (degraded.outcome !== 'suspected_degraded_response' || degraded.terminal_for_date !== false) {
    throw new Error(`1598 degraded-page regression failed: ${JSON.stringify(degraded)}`);
  }
  return { fixture, parsed_records: parsed.records.length, anchors: [kh, mega], degraded_classification: degraded.outcome };
}

function isNetworkError(error) {
  return error?.name === 'TypeError' || Boolean(error?.cause?.code) || /fetch failed|socket|network|timeout/i.test(String(error?.message || ''));
}

async function main() {
  const regression = runKnownPositiveRegression();
  if (args.includes('--self-test')) {
    console.log(JSON.stringify({ ok: true, policy_version: POLICY_VERSION, regression }, null, 2));
    return;
  }

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

  const compact = date.replaceAll('-', '');
  const statusDir = path.join(outRoot, 'batch-status');
  const statusFile = path.join(statusDir, `exact-source-date-${compact}.json`);

  function writeStatus(outcome, details = {}) {
    fs.mkdirSync(statusDir, { recursive: true });
    const payload = {
      schema_version: 2,
      research: 'institutional-withdrawal-validation-coverage-v1',
      stock,
      date,
      outcome,
      terminal_for_date: outcome === 'success' || outcome === 'source_empty' || outcome === 'permanent_error',
      status_policy_version: POLICY_VERSION,
      run_id: process.env.GITHUB_RUN_ID || null,
      updated_at: new Date().toISOString(),
      ...details,
    };
    fs.writeFileSync(statusFile, `${JSON.stringify(payload, null, 2)}\n`);
    return statusFile;
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
      error.classification = 'http_error';
      error.diagnostics = diagnostics;
      throw error;
    }
    if (!diagnostics.date_visible) {
      const error = new Error('requested date not visible');
      error.retryable = true;
      error.classification = 'transient_error';
      error.diagnostics = diagnostics;
      throw error;
    }
    const parsed = parseBrokerRows(html);
    if (!parsed.records.length) {
      const classification = classifyNoRecordResponse({ text, diagnostics });
      const error = new Error(classification.outcome === 'source_empty' ? 'explicit_source_empty_signal' : 'no_broker_records_without_trustworthy_empty_signal');
      error.retryable = classification.retryable;
      error.classification = classification.outcome;
      error.sourceEmptyEvidence = classification.source_empty_evidence;
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
      error.retryable = false;
      error.classification = 'permanent_error';
      error.diagnostics = { ...diagnostics, record_quality: check.record_quality };
      throw error;
    }
    return { payload, diagnostics };
  }

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const { payload, diagnostics } = await fetchOnce();
      const dailyDir = path.join(outRoot, 'daily');
      fs.mkdirSync(dailyDir, { recursive: true });
      const file = path.join(dailyDir, `${compact}.json`);
      fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
      const savedStatus = writeStatus('success', { attempts: attempt + 1, file, quality_version: QUALITY_VERSION, diagnostics });
      console.log(JSON.stringify({ stock, date, file, status_file: savedStatus, outcome: 'success', quality_version: QUALITY_VERSION, diagnostics }, null, 2));
      return;
    } catch (error) {
      lastError = error;
      const retryableStatus = error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
      const canRetry = attempt < maxRetries && (error.retryable === true || retryableStatus || isNetworkError(error));
      if (!canRetry) break;
      const wait = Math.min(30000, Math.max(4000, delayMs * (2 ** attempt))) + Math.floor(Math.random() * (jitterMs + 1));
      console.log(`retry ${attempt + 1}/${maxRetries} after ${wait}ms: ${error.message}`);
      await sleep(wait);
    }
  }

  const retryableStatus = lastError?.status === 408 || lastError?.status === 425 || lastError?.status === 429 || lastError?.status >= 500;
  const outcome = lastError?.classification === 'source_empty'
    ? 'source_empty'
    : lastError?.classification === 'suspected_degraded_response'
      ? 'suspected_degraded_response'
      : lastError?.classification === 'permanent_error'
        ? 'permanent_error'
        : (lastError?.retryable === true || retryableStatus || isNetworkError(lastError))
          ? 'transient_error'
          : 'permanent_error';
  const savedStatus = writeStatus(outcome, {
    error: lastError?.message || 'unknown',
    http_status: lastError?.status || null,
    diagnostics: lastError?.diagnostics || null,
    source_empty_evidence: lastError?.sourceEmptyEvidence || null,
  });
  console.error(JSON.stringify({ stock, date, outcome, status_file: savedStatus, error: lastError?.message || 'unknown', diagnostics: lastError?.diagnostics || null }, null, 2));
  process.exit(outcome === 'source_empty' ? 3 : (outcome === 'transient_error' || outcome === 'suspected_degraded_response') ? 2 : 4);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
