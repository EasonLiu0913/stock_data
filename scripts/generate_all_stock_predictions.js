#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { normalizeIsoDate } = require('./resolve_forecast_dates');

const ROOT = path.resolve(__dirname, '..');
const STOCK_LIST = path.join(ROOT, 'data_twse', 'twse_industry_Stock.json');
const PRICE_DIR = path.join(ROOT, 'data_fubon');
const INST_DIR = path.join(ROOT, 'data_twse_institutional_investors');
const NORMALIZED_INST_DIR = path.join(ROOT, 'data_normalized', 'institutional_investors');
const NORMALIZED_BROKER_DIR = path.join(ROOT, 'data_normalized', 'broker_details');
const MARGIN_DIR = path.join(ROOT, 'data_twse_margin_balance');
const BROKER_DIR = path.join(ROOT, 'data_fubon_broker_details');
const MI_INDEX_DIR = path.join(ROOT, 'data_twse_mi_index');
const MARKET_RISK_DIR = path.join(ROOT, 'data_market_risk');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const HOLIDAY_FILE = path.join(ROOT, 'data_history_sma', 'non_trading_days.json');
const JSON_DIR = path.join(ROOT, 'data_predictions');
const INDEX_FILE = path.join(ROOT, 'public', 'index.html');
const METHOD_VERSION = '1.1.0';
const brokerFileCache = new Map();

function readJson(file, fallback = null) {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text ? JSON.parse(text) : fallback;
  } catch { return fallback; }
}
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replaceAll(',', '').replaceAll('"', '').trim());
  return Number.isFinite(n) ? n : null;
}
function round(v, d = 2) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }
function pct(a, b) { return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a / b - 1) * 100 : null; }
function listFiles(dir, re) {
  try { return fs.readdirSync(dir).filter((f) => re.test(f)).sort(); } catch { return []; }
}
function dateFromName(name) {
  const m = name.match(/(20\d{6})/); return m ? m[1] : null;
}
function isoDate(compact) { return `${compact.slice(0,4)}-${compact.slice(4,6)}-${compact.slice(6,8)}`; }
function compactDate(iso) { return iso.replaceAll('-', ''); }
function envIsoDate(name) {
  const value = process.env[name];
  if (!value) return null;
  const iso = normalizeIsoDate(value);
  if (!iso) throw new Error(`Invalid ${name}: ${value}`);
  return iso;
}
function loadHolidaySet(file) {
  const data = readJson(file, []);
  if (Array.isArray(data)) return new Set(data);
  if (data && typeof data === 'object') return new Set(Object.values(data).flatMap((value) => Array.isArray(value) ? value : []));
  return new Set();
}
function nextTradeDate(baseIso, holidays) {
  const d = new Date(`${baseIso}T12:00:00+08:00`);
  do {
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0,10);
    if (d.getDay() !== 0 && d.getDay() !== 6 && !holidays.has(iso) && !holidays.has(iso.replaceAll('-', '/'))) return iso;
  } while (true);
}
function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i+1] === '"' && quoted) { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(cell); if (row.some((v) => v !== '')) rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function loadMargin(file) {
  try {
    const rows = csvRows(fs.readFileSync(file, 'utf8'));
    const head = rows.shift() || [];
    const codeI = head.findIndex((x) => x.includes('股票代號'));
    const prevI = head.findIndex((x) => x.includes('融資前日餘額'));
    const nowI = head.findIndex((x) => x.includes('融資今日餘額'));
    const map = new Map();
    for (const r of rows) {
      const code = String(r[codeI] || '').trim();
      if (code) map.set(code, { previous: num(r[prevI]), current: num(r[nowI]) });
    }
    return map;
  } catch { return new Map(); }
}
function recursivelyFindStock(root, code) {
  const hits = [];
  function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    const vals = Object.values(v).map(String);
    if (String(v.stock_code ?? v.stockCode ?? v.code ?? v.Code ?? v.證券代號 ?? '').trim() === code || vals.includes(code)) hits.push(v);
    for (const x of Object.values(v)) walk(x);
  }
  walk(root); return hits;
}
function pickNumber(obj, keys) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = String(k).toLowerCase();
    if (keys.some((x) => key.includes(x.toLowerCase()))) {
      const n = num(v); if (n !== null) return n;
    }
  }
  return null;
}
function fieldIndex(fields, names) {
  return fields.findIndex((field) => names.some((name) => String(field || '').includes(name)));
}
function parseInstitutionalTable(data, code) {
  if (!Array.isArray(data?.fields) || !Array.isArray(data?.data)) return null;
  const fields = data.fields;
  const codeI = fieldIndex(fields, ['證券代號']);
  const foreignCashI = fieldIndex(fields, ['外陸資買賣超股數(不含外資自營商)']);
  const foreignDealerI = fieldIndex(fields, ['外資自營商買賣超股數']);
  const trustI = fieldIndex(fields, ['投信買賣超股數']);
  const dealerI = fieldIndex(fields, ['自營商買賣超股數']);
  const totalI = fieldIndex(fields, ['三大法人買賣超股數']);
  if (codeI < 0) return null;
  const row = data.data.find((item) => String(item?.[codeI] || '').trim() === code);
  if (!row) return null;
  const foreignCash = foreignCashI >= 0 ? num(row[foreignCashI]) : null;
  const foreignDealer = foreignDealerI >= 0 ? num(row[foreignDealerI]) : null;
  const foreign = [foreignCash, foreignDealer].some(Number.isFinite)
    ? (foreignCash || 0) + (foreignDealer || 0)
    : null;
  const trust = trustI >= 0 ? num(row[trustI]) : null;
  const dealer = dealerI >= 0 ? num(row[dealerI]) : null;
  const total = totalI >= 0 ? num(row[totalI]) : ([foreign, trust, dealer].every(Number.isFinite) ? foreign + trust + dealer : null);
  return { foreign, trust, dealer, total };
}
function loadInstitutional(file, code) {
  const data = readJson(file, null); if (!data) return null;
  if (data.stocks && typeof data.stocks === 'object') {
    const stock = data.stocks[code];
    if (!stock) return null;
    return {
      foreign: num(stock.foreign),
      trust: num(stock.trust),
      dealer: num(stock.dealer),
      total: num(stock.total)
    };
  }
  const tableHit = parseInstitutionalTable(data, code);
  if (tableHit) return tableHit;
  const hit = recursivelyFindStock(data, code)[0]; if (!hit) return null;
  const foreign = pickNumber(hit, ['foreign', '外資買賣超', '外陸資買賣超']);
  const trust = pickNumber(hit, ['trust', '投信買賣超']);
  const dealer = pickNumber(hit, ['dealer', '自營商買賣超']);
  const total = pickNumber(hit, ['total', '三大法人買賣超合計']) ?? ([foreign, trust, dealer].every(Number.isFinite) ? foreign + trust + dealer : null);
  return { foreign, trust, dealer, total };
}
function brokerNetLots(data, code) {
  const stock = data?.stocks?.[code] || data?.[code] || recursivelyFindStock(data, code)[0];
  if (!stock || typeof stock !== 'object') return null;

  if (stock.totals && typeof stock.totals === 'object') {
    const netLots = num(stock.totals.net ?? stock.totals.netBuySell ?? stock.totals.買賣超);
    if (netLots !== null) return netLots;
  }

  const net = pickNumber(stock, ['net', '買賣超', '合計買賣超', '主力買賣超']);
  if (net === null) return null;
  if (stock.normalized_unit === '股') return net / 1000;
  return net;
}
function loadBroker(code, baseCompact) {
  const normalizedPath = path.join(NORMALIZED_BROKER_DIR, `${baseCompact}.json`);
  const normalized = readJson(normalizedPath, null);
  const normalizedStock = normalized?.stocks?.[code];
  if (normalizedStock) {
    const netShares = num(normalizedStock.net);
    if (netShares !== null) return { net: netShares / 1000, file: path.relative(ROOT, normalizedPath) };
  }

  const batchFile = `fubon_${baseCompact}_券商分點進出明細.json`;
  const candidates = [
    batchFile,
    ...listFiles(BROKER_DIR, new RegExp(`${baseCompact}.*${code}|${code}.*${baseCompact}`))
  ].filter((file, index, files) => files.indexOf(file) === index);
  for (const f of candidates.reverse()) {
    const filePath = path.join(BROKER_DIR, f);
    if (!brokerFileCache.has(filePath)) brokerFileCache.set(filePath, readJson(filePath, null));
    const data = brokerFileCache.get(filePath); if (!data) continue;
    const net = brokerNetLots(data, code);
    if (net !== null) return { net, file: f };
  }
  return null;
}
function loadInstitutionalSeries(instFiles, baseCompact, code) {
  const normalizedPath = path.join(NORMALIZED_INST_DIR, `${baseCompact}.json`);
  const normalized = loadInstitutional(normalizedPath, code);
  if (normalized) return [normalized];
  return instFiles.map((f)=>loadInstitutional(path.join(INST_DIR,f),code));
}
function extractMarketChartSnapshot(baseIso) {
  const data = readJson(MARKET_FILE, null); if (!data) return null;
  const dateKeys = [baseIso, baseIso.replaceAll('-', '/'), compactDate(baseIso)];
  const rows = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : Object.values(data).flatMap((v) => Array.isArray(v) ? v : [v]);
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const date = String(r.date ?? r.Date ?? r.日期 ?? '');
    if (!dateKeys.includes(date)) continue;
    const p = pickNumber(r, ['changepercent', '漲跌百分比', 'return']);
    const close = pickNumber(r, ['close', '收盤']); const prev = pickNumber(r, ['previous', '前日收盤']);
    return {
      date: baseIso,
      close,
      previous_close: prev,
      change_percent: p ?? pct(close, prev),
      source_file: path.relative(ROOT, MARKET_FILE),
      source_type: 'twse_market_chart'
    };
  }
  return null;
}
function extractMiIndexSnapshot(baseIso) {
  const file = path.join(MI_INDEX_DIR, `${compactDate(baseIso)}_twse_mi_index.json`);
  const data = readJson(file, null); if (!data) return null;
  for (const table of data.tables || []) {
    const fields = table.fields || [];
    const nameI = fields.findIndex((field) => field === '指數' || field === '報酬指數');
    const closeI = fields.findIndex((field) => field.includes('收盤指數'));
    const changeI = fields.findIndex((field) => field.includes('漲跌點數'));
    const percentI = fields.findIndex((field) => field.includes('漲跌百分比'));
    if ([nameI, closeI, changeI, percentI].some((index) => index < 0)) continue;
    const row = (table.data || []).find((item) => String(item[nameI] || '').trim() === '發行量加權股價指數');
    if (!row) continue;
    const close = num(row[closeI]);
    const change = num(row[changeI]);
    const changePercent = num(row[percentI]);
    if (!Number.isFinite(close) || !Number.isFinite(changePercent)) continue;
    return {
      date: baseIso,
      index_name: '發行量加權股價指數',
      close,
      change,
      change_percent: changePercent,
      source_file: path.relative(ROOT, file),
      source_type: 'twse_mi_index'
    };
  }
  return null;
}
function loadMarketSnapshot(baseIso) {
  return extractMiIndexSnapshot(baseIso) || extractMarketChartSnapshot(baseIso);
}
function latestMarketRisk(baseCompact) {
  const file = path.join(MARKET_RISK_DIR, baseCompact, 'market_risk_snapshot.json');
  const exact = readJson(file, null);
  if (exact) return { ...exact, source_file: path.relative(ROOT, file) };
  try {
    const dirs = fs.readdirSync(MARKET_RISK_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^20\d{6}$/.test(entry.name) && entry.name <= baseCompact)
      .map((entry) => entry.name)
      .sort();
    const latest = dirs.at(-1);
    if (!latest) return null;
    const latestFile = path.join(MARKET_RISK_DIR, latest, 'market_risk_snapshot.json');
    const data = readJson(latestFile, null);
    return data ? { ...data, source_file: path.relative(ROOT, latestFile) } : null;
  } catch {
    return null;
  }
}
function labelDirection(score) {
  if (score >= 5) return '偏多'; if (score >= 2) return '中性偏多'; if (score >= -1) return '中性'; if (score >= -4) return '中性偏空'; return '偏空';
}
function riskLabel(score) { return score >= 4 ? '高風險' : score >= 2 ? '中風險' : '低風險'; }
function mean(arr) { const a = arr.filter(Number.isFinite); return a.length ? a.reduce((s,v)=>s+v,0)/a.length : null; }
function calcRsi(closes) {
  if (closes.length < 15) return null; const rs = [];
  for (let i=closes.length-14;i<closes.length;i++) rs.push(pct(closes[i], closes[i-1]));
  const gain = rs.reduce((s,v)=>s+Math.max(v,0),0)/14; const loss = rs.reduce((s,v)=>s+Math.max(-v,0),0)/14;
  return loss === 0 ? 100 : 100 - 100/(1+gain/loss);
}
function calcAtr(rows) {
  if (rows.length < 15) return null; const tr=[];
  for (let i=rows.length-14;i<rows.length;i++) {
    const r=rows[i], pc=rows[i-1].close;
    tr.push(Math.max(r.high-r.low, Math.abs(r.high-pc), Math.abs(r.low-pc)));
  }
  return mean(tr);
}
function updateIndex(predictions) {
  let html = fs.readFileSync(INDEX_FILE, 'utf8');
  const block = `const predictions = [\n${predictions.map((p)=>`            { file: '${p.file}', title: '${p.title.replaceAll("'","\\'")}', description: '${p.description}' }`).join(',\n')}\n        ];`;
  html = html.replace(/const predictions = \[[\s\S]*?\n\s*\];/, block);
  fs.writeFileSync(INDEX_FILE, html, 'utf8');
}

function main() {
  const stocks = readJson(STOCK_LIST, {});
  const requestedBaseIso = envIsoDate('FORECAST_BASE_DATE');
  const requestedTargetIso = envIsoDate('FORECAST_TARGET_DATE');
  const requestedBaseCompact = requestedBaseIso ? compactDate(requestedBaseIso) : null;
  const priceFiles = listFiles(PRICE_DIR, /^fubon_20\d{6}_sma\.json$/)
    .filter((file) => !requestedBaseCompact || dateFromName(file) <= requestedBaseCompact)
    .slice(-40);
  if (!priceFiles.length) throw new Error('No SMA files found');
  const history = new Map();
  for (const file of priceFiles) {
    const data = readJson(path.join(PRICE_DIR, file), {});
    for (const [code, item] of Object.entries(data || {})) {
      const dates = Object.keys(item || {}).filter((k)=>/^20\d{2}[\/-]\d{2}[\/-]\d{2}$/.test(k)).sort();
      for (const dateKey of dates) {
        const r=item[dateKey]||{}; const iso=dateKey.replaceAll('/','-');
        if (requestedBaseIso && iso > requestedBaseIso) continue;
        const row={date:iso,close:num(r.Price??r.Close),open:num(r.Open),high:num(r.High),low:num(r.Low),volume:num(r.Volume),sma5:num(r.SMA5),sma20:num(r.SMA20),sma60:num(r.SMA60)};
        if ([row.close,row.open,row.high,row.low,row.volume].every(Number.isFinite)) {
          if (!history.has(code)) history.set(code,new Map()); history.get(code).set(iso,row);
        }
      }
    }
  }
  const allDates=[...new Set([...history.values()].flatMap((m)=>[...m.keys()]))].sort();
  if (!allDates.length) throw new Error(`No SMA rows found${requestedBaseIso ? ` on or before ${requestedBaseIso}` : ''}`);
  const baseIso=requestedBaseIso || allDates.at(-1);
  if (!allDates.includes(baseIso)) throw new Error(`No SMA rows found for FORECAST_BASE_DATE ${baseIso}`);
  const baseCompact=compactDate(baseIso); const holidays=loadHolidaySet(HOLIDAY_FILE); const forecastDate=requestedTargetIso || nextTradeDate(baseIso,holidays);
  const instFiles=listFiles(INST_DIR,/^20\d{6}_twse_institutional_investors\.json$/).filter((f)=>dateFromName(f)<=baseCompact).slice(-5);
  const marginFiles=listFiles(MARGIN_DIR,/^20\d{6}_twse_margin_balance\.csv$/).filter((f)=>dateFromName(f)<=baseCompact);
  const margin=marginFiles.length?loadMargin(path.join(MARGIN_DIR,marginFiles.at(-1))):new Map();
  const marketSnapshot=loadMarketSnapshot(baseIso);
  const marketRisk=latestMarketRisk(baseCompact);
  const marketReturn=marketSnapshot?.change_percent ?? null;
  const forecastCompact=compactDate(forecastDate);
  const forecastJsonDir=path.join(JSON_DIR,forecastCompact);
  fs.mkdirSync(JSON_DIR,{recursive:true});
  fs.rmSync(forecastJsonDir,{recursive:true,force:true});
  fs.mkdirSync(forecastJsonDir,{recursive:true});
  fs.writeFileSync(path.join(forecastJsonDir,'market-snapshot.json'),JSON.stringify({
    generated_at: new Date().toISOString(),
    base_trade_date: baseIso,
    forecast_date: forecastDate,
    data: marketSnapshot,
    missing_data: marketSnapshot ? [] : ['大盤指數'],
    missing_files: marketSnapshot ? [] : [
      `data_twse_mi_index/${baseCompact}_twse_mi_index.json`,
      'data_twse_market_chart/market_chart.json'
    ]
  },null,2));
  const missingStocks=[]; const predictions=[]; const generatedAt=new Date().toISOString();
  for (const [code, meta] of Object.entries(stocks)) {
    const rows=[...(history.get(code)?.values()||[])].sort((a,b)=>a.date.localeCompare(b.date)); const t=rows.at(-1); const missing=[]; const missingFiles=[];
    if (!t || t.date!==baseIso) { missing.push('個股價格與成交量'); missingFiles.push(`data_fubon/*${baseCompact}*_sma.json:${code}`); }
    const prior=rows.at(-2), prior3=rows.at(-4); const closes=rows.map((r)=>r.close); const volumes=rows.map((r)=>r.volume);
    const r1=t&&prior?pct(t.close,prior.close):null; const r3=t&&prior3?pct(t.close,prior3.close):null; const intraday=t?pct(t.close,t.open):null;
    const vr1=t&&prior&&prior.volume?pct(t.volume,prior.volume)/100+1:null; const vr5=t&&rows.length>=6?t.volume/mean(volumes.slice(-6,-1)):null;
    const gap20=t&&t.sma20?pct(t.close,t.sma20):null; const atr=calcAtr(rows); const rsi=calcRsi(closes); const rel=Number.isFinite(r1)&&Number.isFinite(marketReturn)?r1-marketReturn:null;
    if (!Number.isFinite(marketReturn)) { missing.push('大盤指數'); missingFiles.push(`data_predictions/${forecastCompact}/market-snapshot.json`); }
    const instSeries=loadInstitutionalSeries(instFiles, baseCompact, code); const inst=instSeries.at(-1); if (!inst||!Number.isFinite(inst.total)) { missing.push('三大法人'); missingFiles.push(`data_normalized/institutional_investors/${baseCompact}.json:${code}`, `data_twse_institutional_investors/${baseCompact}_twse_institutional_investors.json:${code}`); }
    const m=margin.get(code); const marginRate=m&&Number.isFinite(m.previous)&&m.previous!==0?pct(m.current,m.previous):null; if (!Number.isFinite(marginRate)) { missing.push('融資融券'); missingFiles.push(`data_twse_margin_balance/${baseCompact}_twse_margin_balance.csv:${code}`); }
    const broker=loadBroker(code,baseCompact); const mainRatio=broker&&t?broker.net/t.volume*100:null; if (!Number.isFinite(mainRatio)) { missing.push('券商分點'); missingFiles.push(`data_fubon_broker_details/*${baseCompact}*${code}*`); }
    let score=0; const scores=[]; const add=(item,value,rule,s)=>{score+=s;scores.push({item,value,rule,score:s});};
    if (Number.isFinite(r1)) { if(r1>=3)add('單日報酬',`${round(r1)}%`,'r1 ≥ 3%',1); else if(r1<=-3)add('單日報酬',`${round(r1)}%`,'r1 ≤ -3%',-1); }
    if(t&&Number.isFinite(t.sma20)) add('SMA20',`${t.close}/${t.sma20}`,t.close>t.sma20?'close > SMA20':'close < SMA20',t.close>t.sma20?1:-1);
    if(Number.isFinite(intraday)){if(intraday>=3)add('日內報酬',`${round(intraday)}%`,'≥ 3%',1);else if(intraday<=-3)add('日內報酬',`${round(intraday)}%`,'≤ -3%',-1);}
    if(Number.isFinite(r1)&&Number.isFinite(vr1)&&vr1>=1.2&&r1!==0)add('量價',`${round(vr1)}x`,r1>0?'上漲放量':'下跌放量',r1>0?1:-1);
    if(Number.isFinite(rel)){if(rel>=3)add('相對強弱',`${round(rel)}%`,'≥ 3',2);else if(rel<=-3)add('相對強弱',`${round(rel)}%`,'≤ -3',-2);}
    if(Number.isFinite(r3)){if(r3>=8)add('三日報酬',`${round(r3)}%`,'≥ 8%',1);else if(r3<=-8)add('三日報酬',`${round(r3)}%`,'≤ -8%',-1);}
    const instRatio=inst&&t&&Number.isFinite(inst.total)?inst.total/t.volume*100:null; if(Number.isFinite(instRatio)){let s=instRatio>=10?2:instRatio>=3?1:instRatio<=-10?-2:instRatio<=-3?-1:0;if(s)add('法人占量',`${round(instRatio)}%`,'固定區間',s);}
    if(inst&&Number.isFinite(inst.foreign)&&Number.isFinite(inst.trust)&&inst.foreign*inst.trust>0)add('外資投信同向',inst.foreign>0?'同買':'同賣','同方向',inst.foreign>0?1:-1);
    if(Number.isFinite(mainRatio)){let s=mainRatio>=5?2:mainRatio>=2?1:mainRatio<=-5?-2:mainRatio<=-2?-1:0;if(s)add('主力占量',`${round(mainRatio)}%`,'固定區間',s);}
    if(Number.isFinite(r1)&&Number.isFinite(marginRate)){let s=0;if(marginRate<=-1)s=1;else if(marginRate>=1)s=r1<0?-2:-1;if(s)add('融資變動',`${round(marginRate)}%`,'股價與融資規則',s);}
    const marketRiskScore = marketRisk?.market_risk_score ?? null;
    const newsRiskScore = marketRisk?.news?.keyword_risk_score ?? null;
    const adrRiskScore = Math.max(marketRisk?.news?.adr_sox_nasdaq_news_risk ?? 0, marketRisk?.external_market?.adr_sox_nasdaq_market_risk ?? 0);
    const oilRiskScore = Math.max(marketRisk?.news?.oil_news_risk ?? 0, marketRisk?.external_market?.oil_futures_risk ?? 0);
    if(Number.isFinite(marketRiskScore) && marketRiskScore >= 65)add('市場新聞風險',`${round(marketRiskScore,1)}`,'市場風險 ≥ 65',-1);
    if(Number.isFinite(adrRiskScore) && adrRiskScore >= 70)add('ADR/費半/Nasdaq',`${round(adrRiskScore,1)}`,'外部科技風險 ≥ 70',-1);
    if(Number.isFinite(oilRiskScore) && oilRiskScore >= 70)add('油價期貨風險',`${round(oilRiskScore,1)}`,'油價/能源風險 ≥ 70',-1);
    const raw=labelDirection(score); let stockRisk=0; if(Number.isFinite(r3)&&Math.abs(r3)>=15)stockRisk+=2;if(Number.isFinite(gap20)&&Math.abs(gap20)>=15)stockRisk++;if(Number.isFinite(rsi)&&(rsi>=70||rsi<=30))stockRisk++;if(Number.isFinite(r1)&&r1>0&&Number.isFinite(vr1)&&vr1<1)stockRisk++;if(Number.isFinite(atr)&&t&&atr/t.close>=.04)stockRisk++;
    let marketRiskOverlay=0;if(Number.isFinite(marketRiskScore) && marketRiskScore >= 65)marketRiskOverlay+=2; else if(Number.isFinite(marketRiskScore) && marketRiskScore >= 40)marketRiskOverlay+=1;
    if(Number.isFinite(adrRiskScore) && adrRiskScore >= 70)marketRiskOverlay+=1;
    if(Number.isFinite(oilRiskScore) && oilRiskScore >= 70)marketRiskOverlay+=1;
    const combinedRisk=stockRisk+marketRiskOverlay;
    let final=raw;if(combinedRisk>=4&&raw==='偏多')final='中性偏多';if(combinedRisk>=4&&raw==='偏空')final='中性偏空';
    const completeness=(t?30:0)+(Number.isFinite(marketReturn)?10:0)+(inst&&Number.isFinite(inst.total)?25:0)+(Number.isFinite(marginRate)?15:0)+(Number.isFinite(mainRatio)?20:0);
    const payload={methodology_version:METHOD_VERSION,generated_at:generatedAt,prediction_mode:'prospective',stock_code:code,stock_name:meta.Name,forecast_date:forecastDate,base_trade_date:baseIso,information_cutoff:`${baseIso}T15:30:00+08:00`,market:'TWSE',direction_score:score,raw_direction_label:raw,risk_score:stockRisk,risk_label:riskLabel(stockRisk),stock_risk_score:stockRisk,stock_risk_label:riskLabel(stockRisk),market_context_risk_score:marketRiskOverlay,market_context_risk_label:riskLabel(marketRiskOverlay),combined_risk_score:combinedRisk,combined_risk_label:riskLabel(combinedRisk),final_direction_label:final,data_completeness:completeness,missing_data:[...new Set(missing)],missing_files:[...new Set(missingFiles)],missing_indicators:[],data_quality_notes:marketRisk?[]:['缺少市場新聞/外部指數風險快照'],backtest_rule_id:null,backtest_status:'unavailable',features:{r1:round(r1),r3:round(r3),intraday_return:round(intraday),volume_ratio_1d:round(vr1),volume_ratio_5d:round(vr5),gap_sma20:round(gap20),atr14:round(atr),rsi14:round(rsi),relative_strength:round(rel),institutional_ratio:round(instRatio),main_net_ratio:round(mainRatio),margin_change_rate:round(marginRate),market_news_risk_score:round(newsRiskScore,1),external_market_risk_score:round(marketRisk?.external_market?.external_market_risk_score,1),market_risk_score:round(marketRiskScore,1),adr_sox_nasdaq_risk:round(adrRiskScore,1),oil_futures_risk:round(oilRiskScore,1)},market_risk:marketRisk?{source_file:marketRisk.source_file,risk_label:marketRisk.risk_label,top_keywords:marketRisk.news?.top_keywords?.slice(0,8)||[],top_industries:marketRisk.news?.top_industries?.slice(0,8)||[],tracked_indicators:marketRisk.external_market?.tracked_indicators||[]}:null,view:{lead:`依方法 ${METHOD_VERSION}，使用 ${baseIso} 收盤以前的專案資料評估。`,risk_label:`個股${riskLabel(stockRisk)} / 市場${riskLabel(marketRiskOverlay)}`,forecast_cards:[{label:'收盤價',value:t?String(t.close):'缺少',description:`SMA20：${t?.sma20??'缺少'}`},{label:'方向分數',value:String(score),description:raw},{label:'資料完整度',value:`${completeness}%`,description:missing.length?`缺少：${[...new Set(missing)].join('、')}`:'核心資料齊全'}],facts:[{label:'單日報酬',value:Number.isFinite(r1)?`${round(r1)}%`:'無法計算',description:`基準日 ${baseIso}`},{label:'三日報酬',value:Number.isFinite(r3)?`${round(r3)}%`:'無法計算',description:'依固定公式計算'},{label:'個股風險',value:riskLabel(stockRisk),description:`個股技術/波動風險分數：${stockRisk}`},{label:'市場風險',value:Number.isFinite(marketRiskScore)?`${round(marketRiskScore,1)}`:'缺少',description:marketRisk?.risk_label?`新聞與外部指數：${marketRisk.risk_label}；疊加分數 ${marketRiskOverlay}`:'未產生 market_risk_snapshot'},{label:'ADR/油價風險',value:`${round(adrRiskScore,1)??'NA'} / ${round(oilRiskScore,1)??'NA'}`,description:'ADR/費半/Nasdaq 與油價期貨'}],scores,scenarios:[{label:'基準情境',title:final,description:'依固定分數與總風險降級規則產生。',target:t&&atr?`${round(t.close-atr)} ～ ${round(t.close+atr)}`:'區間資料不足'}],levels:t?[{type:'參考支撐',price:String(round(t.low)),description:'基準日低點'},{type:'參考壓力',price:String(round(t.high)),description:'基準日高點'}]:[],data_note:missing.length?`缺少資料：${[...new Set(missing)].join('、')}。未取得對應日期資料的項目依規格計 0 分。`:'核心資料已依日期完成交叉驗證。'}};
    const jsonFile=path.join(forecastJsonDir,`${code}.json`);fs.writeFileSync(jsonFile,JSON.stringify(payload,null,2));
    predictions.push({file:`prediction-stock.html?date=${forecastCompact}&code=${code}`,title:`${forecastDate} ${meta.Name}（${code}）`,description:`方法 ${METHOD_VERSION}；資料完整度 ${completeness}%。`});
    if(missing.length)missingStocks.push({stock_code:code,stock_name:meta.Name,missing_data:[...new Set(missing)],missing_files:[...new Set(missingFiles)]});
  }
  predictions.sort((a,b)=>a.title.localeCompare(b.title,'zh-Hant'));
  updateIndex(predictions);
  fs.writeFileSync(path.join(forecastJsonDir,'missing-data-stocks.json'),JSON.stringify({base_trade_date:baseIso,forecast_date:forecastDate,count:missingStocks.length,stocks:missingStocks},null,2));
  const previousManifest=readJson(path.join(JSON_DIR,'manifest.json'),{});
  const existingDateDirs=fs.readdirSync(JSON_DIR,{withFileTypes:true})
    .filter((entry)=>entry.isDirectory()&&/^20\d{6}$/.test(entry.name))
    .map((entry)=>entry.name);
  const availableDates=[...new Set([...(previousManifest.available_dates||[]),...existingDateDirs,forecastCompact])].filter((date)=>/^20\d{6}$/.test(date)).sort();
  const manifest={methodology_version:METHOD_VERSION,generated_at:generatedAt,base_trade_date:baseIso,forecast_date:forecastDate,forecast_date_compact:forecastCompact,output_directory:`data_predictions/${forecastCompact}`,market_snapshot:`data_predictions/${forecastCompact}/market-snapshot.json`,market_risk_snapshot:marketRisk?.source_file??null,latest_date:forecastCompact,available_dates:availableDates,total_stocks:Object.keys(stocks).length,generated_reports:predictions.length,report_mode:'dynamic-json',missing_data_stocks:missingStocks.length};
  fs.writeFileSync(path.join(forecastJsonDir,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(JSON_DIR,'manifest.json'),JSON.stringify({...manifest,latest_manifest:`data_predictions/${forecastCompact}/manifest.json`,latest_market_snapshot:`data_predictions/${forecastCompact}/market-snapshot.json`,latest_missing_data:`data_predictions/${forecastCompact}/missing-data-stocks.json`},null,2));
  const dashboardResult = spawnSync(process.execPath, [path.join(__dirname, 'generate_prediction_dashboard_data.js')], { stdio: 'inherit' });
  if (dashboardResult.status !== 0) process.exit(dashboardResult.status || 1);
  console.log(JSON.stringify({baseIso,forecastDate,total:predictions.length,missing:missingStocks.length}));
}
main();
