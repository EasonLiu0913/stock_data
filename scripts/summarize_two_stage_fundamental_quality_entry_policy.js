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
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-entry-policy.json');
const PRICE_LOADERS = [loadFromHistorySma, loadFromLegacyFubon, loadFromTwseMiIndex];
const HORIZONS = [20, 40, 60];
const MAX_WAIT = 20;
const ELECTRONIC_INDUSTRIES = new Set([
  '半導體業','電腦及週邊設備業','光電業','通信網路業','電子零組件業','電子通路業','資訊服務業','其他電子業','電子工業',
]);
const POLICIES = [
  { id: 'direct', name: '訊號日直接進場', type: 'direct' },
  { id: 'pullback_5_skip', name: '最多等20日 -5%，未觸發放棄', type: 'pullback', threshold: 0.95, pullback_pct: -5, fallback_day: null },
  { id: 'pullback_5_fallback_d5', name: '等 -5%，第5日未觸發則收盤進場', type: 'pullback', threshold: 0.95, pullback_pct: -5, fallback_day: 5 },
  { id: 'pullback_5_fallback_d10', name: '等 -5%，第10日未觸發則收盤進場', type: 'pullback', threshold: 0.95, pullback_pct: -5, fallback_day: 10 },
  { id: 'pullback_5_fallback_d20', name: '等 -5%，第20日未觸發則收盤進場', type: 'pullback', threshold: 0.95, pullback_pct: -5, fallback_day: 20 },
  { id: 'pullback_10_skip', name: '最多等20日 -10%，未觸發放棄', type: 'pullback', threshold: 0.90, pullback_pct: -10, fallback_day: null },
  { id: 'pullback_10_fallback_d5', name: '等 -10%，第5日未觸發則收盤進場', type: 'pullback', threshold: 0.90, pullback_pct: -10, fallback_day: 5 },
  { id: 'pullback_10_fallback_d10', name: '等 -10%，第10日未觸發則收盤進場', type: 'pullback', threshold: 0.90, pullback_pct: -10, fallback_day: 10 },
  { id: 'pullback_10_fallback_d20', name: '等 -10%，第20日未觸發則收盤進場', type: 'pullback', threshold: 0.90, pullback_pct: -10, fallback_day: 20 },
];

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
      out.push({month,stock_id:stockId,stock_name:row.company_name||event.company_name||null,base_trading_date:event.base_trading_date}); diagnostics.included++;
    }
  }
  return {out,diagnostics};
}
function directEntry(event,indexByDate){
  const idx=indexByDate.get(event.base_trading_date); if(!Number.isInteger(idx))return null;
  const p=getPrice(event.stock_id,event.base_trading_date); if(!p?.close)return null;
  return {entry_index:idx,entry_date:event.base_trading_date,entry_price:p.close,wait_days:0,entry_reason:'direct'};
}
function policyEntry(event,policy,marketRows,indexByDate){
  if(policy.type==='direct') return directEntry(event,indexByDate);
  const base=directEntry(event,indexByDate); if(!base)return null;
  const limit=base.entry_price*policy.threshold;
  const waitLimit=Number.isInteger(policy.fallback_day)?policy.fallback_day:MAX_WAIT;
  for(let offset=1;offset<=waitLimit;offset++){
    const idx=base.entry_index+offset,date=marketRows[idx]?.date; if(!date)return null;
    const p=getPrice(event.stock_id,date);
    if(Number.isFinite(p?.low)&&p.low<=limit){
      return {entry_index:idx,entry_date:date,entry_price:limit,wait_days:offset,entry_reason:'pullback_fill'};
    }
  }
  if(Number.isInteger(policy.fallback_day)){
    const idx=base.entry_index+policy.fallback_day,date=marketRows[idx]?.date; if(!date)return null;
    const p=getPrice(event.stock_id,date); if(!p?.close)return null;
    return {entry_index:idx,entry_date:date,entry_price:p.close,wait_days:policy.fallback_day,entry_reason:'fallback_close'};
  }
  return {skipped:true,wait_days:MAX_WAIT,entry_reason:'no_fill'};
}
function pathStats(stockId,entryIndex,entryPrice,exitIndex,marketRows){
  if(exitIndex<=entryIndex||!marketRows[exitIndex])return null;
  let maxHigh=-Infinity,minLow=Infinity;
  for(let idx=entryIndex+1;idx<=exitIndex;idx++){
    const date=marketRows[idx]?.date; if(!date)return null;
    const p=getPrice(stockId,date); if(!p)continue;
    if(Number.isFinite(p.high))maxHigh=Math.max(maxHigh,p.high);
    if(Number.isFinite(p.low))minLow=Math.min(minLow,p.low);
  }
  const exitDate=marketRows[exitIndex].date,end=getPrice(stockId,exitDate);
  if(!end?.close||!Number.isFinite(maxHigh)||!Number.isFinite(minLow))return null;
  return {endpoint_pct:((end.close/entryPrice)-1)*100,mfe_pct:((maxHigh/entryPrice)-1)*100,mae_pct:((minLow/entryPrice)-1)*100};
}
function summarizePolicy(events,entries,horizon,marketRows,indexByDate){
  const eligible=[];
  for(const event of events){
    const baseIdx=indexByDate.get(event.base_trading_date);
    if(Number.isInteger(baseIdx)&&marketRows[baseIdx+MAX_WAIT+horizon]) eligible.push(event);
  }
  const trades=[],skipped=[],reasonCounts={direct:0,pullback_fill:0,fallback_close:0,no_fill:0};
  for(const event of eligible){
    const entry=entries.get(event);
    if(!entry)continue;
    reasonCounts[entry.entry_reason]=(reasonCounts[entry.entry_reason]||0)+1;
    if(entry.skipped){ skipped.push(event); continue; }
    const stats=pathStats(event.stock_id,entry.entry_index,entry.entry_price,entry.entry_index+horizon,marketRows);
    if(stats) trades.push({event,entry,stats});
  }
  const directSkippedStats=[];
  for(const event of skipped){
    const entry=directEntry(event,indexByDate); if(!entry)continue;
    const stats=pathStats(event.stock_id,entry.entry_index,entry.entry_price,entry.entry_index+horizon,marketRows);
    if(stats) directSkippedStats.push(stats);
  }
  const n=trades.length,total=eligible.length;
  return {
    horizon:`d${horizon}`,
    eligible_events:total,
    trades:n,
    skipped_events:skipped.length,
    participation_rate_pct:pct(n,total),
    trigger_fill_rate_pct:pct(reasonCounts.pullback_fill,total),
    fallback_fill_rate_pct:pct(reasonCounts.fallback_close,total),
    avg_wait_days:round(mean(trades.map(x=>x.entry.wait_days))),
    median_wait_days:round(median(trades.map(x=>x.entry.wait_days))),
    endpoint:{average_pct:round(mean(trades.map(x=>x.stats.endpoint_pct))),median_pct:round(median(trades.map(x=>x.stats.endpoint_pct))),positive_rate_pct:pct(trades.filter(x=>x.stats.endpoint_pct>0).length,n),ge30_rate_pct:pct(trades.filter(x=>x.stats.endpoint_pct>=30).length,n)},
    mfe:{average_pct:round(mean(trades.map(x=>x.stats.mfe_pct))),median_pct:round(median(trades.map(x=>x.stats.mfe_pct))),ge50_rate_pct:pct(trades.filter(x=>x.stats.mfe_pct>=50).length,n)},
    mae:{average_pct:round(mean(trades.map(x=>x.stats.mae_pct))),median_pct:round(median(trades.map(x=>x.stats.mae_pct)))},
    missed_winners:{
      skipped_with_direct_stats:directSkippedStats.length,
      direct_endpoint_ge30_count:directSkippedStats.filter(x=>x.endpoint_pct>=30).length,
      direct_endpoint_ge30_rate_pct:pct(directSkippedStats.filter(x=>x.endpoint_pct>=30).length,directSkippedStats.length),
      direct_mfe_ge50_count:directSkippedStats.filter(x=>x.mfe_pct>=50).length,
      direct_mfe_ge50_rate_pct:pct(directSkippedStats.filter(x=>x.mfe_pct>=50).length,directSkippedStats.length),
      direct_positive_count:directSkippedStats.filter(x=>x.endpoint_pct>0).length,
      direct_positive_rate_pct:pct(directSkippedStats.filter(x=>x.endpoint_pct>0).length,directSkippedStats.length),
    },
  };
}
function addVsDirect(rows){
  const directByH=new Map(rows.filter(r=>r.policy_id==='direct').map(r=>[r.horizon,r]));
  for(const row of rows){
    const b=directByH.get(row.horizon); if(!b){row.vs_direct=null;continue;}
    row.vs_direct={
      avg_endpoint_delta_pct:round(row.endpoint.average_pct-b.endpoint.average_pct),
      median_endpoint_delta_pct:round(row.endpoint.median_pct-b.endpoint.median_pct),
      positive_rate_delta_pp:round(row.endpoint.positive_rate_pct-b.endpoint.positive_rate_pct),
      endpoint_ge30_rate_delta_pp:round(row.endpoint.ge30_rate_pct-b.endpoint.ge30_rate_pct),
      median_mfe_delta_pct:round(row.mfe.median_pct-b.mfe.median_pct),
      median_mae_delta_pct:round(row.mae.median_pct-b.mae.median_pct),
      participation_rate_delta_pp:round(row.participation_rate_pct-b.participation_rate_pct),
    };
  }
}
function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv),start=args.get('start-month')||'202401',end=args.get('end-month')||'202606';
  const history=loadRevenueHistory(),financialByStock=loadFinancialMaster(),marketRows=loadMarketRows(),indexByDate=new Map(marketRows.map((r,i)=>[r.date,i]));
  const loaded=loadCandidates(start,end,history,financialByStock),candidates=loaded.out,rows=[];
  for(const policy of POLICIES){
    const entries=new Map(); let processed=0;
    for(const event of candidates){ entries.set(event,policyEntry(event,policy,marketRows,indexByDate)); if(++processed%20===0)clearCaches(); }
    clearCaches();
    for(const horizon of HORIZONS){ rows.push({policy_id:policy.id,policy_name:policy.name,...summarizePolicy(candidates,entries,horizon,marketRows,indexByDate)}); clearCaches(); }
  }
  addVsDirect(rows);
  const out={
    schema_version:1,
    dataset:'two_stage_fundamental_quality_entry_policy',
    generated_at:new Date().toISOString(),start_month:start,end_month:end,
    methodology:{
      status:'research_only',
      universe:'electronic FAS>=8 + latest-known FQ>=10',
      candidate_events:candidates.length,
      max_wait_trading_days:MAX_WAIT,
      horizons:HORIZONS.map(h=>`d${h}`),
      policies:POLICIES,
      pullback_fill_rule:'limit assumed filled when daily low touches base close * threshold; no gap/slippage modeling',
      fallback_rule:'if pullback has not filled by fallback day, enter at that day close',
      holding_rule:'each executed trade holds D20/D40/D60 trading days after its actual entry',
      fair_maturity_rule:'for each horizon, only events with enough history for maximum 20-day wait plus the holding horizon are eligible for every policy',
      missed_winner_rule:'for skip policies, evaluate skipped events using direct-entry outcomes to quantify winners forfeited by waiting',
      cagr_note:'CAGR is intentionally not reported because event signals overlap and no portfolio capital-allocation model is defined; event-level average/median returns and participation are reported instead',
      anti_lookahead:'factor membership, pullback triggers, and fallback entries only use information available by the corresponding date',
    },
    coverage:{candidate_events:candidates.length,diagnostics:loaded.diagnostics},
    rows,
  };
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true}); fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(ROOT,OUTPUT),candidates:candidates.length,policies:POLICIES.length,rows:rows.length},null,2));
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
module.exports={POLICIES,HORIZONS,policyEntry,pathStats,summarizePolicy};
