'use strict';
// Explicit-date, research-only official TWSE BFI82U fetch and atomic archive; no main/production writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https');
const {verify}=require('./research_date_to_video_bfi82u_v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function validDate(date){return /^20\d{6}$/.test(date||'')&&Number.isFinite(Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z'))&&new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z').toISOString().slice(0,10)===date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)}
function archive(root,date,bytes,meta){
 if(!validDate(date))throw Error('INVALID_TARGET_DATE');
 if(meta.httpStatus!==200||!/^application\/json\b/i.test(meta.contentType||''))throw Error('OFFICIAL_HTTP_RESPONSE_REQUIRED');
 if(meta.sourceUrl!==`https://www.twse.com.tw/rwd/zh/fund/BFI82U?type=day&dayDate=${date}&response=json`)throw Error('OFFICIAL_SOURCE_URL_MISMATCH');
 const p=JSON.parse(bytes.toString('utf8'));
 const manifest={source:'bfi82u',targetDate:date,url:meta.sourceUrl,observedAt:meta.observedAt,sha256:sha(bytes),bytes:bytes.length,httpStatus:meta.httpStatus,contentType:meta.contentType,reportedDate:p.date,dateVerified:p.date===date,requiresIndependentScopeValidation:true,scopeVerified:false,publicationAuthorized:false,archiveType:'original_http_response'};
 verify(bytes,manifest,date); // reject stale dates, malformed rows, arithmetic and aggregate mismatches before writing
 const dir=path.join(root,'data_research/twse-market-opening/primary-archive',date),prefix=path.join(dir,date+'-bfi82u');
 if(fs.existsSync(prefix+'.json')||fs.existsSync(prefix+'.manifest.json'))throw Error('ARCHIVE_ALREADY_EXISTS_REVIEW_BEFORE_REPLACEMENT');
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(prefix+'.json',bytes,{flag:'wx'});
 try{fs.writeFileSync(prefix+'.manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});}catch(e){fs.unlinkSync(prefix+'.json');throw e;}
 return {target_date:date,raw_sha256:manifest.sha256,raw_path:prefix+'.json',manifest_path:prefix+'.manifest.json',status:'VERIFIED_RESEARCH_ARCHIVE',publication_authorized:false};
}
function fetchOfficial(date){if(!validDate(date))return Promise.reject(Error('INVALID_TARGET_DATE'));return new Promise((resolve,reject)=>{
 const url=`https://www.twse.com.tw/rwd/zh/fund/BFI82U?type=day&dayDate=${date}&response=json`;
 https.get(url,{headers:{Accept:'application/json','User-Agent':'stock-data-research/1.0'}},res=>{
  const chunks=[];let size=0;res.on('data',b=>{size+=b.length;if(size>1024*1024){res.destroy(Error('RESPONSE_TOO_LARGE'));return;}chunks.push(b)});
  res.on('error',reject);res.on('end',()=>resolve({bytes:Buffer.concat(chunks),meta:{httpStatus:res.statusCode,contentType:res.headers['content-type']||'',sourceUrl:url,observedAt:new Date().toISOString()}}));
 }).on('error',reject);
});}
if(require.main===module){const date=process.argv[2],root=process.argv[3]||'.';if(!validDate(date)){console.error('Usage: node scripts/research_date_to_video_bfi82u_archive.js YYYYMMDD [repo-root]');process.exitCode=2;}else fetchOfficial(date).then(x=>console.log(JSON.stringify(archive(root,date,x.bytes,x.meta),null,2))).catch(e=>{console.error(e.message);process.exitCode=1});}
module.exports={archive,fetchOfficial};
