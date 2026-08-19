#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LIST_ROOT = path.join(ROOT, 'data_daily_gain_over_5');
const FACT_DIR = path.join(LIST_ROOT, 'analysis-facts');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  const rows = [];
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return rows;
  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = !quoted;
      } else if (c === ',' && !quoted) {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const header = parseLine(lines[0]);
  for (const line of lines.slice(1)) {
    const values = parseLine(line);
    rows.push(Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
  }
  return rows;
}

function marginByCode(file) {
  const map = new Map();
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  for (const row of rows) {
    const code = String(row['股票代號'] ?? '').trim();
    if (!code) continue;
    const marginPrev = numeric(row['融資前日餘額']);
    const marginNow = numeric(row['融資今日餘額']);
    const shortPrev = numeric(row['融券前日餘額']);
    const shortNow = numeric(row['融券今日餘額']);
    map.set(code, {
      margin_prev: marginPrev,
      margin_now: marginNow,
      margin_delta: marginPrev !== null && marginNow !== null ? marginNow - marginPrev : null,
      short_prev: shortPrev,
      short_now: shortNow,
      short_delta: shortPrev !== null && shortNow !== null ? shortNow - shortPrev : null,
    });
  }
  return map;
}

function brokerFacts(stock) {
  if (!stock || typeof stock !== 'object') return null;
  const buys = Array.isArray(stock.buyBrokers) ? stock.buyBrokers : [];
  const sells = Array.isArray(stock.sellBrokers) ? stock.sellBrokers : [];
  const sumShare = (rows, n) => rows.slice(0, n).reduce((sum, row) => sum + (numeric(row.sharePercent) || 0), 0);
  const topRows = (rows, side) => rows.slice(0, 5).map((row) => ({
    broker_name: row.brokerName || null,
    broker_id: row.brokerId || null,
    branch_id: row.branchId || null,
    net: numeric(side === 'buy' ? row.netBuy : row.netSell),
    share_pct: numeric(row.sharePercent),
  }));
  return {
    top3_buy_share_pct: Number(sumShare(buys, 3).toFixed(2)),
    top5_buy_share_pct: Number(sumShare(buys, 5).toFixed(2)),
    top3_sell_share_pct: Number(sumShare(sells, 3).toFixed(2)),
    top5_sell_share_pct: Number(sumShare(sells, 5).toFixed(2)),
    totals: stock.totals || null,
    top_buy_brokers: topRows(buys, 'buy'),
    top_sell_brokers: topRows(sells, 'sell'),
    source_url: stock.sourceUrl || null,
  };
}

function miMatches(miPayload, code, name) {
  const tables = Array.isArray(miPayload?.tables) ? miPayload.tables : [];
  const matches = [];
  for (const table of tables) {
    const rows = Array.isArray(table?.data) ? table.data : [];
    for (const row of rows) {
      const flat = Array.isArray(row) ? row.map(String) : Object.values(row || {}).map(String);
      if (!flat.some((value) => value.trim() === String(code) || value.includes(String(name)))) continue;
      matches.push({
        table_title: table.title || table.name || null,
        fields: Array.isArray(table.fields) ? table.fields : null,
        row,
      });
      if (matches.length >= 5) return matches;
    }
  }
  return matches;
}

function marketContext(miPayload) {
  const tables = Array.isArray(miPayload?.tables) ? miPayload.tables : [];
  return {
    table_count: tables.length,
    tables: tables.slice(0, 12).map((table) => ({
      title: table.title || table.name || null,
      fields: Array.isArray(table.fields) ? table.fields : null,
      row_count: Array.isArray(table.data) ? table.data.length : 0,
      sample_rows: Array.isArray(table.data) ? table.data.slice(0, 5) : [],
    })),
  };
}

function priceFacts(stock) {
  const open = numeric(stock.open);
  const high = numeric(stock.high);
  const low = numeric(stock.low);
  const close = numeric(stock.close);
  const previousClose = numeric(stock.previous_close);
  const range = high !== null && low !== null ? high - low : null;
  return {
    previous_close: previousClose,
    open,
    high,
    low,
    close,
    volume: numeric(stock.volume),
    change_pct: numeric(stock.change_pct),
    gap_open_pct: previousClose && open !== null ? Number((((open / previousClose) - 1) * 100).toFixed(2)) : null,
    intraday_return_pct: open && close !== null ? Number((((close / open) - 1) * 100).toFixed(2)) : null,
    close_location_in_range: range && close !== null && low !== null ? Number(((close - low) / range).toFixed(4)) : null,
  };
}

function main() {
  const date = process.argv[2];
  if (!/^20\d{6}$/.test(String(date || ''))) {
    throw new Error('Usage: node scripts/build_daily_gainers_ai_facts.js YYYYMMDD');
  }

  const listFile = path.join(LIST_ROOT, `${date}.json`);
  const causeFile = path.join(LIST_ROOT, 'analysis', `${date}.json`);
  const flowFile = path.join(LIST_ROOT, 'analysis-flow', `${date}.json`);
  const marginFile = path.join(ROOT, 'data_twse_margin_balance', `${date}_twse_margin_balance.csv`);
  const brokerFile = path.join(ROOT, 'data_fubon_broker_details', `fubon_${date}_券商分點進出明細.json`);
  const miFile = path.join(ROOT, 'data_twse_mi_index', `${date}_twse_mi_index.json`);

  for (const file of [listFile, causeFile, flowFile, marginFile, brokerFile, miFile]) {
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`Required AI fact input missing or empty: ${path.relative(ROOT, file)}`);
  }

  const list = readJson(listFile);
  const cause = readJson(causeFile);
  const flow = readJson(flowFile);
  const brokers = readJson(brokerFile);
  const mi = readJson(miFile);
  const margins = marginByCode(marginFile);

  if (!Array.isArray(list.stocks) || list.target_date !== date) throw new Error('Invalid daily gainer list');
  if (!Array.isArray(flow.analyses) || flow.target_date !== date) throw new Error('Invalid flow analysis');
  if (!brokers.complete || !brokers.stocks || typeof brokers.stocks !== 'object') throw new Error('Broker-detail snapshot is not complete');
  if (!Array.isArray(mi.tables) || mi.tables.length === 0) throw new Error('MI_INDEX has no tables');

  const causeMap = new Map((cause.analyses || []).map((item) => [String(item.code), item]));
  const flowMap = new Map(flow.analyses.map((item) => [String(item.code), item]));

  const stocks = list.stocks.map((stock) => {
    const code = String(stock.code);
    const f = flowMap.get(code) || {};
    const c = causeMap.get(code) || {};
    return {
      code,
      name: stock.name,
      price: priceFacts(stock),
      catalyst_context: {
        reason_summary: c.reason_summary || null,
        evidence: Array.isArray(c.evidence) ? c.evidence : [],
        confidence: c.confidence || null,
        sources: Array.isArray(c.sources) ? c.sources : [],
      },
      institutional: {
        foreign_net: numeric(f.foreign_net),
        trust_net: numeric(f.trust_net),
        dealer_net: numeric(f.dealer_net),
      },
      margin: margins.get(code) || null,
      broker: brokerFacts(brokers.stocks[code]),
      technical_signal: f.technical_signal || null,
      legacy_rule_interpretation: f.flow_interpretation || null,
      mi_index_matches: miMatches(mi, code, stock.name),
    };
  });

  const payload = {
    schema_version: 1,
    methodology_version: 'daily-gainers-ai-facts-v1',
    target_date: date,
    generated_at: new Date().toISOString(),
    purpose: 'deterministic_fact_package_for_ai_synthesis',
    ai_must_not_invent_missing_values: true,
    source_files: {
      list: path.relative(ROOT, listFile),
      catalyst_analysis: path.relative(ROOT, causeFile),
      flow_analysis: path.relative(ROOT, flowFile),
      margin: path.relative(ROOT, marginFile),
      broker_details: path.relative(ROOT, brokerFile),
      mi_index: path.relative(ROOT, miFile),
    },
    stock_count: stocks.length,
    market_context: marketContext(mi),
    stocks,
  };

  fs.mkdirSync(FACT_DIR, { recursive: true });
  const out = path.join(FACT_DIR, `${date}.json`);
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ output: path.relative(ROOT, out), stock_count: stocks.length }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
