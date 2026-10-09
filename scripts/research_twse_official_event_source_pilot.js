'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCES=[
 {id:'circulars',url:'https://dsp.twse.com.tw/official/search',hints:['公文通函','依日期查詢']},
 {id:'share_changes',url:'https://www.twse.com.tw/zh/focus/lt185-dtr.html',hints:['公告日期','生效日期']},
 {id:'notices',url:'https://www.twse.com.tw/zh/announcement/announcement/list.html',hints:['公文公告','關鍵字']}
];
const MAX_BYTES=1024*1024, TIMEOUT_MS=15000;
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function inspect(bytes,source,status,contentType){
 const html=bytes.toString('utf8');
 const hints=source.hints.map(x=>({text:x,present:html.includes(x)}));
 return {id:source.id,url:source.url,http_status:status,content_type:contentType,bytes:bytes.length,sha256:sha(bytes),hints,query_contract_verified:false,pagination_parameters_verified:false,server_total_count_verified:false,effective_date_exhaustiveness_verified:false,classification:'SOURCE_PAGE_ONLY'};
}
async function fetchBounded(source,outputDir,fetcher=fetch){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  const response=await fetcher(source.url,{redirect:'error',signal:controller.signal,headers:{'user-agent':'stock-data-research-bounded/1.0','accept':'text/html'}});
  const mime=response.headers.get('content-type')||'';
  if(!response.ok)throw Error('HTTP_'+response.status);
  if(!mime.toLowerCase().includes('text/html'))throw Error('UNEXPECTED_CONTENT_TYPE');
  const len=Number(response.headers.get('content-length')||0);
  if(len>MAX_BYTES)throw Error('RESPONSE_TOO_LARGE');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.byteLength;if(size>MAX_BYTES)throw Error('RESPONSE_TOO_LARGE');chunks.push(Buffer.from(chunk));}
  const bytes=Buffer.concat(chunks);const metadata=inspect(bytes,source,response.status,mime);
  fs.writeFileSync(path.join(outputDir,source.id+'.raw.html'),bytes);
  return metadata;
 }catch(err){return {id:source.id,url:source.url,error:String(err.message||err),query_contract_verified:false,pagination_parameters_verified:false,server_total_count_verified:false,effective_date_exhaustiveness_verified:false,classification:'ACQUISITION_FAILED'};}
 finally{clearTimeout(timer);}
}
async function main(){
 const out=process.argv[2]||'output/twse-official-event-source-pilot';fs.mkdirSync(out,{recursive:true});
 const results=[];for(const source of SOURCES)results.push(await fetchBounded(source,out));
 const report={schema_version:1,research_only:true,run_date:new Date().toISOString(),target_window:['20261008','20261010'],sources:results,limits:{max_response_bytes:MAX_BYTES,timeout_ms:TIMEOUT_MS,allowlisted_sources:SOURCES.map(s=>s.url),requests_per_source:1,any_result_api_invoked:false,all_pages_enumerated:false,raw_result_export_captured:false,issued_before_window_effective_in_window_covered:false},result:'BLOCKED',m1_decision:'BLOCKED_ON_HISTORICAL_MASTER_PROVENANCE',production_authorized:false,prompt_b_eligible:false,next:'Discover official query result contracts and complete effective-dated results without inventing HTTP parameters'};
 fs.writeFileSync(path.join(out,'research-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({result:report.result,downloaded:results.filter(x=>x.sha256).length,failed:results.filter(x=>x.error).length,total:results.length}));
 if(results.some(x=>x.error))process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={SOURCES,inspect,sha,MAX_BYTES};
