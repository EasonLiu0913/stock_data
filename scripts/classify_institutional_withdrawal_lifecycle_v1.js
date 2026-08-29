#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const v6File = arg('v6', path.join('data_research','institutional-flow','backtests','institutional-withdrawal-v6-distribution-absorption.json'));
const pvFile = arg('price-volume', path.join('data_research','institutional-flow','features','price-volume-v5.json'));
const foreignFile = arg('foreign', path.join('data_research','institutional-flow','features','foreign-flow-v5.json'));
const output = arg('output', path.join('data_research','institutional-flow','validation','institutional-withdrawal-lifecycle-v1.json'));

const v6 = JSON.parse(fs.readFileSync(v6File, 'utf8'));
const pv = JSON.parse(fs.readFileSync(pvFile, 'utf8'));
const foreign = JSON.parse(fs.readFileSync(foreignFile, 'utf8'));

if (v6.methodology !== 'institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1') throw new Error(`Unexpected v6 methodology: ${v6.methodology}`);
if (pv.methodology !== 'institutional-withdrawal-v5-price-volume-features-v3-source-derived-calendar-gap-preserving') throw new Error(`Unexpected price-volume methodology: ${pv.methodology}`);
if (foreign.methodology !== 'institutional-withdrawal-v5-foreign-flow-features-v2-source-derived-calendar') throw new Error(`Unexpected foreign methodology: ${foreign.methodology}`);
if (!Array.isArray(pv.trading_dates) || JSON.stringify(pv.trading_dates) !== JSON.stringify(foreign.trading_dates)) throw new Error('Source-derived price-volume and foreign calendars differ');

const dates = pv.trading_dates;
const pvMap = new Map(pv.rows.map(r => [`${r.stock}|${r.date}`, r]));
const foreignMap = new Map(foreign.rows.map(r => [`${r.stock}|${r.date}`, r]));
const weeklyByStock = new Map();
for (const r of (v6.results?.all_eligible?.events || [])) {
  if (!weeklyByStock.has(r.stock)) weeklyByStock.set(r.stock, []);
  weeklyByStock.get(r.stock).push(r);
}
for (const xs of weeklyByStock.values()) xs.sort((a,b) => a.market_feature_date.localeCompare(b.market_feature_date));

const fragile = (v6.results?.fragile_distribution?.events || []).map(r => ({
  stock: r.stock,
  fragile_anchor: r.market_feature_date,
  tdcc_observed_date: r.tdcc_observed_date,
  anchor_close: Number(r.price_volume?.close),
}));

const pct = (a,b) => Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a / b - 1) * 100 : null;
const round = (v,d=2) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const closeOf = row => Number(row?.close ?? row?.price_volume?.close);
function latestWeekly(stock, date) {
  let best = null;
  for (const x of (weeklyByStock.get(stock) || [])) {
    if (x.market_feature_date <= date) best = x;
    else break;
  }
  return best;
}
function foreignSupply(stock, date) {
  const f = foreignMap.get(`${stock}|${date}`);
  const net5 = Number(f?.rolling_5d?.total_net);
  const ratio5 = Number(f?.rolling_5d?.total_sell_ratio);
  return { net5: Number.isFinite(net5) ? net5 : null, ratio5: Number.isFinite(ratio5) ? ratio5 : null, value: Number.isFinite(net5) && Number.isFinite(ratio5) && net5 < 0 && ratio5 >= 0.6 };
}
function weeklySupply(stock, date, v62Mode=false) {
  const w = latestWeekly(stock, date);
  const brokerScore = Number(w?.broker?.score);
  const persistent = Boolean(w?.classification?.persistent_transfer);
  const broker = Number.isFinite(brokerScore) && brokerScore >= 3;
  return {
    weekly: w,
    broker_score: Number.isFinite(brokerScore) ? brokerScore : null,
    persistent,
    broker,
    // Frozen v6.2 used persistent+broker as one ownership-supply state; v6.3+ accepted either family independently.
    confirm: v62Mode ? (persistent && broker) : (persistent || broker),
  };
}
function classifyCandidate(event) {
  const {stock, fragile_anchor: anchor, anchor_close: anchorClose} = event;
  const ai = dates.indexOf(anchor);
  if (ai < 0 || !Number.isFinite(anchorClose)) throw new Error(`Invalid fragile anchor ${stock} ${anchor}`);
  let runningPeak = anchorClose;
  let immediate = null;
  let delayed = null;
  const daily = [];
  const future = dates.slice(ai + 1, ai + 21);
  for (let i = 0; i < future.length; i++) {
    const date = future[i];
    const session = i + 1;
    const p = pvMap.get(`${stock}|${date}`);
    const close = closeOf(p);
    if (!Number.isFinite(close)) { daily.push({session,date,missing_price:true}); continue; }
    runningPeak = Math.max(runningPeak, close);
    const ret = pct(close, anchorClose);
    const peakGain = pct(runningPeak, anchorClose);
    const dd = pct(close, runningPeak);
    const fsup = foreignSupply(stock, date);
    const ws62 = weeklySupply(stock, date, true);
    const ws63 = weeklySupply(stock, date, false);
    const priceBreakdown = ret <= -5;
    const failedRebound = peakGain >= 3 && ret <= -2 && dd <= -5;
    const immediateTrigger = session <= 10 && (fsup.value || ws62.confirm) && (priceBreakdown || failedRebound);
    const delayedBreakdown = session >= 11 && session <= 20 && ret <= -10;
    const reboundFailure = session >= 11 && session <= 20 && peakGain >= 5 && dd <= -10 && ret <= -2;
    const delayedTrigger = session >= 11 && session <= 20 && (fsup.value || ws63.confirm) && (delayedBreakdown || reboundFailure);
    const row = {session,date,close,return_from_anchor_pct:round(ret),running_peak_gain_pct:round(peakGain),drawdown_from_peak_pct:round(dd),foreign_supply:fsup.value,foreign_net_5d:fsup.net5,foreign_sell_ratio_5d:fsup.ratio5,broker_supply:ws63.broker,ownership_supply:ws63.persistent,latest_broker_score:ws63.broker_score,latest_tdcc_anchor:ws63.weekly?.tdcc_observed_date || null,transfer_streak:Number(ws63.weekly?.tdcc?.transfer_streak ?? 0),price_breakdown:priceBreakdown,failed_rebound:failedRebound,delayed_breakdown:delayedBreakdown,rebound_failure:reboundFailure};
    daily.push(row);
    if (!immediate && immediateTrigger) immediate = {...row,path:'immediate'};
    if (!immediate && !delayed && delayedTrigger) delayed = {...row,path: reboundFailure ? 'rebound_failure' : 'delayed_breakdown'};
  }
  const candidate = immediate || delayed;
  return {candidate, daily, available_future_sessions:future.length};
}
function durability(event, candidate) {
  if (!candidate) return {status:'no_candidate_failure', window:[]};
  const ai = dates.indexOf(event.fragile_anchor);
  const ci = dates.indexOf(candidate.date);
  let runningPeak = event.anchor_close;
  for (const d of dates.slice(ai, ci + 1)) {
    const c = closeOf(pvMap.get(`${event.stock}|${d}`));
    if (Number.isFinite(c)) runningPeak = Math.max(runningPeak, c);
  }
  const ds = dates.slice(ci + 1, ci + 4);
  const rows = ds.map(date => {
    const close = closeOf(pvMap.get(`${event.stock}|${date}`));
    if (!Number.isFinite(close)) return {date,missing_price:true};
    runningPeak = Math.max(runningPeak, close);
    const ret = pct(close, event.anchor_close);
    const peakGain = pct(runningPeak, event.anchor_close);
    const dd = pct(close, runningPeak);
    const broken = ret <= -2 || (peakGain >= 5 && dd <= -8 && ret <= 1);
    const f = foreignSupply(event.stock, date);
    const w = weeklySupply(event.stock, date, false);
    return {date,close,broken_state:broken,supply_confirm:f.value || w.broker || w.persistent};
  });
  if (ds.length < 3) return {status:'insufficient_persistence_followup',window:rows};
  const brokenVotes = rows.filter(r => r.broken_state).length;
  const supplyVotes = rows.filter(r => r.supply_confirm).length;
  return {status: brokenVotes >= 2 && supplyVotes >= 1 ? 'durable_failure_confirmed' : 'candidate_failure_not_durable', broken_votes:brokenVotes, supply_votes:supplyVotes, window:rows};
}
function recovery(event, candidate, durable) {
  if (!candidate || durable.status !== 'durable_failure_confirmed') return {status:'not_applicable'};
  const ci = dates.indexOf(candidate.date);
  const ds = dates.slice(ci + 1, ci + 16);
  const daily = ds.map((date,i) => {
    const close = closeOf(pvMap.get(`${event.stock}|${date}`));
    const f = foreignMap.get(`${event.stock}|${date}`);
    const net5 = Number(f?.rolling_5d?.total_net);
    const ratio5 = Number(f?.rolling_5d?.total_sell_ratio);
    const w = latestWeekly(event.stock, date);
    const brokerScore = Number(w?.broker?.score);
    const persistent = Boolean(w?.classification?.persistent_transfer);
    return {session:i+1,date,close:Number.isFinite(close)?close:null,missing_price:!Number.isFinite(close),anchor_reclaim_vote:Number.isFinite(close) && close >= event.anchor_close,foreign_relief:(Number.isFinite(net5)&&net5>=0)||(Number.isFinite(ratio5)&&ratio5<=0.4),broker_relief:Number.isFinite(brokerScore)&&brokerScore<=2,ownership_relief:Boolean(w)&&!persistent};
  });
  let confirmed = null;
  for (let start = 3; start <= daily.length - 3; start++) {
    const win = daily.slice(start, start + 3);
    if (win.length < 3 || win.some(x => x.missing_price)) continue;
    const priceVotes = win.filter(x => x.anchor_reclaim_vote).length;
    const fam = {foreign:win.some(x=>x.foreign_relief),broker:win.some(x=>x.broker_relief),ownership:win.some(x=>x.ownership_relief)};
    const reliefCount = Object.values(fam).filter(Boolean).length;
    if (priceVotes >= 2 && reliefCount >= 2) { confirmed = {reclaim_date:win[2].date,start_session:win[0].session,end_session:win[2].session,price_reclaim_votes:priceVotes,relief_families:fam,relief_family_count:reliefCount}; break; }
  }
  return {status:confirmed?'confirmed_reclaim':ds.length>=15?'no_reclaim_within_15_sessions':'insufficient_recovery_followup',reclaim_confirmation:confirmed,daily_path:daily};
}

const events = fragile.map(event => {
  const {candidate,daily,available_future_sessions} = classifyCandidate(event);
  const durable = durability(event,candidate);
  const reclaim = recovery(event,candidate,durable);
  let lifecycle_state = 'fragile_distribution';
  if (candidate) lifecycle_state = 'candidate_failure';
  if (durable.status === 'durable_failure_confirmed') lifecycle_state = reclaim.status === 'confirmed_reclaim' ? 'failure_plus_reclaim' : reclaim.status === 'no_reclaim_within_15_sessions' ? 'failure_plus_no_reclaim' : 'durable_failure_recovery_pending';
  return {...event,lifecycle_state,candidate_failure:candidate?{date:candidate.date,session:candidate.session,path:candidate.path}:null,durability:durable,recovery:reclaim,available_future_sessions,daily_failure_path:daily};
});

const counts = {};
for (const e of events) counts[e.lifecycle_state] = (counts[e.lifecycle_state] || 0) + 1;
const payload = {
  schema_version:1,
  methodology:'institutional-withdrawal-lifecycle-v1',
  frozen_from:['institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1','institutional-withdrawal-v6-2-fragile-failure-transition-v1','institutional-withdrawal-v6-3-delayed-failure-transition-v1','institutional-withdrawal-v6-4-durable-failure-confirmation-v1','institutional-withdrawal-v6-5-recovery-reclaim-diagnosis-v1'],
  research_only:true,
  production_safe:false,
  source_derived_trading_calendar:true,
  lookahead_guard:'Classifier inputs are frozen v6 contemporaneous states plus current/prior price-volume and foreign features only. No v6.1 outcome label, forward return, future max drawdown, or other outcome field is read.',
  fragile_event_count:events.length,
  counts,
  events,
  generated_at:new Date().toISOString(),
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({methodology:payload.methodology,fragile_event_count:events.length,counts,events:events.map(e=>({stock:e.stock,anchor:e.fragile_anchor,state:e.lifecycle_state,candidate:e.candidate_failure,reclaim:e.recovery.status}))},null,2));
