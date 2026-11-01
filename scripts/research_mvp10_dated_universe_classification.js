#!/usr/bin/env node
'use strict';
// Research evidence inventory, not historical classification approval.
// Never edits original source, AI, market-summary or script.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const CATEGORIES=Object.freeze(['Stock','InnovationBoard','TDR','ETF']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const file=(root,p)=>path.join(root,p);
function readCsv(buf,category){
  const lines=buf.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if(lines.shift()!=='Code,Name,Industry')throw Error('CSV_HEADER:'+category);
  const map=new Map();
  for(const line of lines){
    const [code,name]=line.split(',');
    if(!code||!name||map.has(code))throw Error('CSV_ROW_INVALID:'+category+':'+code);
    map.set(code,name);
  }
  return map;
}
function classify({raw,categoryMaps,sourceHashes}){
  if(!/^20\d{6}$/.test(raw?.target_date||'')||!Array.isArray(raw?.stocks)||
     raw.stock_count!==raw.stocks.length)throw Error('INVALID_DATED_SOURCE');
  const seen=new Set(),rows=[],issues=[];
  for(const stock of raw.stocks){
    const code=String(stock.code||''),name=String(stock.name||'');
    if(!code||seen.has(code))throw Error('DUPLICATE_OR_MISSING_STOCK_CODE:'+code);
    seen.add(code);
    const hits=CATEGORIES.filter(c=>categoryMaps[c]?.has(code));
    if(hits.length!==1)issues.push({code,reason:'CATEGORY_UNCLASSIFIED_OR_OVERLAP',categories:hits});
    if(hits.length===1&&categoryMaps[hits[0]].get(code)!==name)
      issues.push({code,reason:'CATEGORY_NAME_CONFLICT',source_name:categoryMaps[hits[0]].get(code),raw_name:name});
    const category=hits.length===1?hits[0]:'UNRESOLVED';
    const classification_status=category==='TDR'?'EXCLUDE_KNOWN_NON_COMMON':
      category==='Stock'?'RESEARCH_STOCK_CANDIDATE_UNVERIFIED_DATE':
      category==='InnovationBoard'?'NEEDS_ORDINARY_TYPE_AND_DATE_EVIDENCE':'BLOCKED';
    rows.push({code,name,category,classification_status,change_pct:stock.change_pct});
  }
  const counts=Object.fromEntries([...CATEGORIES,'UNRESOLVED'].map(k=>[k,rows.filter(r=>r.category===k).length]));
  return {
    schema_version:1,target_date:raw.target_date,
    source_snapshot_effective_on_target_date_verified:false,
    category_source_file_sha256:sourceHashes,
    stock_count:raw.stock_count,category_counts:counts,rows,issues,
    excluded_known_noncommon:rows.filter(r=>r.classification_status==='EXCLUDE_KNOWN_NON_COMMON').map(r=>r.code),
    unresolved_date_or_type_count:rows.filter(r=>r.classification_status!=='EXCLUDE_KNOWN_NON_COMMON').length,
    classification_certified:false,analysis_rebuilt:false,render_authorized:false,publication_authorized:false,
    decision:issues.length?'BLOCKED_CONFLICT':'RESEARCH_INVENTORY_ONLY',
    next_gate:'Independently verify 20261008 effective classification and regenerate dated raw, facts, AI, market summary and script as a consistent bundle'
  };
}
function inspect(root,date){
  if(!/^20\d{6}$/.test(date))throw Error('INVALID_DATE');
  const rawpath='data_daily_gain_over_5/'+date+'.json';
  const rawbuf=fs.readFileSync(file(root,rawpath)),raw=JSON.parse(rawbuf);
  if(raw.target_date!==date)throw Error('SOURCE_DATE_MISMATCH');
  const maps={},hashes={};
  for(const c of CATEGORIES){
    const p='data_twse/twse_industry_'+c+'.csv',b=fs.readFileSync(file(root,p));
    maps[c]=readCsv(b,c);
    hashes[c]={path:p,sha256:sha(b),record_count:maps[c].size};
  }
  const report=classify({raw,categoryMaps:maps,sourceHashes:hashes});
  report.raw_source={path:rawpath,sha256:sha(rawbuf)};
  return report;
}
if(require.main===module){
  try{
    const date=process.argv[2],root=process.argv[3]||process.cwd();
    if(!date)throw Error('Usage: node scripts/research_mvp10_dated_universe_classification.js YYYYMMDD [root]');
    const report=inspect(root,date);
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if(report.issues.length)process.exitCode=1;
  }catch(e){console.error(e.stack||e.message);process.exitCode=1;}
}
module.exports={classify,readCsv,inspect,CATEGORIES};
