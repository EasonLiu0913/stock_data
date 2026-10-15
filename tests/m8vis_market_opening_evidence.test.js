'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),date='20261008';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const opening=read('data_daily_gain_over_5/market-opening/'+date+'.json');
const summary=read('data_daily_gain_over_5/market-summary/'+date+'.json');
const master=read('video_scripts/daily-gainers/v2/'+date+'/master.json');
assert.equal(opening.target_date,date);assert.equal(summary.target_date,date);assert.equal(master.target_date,date);
assert.equal(opening.market,'TWSE');
assert.equal(opening.market_trading.turnover_ma5_definition,'previous 5 TWSE trading days (excluding target)');
assert.equal(opening.institutional.foreign.unit,'TWD');
assert.equal(summary.breadth.stock_count,35);
assert.equal(opening.preliminary_gainers.verified_twse_common_stock_only,false);
const missing=[];
if(!opening.breadth||!Number.isInteger(opening.breadth.rising_count)||!Number.isInteger(opening.breadth.falling_count))missing.push('whole-market rising/falling breadth');
for(const group of ['foreign','investment_trust','dealers']){
 const item=opening.institutional?.[group];
 if(!item||!Number.isFinite(item.net_twd)||item.unit!=='TWD'||item.market_scope!=='TWSE')missing.push(group+' verified TWD net flow');
}
if(!Number.isFinite(opening.market_trading?.turnover_twd)||!Number.isFinite(opening.market_trading?.turnover_ma5_twd))missing.push('comparable turnover and five-day mean');
const ready=missing.length===0&&opening.status==='final';
if(process.env.REQUIRE_COMPLETE_MARKET_OPENING==='1')assert.ok(ready,'Opening evidence BLOCKED: '+missing.join('; '));
console.log(JSON.stringify({status:ready?'READY':'BLOCKED',date,missing,preview_is_not_editorial_pass:true}));
