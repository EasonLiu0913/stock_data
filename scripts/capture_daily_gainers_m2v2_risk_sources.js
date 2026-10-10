'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const contract=require('../data_research/twse-market-opening/20261008-m2v2-official-risk-endpoint-contract.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function capture(fetchImpl=fetch,outDir=process.argv[2]||'./m2-risk-raw'){
 fs.mkdirSync(outDir,{recursive:true});
 const results=[];
 for(const src of contract.sources){
  const name=src.type.toLowerCase();
  const manifest={date:contract.date,source:src.type,request_url:src.url,queried_at:new Date().toISOString(),http_response_verified:false,date_scoped_complete:false,negative_clearance_certified:false,publication_authorized:false};
  try{
   const response=await fetchImpl(src.url,{headers:{'User-Agent':'Mozilla/5.0 M2ResearchEvidence/1.0','Accept':'application/json'},signal:AbortSignal.timeout(20000)});
   const bytes=Buffer.from(await response.arrayBuffer());
   manifest.http_status=response.status;
   manifest.content_type=response.headers.get('content-type');
   manifest.sha256=hash(bytes);
   manifest.byte_length=bytes.length;
   fs.writeFileSync(path.join(outDir,name+'.raw'),bytes);
   let obj;
   try{obj=JSON.parse(bytes.toString('utf8'));}catch{manifest.error='NOT_JSON';}
   if(obj){
    manifest.api_status=obj.stat??obj.status??null;
    manifest.data_rows=Array.isArray(obj.data)?obj.data.length:null;
    manifest.field_names=Array.isArray(obj.fields)?obj.fields:null;
    manifest.http_response_verified=response.ok&&Array.isArray(obj.data);
    if(!manifest.http_response_verified)manifest.error='UNVERIFIED_RESPONSE_SCHEMA_OR_HTTP_STATUS';
   }
  }catch(e){manifest.error=String(e&&e.message||e);}
  fs.writeFileSync(path.join(outDir,name+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  results.push(manifest);
 }
 return {date:contract.date,results,verified_clearance_codes:[],publication_authorized:false,prompt_a_complete:false};
}
if(require.main===module)capture().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1});
module.exports={capture};
