'use strict';
// Research-only, caller-supplied FMTQIK HTTP candidate. No network fetch, source approval or Master promotion.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectCandidate}=require('./research_official_fmtqik_raw_candidate_v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function stage(root,date,bytes,meta){
 const result=inspectCandidate(bytes,date);
 if(result.status!=='CANDIDATE_TABLE_SHAPE_ONLY_CONTRACT_REVIEW_REQUIRED')throw Error('FMTQIK_CANDIDATE_REJECTED:'+result.reason);
 if(meta?.httpStatus!==200||!/^application\/json\b/i.test(meta.contentType||''))throw Error('CANDIDATE_HTTP_METADATA_REQUIRED');
 if(typeof meta.sourceUrl!=='string')throw Error('CANDIDATE_TWSE_URL_REQUIRED');
 let url;try{url=new URL(meta.sourceUrl);}catch{throw Error('CANDIDATE_TWSE_URL_REQUIRED');}
 if(url.protocol!=='https:'||url.hostname!=='www.twse.com.tw'||url.port||url.username||url.password||url.hash||url.pathname!=='/rwd/zh/afterTrading/FMTQIK'||url.searchParams.get('date')!==date||url.searchParams.get('response')!=='json'||[...url.searchParams.keys()].some(k=>!['date','response'].includes(k)))throw Error('CANDIDATE_DATED_FMTQIK_URL_REQUIRED');
 if(typeof meta.observedAt!=='string'||!Number.isFinite(Date.parse(meta.observedAt)))throw Error('CANDIDATE_OBSERVATION_TIME_REQUIRED');
 const dir=path.join(root,'fmtqik-candidate',date),raw=path.join(dir,'response.json'),manifestPath=path.join(dir,'candidate-manifest.json');
 if(fs.existsSync(raw)||fs.existsSync(manifestPath))throw Error('CANDIDATE_ALREADY_EXISTS_REVIEW_REQUIRED');
 const manifest={contract:'FMTQIK_STAGED_HTTP_CANDIDATE_V1',target_date:date,source_url_unapproved:meta.sourceUrl,observed_at:meta.observedAt,http_status:meta.httpStatus,content_type:meta.contentType,sha256:sha(bytes),bytes:bytes.length,candidate_inspection:result,endpoint_approved:false,raw_http_provenance_certified:false,master_authorized:false,render_authorized:false,publication_authorized:false};
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(raw,bytes,{flag:'wx'});
 try{fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});}catch(e){fs.unlinkSync(raw);throw e;}
 return {status:'STAGED_CANDIDATE_REVIEW_REQUIRED',target_date:date,sha256:manifest.sha256,raw_path:raw,manifest_path:manifestPath,master_authorized:false,publication_authorized:false};
}
module.exports={stage};
