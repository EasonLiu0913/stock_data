'use strict';
const fs=require('node:fs');
const https=require('node:https');
const crypto=require('node:crypto');
const path=require('node:path');
const SOURCES=Object.freeze({
 bfi82u:{url:'https://www.twse.com.tw/rwd/zh/fund/BFI82U?dayDate=20261008&response=json',date:'20261008'},
 fmtqik:{url:'https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date=20261008&response=json',date:'20261008'},
 bfiamu:{url:'https://www.twse.com.tw/rwd/zh/afterTrading/BFIAMU?date=20261008&response=json',date:'20261008'}
});
function fetchOriginal(url,timeoutMs=20000){
 return new Promise((resolve,reject)=>{
  const request=https.get(url,{headers:{'User-Agent':'stock-data-M2-research/1.0','Accept':'application/json'},timeout:timeoutMs},res=>{
   if(res.statusCode!==200){res.resume();reject(new Error('official endpoint HTTP '+res.statusCode));return;}
   const chunks=[];let length=0;
   res.on('data',b=>{length+=b.length;if(length>15000000){request.destroy(new Error('source too large'));return;}chunks.push(b);});
   res.on('end',()=>resolve({bytes:Buffer.concat(chunks),status:res.statusCode,contentType:res.headers['content-type']||''}));
   res.on('error',reject);
  });request.on('timeout',()=>request.destroy(new Error('official endpoint timeout')));request.on('error',reject);
 });
}
function validatePayload(bytes,source,date){
 let obj;try{obj=JSON.parse(bytes.toString('utf8'));}catch{throw Error('not JSON; source not authenticated');}
 if(!obj||typeof obj!=='object'||!Array.isArray(obj.data)&&!Array.isArray(obj.tables))throw Error('unrecognized TWSE payload schema');
 if(obj.stat && obj.stat!=='OK')throw Error('TWSE stat '+obj.stat);
 // Endpoint-specific date location and effective-date meaning are not uniformly guaranteed.
 // Unresolved report date is deliberately not certified from request URL alone.
 const reported=String(obj.date??obj.reportDate??'');
 const normalized=reported.replace(/[^0-9]/g,'');
 const dateVerified=normalized===date;
 return {reportedDate:reported||null,dateVerified,requiresIndependentScopeValidation:true};
}
async function main(){
 const [name,outputDir]=process.argv.slice(2);
 if(!SOURCES[name]||!outputDir)throw Error('Usage: node scripts/capture_twse_m2_primary_source.js bfi82u|fmtqik|bfiamu OUTPUT_DIRECTORY');
 const cfg=SOURCES[name];
 const result=await fetchOriginal(cfg.url);
 const check=validatePayload(result.bytes,name,cfg.date);
 const hash=crypto.createHash('sha256').update(result.bytes).digest('hex');
 fs.mkdirSync(outputDir,{recursive:true});
 const basename=cfg.date+'-'+name;
 const raw=path.join(outputDir,basename+'.json');
 const manifest=path.join(outputDir,basename+'.manifest.json');
 if(fs.existsSync(raw)||fs.existsSync(manifest))throw Error('existing capture: refusing overwrite');
 fs.writeFileSync(raw,result.bytes,{flag:'wx'});
 const record={source:name,targetDate:cfg.date,url:cfg.url,observedAt:new Date().toISOString(),sha256:hash,bytes:result.bytes.length,httpStatus:result.status,contentType:result.contentType,...check,scopeVerified:false,publicationAuthorized:false,archiveType:'original_http_response'};
 fs.writeFileSync(manifest,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({raw,manifest,...record},null,2));
 if(!check.dateVerified)process.exitCode=2;
}
module.exports={validatePayload,SOURCES};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
