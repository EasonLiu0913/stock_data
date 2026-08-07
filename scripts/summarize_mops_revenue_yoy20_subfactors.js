#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const OUTPUT = path.join(SIGNAL_ROOT, 'yoy20-subfactor-experiment.json');
const HORIZONS = ['d1', 'd3', 'd5', 'd10', 'd20'];

const mean = xs => { const a = xs.filter(Number.isFinite); return a.length ? a.reduce((s,v)=>s+v,0)/a.length : null; };
const median = xs => { const a = xs.filter(Number.isFinite).sort((a,b)=>a-b); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
const round = (v,d=4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
function readJson(file, fallback=null){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;} }
function parseArgs(argv){const m=new Map();for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--'))continue;m.set(argv[i].slice(2),argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true);}return m;}
function prevMonth(month, n=1){let y=Number(month.slice(0,4)),m=Number(month.slice(4,6));for(let i=0;i<n;i++){m--;if(m===0){m=12;y--;}}return `${y}${String(m).padStart(2,'0')}`;}

function loadStudyMonths(start,end){return fs.readdirSync(SIGNAL_ROOT).filter(n=>/^20\d{4}\.json$/.test(n)).map(n=>n.slice(0,6)).filter(m=>(!start||m>=start)&&(!end||m<=end)).sort().map(month=>({month,payload:readJson(path.join(SIGNAL_ROOT,`${month}.json`),{})}));}
function loadRevenueHistory(){
  const months=fs.readdirSync(REVENUE_ROOT,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^20\d{4}$/.test(e.name)).map(e=>e.name).sort();
  const byMonth=new Map(), byStock=new Map();
  for(const month of months){const p=readJson(path.join(REVENUE_ROOT,month,'monthly_revenue.json'),{});const map=new Map();for(const row of p.companies||[]){map.set(String(row.stock_code),row);if(!byStock.has(String(row.stock_code)))byStock.set(String(row.stock_code),new Map());byStock.get(String(row.stock_code)).set(month,row);}byMonth.set(month,map);}return {byMonth,byStock};
}
function consecutiveYoyAtLeast(stockMap, month, threshold, count){for(let i=0;i<count;i++){const row=stockMap?.get(prevMonth(month,i));if(!row||Number(row.yoy_pct)<threshold)return false;}return true;}
function revenueHigh(stockMap, month, lookback){const current=stockMap?.get(month);if(!current)return false;const vals=[];for(let i=0;i<lookback;i++){const row=stockMap.get(prevMonth(month,i));if(!row||!Number.isFinite(Number(row.monthly_revenue_thousand_twd)))return false;vals.push(Number(row.monthly_revenue_thousand_twd));}return vals[0]===Math.max(...vals);}
function enrich(event, month, history){const sm=history.byStock.get(String(event.stock_code));const yoy=Number(event.factors?.yoy_pct),mom=Number(event.factors?.mom_pct);return {...event,_sub:{yoy_10_20:yoy>=10&&yoy<20,yoy_20_30:yoy>=20&&yoy<30,yoy_30_50:yoy>=30&&yoy<50,yoy_ge_50:yoy>=50,yoy20_mom_positive:yoy>=20&&mom>0,yoy20_accelerating:yoy>=20&&event.factors?.yoy_accelerating===true,yoy20_consecutive_2:consecutiveYoyAtLeast(sm,month,20,2),yoy20_consecutive_3:consecutiveYoyAtLeast(sm,month,20,3),yoy20_revenue_high_3:yoy>=20&&revenueHigh(sm,month,3),yoy20_revenue_high_6:yoy>=20&&revenueHigh(sm,month,6),yoy20_revenue_high_12:yoy>=20&&revenueHigh(sm,month,12)}};}
const FACTORS=[
{id:'yoy_10_20',name:'YoY 10～20%',test:e=>e._sub.yoy_10_20},
{id:'yoy_20_30',name:'YoY 20～30%',test:e=>e._sub.yoy_20_30},
{id:'yoy_30_50',name:'YoY 30～50%',test:e=>e._sub.yoy_30_50},
{id:'yoy_ge_50',name:'YoY ≥50%',test:e=>e._sub.yoy_ge_50},
{id:'yoy20_mom_positive',name:'YoY ≥20% + MoM >0',test:e=>e._sub.yoy20_mom_positive},
{id:'yoy20_accelerating',name:'YoY ≥20% + YoY 加速',test:e=>e._sub.yoy20_accelerating},
{id:'yoy20_consecutive_2',name:'連續2月 YoY ≥20%',test:e=>e._sub.yoy20_consecutive_2},
{id:'yoy20_consecutive_3',name:'連續3月 YoY ≥20%',test:e=>e._sub.yoy20_consecutive_3},
{id:'yoy20_revenue_high_3',name:'YoY ≥20% + 營收3月新高',test:e=>e._sub.yoy20_revenue_high_3},
{id:'yoy20_revenue_high_6',name:'YoY ≥20% + 營收6月新高',test:e=>e._sub.yoy20_revenue_high_6},
{id:'yoy20_revenue_high_12',name:'YoY ≥20% + 營收12月新高',test:e=>e._sub.yoy20_revenue_high_12},
];
function summarize(months,factor,horizon){const all=[],monthly=[];for(const {month,events} of months){const universe=events.filter(e=>e.returns?.[horizon]?.status==='complete');const rows=universe.filter(factor.test);if(!rows.length)continue;const rr=rows.map(e=>e.returns[horizon]),ur=universe.map(e=>e.returns[horizon]);const win=rr.filter(r=>r.outperformed_market===true).length/rr.length*100,uwin=ur.filter(r=>r.outperformed_market===true).length/ur.length*100,ex=mean(rr.map(r=>Number(r.excess_return_pct))),uex=mean(ur.map(r=>Number(r.excess_return_pct)));monthly.push({month,samples:rr.length,universe_samples:ur.length,relative_win_rate:round(win),universe_relative_win_rate:round(uwin),relative_win_rate_uplift_pp:round(win-uwin),avg_excess_return_pct:round(ex),universe_avg_excess_return_pct:round(uex),avg_excess_uplift_pct:round(ex-uex)});all.push(...rr.map(r=>({...r,_uWin:uwin,_uEx:uex})));}
const n=all.length;if(!n)return {factor_id:factor.id,factor_name:factor.name,horizon,samples:0,covered_months:0};const wins=all.filter(r=>r.outperformed_market===true).length/n*100,excess=mean(all.map(r=>Number(r.excess_return_pct)));const weightedUWin=all.reduce((s,r)=>s+r._uWin,0)/n,weightedUEx=all.reduce((s,r)=>s+r._uEx,0)/n;const posWin=monthly.filter(m=>m.relative_win_rate_uplift_pp>0).length/monthly.length*100,posEx=monthly.filter(m=>m.avg_excess_uplift_pct>0).length/monthly.length*100,stability=(posWin+posEx)/2;const sampleScore=Math.min(100,Math.log10(Math.max(n,1))/3*100);const winScore=Math.max(0,Math.min(100,50+(wins-weightedUWin)*5));const exScore=Math.max(0,Math.min(100,50+(excess-weightedUEx)*20));const score=.35*winScore+.30*exScore+.25*stability+.10*sampleScore;return {factor_id:factor.id,factor_name:factor.name,horizon,samples:n,covered_months:monthly.length,relative_win_rate:round(wins),universe_relative_win_rate:round(weightedUWin),relative_win_rate_uplift_pp:round(wins-weightedUWin),avg_excess_return_pct:round(excess),universe_avg_excess_return_pct:round(weightedUEx),avg_excess_uplift_pct:round(excess-weightedUEx),median_excess_return_pct:round(median(all.map(r=>Number(r.excess_return_pct)))),positive_win_uplift_month_rate:round(posWin),positive_excess_uplift_month_rate:round(posEx),stability_score:round(stability),ranking_score:round(score),monthly};}
function main(argv=process.argv.slice(2)){const args=parseArgs(argv),start=args.get('start-month')||null,end=args.get('end-month')||null,history=loadRevenueHistory(),study=loadStudyMonths(start,end).map(({month,payload})=>({month,events:(payload.events||[]).map(e=>enrich(e,month,history))}));if(!study.length)throw new Error('No study months found');const rankings=HORIZONS.flatMap(h=>FACTORS.map(f=>summarize(study,f,h)));const out={schema_version:1,dataset:'mops_monthly_revenue_yoy20_subfactor_experiment',generated_at:new Date().toISOString(),start_month:study[0].month,end_month:study.at(-1).month,methodology:{baseline:'same-month listed-stock universe',primary_candidate:'YoY >= 20%',lookback_rule:'consecutive-growth and revenue-high factors require complete prior monthly observations; 12-month high remains unavailable until 12 full revenue months exist',caution:'research experiment only; do not use as a production strategy score'},factors:FACTORS.map(({id,name})=>({id,name})),horizons:HORIZONS,rankings};fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({output:path.relative(ROOT,OUTPUT),rows:rankings.length},null,2));}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
module.exports={FACTORS,consecutiveYoyAtLeast,revenueHigh,summarize};
