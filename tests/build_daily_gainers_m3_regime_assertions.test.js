'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build}=require('../scripts/build_daily_gainers_m3_regime_assertions');
const o=require('../data_daily_gain_over_5/market-opening/20261008.json');
const r=require('../data_research/twse-market-opening/20261008-m2v2-final-materiality-finance-review.json');
const {verifyArchive}=require('../scripts/verify_daily_gainers_m2_primary_archive');
test('real sources produce conservative down index and weaker breadth without publication',()=>{
 const x=build();assert.equal(x.regime,'INDEX_DOWN_AND_BREADTH_WEAKER');assert.equal(x.evidence.length,6);
 assert.equal(x.publication_authorized,false);assert.match(x.allowed_interpretation,/僅描述/);
 assert.match(x.evidence.find(a=>a.id==='sector').text,/不是法人淨流入/);
});
test('date and source SHA mismatch must fail closed',()=>{
 assert.throws(()=>build({...o,target_date:'20261007'},r,verifyArchive()),/STALE/);
 assert.throws(()=>build(o,{...r,finance_raw_sha256:{...r.finance_raw_sha256,bfi82u:'bad'}},verifyArchive()),/SOURCE_SHA/);
});
test('altered trading value, denominator and integrity rejected',()=>{
 assert.throws(()=>build({...o,market_trading:{...o.market_trading,turnover_twd:1}},r,verifyArchive()),/INVALID_INDEX/);
 assert.throws(()=>build({...o,market_trading:{...o.market_trading,turnover_ma5_twd:0}},r,verifyArchive()),/INVALID_INDEX/);
 assert.throws(()=>build(o,{...r,raw_bytes_sha_match:false},verifyArchive()),/SOURCE_INTEGRITY/);
});
test('contradictory index direction must not be blindly labelled broad bearish',()=>{
 const x=build({...o,taiex:{...o.taiex,change_points:100,change_pct:1}},r,verifyArchive());
 assert.equal(x.regime,'INDEX_BREADTH_DIVERGENCE_OR_MIXED');assert.equal(x.publication_authorized,false);
});
