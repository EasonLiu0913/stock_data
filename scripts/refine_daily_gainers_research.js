#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const DATES=process.argv.slice(2).filter(x=>/^20\d{6}$/.test(x));
const sets={
 ai:new Set(['2308','2301','3017','3653','3443','8996','7711','2324','2377','6285','6831','2359','2465','6933']),
 cpo:new Set(['6442','3450','4977','2455','6451','6426']),
 panel:new Set(['3481','2409','6116','4960','6456','3149','2438']),
 bicycle:new Set(['9921','9914']),
};
const src={
 ai:[{title:'經濟日報：AI資料中心電源配套升級，台達電、光寶科、高力受惠',url:'https://money.udn.com/money/story/11162/9567142',published_at:'2026-06-15'}],
 cpo:[{title:'經濟日報：AI高速互連、矽光子與CPO題材升溫',url:'https://money.udn.com/money/story/5607/9543207',published_at:'2026-06-03'},{title:'經濟日報：光通訊營運成長，CPO需求接棒',url:'https://money.udn.com/money/story/5612/9622037',published_at:'2026-07-12'}],
 panel:[{title:'中央社：面板級封裝題材熱，群創與友達同步走強',url:'https://www.cna.com.tw/news/afe/202606180210.aspx',published_at:'2026-06-18'},{title:'中央社：群創布局FOPLP、友達跨入光通訊',url:'https://www.cna.com.tw/news/afe/202606190112.aspx',published_at:'2026-06-19'}],
 bicycle:[{title:'中央社：巨大庫存去化近尾聲，市場逐步回歸正常節奏',url:'https://www.cna.com.tw/news/afe/202606180196.aspx',published_at:'2026-06-18'},{title:'中央社：巨大、美利達歐洲與中國市場銷售回升',url:'https://www.cna.com.tw/news/afe/202606100369.aspx',published_at:'2026-06-10'}],
};
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function write(file,p){fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');}
function dealerAvailable(date){
 const f=path.join(ROOT,'data_twse_dealers',`${date}_twse_dealers.json`);
 if(!fs.existsSync(f)) return false;
 const raw=fs.readFileSync(f,'utf8').trim();
 if(!raw) return false;
 try{const p=JSON.parse(raw); return Array.isArray(p?.data)&&p.data.length>0;}catch{return false;}
}
for(const date of DATES){
 const causeFile=path.join(ROOT,'data_daily_gain_over_5','analysis',`${date}.json`);
 const flowFile=path.join(ROOT,'data_daily_gain_over_5','analysis-flow',`${date}.json`);
 const cause=read(causeFile), flow=read(flowFile);
 for(const a of cause.analyses||[]){
   const code=String(a.code);
   for(const key of Object.keys(sets)) if(sets[key].has(code)) a.sources=src[key];
 }
 const avail=dealerAvailable(date);
 if(!avail){
   for(const a of flow.analyses||[]){
     a.dealer_net='unavailable';
     a.institutional_summary=String(a.institutional_summary||'').replace(/；自營商[^；]*/, '；自營商 資料 unavailable');
     a.data_sources=(a.data_sources||[]).filter(x=>!String(x).includes('data_twse_dealers/'));
   }
   flow.methodology_note='僅使用該交易日及前一交易日的實際市場/籌碼數據。自營商檔若為空則標示 unavailable；券商分點本批未找到穩定同日結構化來源時亦不杜撰。';
 }
 write(causeFile,cause); write(flowFile,flow);
 console.log(JSON.stringify({date,dealer_available:avail,stocks:cause.stock_count}));
}
