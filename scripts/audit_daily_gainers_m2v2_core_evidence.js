'use strict';
const fs=require('node:fs');
const path=require('node:path');
const preflight=require('../data_research/twse-market-opening/20261008-m2v2-featured-candidates-preflight.json');
const {evaluate}=require('./evaluate_daily_gainers_m2v2_featured_gate');
const risk=require('../data_research/twse-market-opening/20261008-m2v2-featured-trading-risk-review.json');
function audit(p=preflight,r=risk){
 const result=evaluate(p,r),stockMasterDated=p.sources?.classification_asof_20261008_verified===true;
 const items=result.candidates.map(x=>{
  const c=p.candidates.find(y=>y.code===x.code);
  const recomputed=100*c.change/c.previous_close;
  const arithmeticReconciled=Math.abs(recomputed-c.gain_percent)<0.000011&&x.checks.priceArithmetic;
  return {code:c.code,name:c.name,turnover_twd:c.turnover_twd,close:c.close,change:c.change,previous_close:c.previous_close,
   reported_gain_percent:c.gain_percent,recomputed_gain_percent:Number(recomputed.toFixed(8)),
   price_arithmetic_reconciled:arithmeticReconciled,observed_category_matched:c.isin_stock_category_matched===true,
   official_identity_asof_date_verified:stockMasterDated&&x.checks.asofOrdinaryStock,
   original_per_security_proof_present:Boolean(c.per_security_proof),
   core_eligible:x.core_eligible,risk:x.risk,risk_disclosure_required:x.risk_disclosure_required,
   source_price_date:p.date,blocked_core_checks:Object.keys(x.checks).filter(k=>!x.checks[k])};
 });
 return {date:p.date,contract:'M2-v2-RISK-DISCLOSURE-v1',source_references:p.sources,
  scope:'TOP_FIVE_OBSERVED_TURNOVER_NOT_THE_WHOLE_MARKET',count:items.length,
  strict_price_arithmetic_reconciled_count:items.filter(i=>i.price_arithmetic_reconciled&&i.reported_gain_percent>=5).length,
  independently_proven_core_count:items.filter(i=>i.core_eligible&&i.official_identity_asof_date_verified).length,
  material_missingness:{historical_stock_master_asof_verified:stockMasterDated,unverified_identity_count:items.filter(i=>!i.official_identity_asof_date_verified).length,
   missing_original_per_security_proof_count:items.filter(i=>!i.original_per_security_proof_present).length},
  candidates:items,publication_authorized:false,prompt_a_complete:false,prompt_b_eligible:false};
}
if(require.main===module)console.log(JSON.stringify(audit(),null,2));
module.exports={audit};
