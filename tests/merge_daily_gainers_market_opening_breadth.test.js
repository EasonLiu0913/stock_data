'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {mergeVerifiedBreadth}=require('../scripts/merge_daily_gainers_market_opening_breadth');
function fixture(){
 const date='20261008';
 const s={schema_version:1,target_date:date,market:'TWSE',status:'partial',
  taiex:{close:100,previous_close:99,change_points:1,change_pct:(100/99-1)*100},
  market_trading:{turnover_twd:1000,shares:100,transactions:20},
  institutional:{foreign:{buy_twd:100,sell_twd:50,net_twd:50,unit:'TWD',market_scope:'TWSE'}},
  source_manifest:[{source_name:'TWSE FMTQIK',source_date:date,market_scope:'TWSE',verified:true,unit:'TWD',sha256:'c'.repeat(64)}],
  quality:{missing_fields:['market_opening_breadth','sector_flows'],warnings:[],blocking_reasons:['COMPLETE_PUBLICATION_NOT_AUTHORIZED']}};
 const e={target_date:date,market:'TWSE',status:'verified_breadth_only',
  market_opening_breadth:{scope:'TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN',source_date:date,advancers:1,decliners:0,unchanged:0,limit_up:0,limit_down:0,no_trade:0,no_comparison:0,eligible_count:1,
   source_manifest:[{source_name:'TWSE MI_INDEX',source_date:date,market_scope:'TWSE',verified:true,sha256:'b'.repeat(64)}]},
  source_manifest:[{source_name:'TWSE MI_INDEX',source_date:date,market_scope:'TWSE',verified:true,unit:'official stock column counts',sha256:'b'.repeat(64)}]};
 return {s,e};
}
test('verified breadth merges without promoting remaining partial data',()=>{
 const {s,e}=fixture(),out=mergeVerifiedBreadth(s,e);
 assert.equal(out.status,'partial');assert.equal(out.market_opening_breadth.advancers,1);
 assert.equal(out.market_opening_breadth.scope,'TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN');
 assert.deepEqual(out.quality.missing_fields,['sector_flows']);
 assert.equal(out.schema_version,3);
 assert.equal(out.breadth,undefined);
});
test('reject cross-day market breadth',()=>{const {s,e}=fixture();e.target_date='20261007';assert.throws(()=>mergeVerifiedBreadth(s,e),/BREADTH_DATE_MISMATCH/);});
test('does not require or create ordinary-stock classification breadth',()=>{const {s,e}=fixture();const out=mergeVerifiedBreadth(s,e);assert.equal(out.breadth,undefined);});
test('reject internally inconsistent official breadth denominator',()=>{const {s,e}=fixture();e.market_opening_breadth.eligible_count=2;assert.throws(()=>mergeVerifiedBreadth(s,e),/BREADTH_DENOMINATOR/);});
test('reject unverified source provenance',()=>{const {s,e}=fixture();e.source_manifest[0].verified=false;assert.throws(()=>mergeVerifiedBreadth(s,e),/INVALID_BREADTH_PROVENANCE/);});
