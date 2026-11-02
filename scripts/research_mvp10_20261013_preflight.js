#!/usr/bin/env node
'use strict';
// Research-only date-scoped video preflight. Fail closed: classification
// inventory is NOT historical effective-date ordinary-stock certification.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function assess(raw,analysis,ai,summary,script,categories,meta={}){
 const date=raw?.target_date;
 if(!/^20\d{6}$/.test(date||''))throw Error('INVALID_RAW_TRADE_DATE');
 for(const [name,v] of Object.entries({analysis,ai,summary,script}))
  if(v?.target_date!==date)throw Error('SOURCE_DATE_MISMATCH:'+name);
 for(const [name,v,arr] of [['raw',raw,'stocks'],['analysis',analysis,'analyses'],['ai',ai,'analyses']]){
  if(!Array.isArray(v[arr])||v.stock_count!==v[arr].length)throw Error('COUNT_MISMATCH:'+name);
 }
 if(!Array.isArray(script.scenes)||script.stock_count!==raw.stock_count)throw Error('SCRIPT_COUNT_OR_SCENES_MISMATCH');
 if(analysis.stock_count!==raw.stock_count||ai.stock_count!==raw.stock_count)throw Error('SOURCE_COUNT_MISMATCH');
 if(summary.coverage?.raw_stock_count!==raw.stock_count||summary.coverage?.analyzed_stock_count!==raw.stock_count)
  throw Error('MARKET_SUMMARY_COUNT_MISMATCH');
 const cat={};
 for(const key of ['Stock','InnovationBoard','TDR']){
  if(!(categories[key] instanceof Map))throw Error('MISSING_CATEGORY:'+key);
  cat[key]=categories[key];
 }
 const rows=raw.stocks.map(s=>{
  const code=String(s.code),name=String(s.name);
  if(!code||!name)throw Error('INVALID_STOCK_IDENTITY');
  const hits=Object.entries(cat).filter(([k,m])=>m.has(code));
  const mapped=hits.map(([category,m])=>({category,name:m.get(code)}));
  const preferred=/^[0-9]{4}[A-Z]$/.test(code)||/(?:特別股|特)$/u.test(name);
  const reasons=[];
  if(hits.length!==1)reasons.push('CATEGORY_MISSING_OR_OVERLAP');
  if(hits.some(([k,m])=>m.get(code)!==name))reasons.push('NAME_DISAGREEMENT');
  if(hits.length===1&&hits[0][0]!=='Stock')reasons.push('NON_STOCK_CLASS');
  if(preferred)reasons.push('PREFERRED_OR_SPECIAL_SHARE');
  const p=Number(s.previous_close),c=Number(s.close),g=Number(s.change_pct);
  if(!Number.isFinite(p)||p<=0||!Number.isFinite(c)||!Number.isFinite(g)||g<5||Math.abs((c/p-1)*100-g)>0.04)
    reasons.push('UNVERIFIED_GAIN_ARITHMETIC');
  return {code,name,category_hits:mapped,provisional_regular_stock_candidate:reasons.length===0,reasons};
 });
 if(new Set(rows.map(x=>x.code)).size!==rows.length)throw Error('DUPLICATE_CODE');
 const excluded=rows.filter(x=>!x.provisional_regular_stock_candidate);
 const candidate=rows.filter(x=>x.provisional_regular_stock_candidate);
 const scriptCodes=[...new Set(script.scenes.flatMap(s=>s.stock_codes||[]).map(String))];
 const unsafeSceneCodes=scriptCodes.filter(code=>excluded.some(x=>x.code===code));
 return {
  schema_version:1,target_date:date,source_revision:meta.source_revision||null,
  input_sha256:meta.input_sha256||{},raw_stock_count:raw.stock_count,
  original_summary_status:summary.status,original_summary_coverage:summary.coverage?.overall,
  provisional_stock_count:candidate.length,
  excluded_count:excluded.length,excluded,unsafe_scene_codes:unsafeSceneCodes,
  scope_snapshot_effective_on_trading_date_verified:false,
  revised_analysis_generated:false,revised_script_generated:false,
  unmodified_original_validator_pass:false,render_authorized:false,
  youtube_upload_authorized:false,publication_authorized:false,
  decision:excluded.length?'BLOCKED_MIXED_SECURITY_TYPES_REQUIRES_COHERENT_REBUILD':
   'CANDIDATE_SCOPE_INVENTORIED_REQUIRES_DATE_CERTIFICATION_AND_ORIGINAL_VALIDATORS'
 };
}
function csv(b){
 const lines=b.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/); 
 if(lines.shift()!=='Code,Name,Industry')throw Error('BAD_CLASSIFICATION_CSV');
 const out=new Map();for(const line of lines){const [code,name]=line.split(',');if(!code||!name||out.has(code))throw Error('BAD_CATEGORY_ENTRY');out.set(code,name);}
 return out;
}
function inspect(root,date,revision){
 if(!/^20\d{6}$/.test(date))throw Error('INVALID_DATE');
 const paths={
  raw:`data_daily_gain_over_5/${date}.json`,
  analysis:`data_daily_gain_over_5/analysis/${date}.json`,
  ai:`data_daily_gain_over_5/analysis-ai/${date}.json`,
  summary:`data_daily_gain_over_5/market-summary/${date}.json`,
  script:`video_scripts/daily-gainers/${date}.json`
 };
 const input_sha256={},data={};
 for(const [key,p]of Object.entries(paths)){const buf=fs.readFileSync(path.join(root,p));input_sha256[key]={path:p,sha256:sha(buf)};data[key]=JSON.parse(buf);}
 const categories={};
 for(const name of ['Stock','InnovationBoard','TDR']){
  const p=`data_twse/twse_industry_${name}.csv`,buf=fs.readFileSync(path.join(root,p));
  input_sha256[name]={path:p,sha256:sha(buf)};categories[name]=csv(buf);
 }
 return assess(data.raw,data.analysis,data.ai,data.summary,data.script,categories,
  {source_revision:revision||null,input_sha256});
}
if(require.main===module){
 const [root,date,revision]=process.argv.slice(2);
 const result=inspect(root,date,revision);
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
 if(result.decision.startsWith('BLOCKED'))process.exitCode=2;
}
module.exports={assess,csv,inspect};
