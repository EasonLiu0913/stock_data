#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  getDailyPrice,
  clearCaches,
  loadFromHistorySma,
  loadFromLegacyFubon,
  loadFromTwseMiIndex,
} = require('./lib/stock_price_provider');
const { scoreComponents } = require('./summarize_mops_revenue_fundamental_acceleration_score');
const { latestKnownFinancial } = require('./summarize_two_stage_fundamental_quality_long_horizons');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const MASTER_FILE = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'financial-quality-master.json');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-entry-timing-paired.json');
const PRICE_LOADERS = [loadFromHistorySma, loadFromLegacyFubon, loadFromTwseMiIndex];
const HORIZONS = [20, 40, 60];
const ENTRY_WINDOW = 20;
const PULLBACKS = [
  { id: 'pullback_5', name: '20日內首次回檔 -5%', threshold: 0.95 },
  { id: 'pullback_10', name: '20日內首次回檔 -10%', threshold: 0.90 },
];
const ELECTRONIC_INDUSTRIES = new Set([
  '半導體業','電腦及週邊設備業','光電業','通信網路業','電子零組件業','電子通路業','資訊服務業','其他電子業','電子工業',
]);

const mean = xs => { const a = xs.filter(Number.isFinite); return a.length ? a.reduce((s,v)=>s+v,0)/a.length : null; };
const median = xs => { const a = xs.filter(Number.isFinite).sort((a,b)=>a-b); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
const round = (v,d=4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
function pct(n,d){ return d ? round(n/d*100) : null; }
function readJson(file,fallback=null){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;} }
function parseArgs(argv){ const m=new Map(); for(let i=0;i<argv.length;i++){ if(!argv[i].startsWith('--'))continue; m.set(argv[i].slice(2),argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true); } return m; }
function loadRevenueHistory(){
  const byMonth=new Map(),byStock=new Map();
  for(const entry of fs.readdirSync(REVENUE_ROOT,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^20\d{4}$/.test(e.name))){
    const month=entry.name,p=readJson(path.join(REVENUE_ROOT,month,'monthly_revenue.json'),{}),map=new Map();
    for(const row of p.companies||[]){ const id=String(row.stock_code); map.set(id,row); if(!byStock.has(id))byStock.set(id,new Map()); byStock.get(id).set(month,row); }
    byMonth.set(month,map);
  }
  return {byMonth,byStock};
}
function loadFinancialMaster(){ const p=readJson(MASTER_FILE); if(!p||!Array.isArray(p.stocks))throw new Error('Missing financial-quality-master.json'); return new Map(p.stocks.map(s=>[String(s.stock_id),s.rows||[]])); }
function loadMarketRows(){ const p=readJson(MARKET_FILE,{}); return (p.data||[]).filter(r=>/^20\d{6}$/.test(String(r.date))&&Number.isFinite(Number(r.close))).map(r=>({date:String(r.date),close:Number(r.close)})).sort((a,b)=>a.date.localeCompare(b.date)); }
function getPrice(stockId,date){ return getDailyPrice(stockId,date,{root:ROOT,loaders:PRICE_LOADERS}); }
function loadCandidates(start,end,history,financialByStock){
  const out=[]; const diagnostics={electronic_fas8_events:0,missing_known_financial:0,financial_below_10:0,included:0};
  const months=fs.readdirSync(SIGNAL_ROOT).filter(n=>/^20\d{4}\.json$/.test(n)).map(n=>n.slice(0,6)).filter(m=>(!start||m>=start)&&(!end||m<=end)).sort();
  for(const month of months){
    const payload=readJson(path.join(SIGNAL_ROOT,`${month}.json`),{}),revMap=history.byMonth.get(month)||new Map();
    for(const event of payload.events||[]){
      const stockId=String(event.stock_code),row=revMap.get(stockId)||{};
      if(!ELECTRONIC_INDUSTRIES.has(row.industry||'未分類'))continue;
      const monthly=scoreComponents(event,month,history.byStock.get(stockId));
      if(Number(monthly.total_score)<8)continue;
      diagnostics.electronic_fas8_events++;
      const eventDate=event.effective_trading_date||event.conservative_availability_date||null;
      const financial=latestKnownFinancial(financialByStock.get(stockId)||[],eventDate);
      if(!financial||!Number.isFinite(Number(financial.financial_quality_score))){ diagnostics.missing_known_financial++; continue; }
      if(Number(financial.financial_quality_score)<10){ diagnostics.financial_below_10++; continue; }
      if(!event.base_trading_date)continue;
      out.push({month,stock_id:stockId,base_trading_date:event.base_trading_date}); diagnostics.included++;
    }
  }
  return {out,diagnostics};
}
function findPullback(event,rule,marketRows,indexByDate){
  const baseIndex=indexByDate.get(event.base_trading_date); if(!Number.isInteger(baseIndex))return null;
  const base=getPrice(event.stock_id,event.base_trading_date); if(!base?.close)return null;
  const limit=base.close*rule.threshold;
  for(let offset=1;offset<=ENTRY_WINDOW;offset++){
    const idx=baseIndex+offset,date=marketRows[idx]?.date; if(!date)return null;
    const p=getPrice(event.stock_id,date); if(Number.isFinite(p?.low)&&p.low<=limit){
      return {base_index:baseIndex,base_price:base.close,entry_index:idx,entry_date:date,entry_price:limit,wait_days:offset};
    }
  }
  return null;
}
function pathStats(stockId,entryIndex,entryPrice,exitIndex,marketRows){
  if(exitIndex<=entryIndex)return null;
  let maxHigh=-Infinity,minLow=Infinity;
  for(let idx=entryIndex+1;idx<=exitIndex;idx++){
    const date=marketRows[idx]?.date; if(!date)return null;
    const p=getPrice(stockId,date); if(!p)continue;
    if(Number.isFinite(p.high))maxHigh=Math.max(maxHigh,p.high);
    if(Number.isFinite(p.low))minLow=Math.min(minLow,p.low);
  }
  const exitDate=marketRows[exitIndex]?.date, end=getPrice(stockId,exitDate);
  if(!end?.close||!Number.isFinite(maxHigh)||!Number.isFinite(minLow))return null;
  return {
    endpoint_pct:((end.close/entryPrice)-1)*100,
    mfe_pct:((maxHigh/entryPrice)-1)*100,
    mae_pct:((minLow/entryPrice)-1)*100,
  };
}
function pairEvent(event,entry,horizon,marketRows,mode){
  const directEntry={entry_index:entry.base_index,entry_price:entry.base_price};
  let directExit,delayedExit;
  if(mode==='same_holding'){
    directExit=directEntry.entry_index+horizon;
    delayedExit=entry.entry_index+horizon;
  }else if(mode==='same_exit_date'){
    directExit=directEntry.entry_index+horizon;
    delayedExit=directExit;
    if(delayedExit<=entry.entry_index)return null;
  }else throw new Error(`Unknown mode ${mode}`);
  if(!marketRows[directExit]||!marketRows[delayedExit])return null;
  const direct=pathStats(event.stock_id,directEntry.entry_index,directEntry.entry_price,directExit,marketRows);
  const delayed=pathStats(event.stock_id,entry.entry_index,entry.entry_price,delayedExit,marketRows);
  if(!direct||!delayed)return null;
  return {
    wait_days:entry.wait_days,
    direct,delayed,
    delta_endpoint_pct:delayed.endpoint_pct-direct.endpoint_pct,
    delta_mfe_pct:delayed.mfe_pct-direct.mfe_pct,
    delta_mae_pct:delayed.mae_pct-direct.mae_pct,
  };
}
function summarizePairs(pairs,totalTriggered){
  const n=pairs.length;
  return {
    samples:n,
    mature_pair_rate_pct:pct(n,totalTriggered),
    avg_wait_days:round(mean(pairs.map(x=>x.wait_days))),median_wait_days:round(median(pairs.map(x=>x.wait_days))),
    direct:{median_endpoint_pct:round(median(pairs.map(x=>x.direct.endpoint_pct))),median_mfe_pct:round(median(pairs.map(x=>x.direct.mfe_pct))),median_mae_pct:round(median(pairs.map(x=>x.direct.mae_pct))),endpoint_ge30_rate:pct(pairs.filter(x=>x.direct.endpoint_pct>=30).length,n),mfe_ge50_rate:pct(pairs.filter(x=>x.direct.mfe_pct>=50).length,n)},
    delayed:{median_endpoint_pct:round(median(pairs.map(x=>x.delayed.endpoint_pct))),median_mfe_pct:round(median(pairs.map(x=>x.delayed.mfe_pct))),median_mae_pct:round(median(pairs.map(x=>x.delayed.mae_pct))),endpoint_ge30_rate:pct(pairs.filter(x=>x.delayed.endpoint_pct>=30).length,n),mfe_ge50_rate:pct(pairs.filter(x=>x.delayed.mfe_pct>=50).length,n)},
    paired_delta:{
      avg_endpoint_pct:round(mean(pairs.map(x=>x.delta_endpoint_pct))),median_endpoint_pct:round(median(pairs.map(x=>x.delta_endpoint_pct))),endpoint_improved_rate:pct(pairs.filter(x=>x.delta_endpoint_pct>0).length,n),
      avg_mfe_pct:round(mean(pairs.map(x=>x.delta_mfe_pct))),median_mfe_pct:round(median(pairs.map(x=>x.delta_mfe_pct))),mfe_improved_rate:pct(pairs.filter(x=>x.delta_mfe_pct>0).length,n),
      avg_mae_pct:round(mean(pairs.map(x=>x.delta_mae_pct))),median_mae_pct:round(median(pairs.map(x=>x.delta_mae_pct))),mae_improved_rate:pct(pairs.filter(x=>x.delta_mae_pct>0).length,n),
    },
  };
}
function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv),start=args.get('start-month')||'202401',end=args.get('end-month')||'202606';
  const history=loadRevenueHistory(),financialByStock=loadFinancialMaster(),marketRows=loadMarketRows(),indexByDate=new Map(marketRows.map((r,i)=>[r.date,i]));
  const loaded=loadCandidates(start,end,history,financialByStock),candidates=loaded.out,rows=[],triggeredCoverage={};
  for(const rule of PULLBACKS){
    const triggered=[]; let processed=0;
    for(const event of candidates){ const entry=findPullback(event,rule,marketRows,indexByDate); if(entry)triggered.push([event,entry]); if(++processed%20===0)clearCaches(); }
    clearCaches(); triggeredCoverage[rule.id]={triggered_events:triggered.length,trigger_rate_pct:pct(triggered.length,candidates.length)};
    for(const horizon of HORIZONS){
      for(const mode of ['same_holding','same_exit_date']){
        const pairs=[]; processed=0;
        for(const [event,entry] of triggered){ const x=pairEvent(event,entry,horizon,marketRows,mode); if(x)pairs.push(x); if(++processed%20===0)clearCaches(); }
        clearCaches();
        rows.push({rule_id:rule.id,rule_name:rule.name,horizon:`d${horizon}`,comparison_mode:mode,...summarizePairs(pairs,triggered.length)});
      }
    }
  }
  const out={schema_version:1,dataset:'two_stage_fundamental_quality_entry_timing_paired',generated_at:new Date().toISOString(),start_month:start,end_month:end,methodology:{status:'research_only',universe:'electronic FAS>=8 + latest-known FQ>=10',entry_window_trading_days:ENTRY_WINDOW,pullback_rules:PULLBACKS,horizons:HORIZONS.map(h=>`d${h}`),same_holding:'direct and delayed entries each hold the same number of trading days after their own entry',same_exit_date:'both entries are evaluated at the direct-entry D20/D40/D60 calendar exit date; isolates entry-price/timing advantage from horizon shift',fill_rule:'limit assumed filled when daily low touches base close * threshold; no gap/slippage modeling',anti_lookahead:'factor membership and entry triggers only use information available by signal/entry date'},coverage:{candidate_events:candidates.length,diagnostics:loaded.diagnostics,triggered:triggeredCoverage},rows};
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true}); fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(ROOT,OUTPUT),candidates:candidates.length,triggered:triggeredCoverage,rows:rows.length},null,2));
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
module.exports={PULLBACKS,HORIZONS,findPullback,pairEvent,summarizePairs};
