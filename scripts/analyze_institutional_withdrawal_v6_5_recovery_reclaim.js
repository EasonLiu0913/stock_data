#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const v64File = getArg('v64', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-4-durable-failure.json'));
const v6File = getArg('v6', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-distribution-absorption.json'));
const pvFile = getArg('price-volume', path.join('data_research','institutional-flow','features','price-volume-v5.json'));
const foreignFile = getArg('foreign', path.join('data_research','institutional-flow','features','foreign-flow-v5.json'));
const output = getArg('output', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-5-recovery-reclaim.json'));
const report = getArg('report', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-5-recovery-reclaim.md'));

const v64 = JSON.parse(fs.readFileSync(v64File,'utf8'));
const v6 = JSON.parse(fs.readFileSync(v6File,'utf8'));
const pv = JSON.parse(fs.readFileSync(pvFile,'utf8'));
const foreign = JSON.parse(fs.readFileSync(foreignFile,'utf8'));

if (v64.methodology !== 'institutional-withdrawal-v6-4-durable-failure-confirmation-v1') throw new Error(`Unexpected v6.4 methodology: ${v64.methodology}`);
if (v6.methodology !== 'institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1') throw new Error(`Unexpected v6 methodology: ${v6.methodology}`);
if (!Array.isArray(pv.trading_dates) || !Array.isArray(foreign.trading_dates)) throw new Error('Missing daily calendars');
if (JSON.stringify(pv.trading_dates) !== JSON.stringify(foreign.trading_dates)) throw new Error('Price-volume and foreign calendars differ');

const tradingDates = pv.trading_dates;
const pvMap = new Map(pv.rows.map(r => [`${r.stock}|${r.date}`, r]));
const foreignMap = new Map(foreign.rows.map(r => [`${r.stock}|${r.date}`, r]));
const v6Events = v6.results?.all_eligible?.events || [];
const weeklyByStock = new Map();
for (const r of v6Events) {
  if (!weeklyByStock.has(r.stock)) weeklyByStock.set(r.stock, []);
  weeklyByStock.get(r.stock).push(r);
}
for (const xs of weeklyByStock.values()) xs.sort((a,b)=>a.market_feature_date.localeCompare(b.market_feature_date));

const round = (v,d=2) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const pct = (a,b) => Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a/b - 1)*100 : null;
const getClose = r => Number(r?.close ?? r?.price_volume?.close);
function latestWeekly(stock,date){
  const xs=weeklyByStock.get(stock)||[];
  let best=null;
  for(const x of xs){ if(x.market_feature_date<=date) best=x; else break; }
  return best;
}
function foreign5(r){ return r?.rolling_5d || null; }
function supplyRelief(stock,date){
  const f=foreignMap.get(`${stock}|${date}`);
  const r5=foreign5(f);
  const foreignNet=Number(r5?.total_net);
  const foreignSellRatio=Number(r5?.total_sell_ratio);
  const foreignRelief = (Number.isFinite(foreignNet) && foreignNet >= 0) || (Number.isFinite(foreignSellRatio) && foreignSellRatio <= 0.4);
  const w=latestWeekly(stock,date);
  const brokerScore=Number(w?.broker?.score);
  const brokerRelief=Number.isFinite(brokerScore) && brokerScore <= 2;
  const persistent=Boolean(w?.classification?.persistent_transfer);
  const ownershipRelief=w ? !persistent : false;
  return {
    foreign_relief:foreignRelief,
    foreign_net_5d:Number.isFinite(foreignNet)?foreignNet:null,
    foreign_sell_ratio_5d:Number.isFinite(foreignSellRatio)?foreignSellRatio:null,
    broker_relief:brokerRelief,
    latest_broker_score:Number.isFinite(brokerScore)?brokerScore:null,
    ownership_relief:ownershipRelief,
    latest_tdcc_anchor:w?.tdcc_observed_date||null,
    transfer_streak:Number(w?.tdcc?.transfer_streak ?? 0),
  };
}

const candidates=(v64.events||[]).filter(e=>e.persistence_status==='durable_failure_confirmed');
const events=[];
for(const c of candidates){
  const stock=c.stock;
  const candidateDate=c.candidate_failure_date;
  const idx=tradingDates.indexOf(candidateDate);
  if(idx<0) throw new Error(`Candidate date missing from calendar: ${stock} ${candidateDate}`);
  const anchorClose=Number(c.anchor_close);
  if(!Number.isFinite(anchorClose)) throw new Error(`Anchor close missing: ${stock} ${candidateDate}`);

  const dates=tradingDates.slice(idx+1,idx+16);
  const daily=[];
  let trough=null;
  let firstOneDayReclaim=null;
  for(let i=0;i<dates.length;i++){
    const date=dates[i];
    const p=pvMap.get(`${stock}|${date}`);
    const close=getClose(p);
    const relief=supplyRelief(stock,date);
    if(!Number.isFinite(close)){
      daily.push({session:i+1,date,missing_price:true,...relief});
      continue;
    }
    if(!trough || close<trough.close) trough={date,close,session:i+1};
    const reclaim=close>=anchorClose;
    if(reclaim && !firstOneDayReclaim) firstOneDayReclaim={date,session:i+1,close};
    daily.push({
      session:i+1,date,close,
      return_from_anchor_pct:round(pct(close,anchorClose)),
      anchor_reclaim_vote:reclaim,
      ...relief,
    });
  }

  let firstPriceRepair=null;
  let confirmed=null;
  for(let start=3;start<=daily.length-3;start++){
    const win=daily.slice(start,start+3);
    if(win.length<3 || win.some(x=>x.missing_price)) continue;
    const priceVotes=win.filter(x=>x.anchor_reclaim_vote).length;
    const priceRepair=priceVotes>=2;
    if(priceRepair && !firstPriceRepair){
      firstPriceRepair={start_session:win[0].session,end_session:win[2].session,start_date:win[0].date,end_date:win[2].date,price_reclaim_votes:priceVotes};
    }
    const fam={
      foreign:win.some(x=>x.foreign_relief),
      broker:win.some(x=>x.broker_relief),
      ownership:win.some(x=>x.ownership_relief),
    };
    const reliefFamilies=Object.values(fam).filter(Boolean).length;
    if(priceRepair && reliefFamilies>=2){
      confirmed={
        reclaim_date:win[2].date,
        start_date:win[0].date,
        start_session:win[0].session,
        end_session:win[2].session,
        price_reclaim_votes:priceVotes,
        relief_families:fam,
        relief_family_count:reliefFamilies,
        closes:win.map(x=>x.close),
      };
      break;
    }
  }

  let maxReboundFromTrough=null;
  if(trough){
    for(const d of daily){
      if(d.missing_price || d.session<trough.session) continue;
      const r=pct(d.close,trough.close);
      if(Number.isFinite(r) && (!maxReboundFromTrough || r>maxReboundFromTrough.pct)) maxReboundFromTrough={date:d.date,session:d.session,pct:r,close:d.close};
    }
  }
  const lastValid=[...daily].reverse().find(x=>!x.missing_price) || null;
  const completeFollowup=dates.length>=15;
  const status=confirmed ? 'confirmed_reclaim' : completeFollowup ? 'no_reclaim_within_15_sessions' : 'insufficient_recovery_followup';
  events.push({
    stock,
    fragile_anchor:c.fragile_anchor,
    fragile_anchor_close:anchorClose,
    candidate_failure_date:candidateDate,
    candidate_path:c.candidate_path,
    v61_outcome_label:c.v61_outcome_label,
    status,
    first_one_day_anchor_reclaim:firstOneDayReclaim,
    first_price_repair_window:firstPriceRepair,
    reclaim_confirmation:confirmed,
    post_candidate_trough:trough ? {...trough,return_from_anchor_pct:round(pct(trough.close,anchorClose))}:null,
    max_rebound_from_trough:maxReboundFromTrough ? {...maxReboundFromTrough,pct:round(maxReboundFromTrough.pct)}:null,
    end_of_window:lastValid ? {date:lastValid.date,session:lastValid.session,close:lastValid.close,return_from_anchor_pct:round(pct(lastValid.close,anchorClose))}:null,
    available_future_sessions:dates.length,
    daily_path:daily,
  });
}

const counts={};
const byOutcome={};
for(const e of events){
  counts[e.status]=(counts[e.status]||0)+1;
  const k=e.v61_outcome_label||'unknown';
  if(!byOutcome[k]) byOutcome[k]={candidates:0,reclaimed:0,no_reclaim:0,insufficient:0,reclaim_sessions:[]};
  const x=byOutcome[k]; x.candidates++;
  if(e.status==='confirmed_reclaim'){x.reclaimed++;x.reclaim_sessions.push(e.reclaim_confirmation.end_session);}
  else if(e.status==='no_reclaim_within_15_sessions')x.no_reclaim++;
  else x.insufficient++;
}
for(const x of Object.values(byOutcome)){
  x.reclaim_rate=x.candidates?round(x.reclaimed/x.candidates,3):null;
  x.mean_reclaim_session=x.reclaim_sessions.length?round(x.reclaim_sessions.reduce((a,b)=>a+b,0)/x.reclaim_sessions.length,2):null;
  delete x.reclaim_sessions;
}

const payload={
  schema_version:1,
  methodology:'institutional-withdrawal-v6-5-recovery-reclaim-diagnosis-v1',
  research_only:true,
  production_safe:false,
  pre_registered_spec:'data_research/institutional-flow/v6-5-recovery-reclaim-spec.md',
  source_methodologies:{v64:v64.methodology,v6:v6.methodology,price_volume:pv.methodology,foreign:foreign.methodology},
  recovery_window_sessions:[4,15],
  counts,
  by_v61_outcome:byOutcome,
  events,
  guardrails:[
    'v6.5 can only diagnose recovery after a frozen v6.4 durable failure candidate; it cannot create or delete historical candidates.',
    'The candidate day and v6.4 sessions 1-3 are excluded from reclaim confirmation windows.',
    'v6.1 outcome labels are attached only after reclaim classification.',
    'Development-sample research only; untouched/walk-forward validation remains required.',
  ],
  generated_at:new Date().toISOString(),
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');

const lines=[];
lines.push('# Institutional Withdrawal v6.5 — Recovery / Reclaim Diagnosis');
lines.push('');
lines.push(`- Frozen v6.4 durable candidates: **${events.length}**`);
lines.push(`- Confirmed reclaim: **${counts.confirmed_reclaim||0}**`);
lines.push(`- No reclaim within 15 sessions: **${counts.no_reclaim_within_15_sessions||0}**`);
lines.push(`- Insufficient recovery follow-up: **${counts.insufficient_recovery_followup||0}**`);
lines.push('');
lines.push('## Candidates');
lines.push('');
lines.push('| Stock | Fragile anchor | Candidate | v6.1 diagnosis | Recovery status | Reclaim date | Price repair | Relief families | Trough vs anchor | Max rebound from trough | End vs anchor |');
lines.push('|---|---|---|---|---|---|---|---:|---:|---:|---:|');
for(const e of events){
  const r=e.reclaim_confirmation;
  lines.push(`| ${e.stock} | ${e.fragile_anchor} | ${e.candidate_failure_date} | ${e.v61_outcome_label} | ${e.status} | ${r?.reclaim_date||'-'} | ${r?`${r.price_reclaim_votes}/3`:'-'} | ${r?.relief_family_count??'-'} | ${e.post_candidate_trough?.return_from_anchor_pct??'n/a'}% | ${e.max_rebound_from_trough?.pct??'n/a'}% | ${e.end_of_window?.return_from_anchor_pct??'n/a'}% |`);
}
lines.push('');
lines.push('## By v6.1 diagnosis');
lines.push('');
lines.push('| Diagnosis | Candidates | Reclaimed | No reclaim | Insufficient | Reclaim rate | Mean reclaim session |');
lines.push('|---|---:|---:|---:|---:|---:|---:|');
for(const [k,x] of Object.entries(byOutcome)) lines.push(`| ${k} | ${x.candidates} | ${x.reclaimed} | ${x.no_reclaim} | ${x.insufficient} | ${x.reclaim_rate??'n/a'} | ${x.mean_reclaim_session??'n/a'} |`);
lines.push('');
lines.push('## Guardrails');
lines.push('');
lines.push('- Reclaim requires repeated price repair and at least two supply-relief families in the same 3-session window.');
lines.push('- v6.1 outcome labels do not construct the rule.');
lines.push('- Development-sample research only.');
fs.writeFileSync(report,lines.join('\n')+'\n');

console.log(JSON.stringify({counts,by_v61_outcome:byOutcome},null,2));
