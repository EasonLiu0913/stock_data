'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const contract=require('../data_research/twse-market-opening/20261008-official-query-contract-from-pilot1.json');
const urls=contract.next_pilot.allowlisted_script_urls;
async function main(){const dir=process.argv[2]||'output/twse-query-js-contract';fs.mkdirSync(dir,{recursive:true});const entries=[];
for(let i=0;i<urls.length;i++){const url=urls[i],ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);try{
 const r=await fetch(url,{signal:ctrl.signal,redirect:'error',headers:{accept:'application/javascript, text/javascript, */*'}});
 if(!r.ok)throw Error('HTTP_'+r.status);
 const b=[];let n=0;for await(const chunk of r.body){n+=chunk.length;if(n>1048576)throw Error('OVER_1_MIB');b.push(Buffer.from(chunk))}
 const raw=Buffer.concat(b);const name='script-'+(i+1)+'.raw.js';fs.writeFileSync(path.join(dir,name),raw);
 entries.push({url,file:name,status:r.status,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex'),request_contract_verified:false,pagination_verified:false,total_count_verified:false});
 }catch(e){entries.push({url,error:String(e.message||e),request_contract_verified:false,pagination_verified:false,total_count_verified:false})}finally{clearTimeout(timer)}}
 const report={source_pilot:37985583586,phase:'JS_ASSET_CAPTURE_ONLY',entries,result:'BLOCKED',m1_decision:'BLOCKED_ON_HISTORICAL_MASTER_PROVENANCE',query_executed:false,complete_event_ledger_proved:false,production_authorized:false,prompt_b_eligible:false};
 fs.writeFileSync(path.join(dir,'js-contract-research.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({scripts_acquired:entries.filter(x=>x.sha256).length,script_errors:entries.filter(x=>x.error).length,result:report.result}));if(entries.some(x=>x.error))process.exitCode=1;}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
