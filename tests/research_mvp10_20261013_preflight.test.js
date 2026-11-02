'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assess}=require('../scripts/research_mvp10_20261013_preflight');
function fixture(){
 const stocks=[
  {code:'1234',name:'普通甲',previous_close:100,close:110,change_pct:10},
  {code:'6645',name:'金萬林-創',previous_close:10,close:11,change_pct:10},
  {code:'9103',name:'美德醫療-DR',previous_close:20,close:22,change_pct:10},
  {code:'1312A',name:'國喬特',previous_close:10,close:11,change_pct:10}
 ];
 const raw={target_date:'20261013',stock_count:4,stocks};
 const common={target_date:'20261013',stock_count:4};
 const analysis={...common,analyses:stocks.map(x=>({code:x.code}))},ai={...common,analyses:stocks.map(x=>({code:x.code}))};
 const summary={target_date:'20261013',status:'final',coverage:{overall:'complete',raw_stock_count:4,analyzed_stock_count:4}};
 const script={target_date:'20261013',stock_count:4,scenes:[{stock_codes:['1234','6645','1312A']}]};
 const cats={Stock:new Map([['1234','普通甲']]),InnovationBoard:new Map([['6645','金萬林-創']]),TDR:new Map([['9103','美德醫療-DR']])};
 return {raw,analysis,ai,summary,script,cats};
}
test('final label does not waive security exclusion or authorize render',()=>{
 const f=fixture(),r=assess(f.raw,f.analysis,f.ai,f.summary,f.script,f.cats);
 assert.equal(r.raw_stock_count,4);assert.equal(r.provisional_stock_count,1);
 assert.equal(r.excluded_count,3);assert.deepEqual(r.unsafe_scene_codes,['6645','1312A']);
 assert.equal(r.render_authorized,false);assert.equal(r.unmodified_original_validator_pass,false);
 assert.equal(r.scope_snapshot_effective_on_trading_date_verified,false);
});
test('wrong date and inconsistent counts fail closed',()=>{
 const f=fixture();f.ai.target_date='20261012';
 assert.throws(()=>assess(f.raw,f.analysis,f.ai,f.summary,f.script,f.cats),/SOURCE_DATE_MISMATCH/);
 const g=fixture();g.summary.coverage.analyzed_stock_count=3;
 assert.throws(()=>assess(g.raw,g.analysis,g.ai,g.summary,g.script,g.cats),/MARKET_SUMMARY_COUNT_MISMATCH/);
});
test('bogus 5 pct classification and name mismatch block',()=>{
 const f=fixture();f.raw.stocks[0].close=102;f.raw.stocks[0].change_pct=9;
 const x=assess(f.raw,f.analysis,f.ai,f.summary,f.script,f.cats);
 assert.ok(x.excluded.some(x=>x.code==='1234'&&x.reasons.includes('UNVERIFIED_GAIN_ARITHMETIC')));
 const g=fixture();g.cats.Stock.set('1234','不同名稱');
 const y=assess(g.raw,g.analysis,g.ai,g.summary,g.script,g.cats);
 assert.ok(y.excluded.some(x=>x.code==='1234'&&x.reasons.includes('NAME_DISAGREEMENT')));
});
test('no exclusions still not certified without effective-date proof',()=>{
 const f=fixture();
 f.raw.stocks=f.raw.stocks.slice(0,1);f.raw.stock_count=1;
 f.analysis.analyses=f.analysis.analyses.slice(0,1);f.analysis.stock_count=1;
 f.ai.analyses=f.ai.analyses.slice(0,1);f.ai.stock_count=1;
 f.summary.coverage.raw_stock_count=1;f.summary.coverage.analyzed_stock_count=1;
 f.script.stock_count=1;f.script.scenes[0].stock_codes=['1234'];
 const r=assess(f.raw,f.analysis,f.ai,f.summary,f.script,f.cats);
 assert.equal(r.excluded_count,0);assert.equal(r.render_authorized,false);
 assert.equal(r.scope_snapshot_effective_on_trading_date_verified,false);
});
