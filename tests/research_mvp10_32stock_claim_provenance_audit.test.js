'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {audit}=require('../scripts/research_mvp10_32stock_claim_provenance_audit');
test('32 stock full batch audit keeps unverified company filings and correct 2305 identity',()=>{
 const j=audit(process.cwd());
 assert.equal(j.original_list_count,35);
 assert.equal(j.provisional_stock_count,32);
 assert.equal(j.strong_claims_count,11);
 assert.equal(j.confirmed_original_2305_name,'全友');
 assert.equal(j.market_summary_final,false);
 assert.equal(j.render_authorized,false);
 assert.equal(j.publication_authorized,false);
 assert.equal(j.primary_company_disclosure_document_content_verified_count,0);
 assert.equal(j.stock_rows.length,32);
 const p=j.stock_rows.find(x=>x.code==='2305');
 assert(p);
 assert(p.source_quality.some(x=>x.quality==='GENERIC_UNDATED_PROFILE'));
 assert(!j.stock_rows.some(x=>x.code==='9103'));
 assert.equal(j.source_strength_conflict_count,0);
});
test('exchange/date official claim conflicts are recorded, never silently converted to verified',()=>{
 const j=audit(process.cwd());
 assert.equal(j.matched_official_numeric_claim_count+j.original_numeric_claim_conflict_count,32);
 for(const item of j.stock_rows){
  assert.equal(item.event_caused_price_rise_verified,false);
  assert.equal(item.company_event_primary_filing_verified,false);
  assert.equal(item.publisher_historical_security_category_effective_on_date_verified,false);
  assert(item.official_numeric_crosscheck.status==='NUMERIC_SOURCE_RECONCILED'||
   (item.official_numeric_crosscheck.status==='NUMERIC_SOURCE_CONFLICT'&&typeof item.official_numeric_crosscheck.error==='string'));
 }
});
test('frozen original source untouched and no main/canonical mutation',()=>{
 const file='data_daily_gain_over_5/analysis/20261008.json',b=fs.readFileSync(file);
 audit(process.cwd());
 assert(fs.readFileSync(file).equals(b));
});
