'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reconcile}=require('../scripts/reconcile_mvp10_mops_claims');
const entries={
 '2305':{name:'全友',revenue:196565,yoy:212.8,domestic:true},
 '3416':{name:'融程電',revenue:534569,yoy:95.9,domestic:true},
 '6672':{name:'騰輝電子-KY',revenue:1020897,yoy:201.68,domestic:false}
};
function fixture(){
 const pages=[
 {url:'https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_115_9_0.html',http_status:200,response_sha256:'a'.repeat(64),response_length:450000,error:null,target_rows:{}},
 {url:'https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_115_9_1.html',http_status:200,response_sha256:'b'.repeat(64),response_length:70000,error:null,target_rows:{}}
 ];
 const proof={};
 for(const [code,spec] of Object.entries(entries)){
  pages[spec.domestic?0:1].target_rows[code]=[code,spec.name,String(spec.revenue)];
  proof[code]={verified:true,company_name:spec.name,revenue_thousand_ntd:spec.revenue,official_yoy_pct:spec.yoy};
 }
 const receipt={research_only:true,target_trade_date:'20261008',official_source_period:'ROC115/09',official_table_columns_verified:true,company_event_caused_market_movement_verified:false,render_authorized:false,publication_authorized:false,pages,official_column_proof:proof,official_revenue_claims_validated:Object.keys(entries)};
 const analyses=Object.entries(entries).map(([code,spec])=>({code,name:spec.name,evidence_strength:'corroborated'}));
 for(let i=0;i<8;i++)analyses.push({code:'X'+i,name:'unverified '+i,evidence_strength:'corroborated'});
 for(let i=0;i<21;i++)analyses.push({code:'Z'+i,name:'other '+i,evidence_strength:'none'});
 analyses.push({code:'9103',name:'美德醫療-DR',evidence_strength:'corroborated'});
 analyses.push({code:'6645',name:'金萬林-創',evidence_strength:'corroborated'});
 analyses.push({code:'7740',name:'熙特爾-創',evidence_strength:'none'});
 const published={target_date:'20261008',stock_count:35,analyses};
 return {receipt,published};
}
test('3 official revenue facts remain distinct from 8 unresolved strong claims',()=>{
 const {receipt,published}=fixture(),r=reconcile(receipt,published);
 assert.equal(r.primary_revenue_facts.length,3);
 assert.equal(r.unresolved_legacy_strong_claims.length,8);
 assert.equal(r.reviewed_legacy_strong_claim_count,11);
 assert.equal(r.provisional_ordinary_scope_certified,false);
 assert.equal(r.issuer_revenue_facts_are_price_catalysts,false);
 assert.equal(r.summary_final,false);
 assert.equal(r.render_authorized,false);
 assert.equal(r.publication_authorized,false);
});
test('mismatched official revenue or issuer is rejected',()=>{
 const f=fixture(); f.receipt.official_column_proof['3416'].official_yoy_pct=95.91;
 assert.throws(()=>reconcile(f.receipt,f.published));
});
test('missing source, duplicate source, and lack of official verification reject',()=>{
 const f=fixture();delete f.receipt.pages[0].target_rows['2305'];
 assert.throws(()=>reconcile(f.receipt,f.published));
 const d=fixture();d.receipt.pages[1].target_rows['2305']=['2305','全友'];
 assert.throws(()=>reconcile(d.receipt,d.published));
 const u=fixture();u.receipt.official_table_columns_verified=false;
 assert.throws(()=>reconcile(u.receipt,u.published));
});
test('wrong date and premature release permission reject',()=>{
 const f=fixture();f.receipt.target_trade_date='20261007';
 assert.throws(()=>reconcile(f.receipt,f.published));
 const u=fixture();u.receipt.publication_authorized=true;
 assert.throws(()=>reconcile(u.receipt,u.published));
});
test('legacy claim scope drift or wrong 2305 name reject',()=>{
 const f=fixture();f.published.analyses[0].name='全漢';
 assert.throws(()=>reconcile(f.receipt,f.published));
 const u=fixture();u.published.analyses[4].evidence_strength='none';
 assert.throws(()=>reconcile(u.receipt,u.published));
});

test('excluded nonordinary legacy stocks never inflate provisional strong count',()=>{
 const f=fixture();
 const r=reconcile(f.receipt,f.published);
 assert.deepEqual(r.excluded_frozen_nonordinary_codes.sort(),['6645','7740','9103'].sort());
 assert.equal(r.reviewed_legacy_strong_claim_count,11);
 const bad=fixture();bad.published.analyses.find(x=>x.code==='9103').name='unverified DR';
 assert.throws(()=>reconcile(bad.receipt,bad.published));
});

test('complete 32-row safe editorial ledger never promotes revenue into causation',()=>{
 const f=fixture();
 const r=reconcile(f.receipt,f.published);
 assert.equal(r.provisional_editorial_claim_ledger.length,32);
 const sources=r.provisional_editorial_claim_ledger.filter(x=>x.independently_verified_company_revenue_fact);
 assert.equal(sources.length,3);
 assert.equal(sources.find(x=>x.code==='2305').name,'全友');
 assert.match(sources.find(x=>x.code==='3416').independently_verified_company_revenue_fact,/95\\.90%/);
 assert.ok(r.provisional_editorial_claim_ledger.every(x=>x.supported_stock_price_cause===false));
 assert.ok(r.provisional_editorial_claim_ledger.every(x=>x.original_research_narrative_reused===false));
 assert.equal(r.summary_final,false);
 assert.equal(r.render_authorized,false);
});
