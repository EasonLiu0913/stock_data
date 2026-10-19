'use strict';
// Research-only bounded BFI82U recovery. No overwrite, no production writes or publication.
const fs=require('node:fs'),path=require('node:path');
const {build}=require('./research_official_data_manifest_v1');
const {archive,fetchOfficial}=require('./research_date_to_video_bfi82u_archive');
async function recover(root,date,{fetcher=fetchOfficial,maxAttempts=2}={}){
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw Error('INVALID_BOUNDED_ATTEMPTS');
 const before=build(root,date),entry=before.entries[0];
 if(entry.status==='VERIFIED_RESEARCH_ONLY')return {status:'REUSED_VERIFIED_ARCHIVE',attempts:0,manifest:before,publication_authorized:false};
 if(entry.status==='INVALID_ARCHIVE')return {status:'INVALID_ARCHIVE_MANUAL_REVIEW',attempts:0,reason:entry.reason,manifest:before,publication_authorized:false};
 const prefix=path.join(root,'data_research/twse-market-opening/primary-archive',date,date+'-bfi82u');
 if(fs.existsSync(prefix+'.json')||fs.existsSync(prefix+'.manifest.json'))return {status:'INCOMPLETE_ARCHIVE_MANUAL_REVIEW',attempts:0,manifest:before,publication_authorized:false};
 const registered=JSON.parse(fs.readFileSync(path.join(root,'config/research/official-data-registry-v1.json'),'utf8')).sources.find(s=>s.id==='BFI82U');
 if(registered?.archiver!=='scripts/research_date_to_video_bfi82u_archive.js'||registered?.endpoint_template!=='https://www.twse.com.tw/rwd/zh/fund/BFI82U?type=day&dayDate={YYYYMMDD}&response=json')throw Error('UNAPPROVED_RECOVERY_SOURCE');
 let reason='OFFICIAL_FETCH_UNAVAILABLE';
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  try{
   const response=await fetcher(date);
   archive(root,date,response.bytes,response.meta);
   const after=build(root,date);
   if(after.entries[0].status!=='VERIFIED_RESEARCH_ONLY')throw Error('POST_ARCHIVE_VERIFICATION_FAILED');
   return {status:'RECOVERED_VERIFIED_ARCHIVE',attempts:attempt,manifest:after,publication_authorized:false};
  }catch(e){
   reason=e.message;
   if(fs.existsSync(prefix+'.json')||fs.existsSync(prefix+'.manifest.json'))return {status:'ARCHIVE_REVIEW_REQUIRED',attempts:attempt,reason,manifest:build(root,date),publication_authorized:false};
   if(!/^(OFFICIAL_FETCH_UNAVAILABLE|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|OFFICIAL_HTTP_RESPONSE_REQUIRED)$/.test(reason))break;
  }
 }
 return {status:'WAITING_SOURCE',attempts:Math.min(maxAttempts,reason==='OFFICIAL_FETCH_UNAVAILABLE'?maxAttempts:maxAttempts),reason,manifest:build(root,date),publication_authorized:false};
}
if(require.main===module){recover(process.argv[3]||'.',process.argv[2]).then(x=>{console.log(JSON.stringify(x,null,2));if(!['REUSED_VERIFIED_ARCHIVE','RECOVERED_VERIFIED_ARCHIVE'].includes(x.status))process.exitCode=1}).catch(e=>{console.error(e.message);process.exitCode=1});}
module.exports={recover};
