'use strict';
// Phase 1: build a provenance-preserving, TWSE market-only PARTIAL snapshot.
// No breadth / official institutional aggregate fabrication. Never label this complete.
const fs=require('node:fs');
const path=require('node:path');
function buildPartialMarketOpening({marketChart,raw,date}) {
 if(!/^20\d{6}$/.test(date)) throw new Error('INVALID_DATE');
 const rows=marketChart?.data;
 if(!Array.isArray(rows)) throw new Error('MISSING_MARKET_CHART_DATA');
 const idx=rows.findIndex(r=>r.date===date);
 if(idx<5) throw new Error('INSUFFICIENT_PRIOR_TRADING_DAYS');
 const day=rows[idx],before=rows[idx-1],prior5=rows.slice(idx-5,idx);
 if(before.date>=date || !prior5.every(r=>Number.isFinite(r.turnover)))throw new Error('INVALID_PRIOR_DAYS');
 if(raw.target_date!==date || !Array.isArray(raw.stocks) || raw.stocks.length!==raw.stock_count)throw new Error('INVALID_GAINERS_SOURCE');
 const required=['open','high','low','close','volumeShares','turnover','transactions','foreignBuyAmount','foreignSellAmount','foreignNetAmount'];
 for(const key of required) if(!Number.isFinite(day[key]))throw new Error('MISSING_VALUE:'+key);
 const ma5=prior5.reduce((sum,r)=>sum+r.turnover,0)/5;
 return {
  schema_version:1,target_date:date,market:'TWSE',status:'partial',
  scope:'TWSE_MARKET_OFFICIAL_TOTALS;COMMON_STOCK_BREADTH_PENDING',
  taiex:{open:day.open,high:day.high,low:day.low,close:day.close,previous_close:before.close,change_points:Number((day.close-before.close).toFixed(2)),change_pct:Number(((day.close/before.close-1)*100).toFixed(4))},
  market_trading:{turnover_twd:day.turnover,shares:day.volumeShares,transactions:day.transactions,turnover_ma5_twd:ma5,turnover_ma5_definition:'previous 5 TWSE trading days (excluding target)',turnover_ratio_ma5:day.turnover/ma5},
  institutional:{foreign:{buy_twd:day.foreignBuyAmount,sell_twd:day.foreignSellAmount,net_twd:day.foreignNetAmount,unit:'TWD',market_scope:'TWSE',definition:'foreign and mainland investors excluding foreign dealers'}},
  preliminary_gainers:{count:raw.stock_count,source:'data_daily_gain_over_5/'+date+'.json',verified_twse_common_stock_only:false},
  breadth:null,sector_flows:null,market_regime:null,
  source_manifest:[
   {source_name:'TWSE MI_5MINS_HIST',source_date:date,market_scope:'TWSE',unit:'index points',verified:true,source_path_or_endpoint:'data_twse_market_chart/market_chart.json'},
   {source_name:'TWSE FMTQIK',source_date:date,market_scope:'TWSE',unit:'TWD/shares/trades',verified:true,source_path_or_endpoint:'data_twse_market_chart/market_chart.json'},
   {source_name:'TWSE BFI82U',source_date:date,market_scope:'TWSE',unit:'TWD',verified:true,source_path_or_endpoint:'data_twse_market_chart/market_chart.json'}
  ],
  quality:{missing_fields:['breadth','listed common-stock identity master','investment_trust total TWD','dealers total TWD','sector_flows','market_regime'],warnings:['Preliminary 5% stock count has not passed TWSE-only common-stock classification'],blocking_reasons:['COMPLETE_PUBLICATION_NOT_AUTHORIZED']},
  generated_from:'validated repository market chart + daily gainers raw data',
 };
}
function main(argv=process.argv.slice(2)){
 const date=argv[0];if(!date)throw new Error('Usage: node scripts/build_daily_gainers_market_opening_phase1.js YYYYMMDD');
 const root=path.resolve(__dirname,'..');
 const marketChart=JSON.parse(fs.readFileSync(path.join(root,'data_twse_market_chart/market_chart.json'),'utf8'));
 const raw=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5',date+'.json'),'utf8'));
 const snapshot=buildPartialMarketOpening({marketChart,raw,date});
 const out=path.join(root,'data_daily_gain_over_5/market-opening',date+'.json');
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(snapshot,null,2)+'\n');
 console.log(JSON.stringify({date,status:snapshot.status,output:path.relative(root,out),missing:snapshot.quality.missing_fields},null,2));
}
if(require.main===module)main();
module.exports={buildPartialMarketOpening};
