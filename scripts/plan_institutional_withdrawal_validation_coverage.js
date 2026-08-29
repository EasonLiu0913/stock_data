#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i=args.indexOf(`--${name}`); return i>=0&&args[i+1]?args[i+1]:fallback; };
const start = arg('start','2026-04-01');
const end = arg('end','9999-12-31');
const output = arg('output',path.join('data_research','institutional-flow','validation','validation-coverage-v1.json'));
const development = new Set(['2330','2317','2454','2382','2303','2449']);
const developmentEnd = '2026-08-21';
const tdccRoot = arg('tdcc-root',path.join('data_tdcc_shareholding','history'));
const brokerResearchRoot = arg('broker-research-root',path.join('data_research','institutional-flow','histock'));
const brokerRawRoot = arg('broker-raw-root','data_fubon_broker_details');
const foreignRoot = arg('foreign-root','data_twse_foreign_investors');
const ohlcvRoot = arg('ohlcv-root','data_fubon');

const iso = ymd => `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`;
const ymd = isoDate => String(isoDate).replaceAll('-','');
const existsDir = p => fs.existsSync(p) && fs.statSync(p).isDirectory();
const readJson = p => JSON.parse(fs.readFileSync(p,'utf8'));
const stockDirNames = root => existsDir(root) ? fs.readdirSync(root).filter(n=>/^\d{4,6}$/.test(n) && existsDir(path.join(root,n))).sort() : [];

function discoverTradingDates(){
  if(!existsDir(foreignRoot)) return [];
  const out=[];
  for(const name of fs.readdirSync(foreignRoot)){
    if(!/^\d{8}_twse_foreign_investors\.json$/.test(name)) continue;
    const raw=name.slice(0,8), date=iso(raw);
    if(date<start||date>end) continue;
    try{const p=readJson(path.join(foreignRoot,name));if(p.stat==='OK'&&String(p.date)===raw&&Array.isArray(p.data))out.push(date);}catch{}
  }
  return out.sort();
}
function tdccDates(stock){
  const root=path.join(tdccRoot,stock); if(!existsDir(root)) return [];
  const out=[];
  for(const name of fs.readdirSync(root).filter(n=>/^\d{8}\.json$/.test(n)).sort()){
    try{const p=readJson(path.join(root,name));const d=String(p.observed_date||'');if(p.source==='tdcc_official_historical_query'&&p.stock===stock&&d>=start&&d<=end)out.push(d);}catch{}
  }
  return out;
}
function researchBrokerDates(stock){
  const root=path.join(brokerResearchRoot,stock,'daily'); if(!existsDir(root)) return [];
  return fs.readdirSync(root).filter(n=>/^\d{8}\.json$/.test(n)).map(n=>iso(n.slice(0,8))).filter(d=>d>=start&&d<=end).sort();
}
function rawBrokerDates(){
  if(!existsDir(brokerRawRoot)) return [];
  return fs.readdirSync(brokerRawRoot).filter(n=>/^fubon_\d{8}_券商分點進出明細\.json$/.test(n)).map(n=>iso(n.slice(6,14))).filter(d=>d>=start&&d<=end).sort();
}
function foreignStockPresence(tradingDates){
  const map=new Map();
  for(const date of tradingDates){
    const file=path.join(foreignRoot,`${ymd(date)}_twse_foreign_investors.json`);
    try{
      const p=readJson(file);
      for(const row of p.data||[]){const s=String(row?.[1]||'').trim();if(!/^\d{4,6}$/.test(s))continue;if(!map.has(s))map.set(s,new Set());map.get(s).add(date);}
    }catch{}
  }
  return map;
}
function ohlcvStockPresence(tradingDates){
  const map=new Map();
  for(const date of tradingDates){
    const file=path.join(ohlcvRoot,`fubon_${ymd(date)}_sma.json`);
    if(!fs.existsSync(file)) continue;
    try{
      const p=readJson(file); const slash=date.replaceAll('-','/');
      for(const [s,byDate] of Object.entries(p)){const r=byDate?.[slash];if(!r)continue;const vals=[r.Price,r.Open,r.High,r.Low,r.Volume].map(Number);if(vals.every(Number.isFinite)){if(!map.has(s))map.set(s,new Set());map.get(s).add(date);}}
    }catch{}
  }
  return map;
}
function ratio(n,d){return d?Number((n/d).toFixed(4)):null;}

const tradingDates=discoverTradingDates();
const rawBroker=rawBrokerDates();
const rawBrokerSet=new Set(rawBroker);
const foreignPresence=foreignStockPresence(tradingDates);
const ohlcvPresence=ohlcvStockPresence(tradingDates);
const tdccStocks=stockDirNames(tdccRoot);
const researchBrokerStocks=stockDirNames(brokerResearchRoot);
const candidateStocks=[...new Set([...tdccStocks,...researchBrokerStocks,...foreignPresence.keys(),...ohlcvPresence.keys()])].sort();

const rows=[];
for(const stock of candidateStocks){
  const tdcc=tdccDates(stock);
  const rb=researchBrokerDates(stock);
  const fp=foreignPresence.get(stock)||new Set();
  const op=ohlcvPresence.get(stock)||new Set();
  const commonDaily=tradingDates.filter(d=>fp.has(d)&&op.has(d));
  const rawBrokerCommon=commonDaily.filter(d=>rawBrokerSet.has(d));
  const postDevTdcc=tdcc.filter(d=>d>developmentEnd);
  const postDevDaily=commonDaily.filter(d=>d>developmentEnd);
  const stockHoldout=!development.has(stock);
  // Minimum precondition for lifecycle research: >=3 TDCC observations, >=40 common daily sessions, and >=80% common daily coverage.
  // Broker research-ready means per-stock normalized histock is already present. Raw-broker-ready means source files exist and may be normalized without outcome selection.
  const commonRatio=ratio(commonDaily.length,tradingDates.length);
  const eligibleBase=tdcc.length>=3 && commonDaily.length>=40 && commonRatio>=0.8;
  const stockHoldoutReady=stockHoldout && eligibleBase && rb.length>=40;
  const stockHoldoutRawBrokerReady=stockHoldout && eligibleBase && rawBrokerCommon.length>=40;
  const timeHoldoutReady=development.has(stock) && postDevTdcc.length>=3 && postDevDaily.length>=40 && rb.filter(d=>d>developmentEnd).length>=40;
  rows.push({stock,development_stock:development.has(stock),tdcc_observations:tdcc.length,tdcc_first:tdcc[0]||null,tdcc_last:tdcc.at(-1)||null,research_broker_days:rb.length,raw_broker_common_days:rawBrokerCommon.length,foreign_days:fp.size,ohlcv_days:op.size,common_foreign_ohlcv_days:commonDaily.length,common_daily_ratio:commonRatio,post_development:{tdcc_observations:postDevTdcc.length,common_daily_days:postDevDaily.length,research_broker_days:rb.filter(d=>d>developmentEnd).length},eligibility:{stock_holdout_ready:stockHoldoutReady,stock_holdout_needs_broker_normalization:stockHoldoutRawBrokerReady&&!stockHoldoutReady,time_holdout_ready:timeHoldoutReady}});
}

const stockHoldoutReady=rows.filter(r=>r.eligibility.stock_holdout_ready).map(r=>r.stock);
const stockHoldoutNeedsBroker=rows.filter(r=>r.eligibility.stock_holdout_needs_broker_normalization).map(r=>r.stock);
const timeHoldoutReady=rows.filter(r=>r.eligibility.time_holdout_ready).map(r=>r.stock);
const payload={
  schema_version:1,
  methodology:'institutional-withdrawal-validation-coverage-planner-v1',
  generated_without_outcomes:true,
  development:{stocks:[...development],period:{start:'2026-04-01',end:developmentEnd}},
  calendar:{policy:'source-derived from valid TWSE foreign daily files; data_history_sma/trading_days.json is never read',first:tradingDates[0]||null,last:tradingDates.at(-1)||null,count:tradingDates.length},
  coverage_requirements:{minimum_tdcc_observations:3,minimum_common_daily_sessions:40,minimum_common_daily_ratio:0.8,broker_requirement:'40 normalized per-stock research days; raw broker source availability is reported separately for deterministic normalization/backfill'},
  counts:{candidate_stocks:rows.length,tdcc_stock_directories:tdccStocks.length,research_broker_stock_directories:researchBrokerStocks.length,stock_holdout_ready:stockHoldoutReady.length,stock_holdout_needs_broker_normalization:stockHoldoutNeedsBroker.length,time_holdout_ready:timeHoldoutReady.length},
  stock_holdout_ready:stockHoldoutReady,
  stock_holdout_needs_broker_normalization:stockHoldoutNeedsBroker,
  time_holdout_ready:timeHoldoutReady,
  rows,
  guardrails:['No outcome, future return, future max drawdown, or v6.1 diagnosis file is read by this planner.','Historical TDCC remains association-only because original publication timestamps are incomplete.','A missing OHLCV trading-date row remains a gap; coverage is not compressed or imputed.','Universe selection is coverage-driven and occurs before validation outcomes are generated.'],
  generated_at:new Date().toISOString(),
};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({counts:payload.counts,calendar:payload.calendar,stock_holdout_ready,stock_holdout_needs_broker_normalization:stockHoldoutNeedsBroker,time_holdout_ready},null,2));
