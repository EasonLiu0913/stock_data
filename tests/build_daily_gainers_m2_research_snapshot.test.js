'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('../scripts/build_daily_gainers_m2_research_snapshot');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../data_research/twse-market-opening/20261008-m2-user-supplied-official-json-extract.json'),'utf8'));
const copy=()=>structuredClone(source);
test('integrated snapshot is partial and has source provenance',()=>{
 const s=build(copy());assert.equal(s.status,'partial');assert.equal(s.publication_authorized,false);
 assert.equal(s.source_provenance.original_http_bytes,false);assert.equal(s.stock_gainers_5pct.verified,false);
 assert.equal(s.institutional.net_twd,-91574625081);assert.equal(s.industry.index_count,34);
 assert.equal(s.industry.reported_non_overlapping_top_level_count,24);
 assert.equal(s.market_turnover.previous_five_mean_twd,1007158931238.4);
});
test('never double counts top-level electronic child turnover',()=>{
 const s=build(copy());const names=s.industry.non_overlapping_top_level.map(x=>x.name);
 assert.ok(names.includes('電子'));assert.ok(!names.includes('半導體'));assert.ok(!names.includes('化學'));
});
test('reject tampered financial figures',()=>{
 const x=copy();x.institutional.rows[0][1]++;assert.throws(()=>build(x),/arithmetic/);
});
test('reject tampered industry hierarchy',()=>{
 const x=copy();x.industry.rows.find(r=>r[0]==='電子零組件')[1]++;assert.throws(()=>build(x),/overlap/);
});
test('reject premature promotion',()=>{
 const x=copy();x.status='complete';assert.throws(()=>build(x),/promotion/);
});
