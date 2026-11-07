'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateOpeningSnapshot}=require('./validate_daily_gainers_market_opening');

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const parseCount=value=>{const m=String(value).match(/^([\d,]+)(?:\(([\d,]+)\))?$/);if(!m)throw new Error('INVALID_MI_INDEX_COUNT:'+value);return {count:Number(m[1].replaceAll(',','')),secondary:m[2]?Number(m[2].replaceAll(',','')):0};};
function buildOpening({date,miIndex,miBytes,marketChart,chartBytes,bfi82u,bfiBytes,receipt}){
 if(!/^20\d{6}$/.test(date)||miIndex.date!==date||bfi82u.target_date!==date)throw new Error('SOURCE_DATE_MISMATCH');
 if(receipt?.target_date!==date||receipt.status!=='PASS'||receipt.source_sha256?.mi_index?.sha256!==sha256(miBytes))throw new Error('OFFICIAL_NUMERIC_RECEIPT_MISMATCH');
 const day=marketChart.data.find(x=>x.date===date),prior=marketChart.data.filter(x=>x.date<date).slice(-5);
 if(!day||prior.length!==5||!prior.every((x,i)=>i===0||prior[i-1].date<x.date))throw new Error('MARKET_CHART_OR_PRIOR_DAYS_MISSING');
 const table=miIndex.tables.find(x=>x.title==='漲跌證券數合計'&&x.fields?.includes('股票'));
 if(!table)throw new Error('MI_INDEX_STOCK_COLUMN_MISSING');
 const column=table.fields.indexOf('股票'),rows=new Map(table.data.map(row=>[row[0],row[column]]));
 const up=parseCount(rows.get('上漲(漲停)')),down=parseCount(rows.get('下跌(跌停)'));
 const unchanged=parseCount(rows.get('持平')).count,noTrade=parseCount(rows.get('未成交')).count,noComparison=parseCount(rows.get('無比價')).count;
 const indexTable=miIndex.tables.find(x=>String(x.title).endsWith('價格指數(臺灣證券交易所)')&&x.fields?.includes('收盤指數'));
 const indexRow=indexTable?.data.find(row=>row[0]==='發行量加權股價指數');
 if(!indexRow)throw new Error('MI_INDEX_TAiex_ROW_MISSING');
 const miClose=Number(indexRow[indexTable.fields.indexOf('收盤指數')].replaceAll(',',''));
 if(Math.abs(miClose-day.close)>0.01)throw new Error('MI_INDEX_CHART_CLOSE_MISMATCH');
 if(bfi82u.market!=='TWSE'||bfi82u.unit!=='TWD'||!bfi82u.foreign||!bfi82u.investment_trust||!bfi82u.dealers)throw new Error('INVALID_BFI82U_SOURCE');
 if(bfi82u.raw_response&&sha256(bfi82u.raw_response)!==bfi82u.raw_response_sha256)throw new Error('BFI82U_RAW_HASH_MISMATCH');
 const total=up.count+down.count+unchanged+noTrade+noComparison;
 const source=(name,sourceDate,scope,unit,fileBytes,url)=>({source_name:name,source_date:sourceDate,market_scope:scope,unit,verified:true,sha256:sha256(fileBytes),source_path_or_endpoint:url});
 const miSource=source('TWSE MI_INDEX',date,'TWSE','official stock column counts and index',miBytes,'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date='+date+'&type=ALL');
 const chartSource=source('TWSE FMTQIK / MI_5MINS_HIST',date,'TWSE','index points, turnover TWD, shares and transactions',chartBytes,'data_twse_market_chart/market_chart.json');
 const bfiSource=source('TWSE BFI82U',date,'TWSE','TWD',bfiBytes,bfi82u.source_url);
 const opening={schema_version:3,target_date:date,market:'TWSE',status:'verified_official_market_aggregate',scope:'TWSE_OFFICIAL_MARKET_OPENING',
  index:{source_date:date,close:day.close,previous_close:prior.at(-1).close,change_points:Number((day.close-prior.at(-1).close).toFixed(2)),change_pct:Number(((day.close/prior.at(-1).close-1)*100).toFixed(4))},
  trading:{source_date:date,scope:'TWSE_WHOLE_MARKET',turnover_twd:day.turnover,shares:day.volumeShares,transactions:day.transactions,turnover_ma5_twd:prior.reduce((s,x)=>s+x.turnover,0)/5,turnover_ratio_ma5:day.turnover/(prior.reduce((s,x)=>s+x.turnover,0)/5)},
  market_opening_breadth:{scope:'TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN',source_date:date,advancers:up.count,limit_up:up.secondary,decliners:down.count,limit_down:down.secondary,unchanged,no_trade:noTrade,no_comparison:noComparison,eligible_count:total,source_manifest:[miSource]},
  institutional:{scope:'TWSE_BFI82U_TWD',source_date:date,foreign:{...bfi82u.foreign,unit:'TWD',market_scope:'TWSE'},investment_trust:{...bfi82u.investment_trust,unit:'TWD',market_scope:'TWSE'},dealers:{...bfi82u.dealers,unit:'TWD',market_scope:'TWSE'},foreign_net_twd:bfi82u.foreign.net_twd,investment_trust_net_twd:bfi82u.investment_trust.net_twd,dealers_net_twd:bfi82u.dealers.net_twd,total_net_twd:bfi82u.total.net_twd},
  source_manifest:[miSource,chartSource,bfiSource],
  source_receipts:{official_numeric_receipt_path:'data_daily_gain_over_5/verification/official-numeric/'+date+'.json',official_numeric_receipt_run_id:receipt.workflow?.run_id||null,bfi82u_capture_method:bfi82u.capture_method,bfi82u_raw_response_sha256:bfi82u.raw_response_sha256||null},
  generation:{builder:'scripts/build_daily_gainers_market_opening_video.js',version:1,deterministic:true}
 };
 validateOpeningSnapshot(opening);
 return opening;
}
function main(argv=process.argv.slice(2)){
 const date=argv[0];if(!/^20\d{6}$/.test(date||''))throw new Error('Usage: node scripts/build_daily_gainers_market_opening_video.js YYYYMMDD');
 const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p));
 const miPath=`data_twse_mi_index/${date}_twse_mi_index.json`,chartPath='data_twse_market_chart/market_chart.json',bfiPath=`data_twse_bfi82u/${date}_twse_bfi82u.json`,receiptPath=`data_daily_gain_over_5/verification/official-numeric/${date}.json`;
 const miBytes=read(miPath),chartBytes=read(chartPath),bfiBytes=read(bfiPath),receipt=JSON.parse(read(receiptPath));
 const snapshot=buildOpening({date,miIndex:JSON.parse(miBytes),miBytes,marketChart:JSON.parse(chartBytes),chartBytes,bfi82u:JSON.parse(bfiBytes),bfiBytes,receipt});
 const output=`data_daily_gain_over_5/market-opening-video/${date}.json`;fs.mkdirSync(path.dirname(path.join(root,output)),{recursive:true});fs.writeFileSync(path.join(root,output),JSON.stringify(snapshot,null,2)+'\n');
 console.log(JSON.stringify({date,status:snapshot.status,output,market_opening_breadth:snapshot.market_opening_breadth,institutional:snapshot.institutional},null,2));
}
if(require.main===module)main();
module.exports={buildOpening,parseCount,sha256};
