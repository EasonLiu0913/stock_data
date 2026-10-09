#!/usr/bin/env node
'use strict';
// Compact inspection artifact for large historical MI_INDEX JSON files.
// Reports table layouts, stock row counts, unknown schema cases; never guesses security type.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function inspect(payload,targetDate){
 if(payload?.stat!=='OK'||payload.date!==targetDate||!Array.isArray(payload.tables))
   throw new Error('INVALID_OR_STALE_MI_INDEX');
 const tables=payload.tables.map((t,index)=>{
  const fields=Array.isArray(t?.fields)?t.fields:[];
  const rows=Array.isArray(t?.data)?t.data:[];
  const codeIndex=fields.indexOf('證券代號');
  const closeIndex=fields.indexOf('收盤價');
  const changeIndex=fields.indexOf('漲跌價差');
  const candidate=codeIndex>=0&&closeIndex>=0&&changeIndex>=0;
  const sample=rows.slice(0,5).map(r=>({
   code:String(r?.[codeIndex]??'').replace(/<[^>]*>/g,'').trim(),
   close:r?.[closeIndex],
   change:r?.[changeIndex],
   sign:fields.indexOf('漲跌(+/-)')>=0?r?.[fields.indexOf('漲跌(+/-)')]:null
  }));
  return {index,title:String(t?.title||''),field_count:fields.length,fields,rows:rows.length,
   stock_table_candidate:candidate,sample:candidate?sample:[]};
 });
 if(!tables.some(t=>t.stock_table_candidate))throw new Error('NO_STOCK_TABLE_CANDIDATE');
 return {target_date:targetDate,stat:'OK',table_count:tables.length,table_profiles:tables,
  stock_candidates:tables.filter(t=>t.stock_table_candidate).map(t=>({index:t.index,rows:t.rows})),
  note:'INSPECTION_ONLY; no verified security identities; cannot publish breadth'};
}
function main(args=process.argv.slice(2)){
 const [date,inputFile]=args;
 if(!/^20\d{6}$/.test(date||'')||!inputFile)throw new Error('Usage: node scripts/inspect_twse_mi_index_breadth.js YYYYMMDD input.json');
 const bytes=fs.readFileSync(inputFile),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 const profile={...inspect(JSON.parse(bytes.toString('utf8')),date),
  source:{path:inputFile,bytes:bytes.length,sha256}};
 const out=path.join(process.cwd(),'output/twse-market-opening-inspection',date+'.json');
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(profile,null,2)+'\n');
 console.log(JSON.stringify({output:out,date,tables:profile.table_count,candidates:profile.stock_candidates,sha256}));
}
if(require.main===module){try{main();}catch(e){console.error('MI_INDEX_INSPECT_FAILED:'+e.message);process.exitCode=1;}}
module.exports={inspect};
