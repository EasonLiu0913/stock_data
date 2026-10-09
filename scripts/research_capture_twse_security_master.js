#!/usr/bin/env node
'use strict';
// Research-only official-source capture; NEVER certifies historical common-stock identity.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCES=Object.freeze({
 isin_listed:{url:'https://isin.twse.com.tw/isin/e_C_public.jsp?strMode=2',kind:'html'},
 listed_companies:{url:'https://openapi.twse.com.tw/v1/opendata/t187ap03_L',kind:'json'},
 recent_listings:{url:'https://www.twse.com.tw/rwd/zh/company/newlisting?response=json',kind:'json'}
});
function validDate(s){if(!/^20\d{6}$/.test(s||''))return false;const y=+s.slice(0,4),m=+s.slice(4,6),d=+s.slice(6);return new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===y+'-'+s.slice(4,6)+'-'+s.slice(6);}
function sha(b){return crypto.createHash('sha256').update(b).digest('hex');}
function publisherDate(html){const m=html.match(/Date\s+Stock\s+Updated\s*[:：]\s*(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/i);return m?m[1]+m[2].padStart(2,'0')+m[3].padStart(2,'0'):null;}
function assess({date,sourceName,bytes,status,contentType,acquiredAt,sourceUrl}){
 const spec=SOURCES[sourceName];if(!spec)throw Error('UNKNOWN_SOURCE');
 const hash=sha(bytes),type=String(contentType||'').toLowerCase();
 const decoded=bytes.toString('utf8');const issues=[];
 if(status!==200)issues.push('HTTP_NOT_200');
 if(!bytes.length)issues.push('EMPTY_SOURCE');
 if(bytes.length>8_000_000)issues.push('SOURCE_OVERSIZE');
 if(spec.kind==='json'){
  if(!/json/.test(type))issues.push('UNEXPECTED_CONTENT_TYPE');
  try{const p=JSON.parse(decoded);if(!Array.isArray(p)&&!p?.data&&!p?.tables)issues.push('UNKNOWN_JSON_SHAPE');}
  catch{issues.push('INVALID_JSON');}
 }else{
  if(!/html/.test(type))issues.push('UNEXPECTED_CONTENT_TYPE');
  if(!/ISIN|證券|Security Code|證券代號/i.test(decoded))issues.push('UNRECOGNIZED_ISIN_HTML');
 }
 const dateUpdated=sourceName==='isin_listed'?publisherDate(decoded):null;
 if(sourceName==='isin_listed'&&!dateUpdated)issues.push('MISSING_PUBLISHER_UPDATE_DATE');
 if(dateUpdated!==null&&dateUpdated!==date)issues.push('SOURCE_DATE_NOT_TARGET');
 // Unlike a snapshot captured on its original date, later retrieval never proves history.
 if(acquiredAt.slice(0,10).replaceAll('-','')!==date)issues.push('ACQUISITION_DATE_NOT_TARGET');
 if(sourceUrl!==spec.url)issues.push('SOURCE_URL_MISMATCH');
 return {source:sourceName,url:spec.url,target_date:date,publisher_updated_date:dateUpdated,
  acquired_at:acquiredAt,http_status:status,content_type:type,bytes:bytes.length,sha256:hash,
  fetch_ok:status===200&&bytes.length>0,archive_sha_ok:true,
  publisher_date_ok:dateUpdated===null?'UNVERIFIED':dateUpdated===date?'PASS':'BLOCKED',
  date_effective_coverage_ok:'BLOCKED',type_coverage_ok:'BLOCKED',
  evidence_status:issues.length?'BLOCKED':'CAPTURED_UNVERIFIED',issues};
}
async function collect({date,dir,fetcher=fetch,now=()=>new Date().toISOString()}){
 if(!validDate(date))throw Error('INVALID_TARGET_DATE');
 fs.mkdirSync(dir,{recursive:true});const raws=path.join(dir,'raw');fs.mkdirSync(raws,{recursive:true});
 const sources=[],sourceErrors=[];
 for(const [name,spec] of Object.entries(SOURCES)){
  let response,bytes=null,status=0,type='',acquiredAt=now();
  try{
   response=await fetcher(spec.url,{headers:{Accept:spec.kind==='json'?'application/json':'text/html'},signal:AbortSignal.timeout(name==='isin_listed'?30000:12000)});
   status=response.status;type=response.headers.get('content-type')||'';
   const len=Number(response.headers.get('content-length')||0);
   if(len>8_000_000)throw Error('SOURCE_OVERSIZE');
   bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length>8_000_000)throw Error('SOURCE_OVERSIZE');
   const rec=assess({date,sourceName:name,bytes,status,contentType:type,acquiredAt,sourceUrl:spec.url});
   if(status===200&&bytes.length){const filename=name+'.'+spec.kind;fs.writeFileSync(path.join(raws,filename),bytes,{flag:'wx'});rec.original_path='raw/'+filename;}
   sources.push(rec);
  }catch(e){sourceErrors.push({source:name,error:String(e.message||e)});sources.push({source:name,url:spec.url,target_date:date,evidence_status:'BLOCKED',issues:['FETCH_FAILED'],error:String(e.message||e)});}
 }
 const result={schema_version:1,project:'daily-gainers-market-opening-end-to-end',scope:'RESEARCH_ONLY',
  target_date:date,manifest_generated_at:now(),sources,source_errors:sourceErrors,
  quote_reconciliation_ok:'NOT_RUN',rights_review_ok:'UNVERIFIED',historical_master_complete:false,
  publication_authorized:false,phase_m1_accepted:false,
  decision:'BLOCKED',reason:'OFFICIAL_DATE_EFFECTIVE_SECURITY_MASTER_UNVERIFIED'};
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(dir,'research-report.json'),JSON.stringify({target_date:date,decision:result.decision,sources:sources.map(({source,evidence_status,issues,sha256,publisher_updated_date})=>({source,evidence_status,issues,sha256,publisher_updated_date}))},null,2)+'\n',{flag:'wx'});
 return result;
}
async function main(args=process.argv.slice(2)){
 const [date,out]=args;if(!date||!out)throw Error('Usage: node scripts/research_capture_twse_security_master.js YYYYMMDD OUTPUT_DIR');
 const report=await collect({date,dir:out});console.log(JSON.stringify({decision:report.decision,target_date:date,sources:report.sources.map(x=>({name:x.source,state:x.evidence_status,issues:x.issues,error:x.error||null,http_status:x.http_status??null,publisher_updated_date:x.publisher_updated_date??null,sha256:x.sha256||null}))}));
 if(report.sources.some(x=>x.evidence_status==='BLOCKED'||x.issues?.length))process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error('RESEARCH_CAPTURE_FAILED:'+e.message);process.exitCode=1;});
module.exports={SOURCES,validDate,publisherDate,sha,assess,collect};
