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
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-entry-timing.json');
const PRICE_LOADERS = [loadFromHistorySma, loadFromLegacyFubon, loadFromTwseMiIndex];
const HORIZONS = [20, 40, 60];
const ENTRY_WINDOW = 20;
const ELECTRONIC_INDUSTRIES = new Set([
  '半導體業','電腦及週邊設備業','光電業','通信網路業','電子零組件業','電子通路業','資訊服務業','其他電子業','電子工業',
]);
const ENTRY_RULES = [
  { id:'immediate', name:'訊號基準日直接進場' },
  { id:'pullback_5', name:'20日內首次回檔 -5%' },
  { id:'pullback_10', name:'20日內首次回檔 -10%' },
  { id:'breakout_10d', name:'20日內首次收盤突破前10日最高收盤' },
  { id:'sma20_reclaim', name:'20日內首次收盤站回 SMA20' },
];

const mean = xs => { const a=xs.filter(Number.isFinite); return a.length?a.reduce((s,v)=>s+v,0)/a.length:null; };
const median = xs => { const a=xs.filter(Number.isFinite).sort((a,b)=>a-b); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
const round = (v,d=4) => Number.isFinite(v)?Number(v.toFixed(d)):null;
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
  const out=[];
  const diagnostics={electronic_fas8_events:0,missing_known_financial:0,invalid_financial_score:0,financial_below_10:0,missing_base_trading_date:0,included:0};
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
      if(!financial){ diagnostics.missing_known_financial++; continue; }
      const financialScore=Number(financial.financial_quality_score);
      if(!Number.isFinite(financialScore)){ diagnostics.invalid_financial_score++; continue; }
      if(financialScore<10){ diagnostics.financial_below_10++; continue; }
      if(!event.base_trading_date){ diagnostics.missing_base_trading_date++; continue; }
      out.push({month,stock_id:stockId,industry:row.industry||'未分類',base_trading_date:event.base_trading_date,monthly_score:Number(monthly.total_score),financial_score:financialScore});
      diagnostics.included++;
    }
  }
  return {candidates:out,diagnostics};
}
function sma(values,n){ if(values.length<n)return null; const a=values.slice(-n).filter(Number.isFinite); return a.length===n?a.reduce((s,v)=>s+v,0)/n:null; }
function findEntry(event,rule,marketRows,indexByDate){
  const baseIndex=indexByDate.get(event.base_trading_date); if(!Number.isInteger(baseIndex))return null;
  const base=getPrice(event.stock_id,event.base_trading_date); if(!base?.close)return null;
  if(rule.id==='immediate')return {entry_index:baseIndex,entry_date:event.base_trading_date,entry_price:base.close,wait_days:0};
  const closes=[];
  for(let i=Math.max(0,baseIndex-25);i<=baseIndex;i++){ const p=getPrice(event.stock_id,marketRows[i].date); closes.push(p?.close??null); }
  for(let offset=1;offset<=ENTRY_WINDOW;offset++){
    const idx=baseIndex+offset,date=marketRows[idx]?.date; if(!date)return null;
    const p=getPrice(event.stock_id,date); if(!p?.close)continue;
    if(rule.id==='pullback_5' && Number.isFinite(p.low) && p.low<=base.close*0.95) return {entry_index:idx,entry_date:date,entry_price:base.close*0.95,wait_days:offset};
    if(rule.id==='pullback_10' && Number.isFinite(p.low) && p.low<=base.close*0.90) return {entry_index:idx,entry_date:date,entry_price:base.close*0.90,wait_days:offset};
    if(rule.id==='breakout_10d'){
      const prev=[]; for(let j=Math.max(0,idx-10);j<idx;j++){ const q=getPrice(event.stock_id,marketRows[j].date); if(Number.isFinite(q?.close))prev.push(q.close); }
      if(prev.length===10 && p.close>Math.max(...prev)) return {entry_index:idx,entry_date:date,entry_price:p.close,wait_days:offset};
    }
    if(rule.id==='sma20_reclaim'){
      const series=[]; for(let j=Math.max(0,idx-19);j<=idx;j++){ const q=getPrice(event.stock_id,marketRows[j].date); if(Number.isFinite(q?.close))series.push(q.close); }
      const s=sma(series,20); if(Number.isFinite(s)&&p.close>=s) return {entry_index:idx,entry_date:date,entry_price:p.close,wait_days:offset};
    }
  }
  return null;
}
function evaluate(event,entry,horizon,marketRows){
  const target=marketRows[entry.entry_index+horizon]; if(!target)return null;
  let maxHigh=-Infinity,minLow=Infinity;
  for(let i=1;i<=horizon;i++){
    const d=marketRows[entry.entry_index+i]?.date; if(!d)return null;
    const p=getPrice(event.stock_id,d); if(!p)continue;
    if(Number.isFinite(p.high))maxHigh=Math.max(maxHigh,p.high);
    if(Number.isFinite(p.low))minLow=Math.min(minLow,p.low);
  }
  const end=getPrice(event.stock_id,target.date); if(!end?.close||!Number.isFinite(maxHigh)||!Number.isFinite(minLow))return null;
  const endpoint=((end.close/entry.entry_price)-1)*100;
  const mfe=((maxHigh/entry.entry_price)-1)*100;
  const mae=((minLow/entry.entry_price)-1)*100;
  return {endpoint_pct:endpoint,mfe_pct:mfe,mae_pct:mae,wait_days:entry.wait_days};
}
function summarize(rows,totalCandidates){
  const n=rows.length;
  return {samples:n,trigger_rate_pct:round(totalCandidates?100*n/totalCandidates:null),avg_wait_days:round(mean(rows.map(r=>r.wait_days))),median_wait_days:round(median(rows.map(r=>r.wait_days))),avg_endpoint_pct:round(mean(rows.map(r=>r.endpoint_pct))),median_endpoint_pct:round(median(rows.map(r=>r.endpoint_pct))),avg_mfe_pct:round(mean(rows.map(r=>r.mfe_pct))),median_mfe_pct:round(median(rows.map(r=>r.mfe_pct))),avg_mae_pct:round(mean(rows.map(r=>r.mae_pct))),median_mae_pct:round(median(rows.map(r=>r.mae_pct))),endpoint_ge20_rate:round(n?100*rows.filter(r=>r.endpoint_pct>=20).length/n:null),endpoint_ge30_rate:round(n?100*rows.filter(r=>r.endpoint_pct>=30).length/n:null),mfe_ge30_rate:round(n?100*rows.filter(r=>r.mfe_pct>=30).length/n:null),mfe_ge50_rate:round(n?100*rows.filter(r=>r.mfe_pct>=50).length/n:null)};
}
function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv),start=args.get('start-month')||'202401',end=args.get('end-month')||'202606';
  const history=loadRevenueHistory(),financialByStock=loadFinancialMaster(),marketRows=loadMarketRows(),indexByDate=new Map(marketRows.map((r,i)=>[r.date,i]));
  const loaded=loadCandidates(start,end,history,financialByStock),candidates=loaded.candidates,rows=[];
  for(const rule of ENTRY_RULES){
    const entries=[]; let processed=0;
    for(const event of candidates){ const e=findEntry(event,rule,marketRows,indexByDate); if(e)entries.push([event,e]); if(++processed%20===0)clearCaches(); }
    clearCaches();
    for(const horizon of HORIZONS){
      const results=[]; processed=0;
      for(const [event,entry] of entries){ const r=evaluate(event,entry,horizon,marketRows); if(r)results.push(r); if(++processed%20===0)clearCaches(); }
      clearCaches();
      rows.push({rule_id:rule.id,rule_name:rule.name,horizon:`d${horizon}`,...summarize(results,candidates.length)});
    }
  }
  const direct=Object.fromEntries(rows.filter(r=>r.rule_id==='immediate').map(r=>[r.horizon,r]));
  for(const row of rows){ const b=direct[row.horizon]; row.vs_immediate={median_endpoint_delta_pct:round((row.median_endpoint_pct??NaN)-(b?.median_endpoint_pct??NaN)),median_mfe_delta_pct:round((row.median_mfe_pct??NaN)-(b?.median_mfe_pct??NaN)),median_mae_improvement_pct:round((row.median_mae_pct??NaN)-(b?.median_mae_pct??NaN))}; }
  const out={schema_version:2,dataset:'two_stage_fundamental_quality_entry_timing',generated_at:new Date().toISOString(),start_month:start,end_month:end,methodology:{status:'research_only',universe:'electronic stocks with FAS>=8 and latest-known FQ>=10',entry_window_trading_days:ENTRY_WINDOW,entry_rules:ENTRY_RULES,horizons:HORIZONS.map(h=>`d${h}`),pullback_fill_rule:'assume limit price fills when daily low touches base close * threshold; no intraday ordering assumptions beyond touch',breakout_rule:'first close within 20 trading days above prior 10 trading-day highest close',sma20_rule:'first close within 20 trading days at or above contemporaneous 20-day SMA',anti_lookahead:'all entry decisions use only prices available through the entry date; events with no financial score known by signal date are excluded rather than inferred',caution:'research only; transaction costs, gaps and slippage are not modeled'},coverage:{candidate_events:candidates.length,...loaded.diagnostics},rows};
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true}); fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(ROOT,OUTPUT),candidates:candidates.length,candidate_diagnostics:loaded.diagnostics,rows:rows.length},null,2));
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
module.exports={ENTRY_RULES,HORIZONS,findEntry,evaluate,summarize,loadCandidates};
