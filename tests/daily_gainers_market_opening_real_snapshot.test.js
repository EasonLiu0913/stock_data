'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildPartialMarketOpening}=require('../scripts/build_daily_gainers_market_opening_phase1');
const root=path.join(__dirname,'..');
const day='20261008';
const market=JSON.parse(fs.readFileSync(path.join(root,'data_twse_market_chart/market_chart.json'),'utf8'));
const raw=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5',day+'.json'),'utf8'));
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/market-opening',day+'.json'),'utf8'));
test('20261008 repository snapshot matches its reproducible source computation',()=>{
 const computed=buildPartialMarketOpening({marketChart:market,raw,date:day});
 for(const key of ['taiex','market_trading','institutional','preliminary_gainers','source_manifest']){
  assert.deepEqual(snapshot[key],computed[key],key+' stale or inconsistent with its source files');
 }
 assert.equal(snapshot.status,'partial');
 assert.equal(snapshot.market,'TWSE');
 assert.equal(snapshot.breadth,null);
 assert.ok(snapshot.quality.missing_fields.includes('breadth'));
 assert.ok(snapshot.quality.blocking_reasons.includes('COMPLETE_PUBLICATION_NOT_AUTHORIZED'));
});
test('20261008 raw 5% count is clearly preliminary, not certified common stock breadth',()=>{
 assert.equal(snapshot.preliminary_gainers.count,raw.stocks.length);
 assert.equal(snapshot.preliminary_gainers.verified_twse_common_stock_only,false);
 assert.equal(snapshot.breadth,null);
});
