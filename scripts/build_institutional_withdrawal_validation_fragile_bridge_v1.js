#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const args=process.argv.slice(2);
const arg=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0&&args[i+1]?args[i+1]:f;};
const input=arg('v6','/tmp/institutional-withdrawal-validation-v6.json');
const output=arg('output','/tmp/institutional-withdrawal-validation-v61-bridge.json');
const HOLDOUT=['1598','1616','1809','6257','7791'];
const v6=JSON.parse(fs.readFileSync(input,'utf8'));
if(v6.methodology!=='institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1') throw new Error(`Unexpected v6 methodology ${v6.methodology}`);
if(JSON.stringify(v6.universe)!==JSON.stringify(HOLDOUT)) throw new Error(`Frozen Batch 1 mismatch in v6 output: ${JSON.stringify(v6.universe)}`);
const all=v6.results?.all_eligible?.events||[];
const fragile=all.filter(e=>e.classification?.structure==='fragile_distribution');
const events=fragile.map(e=>({stock:e.stock,anchor:e.tdcc_observed_date,pre_anchor_history:[],evidence:{tdcc:e.tdcc,broker:e.broker,foreign:e.foreign,price_volume:e.price_volume},evidence_strength:null}));
const payload={schema_version:1,methodology:'institutional-withdrawal-v6-1-event-diagnosis-v1',validation_bridge:true,research_only:true,production_safe:false,source_methodology:v6.methodology,sample:{kind:'untouched_stock_holdout',batch:'batch-1',stocks:HOLDOUT},fragile_event_count:events.length,events,guardrails:['This bridge carries only frozen v6 fragile-event identities and contemporaneous evidence into the unchanged v6.2 executable contract.','No v6.1 development outcome label, forward return, drawdown, structural-repair field, or validation metric is present.'],generated_at:new Date().toISOString()};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({fragile_event_count:events.length,events:events.map(e=>({stock:e.stock,anchor:e.anchor}))},null,2));
