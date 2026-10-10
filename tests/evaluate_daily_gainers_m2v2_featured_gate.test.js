'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{evaluate}=require('../scripts/evaluate_daily_gainers_m2v2_featured_gate');
const c={code:'1301',close:107,change:7,previous_close:100,gain_percent:7,asof_common_stock_identity_verified:false,disposition_verified:false,suspension_verified:false,original_strict_checker_executed:false,mi_index_row_matched:true,daily_5pct_row_matched:true,isin_stock_category_matched:true};
const p={date:'20261008',candidates:[c]};const r={date:'20261008',findings:[]};
test('real preflight-style unverified candidate stays ineligible',()=>{assert.equal(evaluate(p,r).candidates[0].eligible,false)});
test('active disposition never bypasses incomplete core proof',()=>{const all={...c,asof_common_stock_identity_verified:true,disposition_verified:true,suspension_verified:true,original_strict_checker_executed:true};const x=evaluate({...p,candidates:[all]},{...r,findings:[{code:'1301',date:'20261008',event:'DISPOSITION_ACTIVE'}]});assert.equal(x.candidates[0].eligible,false)});
test('only complete positive evidence can make candidate research-eligible',()=>{const all={...c,asof_common_stock_identity_verified:true,disposition_verified:true,suspension_verified:true,original_strict_checker_executed:true};assert.equal(evaluate({...p,candidates:[all]},r).candidates[0].eligible,false);const proven={...all,per_security_proof:{source:'TWSE_MI_INDEX_SECURITY_ROW',date:'20261008',stock_code:'1301',identity_source:'OFFICIAL_DATED_ORDINARY_STOCK_MASTER',identity_date:'20261008',identity_verified:true,is_etf:false,is_warrant:false,is_suspended:false,is_disposition:false,strict_price_rule_verified:true,gain_percent:7}};assert.equal(evaluate({...p,candidates:[proven]},r).candidates[0].eligible,true);assert.equal(evaluate({...p,candidates:[all]},r).publication_authorized,false)});
test('reject stale dates and duplicate codes',()=>{assert.throws(()=>evaluate({...p,date:'20261007'},r));assert.throws(()=>evaluate({...p,candidates:[c,c]},r))});

test('reject proof percent that disagrees with the same candidate',()=>{const qualified={...c,asof_common_stock_identity_verified:true,disposition_verified:true,suspension_verified:true,original_strict_checker_executed:true,per_security_proof:{source:'TWSE_MI_INDEX_SECURITY_ROW',date:'20261008',stock_code:'1301',identity_source:'OFFICIAL_DATED_ORDINARY_STOCK_MASTER',identity_date:'20261008',identity_verified:true,is_etf:false,is_warrant:false,is_suspended:false,is_disposition:false,strict_price_rule_verified:true,gain_percent:7.5}};assert.equal(evaluate({...p,candidates:[qualified]},r).candidates[0].eligible,false)});

test('reject mismatched archived close/change arithmetic even when positive proof flags are set',()=>{const bad={...c,close:108,asof_common_stock_identity_verified:true,disposition_verified:true,suspension_verified:true,original_strict_checker_executed:true};const out=evaluate({...p,candidates:[bad]},r).candidates[0];assert.equal(out.checks.priceArithmetic,false);assert.equal(out.eligible,false)});

test('active disposition is disclosed but does not exclude core-proven narrative candidate',()=>{
 const proof={source:'TWSE_MI_INDEX_SECURITY_ROW',date:'20261008',stock_code:'1301',
  identity_source:'OFFICIAL_DATED_ORDINARY_STOCK_MASTER',identity_date:'20261008',identity_verified:true,
  is_etf:false,is_warrant:false,strict_price_rule_verified:true,gain_percent:7};
 const all={...c,asof_common_stock_identity_verified:true,original_strict_checker_executed:true,per_security_proof:proof};
 const x=evaluate({...p,candidates:[all]},{...r,findings:[{code:'1301',date:'20261008',event:'DISPOSITION_ACTIVE'}]}).candidates[0];
 assert.equal(x.core_eligible,true);
 assert.equal(x.narrative_consideration_eligible,true);
 assert.equal(x.risk.disposition,'KNOWN_ACTIVE');
 assert.equal(x.risk_disclosure_required,true);
});
test('unknown risk remains explicitly unknown, not a core rejection',()=>{
 const all={...c,asof_common_stock_identity_verified:true,original_strict_checker_executed:true,
 per_security_proof:{source:'TWSE_MI_INDEX_SECURITY_ROW',date:'20261008',stock_code:'1301',
 identity_source:'OFFICIAL_DATED_ORDINARY_STOCK_MASTER',identity_date:'20261008',
 identity_verified:true,is_etf:false,is_warrant:false,strict_price_rule_verified:true,gain_percent:7}};
 const x=evaluate({...p,candidates:[all]},r).candidates[0];
 assert.equal(x.core_eligible,true);
 assert.equal(x.risk.disposition,'UNKNOWN');
 assert.equal(x.risk.suspension,'UNKNOWN');
 assert.equal(x.risk_disclosure_required,true);
});
test('source-proven actual nontrading or halt quote anomaly blocks core regardless of risk wording',()=>{
 const all={...c,actual_nontrading_or_halted_quote_anomaly:true};
 const x=evaluate({...p,candidates:[all]},r).candidates[0];
 assert.equal(x.checks.quoteTradable,false);
 assert.equal(x.core_eligible,false);
});
test('proof for ETF or warrant cannot pass ordinary-stock identity',()=>{
 const base={...c,asof_common_stock_identity_verified:true,original_strict_checker_executed:true};
 for(const key of ['is_etf','is_warrant']){
  const proof={source:'TWSE_MI_INDEX_SECURITY_ROW',date:'20261008',stock_code:'1301',
  identity_source:'OFFICIAL_DATED_ORDINARY_STOCK_MASTER',identity_date:'20261008',
  identity_verified:true,is_etf:false,is_warrant:false,strict_price_rule_verified:true,gain_percent:7};
  proof[key]=true;
  assert.equal(evaluate({...p,candidates:[{...base,per_security_proof:proof}]},r).candidates[0].core_eligible,false);
 }
});
