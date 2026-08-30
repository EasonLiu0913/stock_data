#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const args=process.argv.slice(2);
const arg=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0&&args[i+1]?args[i+1]:f;};
const v64File=arg('v64','/tmp/institutional-withdrawal-validation-v64.json');
const v65File=arg('v65','/tmp/institutional-withdrawal-validation-v65.json');
const v6File=arg('v6','/tmp/institutional-withdrawal-validation-v6.json');
const pvFile=arg('price-volume','/tmp/institutional-withdrawal-validation-price-volume.json');
const foreignFile=arg('foreign','/tmp/institutional-withdrawal-validation-foreign.json');
const outcomesFile=arg('outcomes',path.join('data_research','institutional-flow','validation','validation-outcomes-v1.json'));
const metricsFile=arg('metrics',path.join('data_research','institutional-flow','validation','validation-metrics-v1.json'));
const sourceMainSha=arg('source-main-sha',process.env.GITHUB_SHA||null);
const HOLDOUT=['1598','1616','1809','6257','7791'];
const DEVELOPMENT=['2330','2317','2454','2382','2303','2449'];
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const round=(v,d=4)=>Number.isFinite(v)?Number(v.toFixed(d)):null;
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const median=xs=>{if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

function maxDrawdownPct(closes){
  if(!closes.length||closes.some(x=>!Number.isFinite(x)))return null;
  let peak=closes[0],worst=0;
  for(const c of closes){peak=Math.max(peak,c);const dd=(c/peak-1)*100;if(dd<worst)worst=dd;}
  return round(worst,4);
}
function windowMetric(stock,resolutionDate,horizon,dates,pvMap){
  const ri=dates.indexOf(resolutionDate);
  if(ri<0)return {status:'unresolved_for_metric',reason:'resolution_date_missing_from_source_calendar',horizon_sessions:horizon};
  const base=pvMap.get(`${stock}|${resolutionDate}`);
  if(!Number.isFinite(Number(base?.close)))return {status:'unresolved_for_metric',reason:'resolution_ohlcv_missing',horizon_sessions:horizon};
  const windowDates=dates.slice(ri+1,ri+horizon+1);
  if(windowDates.length<horizon)return {status:'unresolved_for_metric',reason:'insufficient_source_derived_sessions',horizon_sessions:horizon,available_source_sessions:windowDates.length,window_start:windowDates[0]||null,window_end:windowDates.at(-1)||null};
  const missing=windowDates.filter(d=>!Number.isFinite(Number(pvMap.get(`${stock}|${d}`)?.close)));
  if(missing.length)return {status:'unresolved_for_metric',reason:'missing_ohlcv_inside_exact_session_window',horizon_sessions:horizon,window_start:windowDates[0],window_end:windowDates.at(-1),missing_ohlcv_dates:missing};
  const closes=windowDates.map(d=>Number(pvMap.get(`${stock}|${d}`).close));
  const baseClose=Number(base.close),endClose=closes.at(-1),totalReturn=(endClose/baseClose-1)*100;
  return {status:'resolved',horizon_sessions:horizon,baseline_date:resolutionDate,baseline_close:baseClose,window_start:windowDates[0],window_end:windowDates.at(-1),target_close:endClose,total_return_pct:round(totalReturn,4),negative_return:totalReturn<0,max_drawdown_pct:maxDrawdownPct([baseClose,...closes]),session_dates:windowDates};
}
function latestWeeklyFactory(v6){
  const weekly=new Map();
  for(const r of (v6.results?.all_eligible?.events||[])){if(!weekly.has(r.stock))weekly.set(r.stock,[]);weekly.get(r.stock).push(r);}
  for(const xs of weekly.values())xs.sort((a,b)=>a.market_feature_date.localeCompare(b.market_feature_date));
  return (stock,date)=>{let best=null;for(const r of (weekly.get(stock)||[])){if(r.market_feature_date<=date)best=r;else break;}return best;};
}
function supplyRelief(stock,date,foreignMap,latestWeekly){
  const f=foreignMap.get(`${stock}|${date}`),r5=f?.rolling_5d||null;
  const net=Number(r5?.total_net),ratio=Number(r5?.total_sell_ratio);
  const foreignAvailable=Number.isFinite(net)||Number.isFinite(ratio);
  const foreignRelief=(Number.isFinite(net)&&net>=0)||(Number.isFinite(ratio)&&ratio<=0.4);
  const w=latestWeekly(stock,date),brokerScore=Number(w?.broker?.score);
  const brokerAvailable=Number.isFinite(brokerScore),brokerRelief=brokerAvailable&&brokerScore<=2;
  const ownershipAvailable=Boolean(w),ownershipRelief=ownershipAvailable&&!Boolean(w.classification?.persistent_transfer);
  return {foreign_available:foreignAvailable,foreign_relief:foreignRelief,foreign_net_5d:Number.isFinite(net)?net:null,foreign_sell_ratio_5d:Number.isFinite(ratio)?ratio:null,broker_available:brokerAvailable,broker_relief:brokerRelief,latest_broker_score:brokerAvailable?brokerScore:null,ownership_available:ownershipAvailable,ownership_relief:ownershipRelief,latest_tdcc_anchor:w?.tdcc_observed_date||null};
}
function structuralRepairMetric(event,resolutionDate,dates,pvMap,foreignMap,latestWeekly){
  const ri=dates.indexOf(resolutionDate);if(ri<0)return {status:'unresolved_for_metric',reason:'resolution_date_missing_from_source_calendar'};
  const horizon=dates.slice(ri+1,ri+31);
  if(horizon.length<30)return {status:'unresolved_for_metric',reason:'insufficient_source_derived_sessions',available_source_sessions:horizon.length,window_start:horizon[0]||null,window_end:horizon.at(-1)||null};
  const rows=horizon.map((date,i)=>{const p=pvMap.get(`${event.stock}|${date}`),close=Number(p?.close);return {session:i+1,date,close:Number.isFinite(close)?close:null,missing_price:!Number.isFinite(close),...supplyRelief(event.stock,date,foreignMap,latestWeekly)};});
  let evidenceIncomplete=false;
  for(let i=0;i<=rows.length-3;i++){
    const win=rows.slice(i,i+3);
    if(win.some(x=>x.missing_price)){evidenceIncomplete=true;continue;}
    const priceVotes=win.filter(x=>x.close>=event.fragile_anchor_close).length;
    const fam={foreign:win.some(x=>x.foreign_relief),broker:win.some(x=>x.broker_relief),ownership:win.some(x=>x.ownership_relief)};
    if(win.some(x=>!x.foreign_available&&!x.broker_available&&!x.ownership_available))evidenceIncomplete=true;
    const reliefCount=Object.values(fam).filter(Boolean).length;
    if(priceVotes>=2&&reliefCount>=2)return {status:'resolved',structural_repair:true,definition:'post-resolution recurrence of frozen v6.5 repair contract: >=2/3 closes reclaim fragile-anchor close plus >=2 supply-relief families in same 3-session window',confirmation_date:win[2].date,start_date:win[0].date,start_session:win[0].session,end_session:win[2].session,price_reclaim_votes:priceVotes,relief_families:fam,relief_family_count:reliefCount,window_start:horizon[0],window_end:horizon.at(-1)};
  }
  if(rows.some(x=>x.missing_price)||evidenceIncomplete)return {status:'unresolved_for_metric',reason:'missing_evidence_inside_30_session_structural_repair_scan',window_start:horizon[0],window_end:horizon.at(-1),missing_ohlcv_dates:rows.filter(x=>x.missing_price).map(x=>x.date)};
  return {status:'resolved',structural_repair:false,definition:'post-resolution recurrence of frozen v6.5 repair contract: >=2/3 closes reclaim fragile-anchor close plus >=2 supply-relief families in same 3-session window',window_start:horizon[0],window_end:horizon.at(-1)};
}
function summarizeGroup(events){
  const resolved=(key,field)=>events.map(e=>e.metrics?.[key]).filter(x=>x?.status==='resolved'&&Number.isFinite(Number(x[field]))).map(x=>Number(x[field]));
  const ret20=resolved('return_20d','total_return_pct'),ret30=resolved('return_30d','total_return_pct'),dd20=resolved('return_20d','max_drawdown_pct'),dd30=resolved('return_30d','max_drawdown_pct');
  const neg20=events.map(e=>e.metrics?.return_20d).filter(x=>x?.status==='resolved').map(x=>x.negative_return?1:0),neg30=events.map(e=>e.metrics?.return_30d).filter(x=>x?.status==='resolved').map(x=>x.negative_return?1:0),repair=events.map(e=>e.metrics?.structural_repair_30d).filter(x=>x?.status==='resolved').map(x=>x.structural_repair?1:0);
  const stat=xs=>({n:xs.length,unresolved:events.length-xs.length,mean:round(mean(xs),4),median:round(median(xs),4)});
  return {event_n:events.length,return_20d_pct:stat(ret20),return_30d_pct:stat(ret30),max_drawdown_20d_pct:stat(dd20),max_drawdown_30d_pct:stat(dd30),negative_return_20d:{n:neg20.length,unresolved:events.length-neg20.length,rate:round(mean(neg20),4)},negative_return_30d:{n:neg30.length,unresolved:events.length-neg30.length,rate:round(mean(neg30),4)},structural_repair_30d:{n:repair.length,unresolved:events.length-repair.length,rate:round(mean(repair),4)}};
}
function seeded(seed=20260830){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
function bootstrapDifference(a,b,iterations=5000,seed=20260830){
  if(a.length<8||b.length<8)return {status:'not_emitted',reason:'preregistered_meaningful_resampling_gate_requires_at_least_8_resolved_observations_per_group',group_n:{failure_plus_no_reclaim:a.length,failure_plus_reclaim:b.length}};
  const rand=seeded(seed),diffs=[];
  for(let k=0;k<iterations;k++){let sa=0,sb=0;for(let i=0;i<a.length;i++)sa+=a[Math.floor(rand()*a.length)];for(let i=0;i<b.length;i++)sb+=b[Math.floor(rand()*b.length)];diffs.push(sa/a.length-sb/b.length);}
  diffs.sort((x,y)=>x-y);const q=p=>diffs[Math.floor((diffs.length-1)*p)];
  return {status:'emitted',iterations,seed,difference_definition:'failure_plus_no_reclaim minus failure_plus_reclaim',point_estimate:round(mean(a)-mean(b),4),ci_95:[round(q(0.025),4),round(q(0.975),4)],group_n:{failure_plus_no_reclaim:a.length,failure_plus_reclaim:b.length}};
}
function metricValues(events,key,field){return events.map(e=>e.metrics?.[key]).filter(x=>x?.status==='resolved'&&Number.isFinite(Number(x[field]))).map(x=>Number(x[field]));}

function main(){
  const v64=read(v64File),v65=read(v65File),v6=read(v6File),pv=read(pvFile),foreign=read(foreignFile);
  if(v64.methodology!=='institutional-withdrawal-v6-4-durable-failure-confirmation-v1'||v65.methodology!=='institutional-withdrawal-v6-5-recovery-reclaim-diagnosis-v1'||v6.methodology!=='institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1')throw new Error('Frozen lifecycle methodology mismatch');
  if(JSON.stringify(v6.universe)!==JSON.stringify(HOLDOUT))throw new Error('Holdout universe mismatch');
  if(JSON.stringify(pv.trading_dates)!==JSON.stringify(foreign.trading_dates))throw new Error('Daily calendars differ');
  const dates=pv.trading_dates,pvMap=new Map(pv.rows.map(r=>[`${r.stock}|${r.date}`,r])),foreignMap=new Map(foreign.rows.map(r=>[`${r.stock}|${r.date}`,r])),latestWeekly=latestWeeklyFactory(v6);
  const v65Map=new Map((v65.events||[]).map(e=>[`${e.stock}|${e.fragile_anchor}|${e.candidate_failure_date}`,e]));
  const durable=(v64.events||[]).filter(e=>e.persistence_status==='durable_failure_confirmed'),events=[];
  for(const d of durable){
    if(!HOLDOUT.includes(d.stock)||DEVELOPMENT.includes(d.stock))throw new Error(`Non-holdout stock entered validation: ${d.stock}`);
    const r=v65Map.get(`${d.stock}|${d.fragile_anchor}|${d.candidate_failure_date}`);if(!r)throw new Error(`Missing v6.5 event ${d.stock} ${d.fragile_anchor}`);
    let lifecycle_state='unresolved_recovery_followup',resolution_date=null,resolution_basis=null;
    if(r.status==='confirmed_reclaim'){lifecycle_state='failure_plus_reclaim';resolution_date=r.reclaim_confirmation?.reclaim_date||null;resolution_basis='v6.5 reclaim confirmation date';}
    else if(r.status==='no_reclaim_within_15_sessions'){
      const ci=dates.indexOf(d.candidate_failure_date),end=ci>=0?dates[ci+15]:null;
      if(end){lifecycle_state='failure_plus_no_reclaim';resolution_date=end;resolution_basis='candidate-failure session 15 end date closing frozen no-reclaim window';}
    }
    const fragileAnchorClose=Number(d.anchor_close);
    const event={stock:d.stock,fragile_anchor:d.fragile_anchor,fragile_anchor_close:Number.isFinite(fragileAnchorClose)?fragileAnchorClose:null,candidate_failure_date:d.candidate_failure_date,candidate_path:d.candidate_path,persistence:{status:d.persistence_status,broken_votes:d.broken_votes,supply_votes:d.supply_votes,window:d.persistence_window},recovery:{status:r.status,reclaim_confirmation:r.reclaim_confirmation||null,available_future_sessions:r.available_future_sessions},lifecycle_state,resolution_date,resolution_basis,traceability:{fragile_anchor_calendar_index:dates.indexOf(d.fragile_anchor),candidate_failure_calendar_index:dates.indexOf(d.candidate_failure_date),resolution_calendar_index:resolution_date?dates.indexOf(resolution_date):null,calendar_index_base:0}};
    event.metrics=resolution_date?{return_20d:windowMetric(d.stock,resolution_date,20,dates,pvMap),return_30d:windowMetric(d.stock,resolution_date,30,dates,pvMap),structural_repair_30d:structuralRepairMetric(event,resolution_date,dates,pvMap,foreignMap,latestWeekly)}:{return_20d:{status:'unresolved_for_metric',reason:'lifecycle_not_resolved'},return_30d:{status:'unresolved_for_metric',reason:'lifecycle_not_resolved'},structural_repair_30d:{status:'unresolved_for_metric',reason:'lifecycle_not_resolved'}};
    events.push(event);
  }
  const resolvedEvents=events.filter(e=>['failure_plus_reclaim','failure_plus_no_reclaim'].includes(e.lifecycle_state));
  const outcomes={schema_version:1,methodology:'institutional-withdrawal-validation-outcomes-v1',lifecycle_methodology:'institutional-withdrawal-lifecycle-v1',frozen_development_methodology:'v6.0-v6.5',research_only:true,production_safe:false,source_main_sha:sourceMainSha,sample:{kind:'untouched_stock_holdout',batch:'batch-1',stocks:HOLDOUT,anchor_range:{start:'2026-04-01',end:'2026-08-21'}},calendar:{policy:'source-derived from valid TWSE foreign-investor daily files; never data_history_sma/trading_days.json',first:dates[0],anchor_end:'2026-08-21',data_through:dates.at(-1),sessions:dates.length},outcome_clock:'Resolution session is the baseline boundary; outcome observations are the next exact source-derived sessions. Missing OHLCV inside a required horizon invalidates that metric and is never skipped or imputed.',return_definition:'close at exact +N source-derived session divided by resolution-date close minus 1',max_drawdown_definition:'maximum peak-to-trough drawdown across resolution close plus the exact next N source-derived session closes',structural_repair_definition:'Outcome-only post-resolution recurrence of the frozen v6.5 repair contract: >=2/3 closes reclaim the original fragile-anchor close and >=2 supply-relief families occur in the same 3-session window within the next 30 source-derived sessions. This field never feeds classification.',historical_tdcc_caveat:'Historical TDCC remains association-only because exact original publication timestamps are incomplete; production_no_lookahead_safe=false.',production_no_lookahead_safe:false,counts:{durable_failure_events:events.length,resolved_lifecycle_events:resolvedEvents.length,failure_plus_reclaim:resolvedEvents.filter(e=>e.lifecycle_state==='failure_plus_reclaim').length,failure_plus_no_reclaim:resolvedEvents.filter(e=>e.lifecycle_state==='failure_plus_no_reclaim').length,unresolved_recovery_followup:events.filter(e=>e.lifecycle_state==='unresolved_recovery_followup').length},events,guardrails:['Frozen Batch 1 membership is exact and immutable.','Development stocks are forbidden from these statistics.','Classification artifacts are generated before this outcome file and do not read this file.','Missing OHLCV sessions remain calendar gaps; no horizon is compressed or imputed.'],generated_at:new Date().toISOString()};
  const groups={failure_plus_no_reclaim:resolvedEvents.filter(e=>e.lifecycle_state==='failure_plus_no_reclaim'),failure_plus_reclaim:resolvedEvents.filter(e=>e.lifecycle_state==='failure_plus_reclaim')};
  const summaries={failure_plus_no_reclaim:summarizeGroup(groups.failure_plus_no_reclaim),failure_plus_reclaim:summarizeGroup(groups.failure_plus_reclaim)},ci={};
  const pairs=[['return_20d_pct','return_20d','total_return_pct'],['return_30d_pct','return_30d','total_return_pct'],['max_drawdown_20d_pct','return_20d','max_drawdown_pct'],['max_drawdown_30d_pct','return_30d','max_drawdown_pct']];
  for(const [name,key,field] of pairs)ci[name]=bootstrapDifference(metricValues(groups.failure_plus_no_reclaim,key,field),metricValues(groups.failure_plus_reclaim,key,field));
  ci.negative_return_20d=bootstrapDifference(groups.failure_plus_no_reclaim.map(e=>e.metrics.return_20d).filter(x=>x.status==='resolved').map(x=>x.negative_return?1:0),groups.failure_plus_reclaim.map(e=>e.metrics.return_20d).filter(x=>x.status==='resolved').map(x=>x.negative_return?1:0));
  ci.negative_return_30d=bootstrapDifference(groups.failure_plus_no_reclaim.map(e=>e.metrics.return_30d).filter(x=>x.status==='resolved').map(x=>x.negative_return?1:0),groups.failure_plus_reclaim.map(e=>e.metrics.return_30d).filter(x=>x.status==='resolved').map(x=>x.negative_return?1:0));
  ci.structural_repair_30d=bootstrapDifference(groups.failure_plus_no_reclaim.map(e=>e.metrics.structural_repair_30d).filter(x=>x.status==='resolved').map(x=>x.structural_repair?1:0),groups.failure_plus_reclaim.map(e=>e.metrics.structural_repair_30d).filter(x=>x.status==='resolved').map(x=>x.structural_repair?1:0));
  const metrics={schema_version:1,methodology:'institutional-withdrawal-validation-metrics-v1',lifecycle_methodology:'institutional-withdrawal-lifecycle-v1',frozen_development_methodology:'v6.0-v6.5',research_only:true,production_safe:false,source_main_sha:sourceMainSha,sample:outcomes.sample,counts:outcomes.counts,groups:summaries,between_group_bootstrap_95ci:ci,bootstrap_policy:'CI emitted only when both compared groups have at least 8 resolved observations for that metric, matching the preregistered minimum subgroup evidence gate; deterministic 5000-resample bootstrap.',promotion_count_gate:{required_resolved_durable_failures:30,required_each_group:8,observed_resolved_durable_failures:resolvedEvents.length,observed_failure_plus_reclaim:groups.failure_plus_reclaim.length,observed_failure_plus_no_reclaim:groups.failure_plus_no_reclaim.length,met:resolvedEvents.length>=30&&groups.failure_plus_reclaim.length>=8&&groups.failure_plus_no_reclaim.length>=8},separation:{stock_holdout_only:true,development_included:false,time_holdout_included:false},generated_at:new Date().toISOString()};
  fs.mkdirSync(path.dirname(outcomesFile),{recursive:true});fs.writeFileSync(outcomesFile,JSON.stringify(outcomes,null,2)+'\n');fs.writeFileSync(metricsFile,JSON.stringify(metrics,null,2)+'\n');
  console.log(JSON.stringify({counts:outcomes.counts,promotion_count_gate:metrics.promotion_count_gate,groups:metrics.groups},null,2));
}
if(require.main===module)main();
module.exports={maxDrawdownPct,windowMetric,bootstrapDifference,summarizeGroup};
