'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateOpeningSnapshot}=require('../scripts/validate_daily_gainers_market_opening');
const base=()=>({
 schema_version:3,target_date:'20261008',market:'TWSE',status:'verified_official_market_aggregate',
 source_manifest:[{source_name:'TWSE FMTQIK',source_date:'20261008',market_scope:'TWSE',unit:'TWD',verified:true,sha256:'c'.repeat(64)}],
 index:{close:100,previous_close:99,change_points:1,change_pct:100/99*100-100},
 trading:{turnover_twd:120000,shares:1000,transactions:25,turnover_ma5_twd:100000,turnover_ratio_ma5:1.2},
 market_opening_breadth:{scope:'TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN',source_date:'20261008',advancers:1,decliners:0,unchanged:0,limit_up:0,limit_down:0,no_trade:0,no_comparison:0,eligible_count:1,
 source_manifest:[{source_name:'TWSE MI_INDEX',source_date:'20261008',market_scope:'TWSE',verified:true,sha256:'b'.repeat(64)}]},
 institutional:{scope:'TWSE_BFI82U_TWD',source_date:'20261008',foreign:{buy_twd:500,sell_twd:400,net_twd:100,unit:'TWD',market_scope:'TWSE'},investment_trust:{buy_twd:0,sell_twd:0,net_twd:0,unit:'TWD',market_scope:'TWSE'},dealers:{buy_twd:0,sell_twd:0,net_twd:0,unit:'TWD',market_scope:'TWSE'},foreign_net_twd:100,investment_trust_net_twd:0,dealers_net_twd:0,total_net_twd:100}
});
test('verified schema-v3 TWSE opening passes without security-classification archive',()=>assert.equal(validateOpeningSnapshot(base()).ok,true));
for(const [name,mutate,code] of [
 ['rejects OTC market',s=>s.market='TPEX','MARKET_NOT_TWSE'],
 ['rejects incomplete opening status',s=>s.status='partial','OPENING_NOT_COMPLETE'],
 ['rejects stale source date',s=>s.source_manifest[0].source_date='20261007','SOURCE_DATE_MISMATCH'],
 ['rejects invalid source SHA format',s=>s.source_manifest[0].sha256='not-a-sha','SOURCE_SHA256_INVALID'],
 ['rejects unit confusion',s=>s.institutional.foreign.unit='shares','INSTITUTIONAL_UNIT_OR_SCOPE'],
 ['rejects buy/sell/net mismatch',s=>s.institutional.foreign.net_twd=200,'INSTITUTIONAL_NET_MISMATCH'],
 ['rejects incorrect TAIEX return',s=>s.index.change_pct=5,'INDEX_PERCENT_MISMATCH'],
 ['rejects invalid date',s=>s.target_date='20260230','INVALID_DATE']
]) test(name,()=>{const s=base();mutate(s);assert.throws(()=>validateOpeningSnapshot(s),{message:new RegExp(code)});});

test('counts no-comparison securities in the official MI_INDEX stock-column denominator',()=>{const s=base();s.market_opening_breadth.no_comparison=1;s.market_opening_breadth.eligible_count=2;assert.equal(validateOpeningSnapshot(s).ok,true);});
test('keeps the two breadth scopes independent',()=>{const s=base();s.market_opening_breadth.scope='TWSE_COMMON_STOCK';assert.throws(()=>validateOpeningSnapshot(s),/MARKET_OPENING_BREADTH_SCOPE/);});
test('rejects an unaccounted MI_INDEX stock-column count',()=>{const s=base();s.market_opening_breadth.advancers=0;assert.throws(()=>validateOpeningSnapshot(s),/MARKET_OPENING_BREADTH_INCONSISTENT/);});
test('rejects missing no-comparison evidence',()=>{const s=base();delete s.market_opening_breadth.no_comparison;assert.throws(()=>validateOpeningSnapshot(s),/no_comparison/);});
