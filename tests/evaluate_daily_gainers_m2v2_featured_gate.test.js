'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluate}=require('../scripts/evaluate_daily_gainers_m2v2_featured_gate');
const sha='a'.repeat(40);
const c={code:'1301',name:'台塑',close:107,change:7,previous_close:100,gain_percent:7,
 mi_index_row_matched:true,daily_5pct_row_matched:true,isin_stock_category_matched:true};
const p={date:'20261008',candidates:[c]},risk={date:'20261008',findings:[]};
const proof={
 classification_evidence:{source:'TWSE_OFFICIAL_STOCK_CATEGORY',stock_code:'1301',stock_name:'台塑',source_sha:sha,stock_category_present:true,competing_categories:[]},
 official_quote_evidence:{source:'TWSE_MI_INDEX_SECURITY_ROW',date:'20261008',stock_code:'1301',stock_name:'台塑',close:107,change:7,previous_close:100,source_sha:sha}
};
const run=(item,findings=[])=>evaluate({...p,candidates:[item]},{...risk,findings}).candidates[0];
test('existing source-unpinned research preflight remains fail closed',()=>assert.equal(run(c).core_eligible,false));
test('date-pinned official quote plus independently classified ordinary stock passes without historical exact-day master',()=>{
 const a=run({...c,...proof});assert.equal(a.core_eligible,true);assert.equal(a.risk.disposition,'UNKNOWN');assert.equal(a.risk_disclosure_required,true);
});
test('known disposition is disclosed rather than blanket exclusion',()=>{
 const a=run({...c,...proof},[{code:'1301',date:'20261008',event:'DISPOSITION_ACTIVE'}]);assert.equal(a.core_eligible,true);assert.equal(a.risk.disposition,'KNOWN_ACTIVE');
});
test('competing ETF TDR or innovation category rejects ordinary-stock claim',()=>{
 for(const type of ['ETF','TDR','InnovationBoard','Warrants','PreferredStock','ETN'])assert.equal(run({...c,...proof,classification_evidence:{...proof.classification_evidence,competing_categories:[type]}}).core_eligible,false);
});
test('unknown or source-unpinned classification rejects',()=>{
 assert.equal(run({...c,...proof,classification_evidence:{...proof.classification_evidence,source_sha:''}}).core_eligible,false);
 assert.equal(run({...c,...proof,classification_evidence:{...proof.classification_evidence,stock_category_present:false}}).core_eligible,false);
});
test('mismatched ticker or stock name rejects',()=>{
 assert.equal(run({...c,...proof,official_quote_evidence:{...proof.official_quote_evidence,stock_name:'其他'}}).core_eligible,false);
 assert.equal(run({...c,...proof,classification_evidence:{...proof.classification_evidence,stock_code:'9999'}}).core_eligible,false);
});
test('stale date rejects and duplicate codes rejected',()=>{
 assert.equal(run({...c,...proof,official_quote_evidence:{...proof.official_quote_evidence,date:'20261007'}}).core_eligible,false);
 assert.throws(()=>evaluate({...p,date:'20261007'},risk));
 assert.throws(()=>evaluate({...p,candidates:[c,c]},risk));
});
test('below five percent, tampered price and invalid zero denominator reject',()=>{
 assert.equal(run({...c,...proof,gain_percent:4.99}).core_eligible,false);
 assert.equal(run({...c,...proof,close:108}).core_eligible,false);
 assert.equal(run({...c,...proof,previous_close:0}).core_eligible,false);
});
test('proof gain and date must match the actually quoted candidate',()=>{
 assert.equal(run({...c,...proof,official_quote_evidence:{...proof.official_quote_evidence,previous_close:99}}).core_eligible,false);
});
test('genuine nontrading quote anomaly fails even with status disclosure',()=>{
 assert.equal(run({...c,...proof,actual_nontrading_or_halted_quote_anomaly:true}).core_eligible,false);
});
test('research never publishes',()=>{
 const v=evaluate({...p,candidates:[{...c,...proof}]},risk);assert.equal(v.publication_authorized,false);assert.equal(v.prompt_b_eligible,false);
});
