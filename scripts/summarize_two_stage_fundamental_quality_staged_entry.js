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
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-staged-entry.json');
const PRICE_LOADERS = [loadFromHistorySma, loadFromLegacyFubon, loadFromTwseMiIndex];
const HORIZONS = [20, 40, 60];
const MAX_WAIT = 20;
const ELECTRONIC_INDUSTRIES = new Set([
  '半導體業','電腦及週邊設備業','光電業','通信網路業','電子零組件業','電子通路業','資訊服務業','其他電子業','電子工業',
]);
const POLICIES = [
  { id:'direct_100', name:'100% 訊號日', tranches:[{kind:'direct',weight:1}] },
  { id:'direct50_pb5_50', name:'50% 訊號日 + 50% -5%', tranches:[{kind:'direct',weight:0.5},{kind:'pullback',threshold:0.95,label:'-5%',weight:0.5}] },
  { id:'direct50_pb10_50', name:'50% 訊號日 + 50% -10%', tranches:[{kind:'direct',weight:0.5},{kind:'pullback',threshold:0.90,label:'-10%',weight:0.5}] },
  { id:'direct50_pb5_25_pb10_25', name:'50% 訊號日 + 25% -5% + 25% -10%', tranches:[{kind:'direct',weight:0.5},{kind:'pullback',threshold:0.95,label:'-5%',weight:0.25},{kind:'pullback',threshold:0.90,label:'-10%',weight:0.25}] },
  { id:'direct33_pb5_33_pb10_34', name:'33% 訊號日 + 33% -5% + 34% -10%', tranches:[{kind:'direct',weight:0.33},{kind:'pullback',threshold:0.95,label:'-5%',weight:0.33},{kind:'pullback',threshold:0.90,label:'-10%',weight:0.34}] },
  { id:'direct25_pb5_25_pb10_50', name:'25% 訊號日 + 25% -5% + 50% -10%', tranches:[{kind:'direct',weight:0.25},{kind:'pullback',threshold:0.95,label:'-5%',weight:0.25},{kind:'pullback',threshold:0.90,label:'-10%',weight:0.5}] },
];

const mean = xs => { const a=xs.filter(Number.isFinite); return a.length?a.reduce((s,v)=>s+v,0)/a.length:null; };
const median = xs => { const a=xs.filter(Number.isFinite).sort((a,b)=>a-b); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
const round = (v,d=4) => Number.isFinite(v)?Number(v.toFixed(d)):null;
const pct = (n,d) => d?round(n/d*100):null;
function readJson(file,fallback=null){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;} }
function parseArgs(argv){ const m=new Map(); for(let i=0;i<argv.length;i++){ if(!argv[i].startsWith('--'))continue; m.set(argv[i].slice(2),argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true); } return m; }
function prevMonth(month,n=1){ let y=Number(month.slice(0,4)),m=Number(month.slice(4,6)); for(let i=0;i<n;i++){m--;if(m===0){m=12;y--;}} return `${y}${String(m).padStart(2,'0')}`; }
function loadRevenueHistory(start,end){
  const min=prevMonth(start,11), byMonth=new Map(),byStock=new Map();
  const months=fs.readdirSync(REVENUE_ROOT,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^20\d{4}$/.test(e.name)).map(e=>e.name).filter(m=>m>=min&&m<=end).sort();
  for(const month of months){
    const p=readJson(path.join(REVENUE_ROOT,month,'monthly_revenue.json'),{}),map=new Map();
    for(const row of p.companies||[]){ const id=String(row.stock_code); map.set(id,row); if(!byStock.has(id))byStock.set(id,new Map()); byStock.get(id).set(month,row); }
    byMonth.set(month,map);
  }
  return {byMonth,byStock};
}
function loadFinancialMaster(){ const p=readJson(MASTER_FILE); if(!p||!Array.isArray(p.stocks))throw new Error('Missing financial-quality-master.json'); return new Map(p.stocks.map(s=>[String(s.stock_id),s.rows||[]])); }
function loadMarketRows(){ const p=readJson(MARKET_FILE,{}); return (p.data||[]).filter(r=>/^20\d{6}$/.test(String(r.date))&&Number.isFinite(Number(r.close))).map(r=>({date:String(r.date),close:Number(r.close)})).sort((a,b)=>a.date.localeCompare(b.date)); }
function getPrice(stockId,date){ return getDailyPrice(stockId,date,{root:ROOT,loaders:PRICE_LOADERS}); }
function loadCandidates(start,end,history,financialByStock){
  const out=[],diagnostics={electronic_fas8_events:0,missing_known_financial:0,financial_below_10:0,included:0};
  const months=fs.readdirSync(SIGNAL_ROOT).filter(n=>/^20\d{4}\.json$/.test(n)).map(n=>n.slice(0,6)).filter(m=>m>=start&&m<=end).sort();
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
      if(!financial||!Number.isFinite(Number(financial.financial_quality_score))){diagnostics.missing_known_financial++;continue;}
      if(Number(financial.financial_quality_score)<10){diagnostics.financial_below_10++;continue;}
      if(!event.base_trading_date)continue;
      out.push({month,stock_id:stockId,stock_name:row.company_name||event.company_name||null,base_trading_date:event.base_trading_date}); diagnostics.included++;
    }
  }
  return {out,diagnostics};
}
function findBase(event,indexByDate){ const idx=indexByDate.get(event.base_trading_date); if(!Number.isInteger(idx))return null; const p=getPrice(event.stock_id,event.base_trading_date); if(!p?.close)return null; return {index:idx,date:event.base_trading_date,price:p.close}; }
function findPullback(event,base,threshold,marketRows,maxOffset){
  const limit=base.price*threshold;
  for(let offset=1;offset<=maxOffset;offset++){
    const idx=base.index+offset,date=marketRows[idx]?.date; if(!date)return null;
    const p=getPrice(event.stock_id,date);
    if(Number.isFinite(p?.low)&&p.low<=limit)return {index:idx,date,price:limit,wait_days:offset};
  }
  return null;
}
function buildFills(event,policy,horizon,marketRows,indexByDate){
  const base=findBase(event,indexByDate); if(!base)return null;
  const exitIndex=base.index+horizon; if(!marketRows[exitIndex])return null;
  const maxOffset=Math.min(MAX_WAIT,Math.max(0,horizon-1));
  const fills=[];
  for(const t of policy.tranches){
    if(t.kind==='direct'){ fills.push({weight:t.weight,index:base.index,date:base.date,price:base.price,kind:'direct',label:'direct'}); continue; }
    const hit=findPullback(event,base,t.threshold,marketRows,maxOffset);
    if(hit) fills.push({...hit,weight:t.weight,kind:'pullback',label:t.label});
  }
  return {base,exitIndex,fills};
}
function portfolioStats(event,plan,marketRows){
  const exitDate=marketRows[plan.exitIndex]?.date,exitPrice=getPrice(event.stock_id,exitDate)?.close;
  if(!Number.isFinite(exitPrice))return null;
  const deployed=plan.fills.reduce((s,f)=>s+f.weight,0);
  let endpoint=0;
  for(const f of plan.fills) endpoint += f.weight*((exitPrice/f.price)-1)*100;
  let maxRet=-Infinity,minRet=Infinity,validDays=0;
  for(let idx=plan.base.index;idx<=plan.exitIndex;idx++){
    const date=marketRows[idx]?.date,p=getPrice(event.stock_id,date); if(!p)continue;
    let highRet=0,lowRet=0;
    for(const f of plan.fills){
      if(f.index>idx)continue;
      if(Number.isFinite(p.high)) highRet += f.weight*((p.high/f.price)-1)*100;
      if(Number.isFinite(p.low)) lowRet += f.weight*((p.low/f.price)-1)*100;
    }
    if(Number.isFinite(p.high)){maxRet=Math.max(maxRet,highRet);validDays++;}
    if(Number.isFinite(p.low))minRet=Math.min(minRet,lowRet);
  }
  if(!validDays||!Number.isFinite(minRet))return null;
  return {endpoint_pct:endpoint,mfe_pct:maxRet,mae_pct:minRet,deployed_weight:deployed,cash_weight:1-deployed};
}
function summarize(events,policy,horizon,marketRows,indexByDate){
  const rows=[]; let pb5=0,pb10=0;
  for(const event of events){
    const plan=buildFills(event,policy,horizon,marketRows,indexByDate); if(!plan)continue;
    const stats=portfolioStats(event,plan,marketRows); if(!stats)continue;
    if(plan.fills.some(f=>f.label==='-5%'))pb5++;
    if(plan.fills.some(f=>f.label==='-10%'))pb10++;
    rows.push({event,plan,stats});
    if(rows.length%20===0)clearCaches();
  }
  clearCaches();
  const n=rows.length;
  return {
    horizon:`d${horizon}`,
    samples:n,
    avg_deployed_weight_pct:round(mean(rows.map(r=>r.stats.deployed_weight))*100),
    median_deployed_weight_pct:round(median(rows.map(r=>r.stats.deployed_weight))*100),
    full_deployment_rate_pct:pct(rows.filter(r=>r.stats.deployed_weight>=0.999).length,n),
    pullback_5_fill_event_rate_pct:pct(pb5,n),
    pullback_10_fill_event_rate_pct:pct(pb10,n),
    endpoint:{average_pct:round(mean(rows.map(r=>r.stats.endpoint_pct))),median_pct:round(median(rows.map(r=>r.stats.endpoint_pct))),positive_rate_pct:pct(rows.filter(r=>r.stats.endpoint_pct>0).length,n),ge30_rate_pct:pct(rows.filter(r=>r.stats.endpoint_pct>=30).length,n)},
    mfe:{average_pct:round(mean(rows.map(r=>r.stats.mfe_pct))),median_pct:round(median(rows.map(r=>r.stats.mfe_pct))),ge50_rate_pct:pct(rows.filter(r=>r.stats.mfe_pct>=50).length,n)},
    mae:{average_pct:round(mean(rows.map(r=>r.stats.mae_pct))),median_pct:round(median(rows.map(r=>r.stats.mae_pct)))},
  };
}
function addVsDirect(rows){
  const base=new Map(rows.filter(r=>r.policy_id==='direct_100').map(r=>[r.horizon,r]));
  for(const r of rows){ const b=base.get(r.horizon); r.vs_direct=b?{avg_endpoint_delta_pct:round(r.endpoint.average_pct-b.endpoint.average_pct),median_endpoint_delta_pct:round(r.endpoint.median_pct-b.endpoint.median_pct),positive_rate_delta_pp:round(r.endpoint.positive_rate_pct-b.endpoint.positive_rate_pct),ge30_rate_delta_pp:round(r.endpoint.ge30_rate_pct-b.endpoint.ge30_rate_pct),median_mfe_delta_pct:round(r.mfe.median_pct-b.mfe.median_pct),median_mae_delta_pct:round(r.mae.median_pct-b.mae.median_pct)}:null; }
}
function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv),start=args.get('start-month')||'202401',end=args.get('end-month')||'202606';
  const history=loadRevenueHistory(start,end),financialByStock=loadFinancialMaster(),marketRows=loadMarketRows(),indexByDate=new Map(marketRows.map((r,i)=>[r.date,i]));
  const loaded=loadCandidates(start,end,history,financialByStock),rows=[];
  for(const policy of POLICIES){ for(const horizon of HORIZONS) rows.push({policy_id:policy.id,policy_name:policy.name,...summarize(loaded.out,policy,horizon,marketRows,indexByDate)}); }
  addVsDirect(rows);
  const out={schema_version:1,dataset:'two_stage_fundamental_quality_staged_entry',generated_at:new Date().toISOString(),start_month:start,end_month:end,methodology:{status:'research_only',universe:'electronic FAS>=8 + latest-known FQ>=10',candidate_events:loaded.out.length,max_wait_trading_days:MAX_WAIT,horizons:HORIZONS.map(h=>`d${h}`),policies:POLICIES,capital_rule:'each signal starts with capital=1; unfilled staged tranches remain cash with 0% return and are never chased',exit_rule:'all filled tranches are marked to the same direct-signal D20/D40/D60 calendar exit date',fill_rule:'pullback tranche fills at base close * 0.95 or 0.90 when daily low first touches that level; no gap/slippage modeling',portfolio_return_rule:'total-capital return is the weighted sum of each filled tranche return; unfilled cash contributes zero',path_rule:'portfolio MFE/MAE are mark-to-market total-capital returns using only tranches filled by each date',anti_lookahead:'factor membership and pullback fills use only information available by the corresponding date'},coverage:{candidate_events:loaded.out.length,diagnostics:loaded.diagnostics},rows};
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true}); fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(ROOT,OUTPUT),candidates:loaded.out.length,rows:rows.length,d60:rows.filter(r=>r.horizon==='d60').map(r=>({policy:r.policy_id,avg:r.endpoint.average_pct,median:r.endpoint.median_pct,deployed:r.avg_deployed_weight_pct,vs_direct:r.vs_direct}))},null,2));
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
module.exports={POLICIES,HORIZONS,findPullback,buildFills,portfolioStats,summarize};
