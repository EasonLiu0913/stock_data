'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assertDate,expectedHoldingsDate,assertFreshHoldings,assertIndustryDate}=require('../scripts/pocket_00981a_freshness');
const rows=date=>[{date},{date}];
const summary=date=>({date,totalRows:2});
test('trading weekday requires current date',()=>assert.equal(expectedHoldingsDate('20261012'),'20261012'));
test('weekend resolves to Friday without claiming Saturday publication',()=>{
 assert.equal(expectedHoldingsDate('20261017'),'20261016');
 assert.equal(expectedHoldingsDate('20261018'),'20261016');
});
test('explicit verified holiday target is supported',()=>assert.equal(expectedHoldingsDate('20261009','20261008'),'20261008'));
test('invalid or future overrides fail closed',()=>{
 assert.throws(()=>expectedHoldingsDate('20261012','20261013'),/future/);
 assert.throws(()=>assertDate('20260230'),/invalid calendar/);
});
test('actual same-date nonempty holdings accepted',()=>assert.equal(assertFreshHoldings(summary('20261012'),rows('20261012'),'20261012'),'20261012'));
test('20261008 API response on 20261012 fails',()=>assert.throws(()=>assertFreshHoldings(summary('20261008'),rows('20261008'),'20261012'),/STALE_HOLDINGS/));
test('mixed row dates and empty holdings fail',()=>{
 assert.throws(()=>assertFreshHoldings(summary('20261012'),[{date:'20261012'},{date:'20261008'}],'20261012'),/mixed row dates/);
 assert.throws(()=>assertFreshHoldings({date:'20261012',totalRows:0},[],'20261012'),/empty/);
});
test('industry may lag independently but cannot be future or empty',()=>{
 assert.equal(assertIndustryDate({date:'20261002',totalRows:30},'20261012'),'20261002');
 assert.throws(()=>assertIndustryDate({date:'20261013',totalRows:30},'20261012'),/later/);
 assert.throws(()=>assertIndustryDate({date:'20261002',totalRows:0},'20261012'),/empty/);
});
