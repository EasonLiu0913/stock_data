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
  source_manifest:[{source_name:'TWSE FMTQIK',source_date:date,market_scope:'TWSE',verified:true,unit:'TWD'}],
  quality:{missing_fields:['breadth','listed common-stock identity master','sector_flows'],warnings:[],blocking_reasons:['COMPLETE_PUBLICATION_NOT_AUTHORIZED']}};
 const e={target_date:date,market:'TWSE',status:'verified_breadth_only',
  breadth:{scope:'TWSE_COMMON_STOCK',advancers:1,decliners:0,unchanged:0,no_trade_count:0,eligible_count:1,gainers_5pct_count:1,
   identities:[{code:'2330',market:'TWSE',security_type:'COMMON_STOCK',classification_verified:true}]},
  source_manifest:[
   {source_name:'TWSE MI_INDEX',source_date:date,market_scope:'TWSE',verified:true,unit:'TWD'},
   {source_name:'date-specific TWSE classified security master',source_date:date,market_scope:'TWSE',verified:true,unit:'security identities'}]};
 return {s,e};
}
test('verified breadth merges without promoting remaining partial data',()=>{
 const {s,e}=fixture(),out=mergeVerifiedBreadth(s,e);
 assert.equal(out.status,'partial');assert.equal(out.breadth.advancers,1);
 assert.deepEqual(out.quality.missing_fields,['sector_flows']);
 assert.equal(s.breadth,undefined);
});
test('reject cross-day market breadth',()=>{const {s,e}=fixture();e.target_date='20261007';assert.throws(()=>mergeVerifiedBreadth(s,e),/BREADTH_DATE_MISMATCH/);});
test('reject OTC constituent',()=>{const {s,e}=fixture();e.breadth.identities[0].market='TPEX';assert.throws(()=>mergeVerifiedBreadth(s,e),/INVALID_SECURITY_CLASSIFICATION/);});
test('reject internally inconsistent breadth',()=>{const {s,e}=fixture();e.breadth.eligible_count=2;assert.throws(()=>mergeVerifiedBreadth(s,e),/BREADTH_INCONSISTENT/);});
test('reject unverified source provenance',()=>{const {s,e}=fixture();e.source_manifest[1].verified=false;assert.throws(()=>mergeVerifiedBreadth(s,e),/INVALID_BREADTH_PROVENANCE/);});
