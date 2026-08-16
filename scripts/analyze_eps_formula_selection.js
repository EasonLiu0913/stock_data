#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const DIR=path.join(ROOT,'data_prediction_analysis','eps-valuation');
const VAL=path.join(DIR,'valuation-backtest.json');
const POL=path.join(DIR,'valuation-applicability-policy.json');
const OUT=path.join(DIR,'formula-selection-study.json');
const OUTMD=path.join(DIR,'formula-selection-study.md');
function read(f){return JSON.parse(fs.readFileSync(f,'utf8'));}
function round(v,d=2){return Number.isFinite(v)?Number(v.toFixed(d)):null;}
function q(xs,p){const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const z=(a.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?a[l]:a[l]+(a[h]-a[l])*(z-l);}
function policyFilter(policy){const ex=new Set(policy?.yoy_scaled_remaining?.excluded_event_keys||[]);const dyn=new Set(policy?.dynamic_pe?.methods||[]);const cap=Number(policy?.dynamic_pe?.max_pe);return r=>{if(r.eps_method==='yoy_scaled_remaining'&&ex.has(`${r.stock_code}:${r.fiscal_period}`))return false;if(dyn.has(r.pe_method)&&Number.isFinite(cap)){const lo=Number(r.pe_low),hi=Number(r.pe_high);if(!(lo>0)||!(hi>0)||Math.max(lo,hi)>cap)return false;}return true;};}
function summarize(rows){const g=new Map();for(const r of rows){const k=`${r.eps_method}__${r.pe_method}`;if(!g.has(k))g.set(k,[]);g.get(k).push(r);}return [...g.entries()].map(([formula,a])=>{const re=a.map(x=>Number(x.range_error_pct)).filter(Number.isFinite);const ce=a.map(x=>Number(x.center_error_pct)).filter(Number.isFinite);return{formula,eps_method:a[0].eps_method,eps_method_label:a[0].eps_method_label,pe_method:a[0].pe_method,pe_method_label:a[0].pe_method_label,stocks:new Set(a.map(x=>x.stock_code)).size,events:new Set(a.map(x=>`${x.stock_code}:${x.fiscal_period}`)).size,samples:a.length,hit_rate_pct:round(a.filter(x=>x.hit_range).length/a.length*100),median_range_error_pct:round(q(re,.5)),p90_range_error_pct:round(q(re,.9)),p95_range_error_pct:round(q(re,.95)),p99_range_error_pct:round(q(re,.99)),mean_range_error_pct:round(re.reduce((s,x)=>s+x,0)/re.length),median_center_error_pct:round(q(ce,.5))};});}
function rankScore(r){return (r.median_range_error_pct||0)*.45+(r.p95_range_error_pct||0)*.30+(r.median_center_error_pct||0)*.15+(100-(r.hit_rate_pct||0))*.10;}
function classify(r){
  if(r.eps_method==='seasonal_prior_year') return {recommendation:'duplicate_of_ttm',reason:'With standalone quarterly EPS, current YTD plus prior-year remaining quarters is algebraically identical to trailing four-quarter EPS.'};
  if(r.eps_method==='ttm'&&r.pe_method==='current_pe20') return {recommendation:'benchmark_only',reason:'TTM EPS × current TTM P/E collapses to current price; the interval is simply current price ±20%.'};
  if(r.eps_method==='ttm'&&r.pe_method==='hist_p20') return {recommendation:'keep_core',reason:'Best independent stock-specific valuation formula after removing the current-price identity baseline.'};
  if(r.eps_method==='ttm'&&r.pe_method==='hist_q25_q75') return {recommendation:'keep_secondary',reason:'Useful historical-valuation sensitivity band, but hit rate is much lower than hist_p20.'};
  if(r.eps_method==='ttm'&&r.pe_method==='fixed_10_20') return {recommendation:'benchmark_only',reason:'Keep one simple market-agnostic fixed-P/E benchmark; higher fixed bands add little value.'};
  if(r.pe_method==='fixed_15_25'||r.pe_method==='fixed_20_30') return {recommendation:'drop',reason:'Higher fixed-P/E bands show clearly weaker robust error and hit-rate results.'};
  if(r.eps_method==='annualized_ytd'||r.eps_method==='yoy_scaled_remaining') return {recommendation:'research_only',reason:'Paired event study does not show stable incremental improvement over TTM under the same P/E method.'};
  return {recommendation:'drop',reason:'No clear incremental role after retaining the stronger independent and benchmark formulas.'};
}
function main(){const val=read(VAL),pol=read(POL);const rows=val.rows.filter(policyFilter(pol));const all=summarize(rows);for(const r of all){r.robust_score=round(rankScore(r));Object.assign(r,classify(r));}all.sort((a,b)=>a.robust_score-b.robust_score||b.samples-a.samples);
 const byEps={};for(const em of [...new Set(all.map(x=>x.eps_method))]){const a=all.filter(x=>x.eps_method===em);byEps[em]={label:a[0]?.eps_method_label||em,median_robust_score:round(q(a.map(x=>x.robust_score),.5)),median_hit_rate_pct:round(q(a.map(x=>x.hit_rate_pct),.5)),median_p95_error_pct:round(q(a.map(x=>x.p95_range_error_pct),.5))};}
 const byPe={};for(const pm of [...new Set(all.map(x=>x.pe_method))]){const a=all.filter(x=>x.pe_method===pm&&x.eps_method!=='seasonal_prior_year');byPe[pm]={label:a[0]?.pe_method_label||pm,median_robust_score:round(q(a.map(x=>x.robust_score),.5)),median_hit_rate_pct:round(q(a.map(x=>x.hit_rate_pct),.5)),median_p95_error_pct:round(q(a.map(x=>x.p95_range_error_pct),.5))};}
 const out={schema_version:2,dataset:'eps_formula_selection_study',generated_at:new Date().toISOString(),source_generated_at:val.generated_at||null,policy_generated_at:pol.generated_at||null,filtered_samples:rows.length,formula_count:all.length,unique_formula_count:18,ranking_rule:'Robust score is diagnostic only: 45% median range error + 30% P95 range error + 15% median center error + 10% miss-rate. Final retention also considers algebraic redundancy and paired incremental value versus TTM.',formulas:all,by_eps_method:byEps,by_pe_method:byPe};fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
 const md=['# EPS 24 套公式保留研究','',`產生時間：${out.generated_at}`,'',`Guard 後樣本：${rows.length}；名義公式：24；去除 seasonal_prior_year 與 TTM 的 6 組恆等重複後，實質獨立組合：18。`,'','|排名|EPS 法|P/E 法|樣本|命中率%|Median Range%|P95 Range%|Robust score|建議|','|---:|---|---|---:|---:|---:|---:|---:|---|'];all.forEach((r,i)=>md.push(`|${i+1}|${r.eps_method_label}|${r.pe_method_label}|${r.samples}|${r.hit_rate_pct}|${r.median_range_error_pct}|${r.p95_range_error_pct}|${r.robust_score}|${r.recommendation}|`));md.push('','> seasonal_prior_year 在目前 standalone-quarter EPS 定義下與 TTM 恆等；TTM × current_pe20 則退化為當時股價 ±20%，只適合作為 benchmark。','');fs.writeFileSync(OUTMD,md.join('\n'));
 console.log(JSON.stringify({output:path.relative(ROOT,OUT),samples:rows.length,unique_formulas:18,kept:all.filter(x=>['keep_core','keep_secondary','benchmark_only'].includes(x.recommendation)).map(x=>({formula:x.formula,recommendation:x.recommendation}))},null,2));}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
