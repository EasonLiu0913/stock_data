'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const URL='https://www.twse.com.tw/res/js/main.js';
const OUTPUT=process.argv[2]||'output/twse-main-js-provenance';
const timeout=15000,cap=1024*1024;
function assignments(js){
 const patterns={apiHostRwd:[/\bapiHost\s*:\s*\{[^}]{0,400}\brwd\s*:\s*(['"`])([^'"`]+)\1/g,/\b(?:cfg\.)?apiHost\.rwd\s*=\s*(['"`])([^'"`]+)\1/g],language:[/\b(?:cfg\.)?lan\s*=\s*(['"`])([^'"`]+)\1/g,/\blan\s*:\s*(['"`])([^'"`]+)\1/g]};
 return Object.fromEntries(Object.entries(patterns).map(([k,ps])=>[k,ps.flatMap(p=>[...js.matchAll(p)].map(m=>({value:m[2],index:m.index})).slice(0,20))]));
}
async function main(){fs.mkdirSync(OUTPUT,{recursive:true});const report={source_url:URL,source_provenance:'LINKED_BY_TWSE_LT185_HTML',downloaded:false,static_assignments:{apiHostRwd:[],language:[]},runtime_configuration_verified:false,query_executed:false,all_pages_verified:false,result:'BLOCKED',m1_decision:'BLOCKED_ON_HISTORICAL_MASTER_PROVENANCE',prompt_b_eligible:false,production_authorized:false};
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
 try{const res=await fetch(URL,{signal:ctl.signal,redirect:'error',headers:{accept:'application/javascript, text/javascript, */*'}});if(!res.ok)throw Error('HTTP_'+res.status);const chunks=[];let size=0;for await(const b of res.body){size+=b.byteLength;if(size>cap)throw Error('RESPONSE_TOO_LARGE');chunks.push(Buffer.from(b))}const raw=Buffer.concat(chunks);
 fs.writeFileSync(path.join(OUTPUT,'main.raw.js'),raw);const content=raw.toString('utf8');report.downloaded=true;report.bytes=raw.length;report.sha256=crypto.createHash('sha256').update(raw).digest('hex');report.http_status=res.status;report.content_type=res.headers.get('content-type');report.static_assignments=assignments(content);report.static_assignment_found=report.static_assignments.apiHostRwd.length>0||report.static_assignments.language.length>0;report.reason='STATIC_CODE_NOT_EXECUTED_NO_RUNTIME_HOST_OR_RESULT_LEDGER_CERTIFICATION';
 }catch(e){report.error=String(e.message||e);report.reason='OFFICIAL_MAIN_JS_ACQUISITION_FAILED';process.exitCode=1;}finally{clearTimeout(timer)}
 fs.writeFileSync(path.join(OUTPUT,'provenance.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({downloaded:report.downloaded,sha256:report.sha256||null,assignment_count:report.static_assignments.apiHostRwd.length,locale_assignment_count:report.static_assignments.language.length,result:report.result}));}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});module.exports={assignments};
