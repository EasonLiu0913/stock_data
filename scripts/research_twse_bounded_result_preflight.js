'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PAGE='https://www.twse.com.tw/zh/focus/lt185-dtr.html';
const MAX=1048576, TIMEOUT=15000;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function bounded(url){const u=new URL(url);if(u.origin!=='https://www.twse.com.tw')throw Error('UNAUTHORIZED_HOST');const controller=new AbortController();const id=setTimeout(()=>controller.abort(),TIMEOUT);try{const res=await fetch(u,{redirect:'error',signal:controller.signal,headers:{accept:'text/html,application/json'}});if(!res.ok)throw Error('HTTP_'+res.status);let n=0;const chunks=[];for await(const c of res.body){n+=c.byteLength;if(n>MAX)throw Error('RESPONSE_TOO_BIG');chunks.push(Buffer.from(c));}return{bytes:Buffer.concat(chunks),status:res.status,type:res.headers.get('content-type')||''};}finally{clearTimeout(id)}}
function evidence(html){const candidates=[...html.matchAll(/(?:apiHost\s*:\s*\{[^}]{0,400}rwd\s*:\s*['"]([^'"]+)['"]|apiHost\.rwd\s*=\s*['"]([^'"]+)['"]|lan\s*:\s*['"](zh|en)['"])/g)].map(x=>x[1]||x[2]||x[3]);return{config_literals:candidates,api_host_rwd_verified:false,language_path_verified:false,reason:'CONFIG_NOT_VERIFIED_FROM_EXECUTED_FIRST_PARTY_SOURCE'};}
async function main(){const dir=process.argv[2]||'output/twse-bounded-result-preflight';fs.mkdirSync(dir,{recursive:true});const report={schema_version:1,target:'20261008',research_only:true,query_executed:false,page_count_reconciled:false,server_total_verified:false,all_effective_date_events_captured:false,request_budget:1,result:'BLOCKED',m1_decision:'BLOCKED_ON_HISTORICAL_MASTER_PROVENANCE',production_authorized:false,prompt_b_eligible:false};
try{const r=await bounded(PAGE);fs.writeFileSync(path.join(dir,'lt185-config-page.raw.html'),r.bytes);report.page={url:PAGE,sha256:sha(r.bytes),bytes:r.bytes.length,status:r.status,content_type:r.type};report.config=evidence(r.bytes.toString('utf8'));}catch(e){report.error=String(e.message||e)}
fs.writeFileSync(path.join(dir,'result-preflight.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({result:report.result,config:report.config?.reason||'FETCH_FAILED',error:report.error||null}));if(report.error)process.exitCode=1;}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={evidence,sha};
