#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const args=process.argv.slice(2);
const arg=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0&&args[i+1]?args[i+1]:f;};
const v63File=arg('v63',path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-3-delayed-failure.json'));
const v6File=arg('v6',path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-distribution-absorption.json'));
const pvFile=arg('price-volume',path.join('data_research','institutional-flow','features','price-volume-v5.json'));
const foreignFile=arg('foreign',path.join('data_research','institutional-flow','features','foreign-flow-v5.json'));
const output=arg('output',path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-4-durable-failure.json'));
const report=arg('report',path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-4-durable-failure.md'));

const v63=JSON.parse(fs.readFileSync(v63File,'utf8'));
const v6=JSON.parse(fs.readFileSync(v6File,'utf8'));
const pv=JSON.parse(fs.readFileSync(pvFile,'utf8'));
const foreign=JSON.parse(fs.readFileSync(foreignFile,'utf8'));
if(v63.methodology!=='institutional-withdrawal-v6-3-delayed-failure-transition-v1') throw new Error(`Unexpected v6.3 methodology ${v63.methodology}`);
if(v6.methodology!=='institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1') throw new Error(`Unexpected v6 methodology ${v6.methodology}`);
if(JSON.stringify(pv.trading_dates)!==JSON.stringify(foreign.trading_dates)) throw new Error('Daily calendars differ');

const dates=pv.trading_dates;
const pvMap=new Map(pv.rows.map(r=>[`${r.stock}|${r.date}`,r]));
const fMap=new Map(foreign.rows.map(r=>[`${r.stock}|${r.date}`,r]));
const weekly=new Map();
for(const r of (v6.results?.all_eligible?.events||[])){
  if(!weekly.has(r.stock)) weekly.set(r.stock,[]);
  weekly.get(r.stock).push(r);
}
for(const xs of weekly.values()) xs.sort((a,b)=>a.market_feature_date.localeCompare(b.market_feature_date));
const round=(v,d=2)=>Number.isFinite(v)?Number(v.toFixed(d)):null;
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a/b-1)*100:null;
function latestWeekly(stock,date){let z=null;for(const r of (weekly.get(stock)||[])){if(r.market_feature_date<=date)z=r;else break;}return z;}
function fNet5(r){return Number(r?.rolling_5d?.total_net);}
function fRatio5(r){return Number(r?.rolling_5d?.total_sell_ratio);}

const candidates=(v63.events||[]).filter(e=>['immediate_failure_preserved','confirmed_delayed_failure'].includes(e.status));
const events=[];
for(const src of candidates){
  const stock=src.stock, anchor=src.fragile_anchor, transition=src.transition_date;
  const ai=dates.indexOf(anchor), ti=dates.indexOf(transition);
  if(ai<0||ti<0||ti<=ai) throw new Error(`Invalid candidate dates ${stock} ${anchor} ${transition}`);
  const anchorClose=Number(pvMap.get(`${stock}|${anchor}`)?.close);
  if(!Number.isFinite(anchorClose)) throw new Error(`Missing anchor close ${stock} ${anchor}`);
  let runningPeak=anchorClose;
  for(const d of dates.slice(ai,ti+1)){
    const c=Number(pvMap.get(`${stock}|${d}`)?.close);
    if(Number.isFinite(c)) runningPeak=Math.max(runningPeak,c);
  }
  const persistenceDates=dates.slice(ti+1,ti+4);
  const rows=[];
  for(const d of persistenceDates){
    const p=pvMap.get(`${stock}|${d}`); const c=Number(p?.close);
    if(!Number.isFinite(c)){rows.push({date:d,missing_price:true});continue;}
    runningPeak=Math.max(runningPeak,c);
    const ret=pct(c,anchorClose), peakGain=pct(runningPeak,anchorClose), dd=pct(c,runningPeak);
    const anchorBreak=ret<=-2;
    const failedReboundPersist=peakGain>=5 && dd<=-8 && ret<=1;
    const broken=anchorBreak||failedReboundPersist;
    const f=fMap.get(`${stock}|${d}`); const net5=fNet5(f), ratio=fRatio5(f);
    const foreignSupply=Number.isFinite(net5)&&Number.isFinite(ratio)&&net5<0&&ratio>=0.6;
    const w=latestWeekly(stock,d); const brokerScore=Number(w?.broker?.score); const persistent=Boolean(w?.classification?.persistent_transfer);
    const brokerSupply=Number.isFinite(brokerScore)&&brokerScore>=3;
    const supply=foreignSupply||brokerSupply||persistent;
    rows.push({date:d,close:c,return_from_anchor_pct:round(ret),running_peak_gain_pct:round(peakGain),drawdown_from_peak_pct:round(dd),anchor_breakdown_persists:anchorBreak,failed_rebound_persists:failedReboundPersist,broken_state:broken,foreign_supply:foreignSupply,foreign_net_5d:Number.isFinite(net5)?net5:null,foreign_sell_ratio_5d:Number.isFinite(ratio)?ratio:null,broker_supply:brokerSupply,latest_broker_score:Number.isFinite(brokerScore)?brokerScore:null,ownership_supply:persistent,latest_tdcc_anchor:w?.tdcc_observed_date||null,transfer_streak:Number(w?.tdcc?.transfer_streak??0),supply_confirm:supply});
  }
  let status;
  if(persistenceDates.length<3) status='insufficient_persistence_followup';
  else {
    const brokenVotes=rows.filter(r=>r.broken_state).length;
    const supplyVotes=rows.filter(r=>r.supply_confirm).length;
    status=brokenVotes>=2&&supplyVotes>=1?'durable_failure_confirmed':'candidate_failure_not_durable';
  }
  events.push({stock,fragile_anchor:anchor,candidate_failure_date:transition,candidate_status:src.status,candidate_path:src.delayed_path||'immediate',v61_outcome_label:src.v61_outcome_label||null,anchor_close:anchorClose,persistence_status:status,broken_votes:rows.filter(r=>r.broken_state).length,supply_votes:rows.filter(r=>r.supply_confirm).length,persistence_window:rows});
}
const counts={};for(const e of events)counts[e.persistence_status]=(counts[e.persistence_status]||0)+1;
const byOutcome={};for(const e of events){const k=e.v61_outcome_label||'unknown';if(!byOutcome[k])byOutcome[k]={candidates:0,durable:0,not_durable:0,insufficient:0};const x=byOutcome[k];x.candidates++;if(e.persistence_status==='durable_failure_confirmed')x.durable++;else if(e.persistence_status==='candidate_failure_not_durable')x.not_durable++;else x.insufficient++;}
for(const x of Object.values(byOutcome))x.durability_rate=x.candidates?round(x.durable/x.candidates,3):null;
const payload={schema_version:1,methodology:'institutional-withdrawal-v6-4-durable-failure-confirmation-v1',research_only:true,production_safe:false,pre_registered_spec:'data_research/institutional-flow/v6-4-durable-failure-spec.md',source_methodologies:{v63:v63.methodology,v6:v6.methodology,price_volume:pv.methodology,foreign:foreign.methodology},persistence_window_sessions:3,required_broken_votes:2,required_supply_votes:1,counts,by_v61_outcome:byOutcome,events,guardrails:['Candidate failure day is excluded from persistence votes.','v6.1 outcome labels are attached only after durability classification.','v6.4 can only confirm or reject an existing frozen v6.3 candidate; it cannot create new candidates.','Development-sample research only; untouched/walk-forward validation remains required.'],generated_at:new Date().toISOString()};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');
const lines=['# Institutional Withdrawal v6.4 — Durable Failure Confirmation','',`- Existing v6.3 failure candidates: **${events.length}**`,`- Durable confirmations: **${counts.durable_failure_confirmed||0}**`,`- Candidate failures rejected as non-durable: **${counts.candidate_failure_not_durable||0}**`,`- Insufficient persistence follow-up: **${counts.insufficient_persistence_followup||0}**`,'','## Candidates','','| Stock | Fragile anchor | Candidate date | v6.1 diagnosis | Candidate path | Durability | Broken votes | Supply votes |','|---|---|---|---|---|---|---:|---:|'];
for(const e of events)lines.push(`| ${e.stock} | ${e.fragile_anchor} | ${e.candidate_failure_date} | ${e.v61_outcome_label} | ${e.candidate_path} | ${e.persistence_status} | ${e.broken_votes}/3 | ${e.supply_votes}/3 |`);
lines.push('','## By v6.1 diagnosis','','| Diagnosis | Candidates | Durable | Rejected | Insufficient | Durability rate |','|---|---:|---:|---:|---:|---:|');for(const [k,x] of Object.entries(byOutcome))lines.push(`| ${k} | ${x.candidates} | ${x.durable} | ${x.not_durable} | ${x.insufficient} | ${x.durability_rate} |`);
lines.push('','## Guardrails','','- Candidate day is not counted as a persistence vote.','- At least 2/3 following sessions must remain broken, and at least 1/3 must retain contemporaneous supply confirmation.','- Outcomes do not construct the rule.','- Development-sample research only.');fs.writeFileSync(report,lines.join('\n')+'\n');
console.log(JSON.stringify({counts,by_v61_outcome:byOutcome,events:events.map(e=>({stock:e.stock,anchor:e.fragile_anchor,candidate:e.candidate_failure_date,label:e.v61_outcome_label,status:e.persistence_status,broken:e.broken_votes,supply:e.supply_votes}))},null,2));
