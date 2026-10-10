'use strict';
function compile(ledger){
 if(ledger?.contract!=='M3-MARKET-REGIME-PHRASING-v1'||ledger.publication_authorized!==false)throw Error('LEDGER_SCOPE');
 const e=Object.fromEntries(ledger.evidence.map(x=>[x.id,x]));
 const ids=['index','breadth','turnover','institutional','sector','gainers'];
 if(ids.some(k=>!e[k]||e[k].date!==ledger.date||!e[k].source))throw Error('MISSING_SOURCE');
 const b=e.breadth.value,i=e.institutional.value;
 if(e.index.unit!=='index_points'||e.breadth.unit!=='securities_count'||['turnover','institutional','sector'].some(k=>e[k].unit!=='TWD'))throw Error('WRONG_UNIT');
 if([b.advance,b.decline,b.unchanged,b.no_trade,b.no_comparison].reduce((a,v)=>a+v,0)!==1082)throw Error('WRONG_BREADTH');
 if(i.total.net_twd!==i.groups.foreign.net_twd+i.groups.trust.net_twd+i.groups.dealers.net_twd)throw Error('WRONG_INSTITUTION_SUM');
 if(e.sector.value.turnover_not_institutional_net!==true||e.gainers.value!==35)throw Error('WRONG_SCOPE');
 const make=(id,refs,text)=>({claim_id:id,date:ledger.date,evidence_ids:refs,source_refs:refs.map(k=>e[k].source),text,publication_authorized:false});
 return [
 make('index_breadth',['index','breadth'],`指數漲跌${e.index.value}點；官方股票欄上漲${b.advance}、下跌${b.decline}、持平${b.unchanged}、未成交${b.no_trade}、無比價${b.no_comparison}，僅描述當日現象`),
 make('turnover',['turnover'],`TWSE整體市場成交金額${e.turnover.value}元，不能稱為僅普通股成交額；發布口徑待認證`),
 make('institutional',['institutional'],`三大法人買賣超合計${i.total.net_twd}元，外資${i.groups.foreign.net_twd}元，投信${i.groups.trust.net_twd}元，自營商${i.groups.dealers.net_twd}元；不推論買賣對手；發布口徑待認證`),
 make('sector',['sector'],`產業成交分類${e.sector.value.category_count}項，有重疊分類，不能視為法人資金淨流入`),
 make('gainers',['gainers'],`觀察到${e.gainers.value}檔達5%標的，不代表全部上市普通股`)
 ];
}
function verify(ledger,claims){
 const expected=compile(ledger);
 if(!Array.isArray(claims)||claims.length!==expected.length||JSON.stringify(claims)!==JSON.stringify(expected))throw Error('CLAIM_TEXT_VALUE_SOURCE_MISMATCH');
 return {checked:claims.length,publication_authorized:false};
}
if(require.main===module){const {build}=require('./build_daily_gainers_m3_regime_assertions');const ledger=build();const claims=compile(ledger);verify(ledger,claims);console.log(JSON.stringify({date:ledger.date,claims,publication_authorized:false},null,2));}
module.exports={compile,verify};
