'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build}=require('../scripts/build_daily_gainers_m2v2_source_backed_core');
const s='a'.repeat(40),code='1301',name='台塑';
const p={date:'20261008',sources:{classification_blob_sha1:s,mi_index_blob_sha1:s},candidates:[{code,name,close:107,change:7,previous_close:100,gain_percent:7,mi_index_row_matched:true,daily_5pct_row_matched:true,isin_stock_category_matched:true}]};
const raw={date:'20261008',stat:'OK',tables:[{title:'每日收盤行情(全部)',fields:['證券代號',...Array(7).fill(''), '收盤價'],data:[[code,name,'','','','','','', '107','+','7']]}]};
const classes=()=>Object.fromEntries(['Stock','InnovationBoard','ETF','TDR','ETN','PreferredStock','Warrants'].map(n=>[n,new Map(n==='Stock'?[[code,{name}]]:[])]));
const r={date:'20261008',findings:[]};
test('real-row shape and independent classification source produce core candidate without historical master',()=>{
 const x=build(p,raw,classes(),r);assert.equal(x.source_verified_quotes,1);assert.equal(x.eligible_count,1);assert.equal(x.candidates[0].risk_disclosure_required,true);assert.equal(x.publication_authorized,false);
});
test('conflicting ETF category prevents core eligibility',()=>{const cl=classes();cl.ETF.set(code,{name});assert.equal(build(p,raw,cl,r).eligible_count,0)});
test('wrong official quote name cannot pass',()=>{const x=structuredClone(raw);x.tables[0].data[0][1]='其他';assert.equal(build(p,x,classes(),r).eligible_count,0)});
test('wrong day cannot pass',()=>assert.throws(()=>build(p,{...raw,date:'20261007'},classes(),r)));
test('price tampering and absent Stock category cannot pass',()=>{
 const x=structuredClone(raw);x.tables[0].data[0][8]='108';assert.equal(build(p,x,classes(),r).eligible_count,0);
 const cl=classes();cl.Stock.clear();assert.equal(build(p,raw,cl,r).eligible_count,0);
});
