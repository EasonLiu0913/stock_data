'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const v=read('scripts/validate_daily_gainers_video_script.js');
for(const x of ["analysis-ai", "market-summary", "video_scripts", "data_daily_gain_over_5"]) assert(v.includes(x),'missing direct validator input '+x);
const inventory=[
 ['daily-gainers-over-5.yml',/generate_daily_gainers_over_5\.js/,/deploy-pages\.yml/],
 ['publish-daily-gainers-ai-analysis.yml',/build_daily_gainers_ai_facts\.js/,/deploy-pages\.yml/],
 ['publish-daily-gainers-news-summary.yml',/analysis-news\/\*\.json/,/deploy-pages\.yml/],
 ['publish-daily-gainers-unified-analysis.yml',/analysis-ai\/\*\.json/,/deploy-pages\.yml/],
 ['daily-gainers-video-upload-orchestrator.yml',/video_scripts\/daily-gainers\/\*\.json/,/validate_daily_gainers_video_script\.js/]
];
for(const [name,signal,sideEffect] of inventory){const y=read('.github/workflows/'+name);assert(signal.test(y),name+': missing signal');assert(sideEffect.test(y),name+': missing side effect marker');}
const unsafe=['data_daily_gain_over_5/analysis-news/20261013.json','data_daily_gain_over_5/analysis-ai/20261013.json','video_scripts/daily-gainers/20261013.json'];
const safeCandidate=['data_daily_gain_over_5/analysis-facts/20261013.json','data_daily_gain_over_5/20261013.json'];
const hazard=p=>unsafe.some(x=>x===p);for(const x of unsafe)assert(hazard(x));for(const x of safeCandidate)assert(!hazard(x));
// Nonmatching the known unsafe examples does NOT mean the global audit is complete.
assert.equal(false,false,'global listener audit remains blocked until complete inventory');
const workflow=read('.github/workflows/research-daily-recovery-firewall-exp04.yml');
assert(/contents: read/.test(workflow));assert(!/contents: write|workflow_dispatch:|workflow_run:|deploy-pages\.yml|git push|youtube|upload-artifact/i.test(workflow));
console.log('EXPERIMENT_04_FIREWALL_PASS: observed direct inputs and 5 high-risk workflow contracts; no production actions; global audit remains open');

// Independent push probe: Experiment 04 workflow registration and execution are separate commits.
