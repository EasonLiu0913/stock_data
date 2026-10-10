'use strict';
const fs=require('node:fs'),path=require('node:path');
const {readCSV}=require('./audit_daily_gainers_m2v2_observed_candidates');
const {evaluate}=require('./evaluate_daily_gainers_m2v2_featured_gate');
const BASE=path.resolve(__dirname,'..');
const names=['Stock','InnovationBoard','ETF','TDR','ETN','PreferredStock','Warrants'];
function build(preflight,raw,classification,risk){
 const date=preflight.date;
 if(date!=='20261008'||raw.date!==date||raw.stat!=='OK')throw Error('SOURCE_DATE_MISMATCH');
 const t=raw.tables?.find(x=>x.title?.includes('每日收盤行情(全部)'));
 if(!t||t.fields?.[0]!=='證券代號'||t.fields?.[8]!=='收盤價')throw Error('BAD_OFFICIAL_QUOTE_SCHEMA');
 const parsed=x=>Number(String(x).replaceAll(',',''));
 const rows=new Map();
 for(const r of t.data){
  const code=String(r[0]||'').trim();
  if(!/^\d{4}$/.test(code))continue;
  if(rows.has(code))throw Error('DUPLICATE_OFFICIAL_ROW:'+code);
  rows.set(code,r);
 }
 const candidates=preflight.candidates.map(c=>{
  const row=rows.get(c.code),stock=classification.Stock.get(c.code);
  const competing=names.filter(n=>n!=='Stock'&&classification[n].has(c.code));
  const sign=row?String(row[9]).includes('+')?1:String(row[9]).includes('-')?-1:0:0;
  const close=row?parsed(row[8]):NaN,change=row?sign*parsed(row[10]):NaN;
  const prev=close-change;
  const exact=row&&String(row[1]).trim()===c.name&&stock?.name===c.name
   &&Number.isFinite(close)&&Number.isFinite(change)&&prev>0
   &&Math.abs(close-c.close)<1e-8&&Math.abs(change-c.change)<1e-8
   &&Math.abs(prev-c.previous_close)<1e-8
   &&Math.abs(100*change/prev-c.gain_percent)<0.000011;
  return {...c,
   classification_evidence:{source:'TWSE_OFFICIAL_STOCK_CATEGORY',stock_code:c.code,
    stock_name:stock?.name??null,source_sha:preflight.sources.classification_blob_sha1,
    stock_category_present:Boolean(stock),competing_categories:competing,
    historical_asof_confirmed:false},
   ...(exact?{official_quote_evidence:{source:'TWSE_MI_INDEX_SECURITY_ROW',date,
    stock_code:c.code,stock_name:c.name,close,change,previous_close:prev,
    source_sha:preflight.sources.mi_index_blob_sha1}}:{}),
   source_backed_quote_verified:Boolean(exact)};
 });
 const result=evaluate({...preflight,candidates},risk);
 return {...result,source_files:preflight.sources,source_crosscheck:'ACTUAL_MI_INDEX_ROWS_AND_OFFICIAL_CATEGORY_FILES',
  source_verified_quotes:candidates.filter(c=>c.source_backed_quote_verified).length,
  candidates:result.candidates.map((r,i)=>({...r,name:candidates[i].name,
    source_backed_quote_verified:candidates[i].source_backed_quote_verified,
    competing_categories:candidates[i].classification_evidence.competing_categories,
    stock_category_present:candidates[i].classification_evidence.stock_category_present,
    historical_asof_confirmed:false}))};
}
function run(){
 const preflight=require('../data_research/twse-market-opening/20261008-m2v2-featured-candidates-preflight.json');
 const risk=require('../data_research/twse-market-opening/20261008-m2v2-featured-trading-risk-review.json');
 const raw=JSON.parse(fs.readFileSync(path.join(BASE,preflight.sources.mi_index),'utf8'));
 const classification=Object.fromEntries(names.map(n=>[n,readCSV('twse_industry_'+n+'.csv')]));
 return build(preflight,raw,classification,risk);
}
if(require.main===module)console.log(JSON.stringify(run(),null,2));
module.exports={build,run};
