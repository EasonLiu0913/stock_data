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
const MARGIN_DIR = path.join(ROOT, 'data_twse_margin_balance');
const BROKER_DIR = path.join(ROOT, 'data_fubon_broker_details');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const HOLIDAY_FILE = path.join(ROOT, 'data_history_sma', 'non_trading_days.json');
const JSON_DIR = path.join(ROOT, 'data_predictions');
const INDEX_FILE = path.join(ROOT, 'public', 'index.html');
const METHOD_VERSION = '1.1.0';

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
    if (String(v.stock_code ?? v.code ?? v.Code ?? v.證券代號 ?? '').trim() === code || vals.includes(code)) hits.push(v);
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
function loadInstitutional(file, code) {
  const data = readJson(file, null); if (!data) return null;
  const hit = recursivelyFindStock(data, code)[0]; if (!hit) return null;
  const foreign = pickNumber(hit, ['foreign', '外資買賣超', '外陸資買賣超']);
  const trust = pickNumber(hit, ['trust', '投信買賣超']);
  const dealer = pickNumber(hit, ['dealer', '自營商買賣超']);
  const total = pickNumber(hit, ['total', '三大法人買賣超合計']) ?? ([foreign, trust, dealer].every(Number.isFinite) ? foreign + trust + dealer : null);
  return { foreign, trust, dealer, total };
}
function loadBroker(code, baseCompact) {
  const candidates = listFiles(BROKER_DIR, new RegExp(`${baseCompact}.*${code}|${code}.*${baseCompact}`));
  for (const f of candidates.reverse()) {
    const data = readJson(path.join(BROKER_DIR, f), null); if (!data) continue;
    const hit = recursivelyFindStock(data, code)[0] || data;
    const net = pickNumber(hit, ['net', '買賣超', '合計買賣超', '主力買賣超']);
    if (net !== null) return { net, file: f };
  }
  return null;
}
function extractMarketReturn(baseIso) {
  const data = readJson(MARKET_FILE, null); if (!data) return null;
  const dateKeys = [baseIso, baseIso.replaceAll('-', '/'), compactDate(baseIso)];
  const rows = Array.isArray(data) ? data : Object.values(data).flatMap((v) => Array.isArray(v) ? v : [v]);
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const date = String(r.date ?? r.Date ?? r.日期 ?? '');
    if (!dateKeys.includes(date)) continue;
    const p = pickNumber(r, ['changepercent', '漲跌百分比', 'return']); if (p !== null) return p;
    const close = pickNumber(r, ['close', '收盤']); const prev = pickNumber(r, ['previous', '前日收盤']);
    if (close !== null && prev !== null) return pct(close, prev);
  }
  return null;
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
  const marketReturn=extractMarketReturn(baseIso);
  const forecastCompact=compactDate(forecastDate);
  const forecastJsonDir=path.join(JSON_DIR,forecastCompact);
  fs.mkdirSync(JSON_DIR,{recursive:true});
  fs.rmSync(forecastJsonDir,{recursive:true,force:true});
  fs.mkdirSync(forecastJsonDir,{recursive:true});
  const missingStocks=[]; const predictions=[]; const generatedAt=new Date().toISOString();
  for (const [code, meta] of Object.entries(stocks)) {
    const rows=[...(history.get(code)?.values()||[])].sort((a,b)=>a.date.localeCompare(b.date)); const t=rows.at(-1); const missing=[]; const missingFiles=[];
    if (!t || t.date!==baseIso) { missing.push('個股價格與成交量'); missingFiles.push(`data_fubon/*${baseCompact}*_sma.json:${code}`); }
    const prior=rows.at(-2), prior3=rows.at(-4); const closes=rows.map((r)=>r.close); const volumes=rows.map((r)=>r.volume);
    const r1=t&&prior?pct(t.close,prior.close):null; const r3=t&&prior3?pct(t.close,prior3.close):null; const intraday=t?pct(t.close,t.open):null;
    const vr1=t&&prior&&prior.volume?pct(t.volume,prior.volume)/100+1:null; const vr5=t&&rows.length>=6?t.volume/mean(volumes.slice(-6,-1)):null;
    const gap20=t&&t.sma20?pct(t.close,t.sma20):null; const atr=calcAtr(rows); const rsi=calcRsi(closes); const rel=Number.isFinite(r1)&&Number.isFinite(marketReturn)?r1-marketReturn:null;
    if (!Number.isFinite(marketReturn)) { missing.push('大盤指數'); missingFiles.push('data_twse_market_chart/market_chart.json'); }
    const instSeries=instFiles.map((f)=>loadInstitutional(path.join(INST_DIR,f),code)); const inst=instSeries.at(-1); if (!inst||!Number.isFinite(inst.total)) { missing.push('三大法人'); missingFiles.push(`data_twse_institutional_investors/${baseCompact}_twse_institutional_investors.json:${code}`); }
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
    const raw=labelDirection(score); let risk=0; if(Number.isFinite(r3)&&Math.abs(r3)>=15)risk+=2;if(Number.isFinite(gap20)&&Math.abs(gap20)>=15)risk++;if(Number.isFinite(rsi)&&(rsi>=70||rsi<=30))risk++;if(Number.isFinite(r1)&&r1>0&&Number.isFinite(vr1)&&vr1<1)risk++;if(Number.isFinite(atr)&&t&&atr/t.close>=.04)risk++;
    let final=raw;if(risk>=4&&raw==='偏多')final='中性偏多';if(risk>=4&&raw==='偏空')final='中性偏空';
    const completeness=(t?30:0)+(Number.isFinite(marketReturn)?10:0)+(inst&&Number.isFinite(inst.total)?25:0)+(Number.isFinite(marginRate)?15:0)+(Number.isFinite(mainRatio)?20:0);
    const payload={methodology_version:METHOD_VERSION,generated_at:generatedAt,prediction_mode:'prospective',stock_code:code,stock_name:meta.Name,forecast_date:forecastDate,base_trade_date:baseIso,information_cutoff:`${baseIso}T15:30:00+08:00`,market:'TWSE',direction_score:score,raw_direction_label:raw,risk_score:risk,risk_label:riskLabel(risk),final_direction_label:final,data_completeness:completeness,missing_data:[...new Set(missing)],missing_files:[...new Set(missingFiles)],missing_indicators:[],data_quality_notes:[],backtest_rule_id:null,backtest_status:'unavailable',features:{r1:round(r1),r3:round(r3),intraday_return:round(intraday),volume_ratio_1d:round(vr1),volume_ratio_5d:round(vr5),gap_sma20:round(gap20),atr14:round(atr),rsi14:round(rsi),relative_strength:round(rel),institutional_ratio:round(instRatio),main_net_ratio:round(mainRatio),margin_change_rate:round(marginRate)},view:{lead:`依方法 ${METHOD_VERSION}，使用 ${baseIso} 收盤以前的專案資料評估。`,risk_label:riskLabel(risk),forecast_cards:[{label:'收盤價',value:t?String(t.close):'缺少',description:`SMA20：${t?.sma20??'缺少'}`},{label:'方向分數',value:String(score),description:raw},{label:'資料完整度',value:`${completeness}%`,description:missing.length?`缺少：${[...new Set(missing)].join('、')}`:'核心資料齊全'}],facts:[{label:'單日報酬',value:Number.isFinite(r1)?`${round(r1)}%`:'無法計算',description:`基準日 ${baseIso}`},{label:'三日報酬',value:Number.isFinite(r3)?`${round(r3)}%`:'無法計算',description:'依固定公式計算'},{label:'RSI14 / ATR14',value:`${round(rsi)??'NA'} / ${round(atr)??'NA'}`,description:'簡單平均規格'}],scores,scenarios:[{label:'基準情境',title:final,description:'依固定分數與風險降級規則產生。',target:t&&atr?`${round(t.close-atr)} ～ ${round(t.close+atr)}`:'區間資料不足'}],levels:t?[{type:'參考支撐',price:String(round(t.low)),description:'基準日低點'},{type:'參考壓力',price:String(round(t.high)),description:'基準日高點'}]:[],data_note:missing.length?`缺少資料：${[...new Set(missing)].join('、')}。未取得對應日期資料的項目依規格計 0 分。`:'核心資料已依日期完成交叉驗證。'}};
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
  const manifest={methodology_version:METHOD_VERSION,generated_at:generatedAt,base_trade_date:baseIso,forecast_date:forecastDate,forecast_date_compact:forecastCompact,output_directory:`data_predictions/${forecastCompact}`,latest_date:forecastCompact,available_dates:availableDates,total_stocks:Object.keys(stocks).length,generated_reports:predictions.length,report_mode:'dynamic-json',missing_data_stocks:missingStocks.length};
  fs.writeFileSync(path.join(forecastJsonDir,'manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(JSON_DIR,'manifest.json'),JSON.stringify({...manifest,latest_manifest:`data_predictions/${forecastCompact}/manifest.json`,latest_missing_data:`data_predictions/${forecastCompact}/missing-data-stocks.json`},null,2));
  const dashboardResult = spawnSync(process.execPath, [path.join(__dirname, 'generate_prediction_dashboard_data.js')], { stdio: 'inherit' });
  if (dashboardResult.status !== 0) process.exit(dashboardResult.status || 1);
  console.log(JSON.stringify({baseIso,forecastDate,total:predictions.length,missing:missingStocks.length}));
}
main();
