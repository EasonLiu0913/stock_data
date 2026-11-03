#!/usr/bin/env node
'use strict';
// MVP10 isolated news-agent execution. Never pushes to main or dispatches publication.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const CONTRACT=require('../config/daily-gainers-ai-contract.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function assert(x,msg){if(!x)throw Error(msg)}
function parseDate(d){assert(/^20\\d{6}$/.test(d||''),'INVALID_DATE');const v=new Date(d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)+'T00:00:00Z');assert(!isNaN(+v)&&v.toISOString().slice(0,10).replace(/-/g,'')===d,'IMPOSSIBLE_DATE');return d}
function sourceData(root,date){
 const p=path.join(root,'data_daily_gain_over_5',date+'.json');assert(fs.existsSync(p),'RAW_MISSING');
 const bytes=fs.readFileSync(p),raw=JSON.parse(bytes.toString('utf8'));
 assert(raw.target_date===date&&raw.stock_count===raw.stocks?.length&&raw.threshold_pct===5,'RAW_INVALID');
 assert(raw.stocks.length>0&&new Set(raw.stocks.map(s=>s.code)).size===raw.stocks.length,'RAW_DUPLICATES');
 for(const s of raw.stocks)assert(/^\\d{4}$/.test(String(s.code))&&s.previous_close>0&&100*(s.close/s.previous_close-1)>=4.995,'RAW_NOT_FIVE_PERCENT');
 return {raw,sha256:sha(bytes)};
}
function exactMatch(rows,stocks){
 assert(Array.isArray(rows)&&rows.length===stocks.length,'NEWS_COVERAGE_MISMATCH');
 for(let i=0;i<rows.length;i++){
  const a=rows[i],s=stocks[i];
  assert(String(a.code)===String(s.code)&&a.name===s.name&&Number(a.change_pct)===Number(s.change_pct),'NEWS_STOCK_MISMATCH');
  assert(CONTRACT.cause_types.includes(a.cause_type)&&CONTRACT.evidence_strength_values.includes(a.evidence_strength)&&CONTRACT.confidence_values.includes(a.confidence),'NEWS_ENUM_INVALID');
  assert(Array.isArray(a.sources)&&Array.isArray(a.evidence)&&Array.isArray(a.follow_up)&&Array.isArray(a.cause_tags),'NEWS_FIELDS_INVALID');
  if(['direct','corroborated'].includes(a.evidence_strength))assert(a.sources.length>0,'NEWS_UNSOURCED_STRONG_CLAIM');
  for(const u of a.sources){assert(u.title&&/^https?:\\/\\//.test(u.url||''),'NEWS_INVALID_LINK')}
  if(['unknown','low_liquidity'].includes(a.cause_type))assert(a.confidence==='low','NEWS_UNKNOWN_CONFIDENCE');
 }
}
function responseText(response){
 if(typeof response.output_text==='string')return response.output_text;
 return (response.output||[]).flatMap(i=>(i.content||[]).filter(c=>c.type==='output_text').map(c=>c.text)).join('\\n');
}
function extractJson(text){
 let s=text.trim().replace(/^\\x60\\x60\\x60(?:json)?\\s*/i,'').replace(/\\s*\\x60\\x60\\x60$/,'');
 return JSON.parse(s);
}
async function generateBatch(stocks,date,key,model,fetchFn=fetch){
 const instruction='You are a Taiwan TWSE financial news research assistant. Perform actual web searches. For each provided code output exactly one JSON object in given order, with code, name, change_pct, cause_type, cause_tags (snake_case), evidence_strength, reason_summary in Traditional Chinese, evidence (array of strings), confidence, follow_up (array), sources (array of {title,url,published_at}). Only date-relevant primary announcements or credible reports; never invent a URL, figure, causal relationship or quotation. When facts are unproven use unknown, evidence_strength none, confidence low, sources empty; cite observed price as price only. Return ONLY a JSON array, no markdown. Allowed cause_type: '+CONTRACT.cause_types.join(',')+'. Allowed evidence_strength: '+CONTRACT.evidence_strength_values.join(',')+'. Allowed confidence: '+CONTRACT.confidence_values.join(',')+'. Date '+date+'. Stock inputs: '+JSON.stringify(stocks.map(s=>({code:String(s.code),name:s.name,change_pct:s.change_pct,volume:s.volume})));
 const r=await fetchFn('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,tools:[{type:'web_search'}],tool_choice:'required',input:instruction,max_output_tokens:6500})});
 const body=await r.json();
 if(!r.ok)throw Error('AGENT_HTTP_'+r.status+':'+String(body.error?.message||'').slice(0,160));
 const result=extractJson(responseText(body));exactMatch(result,stocks);return {result,response_id:body.id||null};
}
async function execute({root=ROOT,date,executeAgent=false,key=process.env.OPENAI_API_KEY,model=process.env.MVP10_NEWS_MODEL||'gpt-5.5',batchSize=4,outputRoot=process.env.MVP10_OUTPUT_ROOT||'/tmp/mvp10-news-agent',fetchFn=fetch}){
 parseDate(date);
 const {raw,sha256}=sourceData(root,date);
 const existing=path.join(root,'data_daily_gain_over_5','analysis-news',date+'.json');
 const dest=path.join(outputRoot,'data_daily_gain_over_5','analysis-news',date+'.json');
 const receiptFile=path.join(outputRoot,'receipt.json');
 assert(path.resolve(outputRoot)!==path.resolve(root)&&!path.resolve(root).startsWith(path.resolve(outputRoot)+path.sep),'ISOLATED_OUTPUT_REQUIRED');
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 if(fs.existsSync(existing)){
  const p=JSON.parse(fs.readFileSync(existing,'utf8'));
  if(p.target_date===date&&p.stock_count===raw.stock_count){
   return {status:'EXISTS_NEEDS_ORIGINAL_VALIDATION',date,source_sha256:sha256,existing};
  }
  throw Error('EXISTING_NEWS_INVALID_DO_NOT_OVERWRITE');
 }
 if(!executeAgent){
  const receipt={status:'MISSING_AGENT_NOT_INVOKED',date,source_sha256:sha256,stock_count:raw.stock_count,requires:'explicit --execute and OPENAI_API_KEY',publication_authorized:false};
  fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2)+'\\n');return receipt;
 }
 assert(typeof key==='string'&&key.length>0,'OPENAI_API_KEY_MISSING');
 assert(Number.isInteger(batchSize)&&batchSize>=1&&batchSize<=5,'BATCH_SIZE_INVALID');
 const analyses=[],ids=[];
 for(let i=0;i<raw.stocks.length;i+=batchSize){
  const group=raw.stocks.slice(i,i+batchSize);
  const {result,response_id}=await generateBatch(group,date,key,model,fetchFn);
  analyses.push(...result);ids.push(response_id);
 }
 exactMatch(analyses,raw.stocks);
 const news={schema_version:CONTRACT.news.schema_version,methodology_version:CONTRACT.news.methodology_version,model_role:CONTRACT.news.model_role,contract_version:CONTRACT.contract_version,contract_policy:CONTRACT.policy,target_date:date,generated_at:new Date().toISOString(),source_list_file:'data_daily_gain_over_5/'+date+'.json',stock_count:raw.stock_count,analyses};
 fs.writeFileSync(dest,JSON.stringify(news,null,2)+'\\n');
 // Run the repository's exact validator against isolated source and candidate, never against main.
 const result=cp.spawnSync(process.execPath,[path.join(root,'scripts/validate_daily_gainers_news_analysis.js'),date,dest],{cwd:root,encoding:'utf8',timeout:90000});
 const receipt={status:result.status===0?'VALIDATOR_PASS_RESEARCH_ONLY':'VALIDATOR_FAIL',date,source_sha256:sha256,output_sha256:sha(fs.readFileSync(dest)),stock_count:analyses.length,agent_response_ids:ids,validator_exit_code:result.status,validator_stderr:String(result.stderr||'').slice(0,1200),publication_authorized:false,main_write_authorized:false,pages_deploy_authorized:false,youtube_upload_authorized:false};
 fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2)+'\\n');
 if(result.status!==0)throw Error('ORIGINAL_NEWS_VALIDATOR_FAILED');
 return receipt;
}
if(require.main===module){
 const a=process.argv.slice(2),v=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 execute({date:v('--date'),executeAgent:a.includes('--execute')}).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1});
}
module.exports={parseDate,sourceData,exactMatch,extractJson,responseText,execute,generateBatch};
