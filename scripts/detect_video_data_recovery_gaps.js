'use strict';
// Read-only research detector: never dispatch, write data, or imply source verification.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const contract=JSON.parse(fs.readFileSync(path.join(root,'config/research/video-data-recovery-contract-v1.json'),'utf8'));
function inspect(contract,readJson,date){
 if(!/^20\d{6}$/.test(date))throw Error('Invalid YYYYMMDD date');
 if(!Array.isArray(contract.required)||!contract.required.length)throw Error('Empty required contract');
 const seen=new Set(),items=[];
 for(const f of contract.required){
  if(!f.id||seen.has(f.id)||!f.path||!f.json_path)throw Error('Invalid or duplicate contract field');
  seen.add(f.id);
  const file=f.path.replaceAll('{date}',date);let obj,reason=null;
  try{obj=readJson(file)}catch(e){reason='SOURCE_FILE_UNAVAILABLE'}
  let value=obj;
  if(!reason){
   if(obj.target_date!==date){reason='STALE_DATA_FAILED';value=undefined}
   else for(const key of f.json_path.split('.'))value=value?.[key];
  }
  if(!reason&&(value===undefined||value===null||typeof value==='number'&&!Number.isFinite(value)))reason='MISSING';
  // A field's presence is not proof of its official provenance. Keep field-level status conservative.
  let status=reason||'PRESENT_UNVERIFIED';
  if(!reason&&f.id.startsWith('breadth_')&&obj.breadth?.verified_twse_common_stock_only!==true)status='CLASSIFICATION_UNVERIFIED';
  if(!reason&&['foreign_net','trust_net','dealers_net'].includes(f.id)){
   const group={foreign_net:'foreign',trust_net:'investment_trust',dealers_net:'dealers'}[f.id],v=obj.institutional?.[group];
   if(v?.source_date!==date||v?.unit!=='TWD'||v?.market_scope!=='TWSE'||!Number.isSafeInteger(v?.buy_twd)||!Number.isSafeInteger(v?.sell_twd)||v.buy_twd-v.sell_twd!==v.net_twd)status='PROVENANCE_OR_ARITHMETIC_INVALID';
  }
  items.push({id:f.id,path:file,json_path:f.json_path,status,recovery:f.recovery,source:f.source});
 }
 return {contract_id:contract.contract_id,contract_version:contract.schema_version,date,mode:'READ_ONLY_NO_DISPATCH',status:items.every(x=>x.status==='PRESENT_UNVERIFIED')?'PRESENT_REQUIRES_EDITORIAL_GATE':'BLOCKED',items,missing_or_invalid:items.filter(x=>x.status!=='PRESENT_UNVERIFIED'),note:'Presence is not source verification; unconditional editorial gate remains independent.'};
}
if(require.main===module){
 const date=process.argv[2]||contract.target_date;
 const result=inspect(contract,p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),date);
 console.log(JSON.stringify(result,null,2));
 if(result.status==='BLOCKED')process.exitCode=1;
}
module.exports={inspect};
