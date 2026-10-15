'use strict';
// Pure read-only recovery planner. It never invokes GitHub or changes source data.
function plan(report,allowlist={}){
 if(report?.mode!=='READ_ONLY_NO_DISPATCH'||!Array.isArray(report.items))throw Error('Untrusted detector report');
 const groups=new Map();
 for(const f of report.items){
  if(f.status==='PRESENT_UNVERIFIED')continue;
  const mapping=allowlist[f.id];
  const approved=mapping?.verified_data_only===true&&mapping?.side_effect_audit==='PASS'&&mapping?.input_date==='date'&&typeof mapping?.workflow_path==='string'&&mapping.workflow_path.startsWith('.github/workflows/');
  const key=approved?mapping.workflow_path:'BLOCKED:'+f.id;
  if(!groups.has(key))groups.set(key,{workflow_path:approved?mapping.workflow_path:null,fields:[],decision:'BLOCKED',reason:'NO_VERIFIED_SAFE_DATA_ONLY_WORKFLOW'});
  const g=groups.get(key);g.fields.push({id:f.id,status:f.status});
  // A mapping is not authorization. A planner can only suggest a dry-run candidate.
  if(approved) {
   g.decision='DRY_RUN_CANDIDATE_ONLY';g.reason='REQUIRES_RUN_DEDUPLICATION_AND_EXPLICIT_AUTHORIZATION';
  }
 }
 return {date:report.date,mode:'PLAN_ONLY_NO_DISPATCH',status:groups.size?'BLOCKED':'NO_GAPS_REQUIRES_EDITORIAL_GATE',actions:[...groups.values()]};
}
if(require.main===module){
 const fs=require('node:fs');
 const report=JSON.parse(fs.readFileSync(0,'utf8'));
 console.log(JSON.stringify(plan(report),null,2));
}
module.exports={plan};
