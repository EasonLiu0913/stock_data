'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assemble}=require('../scripts/build_daily_gainers_m2v2_final_research_summary');
const {run}=require('../scripts/build_daily_gainers_m2v2_source_backed_core');
const review=require('../data_research/twse-market-opening/20261008-m2v2-final-materiality-finance-review.json');
test('real source backed ES core and independent finance checkpoint reconcile nonpublication',()=>{
 const v=assemble(run(),review);assert.equal(v.selected_core_eligible,5);assert.equal(v.observed_candidates,35);
 assert.equal(v.selection.find(c=>c.code==='6672').risk.disposition,'KNOWN_ACTIVE');
 assert.equal(v.publication_authorized,false);assert.equal(v.prompt_b_eligible,false);
 assert.equal(v.materiality.full_universe_claim,false);
});
test('reject count drift and false finance publication scope',()=>{
 assert.throws(()=>assemble({...run(),eligible_count:4},review),/CORE_RESULT_MISMATCH/);
 assert.throws(()=>assemble(run(),{...review,finance_source_scope_verified_for_publication:true}),/PUBLICATION_SCOPE_MISMATCH/);
});
test('reject date, category and disposition mismatch',()=>{
 assert.throws(()=>assemble(run(),{...review,date:'20261007'}),/CONTRACT_DATE_MISMATCH/);
 assert.throws(()=>assemble(run(),{...review,category_breakdown:{Stock:31,InnovationBoard:2,TDR:1}}),/CATEGORY_RECONCILIATION_FAILED/);
 const c=run();c.candidates.find(x=>x.code==='6672').risk.disposition='UNKNOWN';
 assert.throws(()=>assemble(c,review),/RISK_REVIEW_MISMATCH/);
});
