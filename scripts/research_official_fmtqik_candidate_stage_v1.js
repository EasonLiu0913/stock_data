'use strict';
// Research-only, caller-supplied FMTQIK HTTP candidate. No network fetch, source approval or Master promotion.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https');
const {inspectCandidate}=require('./research_official_fmtqik_raw_candidate_v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function stage(root,date,bytes,meta){
 const result=inspectCandidate(bytes,date);
 if(result.status!=='CANDIDATE_TABLE_SHAPE_ONLY_CONTRACT_REVIEW_REQUIRED')throw Error('FMTQIK_CANDIDATE_REJECTED:'+result.reason);
 if(meta?.httpStatus!==200||!/^application\/json\b/i.test(meta.contentType||''))throw Error('CANDIDATE_HTTP_METADATA_REQUIRED');
 if(typeof meta.sourceUrl!=='string')throw Error('CANDIDATE_TWSE_URL_REQUIRED');
 let url;try{url=new URL(meta.sourceUrl);}catch{throw Error('CANDIDATE_TWSE_URL_REQUIRED');}
 if(url.protocol!=='https:'||url.hostname!=='www.twse.com.tw'||url.port||url.username||url.password||url.hash||url.pathname!=='/rwd/zh/afterTrading/FMTQIK'||url.searchParams.get('date')!==date||url.searchParams.get('response')!=='json'||[...url.searchParams].length!==2||[...url.searchParams.keys()].some(k=>!['date','response'].includes(k)))throw Error('CANDIDATE_DATED_FMTQIK_URL_REQUIRED');
 if(typeof meta.observedAt!=='string'||!Number.isFinite(Date.parse(meta.observedAt)))throw Error('CANDIDATE_OBSERVATION_TIME_REQUIRED');
 const dir=path.join(root,'fmtqik-candidate',date),raw=path.join(dir,'response.json'),manifestPath=path.join(dir,'candidate-manifest.json');
 if(fs.existsSync(raw)||fs.existsSync(manifestPath))throw Error('CANDIDATE_ALREADY_EXISTS_REVIEW_REQUIRED');
 const manifest={contract:'FMTQIK_STAGED_HTTP_CANDIDATE_V1',target_date:date,source_url_unapproved:meta.sourceUrl,observed_at:meta.observedAt,http_status:meta.httpStatus,content_type:meta.contentType,sha256:sha(bytes),bytes:bytes.length,candidate_inspection:result,http_metadata_evidence:'CALLER_SUPPLIED_UNVERIFIED',source_contract_review_required:true,endpoint_approved:false,raw_http_provenance_certified:false,master_authorized:false,render_authorized:false,publication_authorized:false};
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(raw,bytes,{flag:'wx'});
 try{fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});}catch(e){fs.unlinkSync(raw);throw e;}
 return {status:'STAGED_CANDIDATE_REVIEW_REQUIRED',target_date:date,sha256:manifest.sha256,raw_path:raw,manifest_path:manifestPath,master_authorized:false,publication_authorized:false};
}
async function fetchAndStage(root,date){
 const captured=await fetchCandidate(date);
 const staged=stage(root,date,captured.bytes,captured.meta);
 // Separate direct-fetch receipt from the caller-supplied candidate manifest. Neither certifies the endpoint.
 const receipt={contract:'FMTQIK_DIRECT_FETCH_RECEIPT_RESEARCH_V1',target_date:date,request_url:captureUrl(date),observed_at:captured.meta.observedAt,http_status:captured.meta.httpStatus,content_type:captured.meta.contentType,response_sha256:sha(captured.bytes),response_bytes:captured.bytes.length,capture_method:'NODE_HTTPS_GET',independently_attested:false,source_contract_review_required:true,raw_http_provenance_certified:false,endpoint_approved:false,master_authorized:false,render_authorized:false,publication_authorized:false};
 const receiptPath=path.join(root,'fmtqik-candidate',date,'direct-fetch-receipt.json');
 fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 return {...staged,receipt_path:receiptPath,capture_path:'DIRECT_TWSE_HTTPS_FETCH_CANDIDATE_ONLY',source_contract_review_required:true,raw_http_provenance_certified:false};
}
function captureUrl(date){return 'https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date='+date+'&response=json';}
function fetchCandidate(date){
 inspectCandidate(Buffer.from('{"fields":["日期","成交金額"],"data":[]}'),date); // validate date without staging
 const sourceUrl=captureUrl(date);
 return new Promise((resolve,reject)=>{
  const request=https.get(sourceUrl,{timeout:12000,headers:{Accept:'application/json','User-Agent':'stock-data-research/1.0'}},res=>{
   const chunks=[];let size=0;res.on('data',b=>{size+=b.length;if(size>1024*1024){res.destroy(Error('CANDIDATE_RESPONSE_TOO_LARGE'));return;}chunks.push(b);});
   res.on('error',reject);res.on('end',()=>resolve({bytes:Buffer.concat(chunks),meta:{httpStatus:res.statusCode,contentType:res.headers['content-type']||'',sourceUrl,observedAt:new Date().toISOString()}}));
  });request.on('timeout',()=>request.destroy(Error('CANDIDATE_FETCH_TIMEOUT')));request.on('error',reject);
 });
}
if(require.main===module){const [date,out]=process.argv.slice(2);if(!out||!path.isAbsolute(out)||path.resolve(out)==='/'){console.error('EXTERNAL_ABSOLUTE_ISOLATED_OUTPUT_REQUIRED');process.exitCode=2;}else fetchAndStage(out,date).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={stage,fetchCandidate,fetchAndStage};
