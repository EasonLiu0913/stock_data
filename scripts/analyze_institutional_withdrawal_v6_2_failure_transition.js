#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const v61File = getArg('v61', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-1-event-diagnosis.json'));
const v6File = getArg('v6', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-distribution-absorption.json'));
const pvFile = getArg('price-volume', path.join('data_research','institutional-flow','features','price-volume-v5.json'));
const foreignFile = getArg('foreign', path.join('data_research','institutional-flow','features','foreign-flow-v5.json'));
const output = getArg('output', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-2-failure-transition.json'));
const report = getArg('report', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-2-failure-transition.md'));

const v61 = JSON.parse(fs.readFileSync(v61File,'utf8'));
const v6 = JSON.parse(fs.readFileSync(v6File,'utf8'));
const pv = JSON.parse(fs.readFileSync(pvFile,'utf8'));
const foreign = JSON.parse(fs.readFileSync(foreignFile,'utf8'));

if (v61.methodology !== 'institutional-withdrawal-v6-1-event-diagnosis-v1') throw new Error(`Unexpected v6.1 methodology: ${v61.methodology}`);
if (v6.methodology !== 'institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1') throw new Error(`Unexpected v6 methodology: ${v6.methodology}`);
if (!Array.isArray(pv.trading_dates) || !Array.isArray(foreign.trading_dates)) throw new Error('Missing source-derived daily calendars');
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
function latestWeekly(stock, date) {
  const xs = weeklyByStock.get(stock) || [];
  let best = null;
  for (const x of xs) {
    if (x.market_feature_date <= date) best = x;
    else break;
  }
  return best;
}
function pct(a,b){ return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a/b - 1)*100 : null; }
function getClose(row){ return Number(row?.close ?? row?.price_volume?.close); }
function getForeignNet5(r){ return Number(r?.rolling_5d?.total_net); }
function getForeignSellRatio5(r){ return Number(r?.rolling_5d?.total_sell_ratio); }

const events = [];
for (const src of v61.events) {
  const stock = src.stock;
  const anchor = src.anchor;
  const anchorIdx = tradingDates.indexOf(anchor);
  if (anchorIdx < 0) throw new Error(`Fragile anchor missing from daily calendar: ${stock} ${anchor}`);
  const anchorPv = pvMap.get(`${stock}|${anchor}`);
  const anchorClose = getClose(anchorPv);
  if (!Number.isFinite(anchorClose)) throw new Error(`Anchor close missing: ${stock} ${anchor}`);

  const futureDates = tradingDates.slice(anchorIdx + 1, anchorIdx + 11);
  let runningPeak = anchorClose;
  let transition = null;
  const daily = [];
  for (let i=0; i<futureDates.length; i++) {
    const date = futureDates[i];
    const p = pvMap.get(`${stock}|${date}`);
    const f = foreignMap.get(`${stock}|${date}`);
    const close = getClose(p);
    if (!Number.isFinite(close)) {
      daily.push({date, missing_price:true});
      continue;
    }
    runningPeak = Math.max(runningPeak, close);
    const retFromAnchor = pct(close, anchorClose);
    const peakGain = pct(runningPeak, anchorClose);
    const drawdownFromPeak = pct(close, runningPeak);
    const priceBreakdown = retFromAnchor <= -5;
    const failedRebound = peakGain >= 3 && retFromAnchor <= -2 && drawdownFromPeak <= -5;
    const net5 = getForeignNet5(f);
    const sellRatio5 = getForeignSellRatio5(f);
    const foreignSupply = Number.isFinite(net5) && Number.isFinite(sellRatio5) && net5 < 0 && sellRatio5 >= 0.6;
    const w = latestWeekly(stock, date);
    const persistent = Boolean(w?.classification?.persistent_transfer);
    const brokerScore = Number(w?.broker?.score);
    const ownershipSupply = persistent && Number.isFinite(brokerScore) && brokerScore >= 3;
    const supplyConfirm = foreignSupply || ownershipSupply;
    const triggered = supplyConfirm && (priceBreakdown || failedRebound);
    const row = {
      session: i+1,
      date,
      close,
      return_from_anchor_pct: round(retFromAnchor),
      running_peak_gain_pct: round(peakGain),
      drawdown_from_peak_pct: round(drawdownFromPeak),
      price_breakdown: priceBreakdown,
      failed_rebound: failedRebound,
      foreign_supply: foreignSupply,
      foreign_net_5d: Number.isFinite(net5) ? net5 : null,
      foreign_sell_ratio_5d: Number.isFinite(sellRatio5) ? sellRatio5 : null,
      latest_tdcc_anchor: w?.tdcc_observed_date || null,
      transfer_streak: Number(w?.tdcc?.transfer_streak ?? 0),
      latest_persistent_transfer: persistent,
      latest_broker_score: Number.isFinite(brokerScore) ? brokerScore : null,
      ownership_supply_state: ownershipSupply,
      failure_transition: triggered,
    };
    daily.push(row);
    if (!transition && triggered) transition = row;
  }

  const status = transition
    ? 'confirmed_failure_transition'
    : futureDates.length >= 10
      ? 'no_failure_within_10_sessions'
      : 'insufficient_followup';
  events.push({
    stock,
    fragile_anchor: anchor,
    anchor_close: anchorClose,
    v61_outcome_label: src.outcome?.label || null,
    evidence_strength: src.evidence_strength ?? null,
    status,
    failure_transition_date: transition?.date || null,
    sessions_to_transition: transition?.session || null,
    trigger: transition ? {
      price_breakdown: transition.price_breakdown,
      failed_rebound: transition.failed_rebound,
      foreign_supply: transition.foreign_supply,
      ownership_supply_state: transition.ownership_supply_state,
      return_from_anchor_pct: transition.return_from_anchor_pct,
      running_peak_gain_pct: transition.running_peak_gain_pct,
      drawdown_from_peak_pct: transition.drawdown_from_peak_pct,
      latest_tdcc_anchor: transition.latest_tdcc_anchor,
      transfer_streak: transition.transfer_streak,
      latest_broker_score: transition.latest_broker_score,
      foreign_net_5d: transition.foreign_net_5d,
      foreign_sell_ratio_5d: transition.foreign_sell_ratio_5d,
    } : null,
    available_future_sessions: futureDates.length,
    daily_path: daily,
  });
}

const counts = {};
for (const e of events) counts[e.status] = (counts[e.status]||0)+1;
const byOutcome = {};
for (const e of events) {
  const k=e.v61_outcome_label || 'unknown';
  if(!byOutcome[k]) byOutcome[k]={events:0, confirmed:0, no_failure:0, insufficient:0, transition_sessions:[]};
  const x=byOutcome[k]; x.events++;
  if(e.status==='confirmed_failure_transition'){x.confirmed++; x.transition_sessions.push(e.sessions_to_transition);}
  else if(e.status==='no_failure_within_10_sessions') x.no_failure++;
  else x.insufficient++;
}
for(const x of Object.values(byOutcome)){
  x.confirmation_rate = x.events ? round(x.confirmed/x.events,3) : null;
  x.mean_sessions_to_transition = x.transition_sessions.length ? round(x.transition_sessions.reduce((a,b)=>a+b,0)/x.transition_sessions.length,2) : null;
  delete x.transition_sessions;
}
const kyec = events.filter(e=>e.stock==='2449');
const payload = {
  schema_version:1,
  methodology:'institutional-withdrawal-v6-2-fragile-failure-transition-v1',
  research_only:true,
  production_safe:false,
  pre_registered_spec:'data_research/institutional-flow/v6-2-failure-transition-spec.md',
  source_methodologies:{v61:v61.methodology,v6:v6.methodology,price_volume:pv.methodology,foreign:foreign.methodology},
  window_sessions:10,
  counts,
  by_v61_outcome:byOutcome,
  events,
  stock_2449:{
    fragile_events:kyec.length,
    transitions:kyec.filter(e=>e.status==='confirmed_failure_transition').map(e=>({anchor:e.fragile_anchor,transition_date:e.failure_transition_date,sessions:e.sessions_to_transition,trigger:e.trigger,v61_outcome_label:e.v61_outcome_label})),
  },
  guardrails:[
    'Failure rules use daily current/prior price-volume and foreign features plus the latest available weekly v6 ownership/supply state only.',
    'v6.1 outcome labels are attached only after transition classification and never construct the rule.',
    'Development-sample diagnostic only; untouched/walk-forward validation remains required before production promotion.',
  ],
  generated_at:new Date().toISOString(),
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');

const lines=[];
lines.push('# Institutional Withdrawal v6.2 — Fragile → Failure Transition');
lines.push('');
lines.push(`- Fragile events: **${events.length}**`);
lines.push(`- Confirmed failure transitions: **${counts.confirmed_failure_transition||0}**`);
lines.push(`- No failure within 10 sessions: **${counts.no_failure_within_10_sessions||0}**`);
lines.push(`- Insufficient follow-up: **${counts.insufficient_followup||0}**`);
lines.push('');
lines.push('## By v6.1 outcome label');
lines.push('');
lines.push('| v6.1 diagnosis | Events | Confirmed | Confirmation rate | Mean sessions to transition |');
lines.push('|---|---:|---:|---:|---:|');
for(const [k,x] of Object.entries(byOutcome)) lines.push(`| ${k} | ${x.events} | ${x.confirmed} | ${x.confirmation_rate ?? 'n/a'} | ${x.mean_sessions_to_transition ?? 'n/a'} |`);
lines.push('');
lines.push('## Event transitions');
lines.push('');
lines.push('| Stock | Fragile anchor | v6.1 diagnosis | Status | Transition | Sessions | Trigger | Return at transition | Peak gain | DD from peak |');
lines.push('|---|---|---|---|---|---:|---|---:|---:|---:|');
for(const e of events){
  const t=e.trigger;
  const trig=t ? [t.price_breakdown?'breakdown':null,t.failed_rebound?'failed_rebound':null,t.foreign_supply?'foreign':null,t.ownership_supply_state?'ownership+broker':null].filter(Boolean).join('+') : '-';
  lines.push(`| ${e.stock} | ${e.fragile_anchor} | ${e.v61_outcome_label} | ${e.status} | ${e.failure_transition_date||'-'} | ${e.sessions_to_transition??'-'} | ${trig} | ${t?.return_from_anchor_pct??'n/a'}% | ${t?.running_peak_gain_pct??'n/a'}% | ${t?.drawdown_from_peak_pct??'n/a'}% |`);
}
lines.push('');
lines.push('## 2449 timeline result');
lines.push('');
if(!kyec.length) lines.push('- No 2449 fragile events found.');
else for(const e of kyec) lines.push(`- 2449 fragile ${e.fragile_anchor}: ${e.status}${e.failure_transition_date?`; transition ${e.failure_transition_date} (${e.sessions_to_transition} sessions)`:''}; v6.1=${e.v61_outcome_label}.`);
lines.push('');
lines.push('## Interpretation guardrails');
lines.push('');
lines.push('- A transition requires price failure plus contemporaneous supply confirmation; neither price decline nor institutional selling alone is sufficient.');
lines.push('- v6.1 outcome labels are diagnostic only and do not feed the transition rule.');
lines.push('- This remains development-sample research, not a production signal.');
fs.writeFileSync(report,lines.join('\n')+'\n');
console.log(JSON.stringify({counts,by_v61_outcome:byOutcome,stock_2449:payload.stock_2449},null,2));
