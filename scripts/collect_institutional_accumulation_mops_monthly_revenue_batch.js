#!/usr/bin/env node
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { buildSourceUrl, decodeHtml, parseMopsRevenueHtml } = require('./crawl_mops_monthly_revenue');

const ROOT = path.resolve(__dirname, '..');
const TARGET_MONTH='202607';
const TARGET_STOCKS=['1102','1103','1104','1109','1201','1203','1215','1216','1217'];
const OUT_DIR=path.join(ROOT,'data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue',TARGET_MONTH);
function sha256(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function jitterMs(min=2000,max=5000){return min+Math.floor(Math.random()*(max-min+1));}
function readJson(file, fallback=null){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function writeJson(file,v){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n');}
function softBlock(html, bytes){const t=String(html).toLowerCase(); return bytes.length < 5000 || /access denied|security|captcha|驗證碼|拒絕|forbidden|request rejected/.test(t);}
async function fetchOne(url){const c=new AbortController(); const timer=setTimeout(()=>c.abort(),30000);try{const r=await fetch(url,{signal:c.signal,headers:{accept:'text/html,application/xhtml+xml','user-agent':'Mozilla/5.0 (compatible; stock-data-accumulation-official-disclosure/1.0)'}}); const bytes=Buffer.from(await r.arrayBuffer()); return {status:r.status,final_url:r.url,content_type:r.headers.get('content-type')||null,bytes,html:decodeHtml(bytes,r.headers.get('content-type')||'')};}finally{clearTimeout(timer);}}
async function main(){
  const existing=readJson(path.join(OUT_DIR,'source-meta.json'));
  if(existing?.quality_state==='quality_passed'){console.log(JSON.stringify({ok:true,skipped:true,reason:'already_quality_passed'},null,2));return;}
  const attempt=Number(existing?.attempt_count||0)+1;
  if(attempt>3) throw new Error('Maximum attempts reached; manual review required.');
  await sleep(jitterMs());
  const url=buildSourceUrl(TARGET_MONTH); const collectedAt=new Date().toISOString();
  let response, parsed, quality='suspected_soft_block_or_extraction_failure', diagnostics={};
  try{
    response=await fetchOne(url);
    diagnostics={http_status:response.status,response_bytes:response.bytes.length,response_sha256:sha256(response.bytes),final_url:response.final_url};
    if(response.status!==200 || softBlock(response.html,response.bytes)) throw new Error('Ambiguous/shrunken/security response');
    if(!response.html.includes('上市公司') || !response.html.includes('出表日期')) throw new Error('Required MOPS structural markers missing');
    parsed=parseMopsRevenueHtml(response.html,TARGET_MONTH);
    const seen=new Set(parsed.companies.map(r=>r.stock_code));
    diagnostics.report_date=parsed.report_date; diagnostics.company_row_count=parsed.companies.length; diagnostics.frozen_stock_visibility=Object.fromEntries(TARGET_STOCKS.map(s=>[s,seen.has(s)]));
    if(!parsed.report_date || parsed.companies.length<500) throw new Error('Archive quality threshold failed');
    quality='quality_passed';
  }catch(error){diagnostics.error=error.message;}
  fs.mkdirSync(OUT_DIR,{recursive:true});
  if(response?.bytes) fs.writeFileSync(path.join(OUT_DIR,'source.html'),response.bytes);
  if(parsed) writeJson(path.join(OUT_DIR,'rows.json'),{schema_version:1,revenue_month:TARGET_MONTH,report_date:parsed.report_date,rows:parsed.companies});
  const meta={schema_version:1,source_provider:'MOPS',source_interface:'historical_monthly_revenue_archive',source_url_or_request_key:url,historical_period_or_spoke_date:TARGET_MONTH,source_reported_date:parsed?.report_date||null,source_reported_time:null,source_timestamp_precision:'aggregate_snapshot_date',source_sequence:null,collected_at:collectedAt,http_status:response?.status??null,final_url:response?.final_url??null,response_bytes:response?.bytes?.length??0,response_sha256:response?.bytes?sha256(response.bytes):null,parser_version:'institutional-accumulation-official-disclosure-source-collection-v1',quality_state:quality,version_safety:'historical_timing_safe_value_version_unproven',pit_known_at:parsed?.report_date||null,pit_availability_rule:'official aggregate report date only; collection time is not historical availability proof',attempt_count:attempt,diagnostics};
  if(quality!=='quality_passed' && attempt>=3) meta.terminal_state='manual_review';
  writeJson(path.join(OUT_DIR,'source-meta.json'),meta);
  console.log(JSON.stringify({ok:quality==='quality_passed',quality_state:quality,attempt_count:attempt,diagnostics},null,2));
  if(quality!=='quality_passed') process.exitCode=2;
}
if(require.main===module) main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={softBlock,jitterMs};
