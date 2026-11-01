#!/usr/bin/env node
'use strict';
// Research-only, fail-closed, reversible stock-universe candidate workspace.
// Outputs noncanonical row-level snapshots; never copies summary/approval fields
// or writes to original source directories / video render inputs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {readCsv}=require('./research_mvp10_dated_universe_classification');
const CATS=['Stock','InnovationBoard','TDR','ETF'];
const EXCLUDED=new Set(['9103']);
const PENDING=new Set(['6645','7740']);
const INPUTS=Object.freeze([
 ['raw','data_daily_gain_over_5/20261008.json','stocks'],
 ['facts','data_daily_gain_over_5/analysis-facts/20261008.json','stocks'],
 ['news','data_daily_gain_over_5/analysis-news/20261008.json','analyses'],
 ['ai','data_daily_gain_over_5/analysis-ai/20261008.json','analyses'],
 ['published','data_daily_gain_over_5/analysis/20261008.json','analyses']
]);
const hex=b=>crypto.createHash('sha256').update(b).digest('hex');
function load(root){
 const input={},sha={};
 for(const [kind,rel,key] of INPUTS){
  const bytes=fs.readFileSync(path.join(root,rel)),j=JSON.parse(bytes);
  if(j.target_date!=='20261008'||!Array.isArray(j[key])||j.stock_count!==j[key].length||j[key].length!==35)
   throw Error('SOURCE_COUNT_DATE_OR_SHAPE:'+kind);
  const codes=j[key].map(x=>String(x.code));
  if(new Set(codes).size!==35)throw Error('DUPLICATE_SOURCE_CODE:'+kind);
  input[kind]=j[key];sha[kind]={path:rel,sha256:hex(bytes)};
 }
 const rawCodes=input.raw.map(x=>String(x.code));
 for(const [kind] of INPUTS.slice(1))
  if(JSON.stringify(input[kind].map(x=>String(x.code)))!==JSON.stringify(rawCodes))
   throw Error('SOURCE_STOCK_ORDER_MISMATCH:'+kind);
 return {input,sha,rawCodes};
}
function assessCategories(root){
 const directory=path.join(root,'data_twse'),maps={},sha={};
 for(const category of CATS){
  const p=path.join(directory,'twse_industry_'+category+'.csv');
  const b=fs.readFileSync(p),names=readCsv(b,category);
  maps[category]=names;sha[category]={path:'data_twse/twse_industry_'+category+'.csv',sha256:hex(b)};
 }
 return {maps,sha};
}
function make(root,out){
 if(path.resolve(out)===path.resolve(root) || path.resolve(out).startsWith(path.resolve(root)+path.sep))
  throw Error('OUTPUT_INSIDE_REPOSITORY_DISALLOWED');
 if(fs.existsSync(out))throw Error('OUTPUT_MUST_NOT_EXIST');
 const {input,sha,rawCodes}=load(root),categories=assessCategories(root);
 const catByCode=new Map();
 for(const row of input.raw){
  const code=String(row.code),hits=CATS.filter(c=>categories.maps[c].has(code));
  if(hits.length!==1||categories.maps[hits[0]].get(code)!==row.name)
   throw Error('UNVERIFIED_CODE_CATEGORY_OR_NAME:'+code);
  catByCode.set(code,hits[0]);
 }
 if(catByCode.get('9103')!=='TDR'||[...PENDING].some(c=>catByCode.get(c)!=='InnovationBoard'))
  throw Error('PINNED_CATEGORY_DRIFT');
 const scenarios=[
  {slug:'stock-category-only',eligible:new Set(['Stock']),conditional_innovation:false,expected:32},
  {slug:'innovation-conditional',eligible:new Set(['Stock','InnovationBoard']),conditional_innovation:true,expected:34}
 ];
 const outputs=[];
 for(const scenario of scenarios){
  const allowed=rawCodes.filter(code=>scenario.eligible.has(catByCode.get(code)));
  if(allowed.length!==scenario.expected||allowed.includes('9103'))throw Error('UNIVERSE_COUNT_OR_TDR_DRIFT');
  const codeSet=new Set(allowed),rows={};
  for(const [kind,,key] of INPUTS){
   const filtered=input[kind].filter(x=>codeSet.has(String(x.code)));
   if(JSON.stringify(filtered.map(x=>String(x.code)))!==JSON.stringify(allowed))
    throw Error('CANDIDATE_RECORD_ORDER_DRIFT:'+kind);
   // Only per-security source records, without inherited summary, status or completeness metadata.
   rows[kind]={
    research_only:true,canonical_daily_video_input:false,target_date:'20261008',
    source_kind:kind,source_sha256:sha[kind].sha256,
    stock_count:filtered.length,record_carry_forward_status:'UNVERIFIED_REQUIRES_NEW_SOURCE_RECONCILIATION',
    records:filtered
   };
  }
  const dir=path.join(out,scenario.slug);fs.mkdirSync(dir,{recursive:true});
  const evidence={};
  for(const [kind,body] of Object.entries(rows)){
   const p=path.join(dir,kind+'-row-candidates.json');
   const b=Buffer.from(JSON.stringify(body,null,2)+'\n');
   fs.writeFileSync(p,b,{flag:'wx'});
   evidence[kind]={filename:path.basename(p),sha256:hex(b),records:body.records.length};
  }
  const report={
   schema_version:1,scope:'RESEARCH_ONLY',target_date:'20261008',scenario:scenario.slug,
   original_stock_count:35,provisional_stock_count:allowed.length,
   code_order:allowed,excluded_codes:rawCodes.filter(code=>!codeSet.has(code)),
   classification_archive_publisher_effective_date_verified:false,
   innovation_inclusion_conditional:scenario.conditional_innovation,
   per_stock_records_copied_unverified:true,all_aggregate_statistics_invalidated:true,
   stock_identity_scope_certified:false,summary_regenerated:false,
   editorial_script_rebuilt:false,video_render_authorized:false,publication_authorized:false,
   source_sha256:sha,category_snapshot_sha256:categories.sha,
   row_candidate_receipts:evidence,
   decision:'CANDIDATE_INPUT_ONLY_NOT_RENDERABLE',
   next_action:'Revalidate date-effective ordinary-stock eligibility, rederive facts/semantics and complete every downstream published analysis and market summary before video validation'
  };
  const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'manifest.json'),bytes,{flag:'wx'});
  outputs.push({scenario:scenario.slug,count:allowed.length,excluded_codes:report.excluded_codes,
    manifest_sha256:hex(bytes),render_authorized:false});
 }
 return {date:'20261008',outputs,publication_authorized:false,render_authorized:false};
}
if(require.main===module){
 try{const [root,out]=process.argv.slice(2);if(!root||!out)throw Error('Usage: node scripts/research_mvp10_isolated_candidate_workspace.js ROOT OUTSIDE_ROOT_DEST');
  console.log(JSON.stringify(make(root,out),null,2));
 }catch(e){console.error(e.stack||e.message);process.exitCode=1}
}
module.exports={make,load,assessCategories,INPUTS};
