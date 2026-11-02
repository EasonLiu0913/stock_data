#!/usr/bin/env node
'use strict';
// Isolated research staging. Never rewrite source checkout or promote final.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const date='20261013';
const rootData='data_daily_gain_over_5';
const mapping=[
 ['raw',rootData+'/'+date+'.json','stocks'],
 ['news',rootData+'/analysis-news/'+date+'.json','analyses'],
 ['facts',rootData+'/analysis-facts/'+date+'.json','stocks'],
 ['ai',rootData+'/analysis-ai/'+date+'.json','analyses']
];
function read(root,p){return JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));}
function fileCopy(src,dst,p){const from=path.join(src,p),to=path.join(dst,p);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);}
function write(root,p,data){const dst=path.join(root,p);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,JSON.stringify(data,null,2)+'\n',{flag:'wx'});}
function build(source,out){
 const sourceAbs=path.resolve(source),outAbs=path.resolve(out);
 if(outAbs===sourceAbs||outAbs.startsWith(sourceAbs+path.sep)||fs.existsSync(outAbs))
  throw Error('OUTPUT_MUST_BE_NEW_SEPARATE_ISOLATED_DIRECTORY');
 const original=Object.fromEntries(mapping.map(([key,p])=>[key,read(source,p)]));
 const raw=original.raw;
 if(raw.target_date!==date||raw.stock_count!==25||!Array.isArray(raw.stocks)||raw.stocks.length!==25)
  throw Error('FROZEN_DATE_OR_RAW_COUNT_CHANGED');
 const maps={};
 for(const category of ['Stock','InnovationBoard','TDR']){
  const lines=fs.readFileSync(path.join(source,'data_twse/twse_industry_'+category+'.csv'),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if(lines.shift()!=='Code,Name,Industry')throw Error('INVALID_CATEGORY_TABLE:'+category);
  maps[category]=new Map(lines.map(x=>x.split(',').slice(0,2)));
 }
 const excluded=[],kept=[];
 for(const row of raw.stocks){
  const code=String(row.code),hits=Object.entries(maps).filter(([k,m])=>m.has(code));
  const ordinary=hits.length===1&&hits[0][0]==='Stock'&&hits[0][1].get(code)===row.name&&
    /^\d{4}$/.test(code)&&!/(?:特別股|特|[-－]DR)$/.test(row.name);
  (ordinary?kept:excluded).push(code);
 }
 const expected=['1312A','6645','6924','7730','9103'].sort();
 if(JSON.stringify(excluded.slice().sort())!==JSON.stringify(expected)||kept.length!==20)
  throw Error('UNEXPECTED_REAL_SOURCE_SCOPE');
 const allowed=new Set(kept),meta=[];
 fs.mkdirSync(outAbs,{recursive:false});
 for(const [key,p,field] of mapping){
  const v=original[key],arr=v[field];
  if(v.target_date!==date||v.stock_count!==25||!Array.isArray(arr)||arr.length!==25)
   throw Error('ORIGINAL_COMPONENT_INCOMPLETE:'+key);
  const ids=arr.map(x=>String(x.code)),expect=raw.stocks.map(x=>String(x.code));
  if(JSON.stringify(ids)!==JSON.stringify(expect))throw Error('STOCK_ORDER_MISMATCH:'+key);
  const filtered=arr.filter(x=>allowed.has(String(x.code)));
  if(filtered.length!==20)throw Error('STAGE_STOCK_COUNT_ERROR:'+key);
  const candidate={...v,stock_count:20,[field]:filtered,research_only:true,
   original_source_semantics_reapproved:false,source_date_classification_certified:false};
  if(key==='facts'){
    candidate.market_context={...v.market_context,gainer_count:20};
  }
  if(key==='ai'){
    delete candidate.market_summary;delete candidate.priority_watchlist;
  }
  if(key==='news'){
    // Leave legacy source-specific facts available for audit; not editorially reapproved.
    candidate.analyses=filtered.map(x=>({...x,original_causal_claim_reapproved:false}));
  }
  write(outAbs,p,candidate);
  meta.push({component:key,source:p,source_sha256:sha(fs.readFileSync(path.join(source,p))),
    candidate_sha256:sha(fs.readFileSync(path.join(outAbs,p)))});
 }
 // Reuse existing original code unchanged, only in isolated checkout.
 for(const p of [
  'scripts/build_daily_gainers_market_summary.js',
  'scripts/validate_daily_gainers_market_summary.js',
  'scripts/lib/daily_gainers_ai_contract.js',
  'config/daily-gainers-ai-contract.json',
  'config/daily-gainers-theme-taxonomy.json'
 ])fileCopy(source,outAbs,p);
 const manifest={schema_version:1,target_date:date,source_revision:null,
  provisional_stock_count:20,excluded_original_codes:excluded,component_sha256:meta,
  source_snapshot_effective_on_date_certified:false,
  analysis_final_rebuilt:false,script_rewritten:false,render_authorized:false,
  publication_authorized:false,
  decision:'RESEARCH_COHERENT_ROWS_ONLY_ORIGINAL_SUMMARY_MUST_REMAIN_PRELIMINARY'};
 write(outAbs,'research-mvp10-20261013-staging.json',manifest);
 return manifest;
}
if(require.main===module){
 const [source,out]=process.argv.slice(2);
 if(!source||!out)throw Error('Usage: node stage_mvp10_20261013_candidates.js source out');
 process.stdout.write(JSON.stringify(build(source,out),null,2)+'\n');
}
module.exports={build};
