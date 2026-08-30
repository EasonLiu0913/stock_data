#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const HOLDOUT = ['1598','1616','1809','6257','7791'];
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i=args.indexOf(`--${name}`); return i>=0 && args[i+1] ? args[i+1] : fallback; };
const stocks = arg('stocks', HOLDOUT.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
const anchorStart = arg('anchor-start','2026-04-01');
const anchorEnd = arg('anchor-end','2026-08-21');
const foreignFile = arg('foreign','/tmp/institutional-withdrawal-validation-foreign.json');
const priceVolumeFile = arg('price-volume','/tmp/institutional-withdrawal-validation-price-volume.json');
const output = arg('output','/tmp/institutional-withdrawal-validation-matrix.json');

if (JSON.stringify(stocks) !== JSON.stringify(HOLDOUT)) {
  throw new Error(`Frozen Batch 1 mismatch: expected ${HOLDOUT.join(',')} got ${stocks.join(',')}`);
}

const readJson = file => JSON.parse(fs.readFileSync(file,'utf8'));
const normalizeDate = v => String(v).replaceAll('/','-');
const ymd = v => normalizeDate(v).replaceAll('-','');
const round = (v,d=4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;

function latestTradingDay(days,date){ let out=null; for(const d of days){ if(d>date) break; out=d; } return out; }
function brokerEvidence(stock,tradingDays,marketDate){
  const index=tradingDays.indexOf(marketDate);
  if(index<0) return {available:false,window_days:0,intended_window_days:0,missing_dates:[],score:null};
  const intended=tradingDays.slice(Math.max(0,index-4),index+1);
  const days=[]; const missing=[];
  for(const date of intended){
    const file=path.join('data_research','institutional-flow','histock',stock,'daily',`${ymd(date)}.json`);
    if(!fs.existsSync(file)){missing.push(date);continue;}
    try{
      const p=readJson(file);
      if(!Array.isArray(p.records)){missing.push(date);continue;}
      const records=p.records.filter(r=>Number.isFinite(Number(r.net)));
      days.push({date,records});
    }catch{missing.push(date);}
  }
  const curr=days.find(d=>d.date===marketDate)||null;
  if(!curr) return {available:false,window_days:days.length,intended_window_days:intended.length,missing_dates:missing,score:null};
  const negative=curr.records.filter(r=>Number(r.net)<0);
  const dailyNegativeNet=negative.reduce((s,r)=>s+Number(r.net),0);
  const map=new Map();
  for(const day of days){
    for(const r of day.records){
      const key=String(r.broker); const a=map.get(key)||{total_net:0,sell_days:0};
      a.total_net+=Number(r.net); if(Number(r.net)<0)a.sell_days+=1; map.set(key,a);
    }
  }
  const persistent=[...map.values()].filter(x=>x.total_net<0&&x.sell_days>=2);
  const persistentNet=persistent.reduce((s,x)=>s+x.total_net,0);
  const flags={daily_negative_breadth:negative.length>=8,daily_negative_net:dailyNegativeNet<=-6000,persistent_5d_sellers:persistent.length>=5,persistent_5d_net:persistentNet<=-8000};
  return {available:true,window_days:days.length,intended_window_days:intended.length,missing_dates:missing,score:Object.values(flags).filter(Boolean).length,daily_negative_breadth:negative.length,daily_negative_net:round(dailyNegativeNet),persistent_5d_sellers:persistent.length,persistent_5d_net:round(persistentNet),flags};
}
function tdccScore(large,small){
  if(!Number.isFinite(large)||!Number.isFinite(small))return 0;
  let score=0; if(large<=-1)score++; if(small>=0.75)score++; if(large<=-2&&small>=2)score+=2; if(large<=-5&&small>=5)score+=3; return score;
}
function loadTdcc(stock){
  const root=path.join('data_tdcc_shareholding','history',stock);
  if(!fs.existsSync(root)) throw new Error(`Missing TDCC directory ${root}`);
  return fs.readdirSync(root).filter(n=>/^\d{8}\.json$/.test(n)).sort().map(n=>readJson(path.join(root,n)))
    .filter(p=>p.source==='tdcc_official_historical_query'&&p.stock===stock&&p.observed_date>=anchorStart&&p.observed_date<=anchorEnd)
    .map(p=>({date:p.observed_date,large:Number(p.derived?.large_holder_pct),small:Number(p.derived?.small_holder_pct),source:p.source}));
}

function main(){
  const foreign=readJson(foreignFile); const pv=readJson(priceVolumeFile);
  const tradingDays=(foreign.trading_dates||[]).map(normalizeDate); const pvDays=(pv.trading_dates||[]).map(normalizeDate);
  if(!tradingDays.length)throw new Error('Missing source-derived trading calendar');
  if(JSON.stringify(tradingDays)!==JSON.stringify(pvDays))throw new Error('Foreign and price-volume calendars differ');
  if(tradingDays[0]!==anchorStart)throw new Error(`Calendar must begin ${anchorStart}, got ${tradingDays[0]}`);
  if(tradingDays.at(-1)<anchorEnd)throw new Error(`Calendar does not reach frozen anchor end ${anchorEnd}`);
  if((foreign.rejected_calendar_files||[]).length)throw new Error(`Rejected calendar files: ${JSON.stringify(foreign.rejected_calendar_files)}`);
  if(JSON.stringify(foreign.universe)!==JSON.stringify(HOLDOUT)||JSON.stringify(pv.universe)!==JSON.stringify(HOLDOUT)) throw new Error('Feature universe is not frozen Batch 1');

  const foreignMap=new Map((foreign.rows||[]).map(r=>[`${r.stock}:${r.date}`,r]));
  const pvMap=new Map((pv.rows||[]).map(r=>[`${r.stock}:${r.date}`,r]));
  const rows=[]; const coverage={};
  for(const stock of stocks){
    const tdcc=loadTdcc(stock);
    let largeDeclineStreak=0,smallIncreaseStreak=0,transferStreak=0,eligible=0,complete=0,brokerAvailable=0;
    const brokerMissingAnchorDates=[];
    for(let i=0;i<tdcc.length;i++){
      const curr=tdcc[i],prev=tdcc[i-1],prev2=tdcc[i-2];
      const large1=prev?round(curr.large-prev.large):null, small1=prev?round(curr.small-prev.small):null;
      const large2=prev2?round(curr.large-prev2.large):null, small2=prev2?round(curr.small-prev2.small):null;
      largeDeclineStreak=Number.isFinite(large1)&&large1<0?largeDeclineStreak+1:0;
      smallIncreaseStreak=Number.isFinite(small1)&&small1>0?smallIncreaseStreak+1:0;
      transferStreak=Number.isFinite(large1)&&Number.isFinite(small1)&&large1<0&&small1>0?transferStreak+1:0;
      const prevLargeDelta=prev&&prev2?round(prev.large-prev2.large):null, prevSmallDelta=prev&&prev2?round(prev.small-prev2.small):null;
      const marketDate=latestTradingDay(tradingDays,curr.date);
      const broker=marketDate?brokerEvidence(stock,tradingDays,marketDate):{available:false,window_days:0,intended_window_days:0,missing_dates:[],score:null};
      const f=marketDate?foreignMap.get(`${stock}:${marketDate}`)||null:null, p=marketDate?pvMap.get(`${stock}:${marketDate}`)||null:null;
      const tdccS=tdccScore(large1,small1);
      if(broker.available)brokerAvailable++;else brokerMissingAnchorDates.push(curr.date);
      const featureComplete=Boolean(marketDate&&broker.available&&f&&p); if(featureComplete)complete++;
      const analysisEligible=Boolean(featureComplete&&broker.window_days===broker.intended_window_days&&broker.window_days>=5&&f.rolling_10d&&Number.isFinite(p.volume_ratio_20d)&&Number.isFinite(p.distribution_days_10d)); if(analysisEligible)eligible++;
      const tdccPersistenceConfirm=largeDeclineStreak>=2&&smallIncreaseStreak>=2;
      const brokerPressureConfirm=Number.isFinite(broker.score)&&broker.score>=3, foreignConfirm=Boolean(f?.foreign_confirm), priceVolumeConfirm=Boolean(p?.price_volume_confirm);
      const pressureBaseline=Boolean(brokerPressureConfirm&&tdccS>=1), independent=[foreignConfirm,tdccPersistenceConfirm,priceVolumeConfirm].filter(Boolean).length;
      rows.push({stock,tdcc_observed_date:curr.date,market_feature_date:marketDate,market_lag_calendar_days:marketDate?Math.round((Date.parse(`${curr.date}T00:00:00Z`)-Date.parse(`${marketDate}T00:00:00Z`))/86400000):null,feature_complete:featureComplete,analysis_eligible:analysisEligible,
        broker:{available:broker.available,score:broker.score,window_days:broker.window_days,intended_window_days:broker.intended_window_days,missing_dates:broker.missing_dates||[],daily_negative_breadth:broker.daily_negative_breadth??null,daily_negative_net:broker.daily_negative_net??null,persistent_5d_sellers:broker.persistent_5d_sellers??null,persistent_5d_net:broker.persistent_5d_net??null},
        tdcc:{large_holder_pct:curr.large,small_holder_pct:curr.small,large_change_1obs_pp:large1,small_change_1obs_pp:small1,large_change_2obs_pp:large2,small_change_2obs_pp:small2,large_change_acceleration_pp:Number.isFinite(large1)&&Number.isFinite(prevLargeDelta)?round(large1-prevLargeDelta):null,small_change_acceleration_pp:Number.isFinite(small1)&&Number.isFinite(prevSmallDelta)?round(small1-prevSmallDelta):null,large_decline_streak:largeDeclineStreak,small_increase_streak:smallIncreaseStreak,transfer_streak:transferStreak,v4_score:tdccS},
        foreign:f?{total_net:f.total_net,ex_dealer_net:f.ex_dealer_net,dealer_net:f.dealer_net,net_5d:f.rolling_5d?.total_net??null,sell_ratio_5d:f.rolling_5d?.total_sell_ratio??null,net_10d:f.rolling_10d?.total_net??null,sell_ratio_10d:f.rolling_10d?.total_sell_ratio??null,net_5d_acceleration:f.total_5d_acceleration}:null,
        price_volume:p?{close:p.close,return_1d_pct:p.return_1d_pct,return_5d_pct:p.return_5d_pct,return_10d_pct:p.return_10d_pct,volume_ratio_20d:p.volume_ratio_20d,distribution_days_5d:p.distribution_days_5d,distribution_days_10d:p.distribution_days_10d,absorption_days_10d:p.absorption_days_10d,close_vs_prior_20d_high_pct:p.close_vs_prior_20d_high_pct}:null,
        confirmations:{broker_pressure_confirm:brokerPressureConfirm,foreign_confirm:foreignConfirm,tdcc_persistence_confirm:tdccPersistenceConfirm,price_volume_confirm:priceVolumeConfirm,independent_confirmation_count:independent,pressure_baseline:pressureBaseline,pressure_plus_foreign:pressureBaseline&&foreignConfirm,pressure_plus_tdcc_persistence:pressureBaseline&&tdccPersistenceConfirm,pressure_plus_price_volume:pressureBaseline&&priceVolumeConfirm,pressure_plus_two_independent:pressureBaseline&&independent>=2,pressure_plus_all_three:pressureBaseline&&independent===3}});
    }
    coverage[stock]={tdcc_anchors:tdcc.length,broker_available:brokerAvailable,broker_missing_anchor_dates:brokerMissingAnchorDates,feature_complete:complete,analysis_eligible:eligible};
  }
  const payload={schema_version:1,methodology:'institutional-withdrawal-validation-matrix-v1-outcome-free',lifecycle_methodology:'institutional-withdrawal-lifecycle-v1',research_only:true,production_safe:false,sample:{kind:'untouched_stock_holdout',batch:'batch-1',stocks:HOLDOUT,anchor_range:{start:anchorStart,end:anchorEnd}},universe:HOLDOUT,range:{start:anchorStart,end:anchorEnd},trading_calendar:{source:'valid TWSE foreign-investor daily files via foreign-flow feature builder; cross-checked against price-volume feature builder',first:tradingDays[0],anchor_end:anchorEnd,data_through:tradingDays.at(-1),count:tradingDays.length},anchor_policy:'Every official historical TDCC observation for the frozen five stocks in the frozen anchor range; market features use latest source-derived session <= observed_date.',classifier_input_policy:'Contemporaneous/current-or-prior fields only. This matrix intentionally contains no future return, drawdown, structural-repair, validation metric, or outcome field.',historical_tdcc_caveat:'Historical TDCC remains association-only because exact original publication timestamps are incomplete; production_no_lookahead_safe=false.',production_no_lookahead_safe:false,counts:{anchors:rows.length,broker_available:rows.filter(r=>r.broker.available).length,feature_complete:rows.filter(r=>r.feature_complete).length,analysis_eligible:rows.filter(r=>r.analysis_eligible).length},coverage,rows,generated_at:new Date().toISOString()};
  fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');
  console.log(JSON.stringify({sample:payload.sample,calendar:payload.trading_calendar,counts:payload.counts,coverage},null,2));
}
if(require.main===module)main();
module.exports={main,brokerEvidence,tdccScore};
