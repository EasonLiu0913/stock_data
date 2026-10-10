'use strict';
const fs=require('node:fs');
// Owner-approved M2-v2-RISK-DISCLOSURE-v1: research narrative consideration,
// NOT a replacement or PASS for the immutable original risk-exclusion boundary.
const riskStatus=(verified,active)=>active?'KNOWN_ACTIVE':verified===true?'VERIFIED_NONE':'UNKNOWN';
function verifyCore(c,date){
 const proof=c.per_security_proof;
 const price=[c.close,c.change,c.previous_close,c.gain_percent];
 const priceArithmetic=price.every(Number.isFinite)&&c.close>0&&c.previous_close>0&&c.change>=0
   &&Math.abs(c.close-c.change-c.previous_close)<1e-7
   &&Math.abs(100*c.change/c.previous_close-c.gain_percent)<0.000011;
 const checks={
  priceArithmetic,
  archiveRow:c.mi_index_row_matched===true&&c.daily_5pct_row_matched===true,
  classification:c.isin_stock_category_matched===true,
  asofOrdinaryStock:c.asof_common_stock_identity_verified===true
    &&proof?.source==='TWSE_MI_INDEX_SECURITY_ROW'&&proof?.stock_code===c.code
    &&proof?.date===date&&proof?.identity_source==='OFFICIAL_DATED_ORDINARY_STOCK_MASTER'
    &&proof?.identity_date===date&&proof?.identity_verified===true
    &&proof?.is_etf===false&&proof?.is_warrant===false,
  strictFivePercent:c.original_strict_checker_executed===true
    &&Number.isFinite(c.gain_percent)&&c.gain_percent>=5&&proof?.strict_price_rule_verified===true
    &&proof?.gain_percent===c.gain_percent,
  quoteTradable:c.actual_nontrading_or_halted_quote_anomaly!==true
 };
 return {checks,coreEligible:Object.values(checks).every(Boolean)};
}
function evaluate(preflight,risk){
 if(preflight?.date!=='20261008'||risk?.date!==preflight.date)throw Error('DATE_MISMATCH');
 if(!Array.isArray(preflight.candidates)||!Array.isArray(risk.findings))throw Error('BAD_SCHEMA');
 const seen=new Set();
 const candidates=preflight.candidates.map(c=>{
  if(seen.has(c.code))throw Error('DUPLICATE_CODE:'+c.code);seen.add(c.code);
  const events=risk.findings.filter(e=>e.code===c.code&&e.date===preflight.date);
  const activeDisposition=events.some(e=>e.event==='DISPOSITION_ACTIVE');
  const activeHalt=events.some(e=>e.event==='HALT_ACTIVE');
  const dispositionStatus=riskStatus(c.disposition_verified,activeDisposition);
  const suspensionStatus=riskStatus(c.suspension_verified,activeHalt);
  const core=verifyCore(c,preflight.date);
  const riskDisclosureRequired=dispositionStatus!=='VERIFIED_NONE'||suspensionStatus!=='VERIFIED_NONE';
  return {code:c.code,checks:core.checks,core_eligible:core.coreEligible,
   risk:{disposition:dispositionStatus,suspension:suspensionStatus},
   risk_disclosure_required:riskDisclosureRequired,
   active_disposition:activeDisposition,active_halt:activeHalt,
   narrative_consideration_eligible:core.coreEligible,
   // Backward-compatible research eligibility alias, never an authorization to publish.
   eligible:core.coreEligible,
   reasons:Object.keys(core.checks).filter(k=>!core.checks[k]),
   disclosures:[dispositionStatus!=='VERIFIED_NONE'?'處置：'+dispositionStatus:null,
    suspensionStatus!=='VERIFIED_NONE'?'暫停交易：'+suspensionStatus:null].filter(Boolean)};
 });
 return {date:preflight.date,phase:'M2-v2',contract:'M2-v2-RISK-DISCLOSURE-v1',
  status:'partial',source:'RESEARCH_ONLY_CORE_AND_RISK_DISCLOSURE',
  eligible_count:candidates.filter(c=>c.core_eligible).length,candidates,
  publication_authorized:false,prompt_a_complete:false,prompt_b_eligible:false};
}
if(require.main===module){
 const p=JSON.parse(fs.readFileSync(process.argv[2]||'data_research/twse-market-opening/20261008-m2v2-featured-candidates-preflight.json'));
 const r=JSON.parse(fs.readFileSync(process.argv[3]||'data_research/twse-market-opening/20261008-m2v2-featured-trading-risk-review.json'));
 console.log(JSON.stringify(evaluate(p,r),null,2));
}
module.exports={evaluate,verifyCore,riskStatus};
