#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT: CONTRACT } = require('./lib/daily_gainers_ai_contract');

const ROOT = path.resolve(__dirname, '..');
const LIST_ROOT = path.join(ROOT, 'data_daily_gain_over_5');
const FACT_DIR = path.join(LIST_ROOT, 'analysis-facts');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(n) ? n : null;
}
function rel(file) { return path.relative(ROOT, file).replaceAll('\\', '/'); }
function availableFile(file) { return fs.existsSync(file) && fs.statSync(file).size > 0; }
function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const parseLine = (line) => {
    const out = []; let cur = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = !quoted;
      } else if (c === ',' && !quoted) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out;
  };
  const header = parseLine(lines[0]);
  return lines.slice(1).map(parseLine).map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}
function marginByCode(file) {
  const map = new Map();
  if (!availableFile(file)) return map;
  for (const row of parseCsv(fs.readFileSync(file, 'utf8'))) {
    const code = String(row['股票代號'] ?? '').trim(); if (!code) continue;
    const marginPrev = numeric(row['融資前日餘額']), marginNow = numeric(row['融資今日餘額']);
    const shortPrev = numeric(row['融券前日餘額']), shortNow = numeric(row['融券今日餘額']);
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
function findFieldIndex(fields, candidates, fallback = -1) {
  const normalized = (fields || []).map((v) => String(v ?? '').replace(/\s+/g, '').trim());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.replace(/\s+/g, ''));
    if (idx >= 0) return idx;
  }
  return fallback;
}
const INSTITUTIONAL_SOURCES = {
  foreign: { dir: 'data_twse_foreign_investors', suffix: '_twse_foreign_investors.json', fallbackCode: 1, fallbackNet: 11, netNames: ['買賣超股數', '買賣超股數(不含外資自營商)', '外陸資買賣超股數'] },
  trust: { dir: 'data_twse_investment_trust', suffix: '_twse_investment_trust.json', fallbackCode: 1, fallbackNet: 5, netNames: ['買賣超股數', '投信買賣超股數'] },
  dealer: { dir: 'data_twse_dealers', suffix: '_twse_dealers.json', fallbackCode: 0, fallbackNet: 10, netNames: ['買賣超股數', '自營商買賣超股數'] },
};
function loadInstitutionalSource(date, key) {
  const cfg = INSTITUTIONAL_SOURCES[key];
  const file = path.join(ROOT, cfg.dir, `${date}${cfg.suffix}`);
  const result = { file: rel(file), status: 'unavailable', rows: new Map(), row_count: 0 };
  if (!availableFile(file)) return result;
  const payload = readJson(file, null);
  if (!payload || !Array.isArray(payload.data)) return result;
  if (payload.stat && payload.stat !== 'OK') return result;
  const fields = Array.isArray(payload.fields) ? payload.fields : [];
  const codeIndex = findFieldIndex(fields, ['證券代號', '股票代號', '證券代碼', '股票代碼'], cfg.fallbackCode);
  const netIndex = findFieldIndex(fields, cfg.netNames, cfg.fallbackNet);
  result.status = 'available'; result.row_count = payload.data.length;
  for (const row of payload.data) {
    if (!Array.isArray(row)) continue;
    const code = String(row[codeIndex] ?? '').trim(); if (!code) continue;
    result.rows.set(code, { net_shares: numeric(row[netIndex]) });
  }
  return result;
}
function institutionalActor(source, code) {
  if (source.status !== 'available') return { net_shares: null, net_lots: null, record_status: 'unavailable', source_file: source.file };
  const row = source.rows.get(code);
  if (!row) return { net_shares: null, net_lots: null, record_status: 'no_record', source_file: source.file };
  const lots = row.net_shares === null ? null : Math.round(row.net_shares / 1000);
  return { net_shares: row.net_shares, net_lots: lots, record_status: row.net_shares === 0 ? 'zero_net' : 'reported', source_file: source.file };
}
function brokerFacts(stock) {
  if (!stock || typeof stock !== 'object') return { status: 'unavailable' };
  const buys = Array.isArray(stock.buyBrokers) ? stock.buyBrokers : [], sells = Array.isArray(stock.sellBrokers) ? stock.sellBrokers : [];
  const sumShare = (rows, n) => rows.slice(0, n).reduce((sum, row) => sum + (numeric(row.sharePercent) || 0), 0);
  const topRows = (rows, side) => rows.slice(0, 5).map((row) => ({
    broker_name: row.brokerName || null,
    broker_id: row.brokerId || null,
    branch_id: row.branchId || null,
    net: numeric(side === 'buy' ? row.netBuy : row.netSell),
    share_pct: numeric(row.sharePercent),
  }));
  return {
    status: 'available',
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
function priceFacts(stock) {
  const open = numeric(stock.open), high = numeric(stock.high), low = numeric(stock.low), close = numeric(stock.close), previousClose = numeric(stock.previous_close);
  const range = high !== null && low !== null ? high - low : null;
  return {
    previous_close: previousClose, open, high, low, close, volume: numeric(stock.volume), change_pct: numeric(stock.change_pct),
    gap_open_pct: previousClose && open !== null ? Number((((open / previousClose) - 1) * 100).toFixed(2)) : null,
    intraday_return_pct: open && close !== null ? Number((((close / open) - 1) * 100).toFixed(2)) : null,
    close_location_in_range: range && close !== null && low !== null ? Number(((close - low) / range).toFixed(4)) : null,
  };
}
function dateKey(date) { return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`; }
function smaRow(payload, code, date) { return payload?.[code]?.[dateKey(date)] || null; }
function technicalFacts(stock, currentSma, previousSma, date, previousDate) {
  const current = smaRow(currentSma, String(stock.code), date) || {};
  const previous = smaRow(previousSma, String(stock.code), previousDate) || {};
  const close = numeric(stock.close);
  const sma5 = numeric(current.sma5), sma20 = numeric(current.sma20), sma60 = numeric(current.sma60);
  const prevVolume = numeric(previous.volume), currentVolume = numeric(stock.volume);
  return {
    sma5, sma20, sma60,
    above_sma5: close !== null && sma5 !== null ? close >= sma5 : null,
    above_sma20: close !== null && sma20 !== null ? close >= sma20 : null,
    above_sma60: close !== null && sma60 !== null ? close >= sma60 : null,
    previous_volume: prevVolume,
    volume_ratio_vs_previous: prevVolume !== null && prevVolume > 0 && currentVolume !== null ? Number((currentVolume / prevVolume).toFixed(2)) : null,
    low_liquidity: currentVolume !== null ? currentVolume < 500 : null,
  };
}
function marketContext(list, miPayload) {
  const count = Array.isArray(list.stocks) ? list.stocks.length : 0;
  const regime = count >= 80 ? 'broad_risk_on' : count >= 40 ? 'broad_strength' : count >= 20 ? 'selective_risk_on' : 'narrow_strength';
  const tables = Array.isArray(miPayload?.tables) ? miPayload.tables : [];
  return {
    gainer_count: count,
    breadth_regime: regime,
    mi_index_status: tables.length ? 'available' : 'unavailable',
    mi_index_table_count: tables.length,
  };
}
function main() {
  const date = process.argv[2];
  if (!/^20\d{6}$/.test(String(date || ''))) throw new Error('Usage: node scripts/build_daily_gainers_ai_facts.js YYYYMMDD');
  const listFile = path.join(LIST_ROOT, `${date}.json`);
  if (!availableFile(listFile)) throw new Error(`Required daily gainer list missing or empty: ${rel(listFile)}`);
  const list = readJson(listFile);
  if (!Array.isArray(list.stocks) || list.target_date !== date) throw new Error('Invalid daily gainer list');
  const previousDate = String(list.previous_date || '');
  if (!/^20\d{6}$/.test(previousDate)) throw new Error(`Invalid previous_date in ${rel(listFile)}`);

  const currentSmaFile = path.join(ROOT, 'data_fubon', `fubon_${date}_sma.json`);
  const previousSmaFile = path.join(ROOT, 'data_fubon', `fubon_${previousDate}_sma.json`);
  if (!availableFile(currentSmaFile) || !availableFile(previousSmaFile)) throw new Error(`SMA input missing for ${previousDate}/${date}`);
  const currentSma = readJson(currentSmaFile, {}), previousSma = readJson(previousSmaFile, {});

  const marginFile = path.join(ROOT, 'data_twse_margin_balance', `${date}_twse_margin_balance.csv`);
  const brokerFile = path.join(ROOT, 'data_fubon_broker_details', `fubon_${date}_券商分點進出明細.json`);
  const miFile = path.join(ROOT, 'data_twse_mi_index', `${date}_twse_mi_index.json`);
  const brokers = availableFile(brokerFile) ? readJson(brokerFile, {}) : {};
  const mi = availableFile(miFile) ? readJson(miFile, {}) : {};
  const margins = marginByCode(marginFile);
  const institutionalSources = Object.fromEntries(Object.keys(INSTITUTIONAL_SOURCES).map((key) => [key, loadInstitutionalSource(date, key)]));

  const stocks = list.stocks.map((stock) => {
    const code = String(stock.code);
    const foreign = institutionalActor(institutionalSources.foreign, code);
    const trust = institutionalActor(institutionalSources.trust, code);
    const dealer = institutionalActor(institutionalSources.dealer, code);
    const verificationRequired = [foreign, trust, dealer].some((actor) => CONTRACT.institutional_verification.required_record_statuses.includes(actor.record_status));
    return {
      code,
      name: stock.name,
      price: priceFacts(stock),
      flow: {
        foreign,
        investment_trust: trust,
        dealer,
        margin: margins.get(code) || { margin_prev: null, margin_now: null, margin_delta: null, short_prev: null, short_now: null, short_delta: null },
        broker: brokerFacts(brokers?.stocks?.[code]),
        institutional_verification_required: verificationRequired,
      },
      technical: technicalFacts(stock, currentSma, previousSma, date, previousDate),
    };
  });

  const payload = {
    schema_version: CONTRACT.facts.schema_version,
    methodology_version: CONTRACT.facts.methodology_version,
    contract_version: CONTRACT.contract_version,
    contract_policy: CONTRACT.policy,
    target_date: date,
    previous_date: previousDate,
    generated_at: new Date().toISOString(),
    purpose: 'deterministic_fact_package_for_daily_gainers_analysis',
    source_list_file: rel(listFile),
    source_files: {
      current_sma: rel(currentSmaFile), previous_sma: rel(previousSmaFile), margin: rel(marginFile), broker_details: rel(brokerFile), mi_index: rel(miFile),
      foreign: institutionalSources.foreign.file, investment_trust: institutionalSources.trust.file, dealer: institutionalSources.dealer.file,
    },
    source_status: {
      margin: availableFile(marginFile) ? 'available' : 'unavailable',
      broker_details: availableFile(brokerFile) && brokers?.complete ? 'available' : 'unavailable',
      mi_index: Array.isArray(mi?.tables) && mi.tables.length ? 'available' : 'unavailable',
      foreign: institutionalSources.foreign.status,
      investment_trust: institutionalSources.trust.status,
      dealer: institutionalSources.dealer.status,
    },
    stock_count: stocks.length,
    market_context: marketContext(list, mi),
    stocks,
  };

  fs.mkdirSync(FACT_DIR, { recursive: true });
  const out = path.join(FACT_DIR, `${date}.json`);
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ output: rel(out), stock_count: stocks.length, methodology_version: CONTRACT.facts.methodology_version, source_status: payload.source_status }, null, 2));
}

try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
