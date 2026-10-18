'use strict';
// Research-only dated base, derived from repo market chart and independently verified BFI82U archive.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {inspect}=require('./research_date_to_video_bfi82u_v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(root,date,out){
 assert.match(date,/^20\d{6}$/);const source=path.join(root,'data_twse_market_chart/market_chart.json'),bytes=fs.readFileSync(source),chart=JSON.parse(bytes);
 assert.equal(chart.sources.ohlc,'TWSE MI_5MINS_HIST');assert.equal(chart.sources.volume,'TWSE FMTQIK');assert.equal(chart.units.turnover,'TWD');
 const rows=chart.data,idx=rows.findIndex(r=>r.date===date);assert.ok(idx>0,'DATED_CHART_ROW_AND_PREVIOUS_REQUIRED');assert.equal(rows.filter(r=>r.date===date).length,1,'DUPLICATE_CHART_DATE');
 const r=rows[idx],prev=rows[idx-1],inst=inspect(root,date);assert.equal(inst.status,'VERIFIED','DATED_BFI82U_REQUIRED');assert.equal(inst.final_six_rows_verified,true);
 for(const k of ['open','high','low','close'])assert.ok(Number.isFinite(r[k])&&r[k]>0,'INVALID_INDEX_'+k);
 for(const k of ['turnover','volumeShares','transactions'])assert.ok(Number.isSafeInteger(r[k])&&r[k]>0,'INVALID_TRADING_'+k);
 assert.equal(r.foreignBuyAmount,inst.institutional.foreign.buy_twd,'CHART_FOREIGN_BUY_MISMATCH');assert.equal(r.foreignSellAmount,inst.institutional.foreign.sell_twd,'CHART_FOREIGN_SELL_MISMATCH');assert.equal(r.foreignNetAmount,inst.institutional.foreign.net_twd,'CHART_FOREIGN_NET_MISMATCH');
 const change=Number((r.close-prev.close).toFixed(2));const base={schema_version:1,target_date:date,market:'TWSE',status:'partial',scope:'TWSE_MARKET_OFFICIAL_TOTALS;COMMON_STOCK_BREADTH_PENDING',taiex:{open:r.open,high:r.high,low:r.low,close:r.close,previous_close:prev.close,change_points:change,change_pct:Number((change/prev.close*100).toFixed(4))},market_trading:{turnover_twd:r.turnover,shares:r.volumeShares,transactions:r.transactions},institutional:Object.fromEntries(['foreign','investment_trust','dealers'].map(k=>[k,inst.institutional[k]])),breadth:null,source_manifest:[{source_name:'TWSE MI_5MINS_HIST + FMTQIK dated repository chart',source_date:date,source_sha256:sha(bytes),source_path_or_endpoint:'data_twse_market_chart/market_chart.json'},{source_name:'TWSE BFI82U final six-row archive',source_date:date,source_sha256:inst.raw_sha256,source_path_or_endpoint:'data_research/twse-market-opening/primary-archive/'+date+'/'+date+'-bfi82u.json'}],quality:{missing_fields:['common-stock identity certification','independent editorial review'],blocking_reasons:['COMPLETE_PUBLICATION_NOT_AUTHORIZED']},research_only:true,publication_authorized:false};
 const dest=path.join(out,date+'.json');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(dest,JSON.stringify(base,null,2)+'\n',{flag:'wx'});return {target_date:date,path:dest,chart_sha256:sha(bytes),bfi82u_sha256:inst.raw_sha256,turnover_twd:r.turnover,change_points:change,publication_authorized:false};
}
if(require.main===module){try{console.log(JSON.stringify(build(process.argv[3]||'.',process.argv[2],process.argv[4]||'/tmp/research-market-opening-base'),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={build};
