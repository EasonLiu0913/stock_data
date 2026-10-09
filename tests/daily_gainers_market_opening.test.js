'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateOpeningSnapshot}=require('../scripts/validate_daily_gainers_market_opening');
const base=()=>({
 schema_version:1,target_date:'20261008',market:'TWSE',
 source_manifest:[{source_name:'TWSE FMTQIK',source_date:'20261008',market_scope:'TWSE',unit:'TWD',verified:true}],
 taiex:{close:100,previous_close:99,change_points:1,change_pct:100/99*100-100},
 market_trading:{turnover_twd:120000,shares:1000,transactions:25},
 breadth:{scope:'TWSE_COMMON_STOCK',advancers:1,decliners:0,unchanged:0,eligible_count:1,gainers_5pct_count:0,no_trade_count:0,
 identities:[{code:'2330',market:'TWSE',security_type:'COMMON_STOCK',classification_verified:true}]},
 institutional:{foreign:{buy_twd:500,sell_twd:400,net_twd:100,unit:'TWD',market_scope:'TWSE'}}
});
test('verified TWSE-only fixture passes',()=>assert.equal(validateOpeningSnapshot(base()).ok,true));
for(const [name,mutate,code] of [
 ['rejects OTC market',s=>s.market='TPEX','MARKET_NOT_TWSE'],
 ['rejects stale source date',s=>s.source_manifest[0].source_date='20261007','SOURCE_DATE_MISMATCH'],
 ['rejects OTC classification',s=>s.breadth.identities[0].market='TPEX','INVALID_SECURITY_CLASSIFICATION'],
 ['rejects ETF within ordinary shares',s=>s.breadth.identities[0].security_type='ETF','INVALID_SECURITY_CLASSIFICATION'],
 ['rejects unverified classification',s=>s.breadth.identities[0].classification_verified=false,'INVALID_SECURITY_CLASSIFICATION'],
 ['rejects unit confusion',s=>s.institutional.foreign.unit='shares','INSTITUTIONAL_UNIT_OR_SCOPE'],
 ['rejects buy/sell/net mismatch',s=>s.institutional.foreign.net_twd=200,'INSTITUTIONAL_NET_MISMATCH'],
 ['rejects incorrect TAIEX return',s=>s.taiex.change_pct=5,'INDEX_PERCENT_MISMATCH'],
 ['rejects incomplete stock identities',s=>s.breadth.identities=[],'MISSING_CLASSIFIED_UNIVERSE'],
 ['rejects invalid date',s=>s.target_date='20260230','INVALID_DATE']
]) test(name,()=>{const s=base();mutate(s);assert.throws(()=>validateOpeningSnapshot(s),{message:new RegExp(code)});});

test('rejects missing no-trade evidence',()=>{const s=base();delete s.breadth.no_trade_count;assert.throws(()=>validateOpeningSnapshot(s),/BREADTH_NO_TRADE_COUNT/);});
test('rejects an unaccounted security in breadth partition',()=>{const s=base();s.breadth.advancers=0;assert.throws(()=>validateOpeningSnapshot(s),/BREADTH_INCONSISTENT/);});
