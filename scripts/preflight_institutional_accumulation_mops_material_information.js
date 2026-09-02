#!/usr/bin/env node
'use strict';
const crypto=require('node:crypto'); const fs=require('node:fs'); const path=require('node:path');
const ROOT=path.resolve(__dirname,'..'); const OUT=path.join(ROOT,'data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json'); const MAX_ATTEMPTS=3;
function sleep(ms){return new Promise(r=>setTimeout(r,ms));} function jitter(){return 2000+Math.floor(Math.random()*3001);} function sha(b){return crypto.createHash('sha256').update(b).digest('hex');}
function blocked(html,bytes){const t=String(html).toLowerCase();return bytes.length<3000||/access denied|captcha|security|驗證碼|forbidden|request rejected|拒絕/.test(t);}
function read(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}} function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n');}
async function request(url,options={}){await sleep(jitter());const r=await fetch(url,{redirect:'follow',...options,headers:{'user-agent':'Mozilla/5.0 (compatible; stock-data-accumulation-preflight/1.0)',accept:'text/html,application/xhtml+xml',...(options.headers||{})}});const b=Buffer.from(await r.arrayBuffer());return{status:r.status,url:r.url,bytes:b,html:new TextDecoder('utf-8').decode(b),sha256:sha(b)};}
function isAmbiguousReason(reason){return /security_or_quality_block|soft_block|extraction_failure/.test(String(reason||''));}
async function main(){
  const existing=read(OUT); if(existing?.decision==='pass'){console.log(JSON.stringify({ok:true,skipped:true,reason:'already_passed'},null,2));return;}
  const prior=Number(existing?.attempt_count || (existing?.decision==='blocked' ? 1 : 0)); const attempt=prior+1;
  if(attempt>MAX_ATTEMPTS || existing?.terminal_state==='manual_review') throw new Error('Maximum preflight attempts reached; manual review required.');
  const started=new Date().toISOString(); const diag={stock:'1102',roc_year:'115',request_cap:3,requests:[]}; let decision='blocked',reason='unverified_machine_contract';
  try{
    const endpoint='https://mops.twse.com.tw/mops/web/ajax_t05st01';
    const body=new URLSearchParams({encodeURIComponent:'1',step:'1',firstin:'1',off:'1',keyword4:'',code1:'',TYPEK:'sii',co_id:'1102',year:'115'}).toString();
    const listing=await request(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body}); diag.requests.push({kind:'listing',status:listing.status,final_url:listing.url,bytes:listing.bytes.length,sha256:listing.sha256});
    if(listing.status!==200||blocked(listing.html,listing.bytes)) throw new Error('listing_security_or_quality_block');
    const hasTable=/<table\b/i.test(listing.html); const seq=/SEQ_NO[=\"'\s]+(\d+)/i.exec(listing.html); const spokeDate=/SPOKE_DATE[=\"'\s]+(\d{8})/i.exec(listing.html); const spokeTime=/SPOKE_TIME[=\"'\s]+(\d{6})/i.exec(listing.html);
    const explicitEmpty=/查無資料|無符合條件|沒有符合條件/.test(listing.html); diag.listing={has_table:hasTable,explicit_empty_marker:explicitEmpty,detail_identity_detected:Boolean(seq&&spokeDate&&spokeTime)};
    if(explicitEmpty){reason='explicit_empty_signal_verified_but_detail_identity_unverified';throw new Error(reason);}
    if(!hasTable||!seq||!spokeDate||!spokeTime) throw new Error('listing_structure_or_detail_identity_unverified');
    const detailUrl=`https://mops.twse.com.tw/mops/web/ajax_t05sr01_1?step=1&COMPANY_ID=1102&SEQ_NO=${seq[1]}&SPOKE_DATE=${spokeDate[1]}&SPOKE_TIME=${spokeTime[1]}`;
    const detail=await request(detailUrl); diag.requests.push({kind:'detail',status:detail.status,final_url:detail.url,bytes:detail.bytes.length,sha256:detail.sha256});
    if(detail.status!==200||blocked(detail.html,detail.bytes)||!detail.html.includes('1102')) throw new Error('detail_security_or_quality_block');
    const noPagination=/共\s*1\s*頁|第\s*1\s*頁\s*\/\s*共\s*1\s*頁/.test(listing.html); diag.pagination={verified_unnecessary:noPagination};
    if(!noPagination) throw new Error('pagination_end_condition_unverified');
    decision='pass'; reason='machine_contract_verified';
  }catch(e){reason=e.message||reason;}
  const retryable=decision==='blocked'&&isAmbiguousReason(reason)&&attempt<MAX_ATTEMPTS;
  const result={schema_version:1,methodology:'institutional-accumulation-official-disclosure-source-collection-v1',outcome_blind:true,started_at:started,completed_at:new Date().toISOString(),decision,reason,attempt_count:attempt,retryable,terminal_state:decision==='blocked'&&isAmbiguousReason(reason)&&attempt>=MAX_ATTEMPTS?'manual_review':null,diagnostics:diag}; write(result); console.log(JSON.stringify(result,null,2)); if(decision!=='pass') process.exitCode=2;
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={blocked,isAmbiguousReason,MAX_ATTEMPTS};
