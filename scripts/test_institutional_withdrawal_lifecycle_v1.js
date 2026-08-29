#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const output = path.join('data_research','institutional-flow','validation','institutional-withdrawal-lifecycle-v1.json');
execFileSync(process.execPath,[path.join('scripts','classify_institutional_withdrawal_lifecycle_v1.js'),'--output',output],{stdio:'inherit'});
const p = JSON.parse(fs.readFileSync(output,'utf8'));

const fail = (msg) => { throw new Error(msg); };
if (p.methodology !== 'institutional-withdrawal-lifecycle-v1') fail(`Unexpected methodology ${p.methodology}`);
if (p.fragile_event_count !== 10) fail(`Expected 10 frozen fragile events, got ${p.fragile_event_count}`);

const byKey = new Map(p.events.map(e => [`${e.stock}|${e.fragile_anchor}`,e]));
const expect = (stock,anchor,candidateDate,candidateSession,path,recovery,state) => {
  const e = byKey.get(`${stock}|${anchor}`);
  if (!e) fail(`Missing event ${stock} ${anchor}`);
  if (e.candidate_failure?.date !== candidateDate) fail(`${stock} ${anchor}: candidate ${e.candidate_failure?.date} != ${candidateDate}`);
  if (e.candidate_failure?.session !== candidateSession) fail(`${stock} ${anchor}: session ${e.candidate_failure?.session} != ${candidateSession}`);
  if (e.candidate_failure?.path !== path) fail(`${stock} ${anchor}: path ${e.candidate_failure?.path} != ${path}`);
  if (e.durability?.status !== 'durable_failure_confirmed') fail(`${stock} ${anchor}: durability ${e.durability?.status}`);
  if (e.recovery?.status !== recovery) fail(`${stock} ${anchor}: recovery ${e.recovery?.status} != ${recovery}`);
  if (e.lifecycle_state !== state) fail(`${stock} ${anchor}: state ${e.lifecycle_state} != ${state}`);
};

expect('2317','2026-06-18','2026-06-26',5,'immediate','no_reclaim_within_15_sessions','failure_plus_no_reclaim');
expect('2454','2026-06-12','2026-07-08',17,'rebound_failure','no_reclaim_within_15_sessions','failure_plus_no_reclaim');
expect('2382','2026-06-18','2026-07-17',19,'delayed_breakdown','no_reclaim_within_15_sessions','failure_plus_no_reclaim');
expect('2449','2026-05-22','2026-06-08',11,'rebound_failure','confirmed_reclaim','failure_plus_reclaim');
expect('2449','2026-06-18','2026-07-14',16,'rebound_failure','no_reclaim_within_15_sessions','failure_plus_no_reclaim');

const may = byKey.get('2449|2026-05-22');
if (may.recovery?.reclaim_confirmation?.reclaim_date !== '2026-06-22') fail(`2449 May reclaim date ${may.recovery?.reclaim_confirmation?.reclaim_date} != 2026-06-22`);
if (may.recovery?.reclaim_confirmation?.price_reclaim_votes !== 2) fail('2449 May must retain frozen 2/3 price repair');
if (may.recovery?.reclaim_confirmation?.relief_family_count !== 2) fail('2449 May must retain frozen 2/3 supply-relief families');

const june = byKey.get('2449|2026-06-18');
if (june.recovery?.reclaim_confirmation) fail('2449 June must not reclaim');

console.log('institutional-withdrawal-lifecycle-v1 regression passed');
console.log(JSON.stringify({fragile_events:p.fragile_event_count,regression_cases:5,states:p.counts},null,2));
