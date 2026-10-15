'use strict';
// Research-only unconditional editorial completeness gate. Missing source proof must fail.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const date='20261008',root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const opening=read('data_daily_gain_over_5/market-opening/'+date+'.json');
const errors=[];
const check=(ok,msg)=>{if(!ok)errors.push(msg);};
check(opening.target_date===date,'target date');
check(opening.market==='TWSE','TWSE market');
check(opening.status==='final','final status');
const b=opening.breadth;
for(const k of ['rising_count','falling_count','unchanged_count','limit_up_count','denominator']){
 check(Number.isInteger(b?.[k])&&b[k]>=0,'breadth '+k);
}
check(b?.market_scope==='TWSE'&&b?.source_date===date,'breadth source date/scope');
check(b?.verified_twse_common_stock_only===true,'ordinary-stock breadth identity');
if(b&&['rising_count','falling_count','unchanged_count','denominator'].every(k=>Number.isInteger(b[k])))check(b.rising_count+b.falling_count+b.unchanged_count===b.denominator,'breadth denominator');
for(const group of ['foreign','investment_trust','dealers']){
 const v=opening.institutional?.[group];
 check(v?.unit==='TWD'&&v?.market_scope==='TWSE'&&v?.source_date===date,group+' date/scope/unit');
 for(const k of ['buy_twd','sell_twd','net_twd'])check(Number.isSafeInteger(v?.[k]),group+' '+k);
 if(v&&['buy_twd','sell_twd','net_twd'].every(k=>Number.isSafeInteger(v[k])))check(v.buy_twd-v.sell_twd===v.net_twd,group+' arithmetic');
}
const t=opening.market_trading;
check(Number.isFinite(t?.turnover_twd)&&t.turnover_twd>0,'turnover');
check(Number.isFinite(t?.turnover_ma5_twd)&&t.turnover_ma5_twd>0,'turnover MA5');
check(t?.turnover_ma5_definition==='previous 5 TWSE trading days (excluding target)','MA5 methodology');
check(Array.isArray(opening.source_manifest)&&opening.source_manifest.length>=3,'source manifest');
check(opening.market_regime!==null&&typeof opening.market_regime==='object','market regime');
const proof={date,editorial_status:errors.length?'BLOCKED':'READY',missing_or_invalid:errors,visual_pass_is_not_editorial_pass:true};
console.log(JSON.stringify(proof,null,2));
if(errors.length)process.exitCode=1;
