#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const v62File = getArg('v62', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-2-failure-transition.json'));
const v6File = getArg('v6', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-distribution-absorption.json'));
const pvFile = getArg('price-volume', path.join('data_research','institutional-flow','features','price-volume-v5.json'));
const foreignFile = getArg('foreign', path.join('data_research','institutional-flow','features','foreign-flow-v5.json'));
const output = getArg('output', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-3-delayed-failure.json'));
const report = getArg('report', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-3-delayed-failure.md'));

const v62 = JSON.parse(fs.readFileSync(v62File,'utf8'));
const v6 = JSON.parse(fs.readFileSync(v6File,'utf8'));
const pv = JSON.parse(fs.readFileSync(pvFile,'utf8'));
const foreign = JSON.parse(fs.readFileSync(foreignFile,'utf8'));

if (v62.methodology !== 'institutional-withdrawal-v6-2-fragile-failure-transition-v1') throw new Error(`Unexpected v6.2 methodology: ${v62.methodology}`);
if (v6.methodology !== 'institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1') throw new Error(`Unexpected v6 methodology: ${v6.methodology}`);
if (!Array.isArray(pv.trading_dates) || !Array.isArray(foreign.trading_dates)) throw new Error('Missing source-derived calendars');
if (JSON.stringify(pv.trading_dates) !== JSON.stringify(foreign.trading_dates)) throw new Error('Daily calendars differ');

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
const pct = (a,b) => Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a/b - 1) * 100 : null;
function latestWeekly(stock,date){
  const xs=weeklyByStock.get(stock)||[];
  let best=null;
  for(const x of xs){ if(x.market_feature_date<=date) best=x; else break; }
  return best;
}
function foreignState(row){
  const net = Number(row?.rolling_5d?.total_net);
  const ratio = Number(row?.rolling_5d?.total_sell_ratio);
  return {
    net_5d: Number.isFinite(net) ? net : null,
    sell_ratio_5d: Number.isFinite(ratio) ? ratio : null,
    foreign_supply: Number.isFinite(net) && Number.isFinite(ratio) && net < 0 && ratio >= 0.6,
  };
}

const events=[];
for(const src of v62.events){
  if(src.status==='confirmed_failure_transition'){
    events.push({
      stock:src.stock,
      fragile_anchor:src.fragile_anchor,
      v61_outcome_label:src.v61_outcome_label,
      v62_status:src.status,
      status:'immediate_failure_preserved',
      transition_date:src.failure_transition_date,
      sessions_to_transition:src.sessions_to_transition,
      delayed_path:null,
      daily_path:[],
    });
    continue;
  }

  const anchorIdx=tradingDates.indexOf(src.fragile_anchor);
  if(anchorIdx<0) throw new Error(`Anchor missing from calendar: ${src.stock} ${src.fragile_anchor}`);
  const anchorPv=pvMap.get(`${src.stock}|${src.fragile_anchor}`);
  const anchorClose=Number(anchorPv?.close);
  if(!Number.isFinite(anchorClose)) throw new Error(`Anchor close missing: ${src.stock} ${src.fragile_anchor}`);

  const futureDates=tradingDates.slice(anchorIdx+1, anchorIdx+21);
  let runningPeak=anchorClose;
  let delayed=null;
  const daily=[];

  for(let i=0;i<futureDates.length;i++){
    const date=futureDates[i];
    const session=i+1;
    const p=pvMap.get(`${src.stock}|${date}`);
    const close=Number(p?.close);
    if(!Number.isFinite(close)){
      daily.push({session,date,missing_price:true});
      continue;
    }
    runningPeak=Math.max(runningPeak,close);
    const ret=pct(close,anchorClose);
    const peakGain=pct(runningPeak,anchorClose);
    const dd=pct(close,runningPeak);
    const f=foreignState(foreignMap.get(`${src.stock}|${date}`));
    const w=latestWeekly(src.stock,date);
    const brokerScore=Number(w?.broker?.score);
    const brokerSupply=Number.isFinite(brokerScore) && brokerScore>=3;
    const ownershipSupply=Boolean(w?.classification?.persistent_transfer);
    const supplyConfirm=f.foreign_supply || brokerSupply || ownershipSupply;
    const delayedBreakdown=session>=11 && session<=20 && ret<=-10;
    const reboundFailure=session>=11 && session<=20 && peakGain>=5 && dd<=-10 && ret<=-2;
    const trigger=supplyConfirm && (delayedBreakdown || reboundFailure);
    const row={
      session,date,close,
      return_from_anchor_pct:round(ret),
      running_peak_gain_pct:round(peakGain),
      drawdown_from_peak_pct:round(dd),
      delayed_breakdown:delayedBreakdown,
      rebound_failure:reboundFailure,
      foreign_supply:f.foreign_supply,
      foreign_net_5d:f.net_5d,
      foreign_sell_ratio_5d:f.sell_ratio_5d,
      broker_supply:brokerSupply,
      latest_broker_score:Number.isFinite(brokerScore)?brokerScore:null,
      ownership_supply:ownershipSupply,
      latest_tdcc_anchor:w?.tdcc_observed_date||null,
      transfer_streak:Number(w?.tdcc?.transfer_streak??0),
      supply_confirm:supplyConfirm,
      delayed_failure_transition:trigger,
    };
    daily.push(row);
    if(!delayed && trigger) delayed=row;
  }

  let status;
  if(delayed) status='confirmed_delayed_failure';
  else if(futureDates.length>=20) status='no_failure_within_20_sessions';
  else status='insufficient_followup';

  events.push({
    stock:src.stock,
    fragile_anchor:src.fragile_anchor,
    anchor_close:anchorClose,
    v61_outcome_label:src.v61_outcome_label,
    v62_status:src.status,
    status,
    transition_date:delayed?.date||null,
    sessions_to_transition:delayed?.session||null,
    delayed_path:delayed ? (delayed.rebound_failure ? 'rebound_failure' : 'delayed_breakdown') : null,
    trigger:delayed ? {
      return_from_anchor_pct:delayed.return_from_anchor_pct,
      running_peak_gain_pct:delayed.running_peak_gain_pct,
      drawdown_from_peak_pct:delayed.drawdown_from_peak_pct,
      foreign_supply:delayed.foreign_supply,
      foreign_net_5d:delayed.foreign_net_5d,
      foreign_sell_ratio_5d:delayed.foreign_sell_ratio_5d,
      broker_supply:delayed.broker_supply,
      latest_broker_score:delayed.latest_broker_score,
      ownership_supply:delayed.ownership_supply,
      latest_tdcc_anchor:delayed.latest_tdcc_anchor,
      transfer_streak:delayed.transfer_streak,
    } : null,
    available_future_sessions:futureDates.length,
    daily_path:daily,
  });
}

const counts={};
for(const e of events) counts[e.status]=(counts[e.status]||0)+1;
const byOutcome={};
for(const e of events){
  const k=e.v61_outcome_label||'unknown';
  if(!byOutcome[k]) byOutcome[k]={events:0,immediate:0,delayed:0,no_failure:0,insufficient:0,transition_sessions:[]};
  const x=byOutcome[k]; x.events++;
  if(e.status==='immediate_failure_preserved'){x.immediate++;x.transition_sessions.push(e.sessions_to_transition);}
  else if(e.status==='confirmed_delayed_failure'){x.delayed++;x.transition_sessions.push(e.sessions_to_transition);}
  else if(e.status==='no_failure_within_20_sessions')x.no_failure++;
  else x.insufficient++;
}
for(const x of Object.values(byOutcome)){
  x.total_confirmed=x.immediate+x.delayed;
  x.confirmation_rate=x.events?round(x.total_confirmed/x.events,3):null;
  x.mean_sessions_to_transition=x.transition_sessions.length?round(x.transition_sessions.reduce((a,b)=>a+b,0)/x.transition_sessions.length,2):null;
  delete x.transition_sessions;
}

const payload={
  schema_version:1,
  methodology:'institutional-withdrawal-v6-3-delayed-failure-transition-v1',
  research_only:true,
  production_safe:false,
  pre_registered_spec:'data_research/institutional-flow/v6-3-delayed-failure-spec.md',
  source_methodologies:{v62:v62.methodology,v6:v6.methodology,price_volume:pv.methodology,foreign:foreign.methodology},
  immediate_window_sessions:10,
  delayed_window_sessions:[11,20],
  counts,
  by_v61_outcome:byOutcome,
  events,
  stock_2449:events.filter(e=>e.stock==='2449').map(e=>({anchor:e.fragile_anchor,status:e.status,transition_date:e.transition_date,sessions:e.sessions_to_transition,path:e.delayed_path,v61_outcome_label:e.v61_outcome_label,trigger:e.trigger})),
  guardrails:[
    'v6.2 immediate failures are preserved and never reclassified.',
    'Delayed triggers use only current/prior daily price-volume and foreign data plus the latest available weekly v6 state.',
    'v6.1 outcome labels are attached only for post-classification diagnostics and never construct triggers.',
    'Development-sample research only; untouched/walk-forward validation remains required.',
  ],
  generated_at:new Date().toISOString(),
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');

const lines=[];
lines.push('# Institutional Withdrawal v6.3 — Delayed Failure Transition');
lines.push('');
lines.push(`- Fragile events: **${events.length}**`);
lines.push(`- Immediate failures preserved from v6.2: **${counts.immediate_failure_preserved||0}**`);
lines.push(`- Confirmed delayed failures (sessions 11–20): **${counts.confirmed_delayed_failure||0}**`);
lines.push(`- No failure within 20 sessions: **${counts.no_failure_within_20_sessions||0}**`);
lines.push(`- Insufficient follow-up: **${counts.insufficient_followup||0}**`);
lines.push('');
lines.push('## By v6.1 diagnosis');
lines.push('');
lines.push('| v6.1 diagnosis | Events | Immediate | Delayed | Total confirmed | Confirmation rate | Mean sessions |');
lines.push('|---|---:|---:|---:|---:|---:|---:|');
for(const [k,x] of Object.entries(byOutcome)) lines.push(`| ${k} | ${x.events} | ${x.immediate} | ${x.delayed} | ${x.total_confirmed} | ${x.confirmation_rate ?? 'n/a'} | ${x.mean_sessions_to_transition ?? 'n/a'} |`);
lines.push('');
lines.push('## Event transitions');
lines.push('');
lines.push('| Stock | Fragile anchor | v6.1 diagnosis | v6.3 status | Transition | Session | Path | Return | Peak gain | DD from peak | Supply |');
lines.push('|---|---|---|---|---|---:|---|---:|---:|---:|---|');
for(const e of events){
  const t=e.trigger;
  const supply=t?[t.foreign_supply?'foreign':null,t.broker_supply?'broker':null,t.ownership_supply?'ownership':null].filter(Boolean).join('+'):'-';
  lines.push(`| ${e.stock} | ${e.fragile_anchor} | ${e.v61_outcome_label} | ${e.status} | ${e.transition_date||'-'} | ${e.sessions_to_transition??'-'} | ${e.delayed_path||'-'} | ${t?.return_from_anchor_pct??'n/a'}% | ${t?.running_peak_gain_pct??'n/a'}% | ${t?.drawdown_from_peak_pct??'n/a'}% | ${supply||'-'} |`);
}
lines.push('');
lines.push('## 2449');
lines.push('');
for(const e of payload.stock_2449) lines.push(`- ${e.anchor}: ${e.status}${e.transition_date?`; ${e.transition_date} session ${e.sessions}, path=${e.path}`:''}; v6.1=${e.v61_outcome_label}.`);
lines.push('');
lines.push('## Guardrails');
lines.push('');
lines.push('- v6.3 is a separately pre-registered delayed-transition hypothesis; v6.2 thresholds remain frozen.');
lines.push('- No v6.1 outcome label constructs a trigger.');
lines.push('- Development-sample research only; no production promotion from this result.');
fs.writeFileSync(report,lines.join('\n')+'\n');
console.log(JSON.stringify({counts,by_v61_outcome:byOutcome,stock_2449:payload.stock_2449},null,2));
