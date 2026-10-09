'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ENDPOINT='https://www.twse.com.tw/rwd/zh/announcement/LT185';
const LIMIT=1024*1024, TIMEOUT=15000;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function summarize(data){
 const rows=Array.isArray(data?.data)?data.data.length:null;
 const pages=Array.isArray(data?.tables)?data.tables.map(x=>({rows:Array.isArray(x.data)?x.data.length:null,fields:x.fields||null})):null;
 return {stat:data?.stat??null,status:data?.status??null,state:data?.state??null,total:data?.total??null,rows,pages,fields:data?.fields??null,has_paging:Object.hasOwn(data||{},'paging'),raw_result_complete:false,all_pages_reconciled:false,effective_date_completeness:false};
}
async function main(){
 const dir=process.argv[2]||'output/twse-lt185-bounded-get';fs.mkdirSync(dir,{recursive:true});
 const spec=new URL(ENDPOINT);spec.searchParams.set('response','json');
 const report={schema_version:1,source:'TWSE official LT185 HTML + main.js + web-report.js',url:spec.toString(),limit:{requests:1,max_bytes:LIMIT,timeout_ms:TIMEOUT,redirects:'error'},target_window:['20261008','20261010'],date_filter_request:false,query_mode:'FIRST_SINGLE_UNFILTERED_SCHEMA_PROBE',query_executed:false,source_total_verified:false,all_pages_reconciled:false,effective_date_window_covered:false,event_coverage_complete:false,result:'BLOCKED',m1_decision:'BLOCKED_ON_HISTORICAL_MASTER_PROVENANCE',prompt_b_eligible:false,production_authorized:false};
 const c=new AbortController(),timeout=setTimeout(()=>c.abort(),TIMEOUT);
 try{
   const res=await fetch(spec,{signal:c.signal,redirect:'error',headers:{accept:'application/json'}});
   report.http_status=res.status;report.content_type=res.headers.get('content-type')||'';report.query_executed=true;
   const len=Number(res.headers.get('content-length')||0);if(len>LIMIT)throw Error('CONTENT_LENGTH_EXCEEDS_CAP');
   const chunks=[];let n=0;for await(const chunk of res.body){n+=chunk.byteLength;if(n>LIMIT)throw Error('RAW_RESPONSE_EXCEEDS_CAP');chunks.push(Buffer.from(chunk));}
   const bytes=Buffer.concat(chunks);report.response_bytes=n;report.response_sha256=hash(bytes);
   fs.writeFileSync(path.join(dir,'LT185-first-result.raw'),bytes);
   if(!res.ok)throw Error('HTTP_'+res.status);
   if(!/json/i.test(report.content_type))throw Error('NOT_JSON_CONTENT_TYPE');
   const payload=JSON.parse(bytes.toString('utf8'));report.shape=summarize(payload);
   report.result='BLOCKED';report.reason='ONE_SCHEMA_PROBE_CANNOT_PROVE_DATE_FILTER_OR_FULL_EVENT_COVERAGE';
 }catch(e){report.error=String(e.message||e);report.reason='QUERY_FAILED_OR_INCOMPLETE';process.exitCode=1}
 finally{clearTimeout(timeout)}
 fs.writeFileSync(path.join(dir,'research-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({result:report.result,http_status:report.http_status||null,raw_sha256:report.response_sha256||null,error:report.error||null,total:report.shape?.total??null}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={summarize,ENDPOINT,LIMIT};
