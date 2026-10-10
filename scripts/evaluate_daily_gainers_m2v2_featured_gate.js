'use strict';
const fs=require('node:fs');
const {checkPerSecurityFivePercent}=require('./verify_daily_gainers_m2_per_security_boundary');
function evaluate(preflight,risk){
 if(preflight?.date!=='20261008'||risk?.date!==preflight.date)throw Error('DATE_MISMATCH');
 if(!Array.isArray(preflight.candidates)||!Array.isArray(risk.findings))throw Error('BAD_SCHEMA');
 const seen=new Set();
 const candidates=preflight.candidates.map(c=>{
  if(seen.has(c.code))throw Error('DUPLICATE_CODE:'+c.code);seen.add(c.code);
  const events=risk.findings.filter(e=>e.code===c.code&&e.date===preflight.date);
  const activeDisposition=events.some(e=>e.event==='DISPOSITION_ACTIVE');
  const checks={identity:c.asof_common_stock_identity_verified===true,disposition:c.disposition_verified===true&&!activeDisposition,suspension:c.suspension_verified===true,strictFivePercent:c.original_strict_checker_executed===true&&Number.isFinite(c.gain_percent)&&c.gain_percent>=5,archiveRow:c.mi_index_row_matched===true&&c.daily_5pct_row_matched===true,classification:c.isin_stock_category_matched===true};
  // A positive marker alone cannot certify a featured stock: run the original immutable boundary.
  let originalBoundaryPassed=false;
  if(Object.values(checks).every(Boolean)){
   try{
    const proof=checkPerSecurityFivePercent(c.per_security_proof);
    originalBoundaryPassed=proof.stock_code===c.code&&proof.date===preflight.date&&c.per_security_proof.gain_percent===c.gain_percent;
   }catch(_){originalBoundaryPassed=false;}
  }
  checks.originalBoundary=originalBoundaryPassed;
  const eligible=Object.values(checks).every(Boolean);
  return {code:c.code,checks,active_disposition:activeDisposition,eligible,reasons:Object.keys(checks).filter(k=>!checks[k])};
 });
 return {date:preflight.date,phase:'M2-v2',status:'partial',source:'RESEARCH_ONLY_EVIDENCE_GATES',eligible_count:candidates.filter(c=>c.eligible).length,candidates,publication_authorized:false,prompt_a_complete:false,prompt_b_eligible:false};
}
if(require.main===module){const preflight=JSON.parse(fs.readFileSync(process.argv[2]||'data_research/twse-market-opening/20261008-m2v2-featured-candidates-preflight.json'));const risk=JSON.parse(fs.readFileSync(process.argv[3]||'data_research/twse-market-opening/20261008-m2v2-featured-trading-risk-review.json'));console.log(JSON.stringify(evaluate(preflight,risk),null,2));}
module.exports={evaluate};
