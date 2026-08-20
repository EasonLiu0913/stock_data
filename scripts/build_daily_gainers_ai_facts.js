#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT } = require('./lib/daily_gainers_ai_contract');

const ROOT = path.resolve(__dirname, '..');
const LIST_ROOT = path.join(ROOT, 'data_daily_gain_over_5');
const FACT_DIR = path.join(LIST_ROOT, 'analysis-facts');
const CONTRACT = DAILY_GAINERS_AI_CONTRACT;

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(n) ? n : null;
}
function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const parseLine = (line) => {
    const out = []; let cur = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur); return out;
  };
  const header = parseLine(lines[0]);
  return lines.slice(1).map(parseLine).map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}
function marginByCode(file) {
  const map = new Map();
  for (const row of parseCsv(fs.readFileSync(file, 'utf8'))) {
    const code = String(row['股票代號'] ?? '').trim(); if (!code) continue;
    const marginPrev = numeric(row['融資前日餘額']), marginNow = numeric(row['融資今日餘額']);
    const shortPrev = numeric(row['融券前日餘額']), shortNow = numeric(row['融券今日餘額']);
    map.set(code, { margin_prev: marginPrev, margin_now: marginNow, margin_delta: marginPrev !== null && marginNow !== null ? marginNow - marginPrev : null, short_prev: shortPrev, short_now: shortNow, short_delta: shortPrev !== null && shortNow !== null ? shortNow - shortPrev : null });
  }
  return map;
}
function brokerFacts(stock) {
  if (!stock || typeof stock !== 'object') return null;
  const buys = Array.isArray(stock.buyBrokers) ? stock.buyBrokers : [], sells = Array.isArray(stock.sellBrokers) ? stock.sellBrokers : [];
  const sumShare = (rows, n) => rows.slice(0, n).reduce((sum, row) => sum + (numeric(row.sharePercent) || 0), 0);
  const topRows = (rows, side) => rows.slice(0, 5).map((row) => ({ broker_name: row.brokerName || null, broker_id: row.brokerId || null, branch_id: row.branchId || null, net: numeric(side === 'buy' ? row.netBuy : row.netSell), share_pct: numeric(row.sharePercent) }));
  return { top3_buy_share_pct: Number(sumShare(buys, 3).toFixed(2)), top5_buy_share_pct: Number(sumShare(buys, 5).toFixed(2)), top3_sell_share_pct: Number(sumShare(sells, 3).toFixed(2)), top5_sell_share_pct: Number(sumShare(sells, 5).toFixed(2)), totals: stock.totals || null, top_buy_brokers: topRows(buys, 'buy'), top_sell_brokers: topRows(sells, 'sell'), source_url: stock.sourceUrl || null };
}
function miMatches(miPayload, code, name) {
  const matches = [];
  for (const table of Array.isArray(miPayload?.tables) ? miPayload.tables : []) {
    for (const row of Array.isArray(table?.data) ? table.data : []) {
      const flat = Array.isArray(row) ? row.map(String) : Object.values(row || {}).map(String);
      if (!flat.some((value) => value.trim() === String(code) || value.includes(String(name)))) continue;
      matches.push({ table_title: table.title || table.name || null, fields: Array.isArray(table.fields) ? table.fields : null, row });
      if (matches.length >= 5) return matches;
    }
  }
  return matches;
}
function marketContext(miPayload) {
  const tables = Array.isArray(miPayload?.tables) ? miPayload.tables : [];
  return { table_count: tables.length, tables: tables.slice(0, 12).map((table) => ({ title: table.title || table.name || null, fields: Array.isArray(table.fields) ? table.fields : null, row_count: Array.isArray(table.data) ? table.data.length : 0, sample_rows: Array.isArray(table.data) ? table.data.slice(0, 5) : [] })) };
}
function priceFacts(stock) {
  const open = numeric(stock.open), high = numeric(stock.high), low = numeric(stock.low), close = numeric(stock.close), previousClose = numeric(stock.previous_close);
  const range = high !== null && low !== null ? high - low : null;
  return { previous_close: previousClose, open, high, low, close, volume: numeric(stock.volume), change_pct: numeric(stock.change_pct), gap_open_pct: previousClose && open !== null ? Number((((open / previousClose) - 1) * 100).toFixed(2)) : null, intraday_return_pct: open && close !== null ? Number((((close / open) - 1) * 100).toFixed(2)) : null, close_location_in_range: range && close !== null && low !== null ? Number(((close - low) / range).toFixed(4)) : null };
}

const INSTITUTIONAL_SOURCES = {
  foreign: { dir: 'data_twse_foreign_investors', suffix: '_twse_foreign_investors.json', codeIndex: 1, netIndex: 11 },
  trust: { dir: 'data_twse_investment_trust', suffix: '_twse_investment_trust.json', codeIndex: 1, netIndex: 5 },
  dealer: { dir: 'data_twse_dealers', suffix: '_twse_dealers.json', codeIndex: 0, netIndex: 10 },
};
function loadInstitutionalSource(date, key) {
  const cfg = INSTITUTIONAL_SOURCES[key];
  const file = path.join(ROOT, cfg.dir, `${date}${cfg.suffix}`);
  const result = { file: path.relative(ROOT, file), status: 'unavailable', rows: new Map(), row_count: 0 };
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return result;
  try {
    const payload = readJson(file);
    if (payload?.stat !== 'OK' || !Array.isArray(payload.data)) return result;
    result.status = 'available'; result.row_count = payload.data.length;
    for (const row of payload.data) {
      if (!Array.isArray(row)) continue;
      const code = String(row[cfg.codeIndex] ?? '').trim(); if (!code) continue;
      result.rows.set(code, { net_shares: numeric(row[cfg.netIndex]), raw_row: row });
    }
    return result;
  } catch { return result; }
}
function institutionalActor(source, code, legacyNet) {
  if (source.status !== 'available') return { net_shares: null, net_lots: null, record_status: 'unavailable', requires_external_verification: true, source_file: source.file, legacy_flow_net_lots: numeric(legacyNet) };
  const row = source.rows.get(code);
  if (!row) return { net_shares: null, net_lots: null, record_status: 'no_record', requires_external_verification: true, source_file: source.file, legacy_flow_net_lots: numeric(legacyNet) };
  const lots = row.net_shares === null ? null : Math.round(row.net_shares / 1000);
  const recordStatus = row.net_shares === 0 ? 'zero_net' : 'reported';
  return { net_shares: row.net_shares, net_lots: lots, record_status: recordStatus, requires_external_verification: CONTRACT.institutional_verification.required_record_statuses.includes(recordStatus), source_file: source.file };
}

function main() {
  const date = process.argv[2];
  if (!/^20\d{6}$/.test(String(date || ''))) throw new Error('Usage: node scripts/build_daily_gainers_ai_facts.js YYYYMMDD');
  const listFile = path.join(LIST_ROOT, `${date}.json`), causeFile = path.join(LIST_ROOT, 'analysis', `${date}.json`), flowFile = path.join(LIST_ROOT, 'analysis-flow', `${date}.json`), marginFile = path.join(ROOT, 'data_twse_margin_balance', `${date}_twse_margin_balance.csv`), brokerFile = path.join(ROOT, 'data_fubon_broker_details', `fubon_${date}_券商分點進出明細.json`), miFile = path.join(ROOT, 'data_twse_mi_index', `${date}_twse_mi_index.json`);
  for (const file of [listFile, causeFile, flowFile, marginFile, brokerFile, miFile]) if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`Required AI fact input missing or empty: ${path.relative(ROOT, file)}`);
  const list = readJson(listFile), cause = readJson(causeFile), flow = readJson(flowFile), brokers = readJson(brokerFile), mi = readJson(miFile), margins = marginByCode(marginFile);
  if (!Array.isArray(list.stocks) || list.target_date !== date) throw new Error('Invalid daily gainer list');
  if (!Array.isArray(flow.analyses) || flow.target_date !== date) throw new Error('Invalid flow analysis');
  if (!brokers.complete || !brokers.stocks || typeof brokers.stocks !== 'object') throw new Error('Broker-detail snapshot is not complete');
  if (!Array.isArray(mi.tables) || mi.tables.length === 0) throw new Error('MI_INDEX has no tables');
  const causeMap = new Map((cause.analyses || []).map((item) => [String(item.code), item])), flowMap = new Map(flow.analyses.map((item) => [String(item.code), item]));
  const institutionalSources = Object.fromEntries(Object.keys(INSTITUTIONAL_SOURCES).map((key) => [key, loadInstitutionalSource(date, key)]));
  const stocks = list.stocks.map((stock) => {
    const code = String(stock.code), f = flowMap.get(code) || {}, c = causeMap.get(code) || {};
    const institutional = { foreign: institutionalActor(institutionalSources.foreign, code, f.foreign_net), trust: institutionalActor(institutionalSources.trust, code, f.trust_net), dealer: institutionalActor(institutionalSources.dealer, code, f.dealer_net) };
    institutional.verification_required = Object.values(institutional).some((value) => value && typeof value === 'object' && value.requires_external_verification === true);
    return { code, name: stock.name, price: priceFacts(stock), catalyst_context: { reason_summary: c.reason_summary || null, evidence: Array.isArray(c.evidence) ? c.evidence : [], confidence: c.confidence || null, sources: Array.isArray(c.sources) ? c.sources : [] }, institutional, margin: margins.get(code) || null, broker: brokerFacts(brokers.stocks[code]), technical_signal: f.technical_signal || null, legacy_rule_interpretation: f.flow_interpretation || null, mi_index_matches: miMatches(mi, code, stock.name) };
  });

  const payload = {
    schema_version: CONTRACT.facts.schema_version,
    methodology_version: CONTRACT.facts.methodology_version,
    contract_version: CONTRACT.contract_version,
    contract_policy: CONTRACT.policy,
    target_date: date,
    generated_at: new Date().toISOString(),
    purpose: 'deterministic_fact_package_for_ai_synthesis',
    ai_must_not_invent_missing_values: true,
    institutional_status_semantics: {
      reported: 'official source contains the stock row and net is non-zero',
      zero_net: 'official source contains the stock row and net equals zero',
      no_record: 'official source is valid but contains no row for this stock',
      unavailable: 'official source file is missing, empty, malformed, or not OK',
    },
    source_files: { list: path.relative(ROOT, listFile), catalyst_analysis: path.relative(ROOT, causeFile), flow_analysis: path.relative(ROOT, flowFile), margin: path.relative(ROOT, marginFile), broker_details: path.relative(ROOT, brokerFile), mi_index: path.relative(ROOT, miFile), foreign: institutionalSources.foreign.file, trust: institutionalSources.trust.file, dealer: institutionalSources.dealer.file },
    institutional_source_status: { foreign: { status: institutionalSources.foreign.status, row_count: institutionalSources.foreign.row_count }, trust: { status: institutionalSources.trust.status, row_count: institutionalSources.trust.row_count }, dealer: { status: institutionalSources.dealer.status, row_count: institutionalSources.dealer.row_count } },
    stock_count: stocks.length,
    market_context: marketContext(mi),
    stocks,
  };

  fs.mkdirSync(FACT_DIR, { recursive: true });
  const out = path.join(FACT_DIR, `${date}.json`);
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ output: path.relative(ROOT, out), stock_count: stocks.length, verification_required: stocks.filter((stock) => stock.institutional.verification_required).length, methodology_version: CONTRACT.facts.methodology_version }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
