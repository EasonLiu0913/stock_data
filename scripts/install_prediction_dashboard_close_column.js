#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// This installer patches the existing dashboard without regenerating prediction data.
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'public', 'prediction-dashboard.html');
let html = fs.readFileSync(file, 'utf8');

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Unable to patch ${label}: expected text not found`);
  return source.replace(before, after);
}

html = replaceOnce(
  html,
  "let dashboard, marketNews=null, marketRisk=null, marketNewsMode='', conceptLists=null, electronicsLists=null, oilPrices=null, futuresOpenInterest=[], cnnFearGreed=null;",
  "let dashboard, basePriceData=null, marketNews=null, marketRisk=null, marketNewsMode='', conceptLists=null, electronicsLists=null, oilPrices=null, futuresOpenInterest=[], cnnFearGreed=null;",
  'dashboard state'
);

html = replaceOnce(
  html,
  "async function loadDashboard(){const m=await fetch('../data_predictions/manifest.json').then(r=>r.json());currentDate=params.get('date')||m.latest_date||m.forecast_date_compact;const summaryPath=currentDate===m.latest_date&&m.latest_summary?m.latest_summary:`data_predictions/${currentDate}/summary.json`;dashboard=await fetch(`../${summaryPath}`).then(r=>{if(!r.ok)throw new Error(`找不到 ${summaryPath}`);return r.json();});await Promise.all([loadMarketNews(),loadClassLists(),loadOilPrices(),loadFuturesOpenInterest(),loadCnnFearGreed()]);init(m);}",
  "async function loadDashboard(){const m=await fetch('../data_predictions/manifest.json').then(r=>r.json());currentDate=params.get('date')||m.latest_date||m.forecast_date_compact;const summaryPath=currentDate===m.latest_date&&m.latest_summary?m.latest_summary:`data_predictions/${currentDate}/summary.json`;dashboard=await fetch(`../${summaryPath}`).then(r=>{if(!r.ok)throw new Error(`找不到 ${summaryPath}`);return r.json();});await Promise.all([loadBasePrices(),loadMarketNews(),loadClassLists(),loadOilPrices(),loadFuturesOpenInterest(),loadCnnFearGreed()]);init(m);}",
  'dashboard loader'
);

html = replaceOnce(
  html,
  "async function fetchJsonOrNull(file){try{const r=await fetch(`../${file}`);return r.ok?await r.json():null;}catch{return null;}}",
  "async function fetchJsonOrNull(file){try{const r=await fetch(`../${file}`);return r.ok?await r.json():null;}catch{return null;}}\n    async function loadBasePrices(){const base=compact(dashboard.base_trade_date);basePriceData=await fetchJsonOrNull(`data_fubon/fubon_${base}_sma.json`);}\n    function basePriceRow(stock){const item=basePriceData?.[String(stock.stock_code)];if(!item)return null;const iso=String(dashboard.base_trade_date||'');const slash=iso.replaceAll('-','/');const compactDate=compact(iso);return item[iso]||item[slash]||item[compactDate]||null;}\n    function baseClose(stock){const row=basePriceRow(stock);const value=Number(row?.Price??row?.Close);return Number.isFinite(value)?value:null;}\n    function closeWithChange(stock){const close=baseClose(stock);const change=Number(stock.features?.r1);if(!Number.isFinite(close))return 'NA';return `${close.toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2})}（${Number.isFinite(change)?signedPct(change):'NA'}）`;}",
  'base price helpers'
);

html = replaceOnce(
  html,
  "const cols=[['report','報告'],['stock','股票']",
  "const cols=[['baseClose','前收盤價（漲跌）'],['report','報告'],['stock','股票']",
  'stock table header'
);

html = replaceOnce(
  html,
  "const map={report:s.stock_code,stock:`${s.stock_name} ${s.stock_code}`",
  "const map={baseClose:baseClose(s),report:s.stock_code,stock:`${s.stock_name} ${s.stock_code}`",
  'stock sort value'
);

html = replaceOnce(
  html,
  "rows.map(s=>`<tr><td><a class=\"link\" href=\"${s.report_file}\">個股</a></td>",
  "rows.map(s=>`<tr><td>${closeWithChange(s)}</td><td><a class=\"link\" href=\"${s.report_file}\">個股</a></td>",
  'stock row'
);

html = replaceOnce(
  html,
  "<tr><th>報告</th><th>股票</th>",
  "<tr><th>前收盤價（漲跌）</th><th>報告</th><th>股票</th>",
  'static stock header'
);

fs.writeFileSync(file, html, 'utf8');
console.log('Updated public/prediction-dashboard.html with base close and daily change column.');
