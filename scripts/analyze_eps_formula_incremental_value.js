#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),DIR=path.join(ROOT,'data_prediction_analysis','eps-valuation');
const val=JSON.parse(fs.readFileSync(path.join(DIR,'valuation-backtest.json'),'utf8'));
const pol=JSON.parse(fs.readFileSync(path.join(DIR,'valuation-applicability-policy.json'),'utf8'));
const excluded=new Set(pol?.yoy_scaled_remaining?.excluded_event_keys||[]),dyn=new Set(pol?.dynamic_pe?.methods||[]),cap=Number(pol?.dynamic_pe?.max_pe);
function keep(r){if(r.eps_method==='yoy_scaled_remaining'&&excluded.has(`${r.stock_code}:${r.fiscal_period}`))return false;if(dyn.has(r.pe_method)&&Number.isFinite(cap)){const lo=+r.pe_low,hi=+r.pe_high;if(!(lo>0&&hi>0)||Math.max(lo,hi)>cap)return false;}return true;}
function median(a){const x=a.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2;}
function round(v,d=2){return Number.isFinite(v)?+v.toFixed(d):null;}
const rows=val.rows.filter(keep),idx=new Map(rows.map(r=>[`${r.stock_code}:${r.fiscal_period}:${r.pe_method}:${r.eps_method}`,r]));
const epsMethods=['seasonal_prior_year','annualized_ytd','yoy_scaled_remaining'];
const peMethods=[...new Set(rows.map(r=>r.pe_method))];
const results=[];
for(const em of epsMethods)for(const pm of peMethods){let win=0,tie=0,lose=0;const dr=[],dc=[];for(const r of rows){if(r.eps_method!==em||r.pe_method!==pm)continue;const b=idx.get(`${r.stock_code}:${r.fiscal_period}:${pm}:ttm`);if(!b)continue;const d=+r.range_error_pct-(+b.range_error_pct);const c=+r.center_error_pct-(+b.center_error_pct);dr.push(d);if(Number.isFinite(c))dc.push(c);if(Math.abs(d)<1e-9)tie++;else if(d<0)win++;else lose++;}const n=win+tie+lose;results.push({eps_method:em,pe_method:pm,matched_events:n,better_than_ttm_pct:round(n?win/n*100:0),equal_to_ttm_pct:round(n?tie/n*100:0),worse_than_ttm_pct:round(n?lose/n*100:0),median_range_error_delta_pct:round(median(dr)),median_center_error_delta_pct:round(median(dc))});}
const out={schema_version:1,dataset:'eps_formula_incremental_value',generated_at:new Date().toISOString(),interpretation:'Negative delta means forecast EPS method has lower error than event-matched TTM under the same P/E method.',results};
fs.writeFileSync(path.join(DIR,'formula-incremental-value-study.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
