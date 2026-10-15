'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const original=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/market-opening/20261008.json'),'utf8'));
const verify=o=>{
 const e=[],check=(v,s)=>{if(!v)e.push(s)};
 check(o.target_date==='20261008','date');check(o.market==='TWSE','market');check(o.status==='final','status');
 const b=o.breadth;
 for(const k of ['rising_count','falling_count','unchanged_count','limit_up_count','denominator'])check(Number.isInteger(b?.[k])&&b[k]>=0,'breadth '+k);
 check(b?.source_date==='20261008'&&b?.market_scope==='TWSE'&&b?.verified_twse_common_stock_only===true,'breadth source');
 if(b&&['rising_count','falling_count','unchanged_count','denominator'].every(k=>Number.isInteger(b[k])))check(b.rising_count+b.falling_count+b.unchanged_count===b.denominator,'breadth denominator');
 for(const k of ['foreign','investment_trust','dealers']){
  const v=o.institutional?.[k];
  check(v?.source_date==='20261008'&&v?.market_scope==='TWSE'&&v?.unit==='TWD',k+' provenance');
  for(const x of ['buy_twd','sell_twd','net_twd'])check(Number.isSafeInteger(v?.[x]),k+' '+x);
  if(v&&['buy_twd','sell_twd','net_twd'].every(x=>Number.isSafeInteger(v[x])))check(v.buy_twd-v.sell_twd===v.net_twd,k+' arithmetic');
 }
 check(Number.isFinite(o.market_trading?.turnover_twd)&&o.market_trading.turnover_twd>0,'turnover');
 check(Number.isFinite(o.market_trading?.turnover_ma5_twd)&&o.market_trading.turnover_ma5_twd>0,'MA5');
 check(o.market_trading?.turnover_ma5_definition==='previous 5 TWSE trading days (excluding target)','MA5 method');
 check(o.market_regime!==null&&typeof o.market_regime==='object','regime');
 return e;
};
const clone=()=>structuredClone(original);
assert(verify(original).length>0,'partial original must BLOCK');
const synthetic=clone();
synthetic.status='final';
synthetic.breadth={rising_count:4,falling_count:5,unchanged_count:1,limit_up_count:1,denominator:10,source_date:'20261008',market_scope:'TWSE',verified_twse_common_stock_only:true};
synthetic.market_regime={classification:'synthetic fixture only'};
assert.deepEqual(verify(synthetic),[],'synthetic valid fixture should pass structural checks; NOT actual evidence');
for(const [name,mutate] of [
 ['wrong date',o=>o.target_date='20261007'],
 ['wrong breadth date',o=>o.breadth.source_date='20261007'],
 ['wrong scope',o=>o.breadth.market_scope='TWSE_AND_TPEX'],
 ['not verified common stock',o=>o.breadth.verified_twse_common_stock_only=false],
 ['denominator mismatch',o=>o.breadth.denominator=11],
 ['missing limit up',o=>delete o.breadth.limit_up_count],
 ['trust source date',o=>o.institutional.investment_trust.source_date='20261007'],
 ['dealer arithmetic',o=>o.institutional.dealers.net_twd+=1],
 ['foreign scope',o=>o.institutional.foreign.market_scope='TWSE_AND_TPEX'],
 ['no regime',o=>o.market_regime=null],
 ['partial status',o=>o.status='partial']
]){const v=structuredClone(synthetic);mutate(v);assert(verify(v).length>0,name+' must fail');}
console.log('PASS: partial real record BLOCKED and 11 synthetic negative cases fail; synthetic fixture is NOT official-data proof');
