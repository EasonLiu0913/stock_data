#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VALUATION_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'valuation-backtest.json');
const OUTLIER_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'yoy-scaled-outlier-study.json');
const OUT_JSON = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'yoy-scaled-shadow-study.json');
const OUT_MD = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'yoy-scaled-shadow-study.md');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, `${JSON.stringify(value,null,2)}\n`); }
function round(v,d=4){ return Number.isFinite(v)?Number(v.toFixed(d)):null; }
function quantile(values,q){ const xs=values.filter(Number.isFinite).sort((a,b)=>a-b); if(!xs.length)return null; const p=(xs.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p); return lo===hi?xs[lo]:xs[lo]+(xs[hi]-xs[lo])*(p-lo); }
function stats(rows){ const errors=rows.map(r=>Number(r.range_error_pct)).filter(Number.isFinite); const centers=rows.map(r=>Number(r.center_error_pct)).filter(Number.isFinite); return {samples:rows.length,hit_rate_pct:rows.length?round(rows.filter(r=>r.hit_range).length/rows.length*100,2):null,range_mean_pct:errors.length?round(errors.reduce((a,b)=>a+b,0)/errors.length):null,range_p50_pct:round(quantile(errors,.5)),range_p90_pct:round(quantile(errors,.9)),range_p95_pct:round(quantile(errors,.95)),range_p99_pct:round(quantile(errors,.99)),range_max_pct:errors.length?round(Math.max(...errors)):null,center_p50_pct:round(quantile(centers,.5)),center_p95_pct:round(quantile(centers,.95))}; }
function byPe(rows){ const map=new Map(); for(const r of rows){ if(!map.has(r.pe_method))map.set(r.pe_method,[]); map.get(r.pe_method).push(r); } return [...map.entries()].map(([pe_method,a])=>({pe_method,pe_method_label:a[0]?.pe_method_label||pe_method,...stats(a)})).sort((a,b)=>a.pe_method.localeCompare(b.pe_method)); }
function markdown(report){ const l=[]; l.push('# EPS YoY Scaled Shadow Study'); l.push(''); l.push(`產生時間：${report.generated_at}`); l.push(''); l.push(`影子規則：pyYtd > ${report.shadow_rule.epsilon} 且 growth <= ${report.shadow_rule.max_growth_multiplier}。正式公式未修改。`); l.push(''); l.push('## 整體比較'); l.push(''); l.push('|版本|事件|公式樣本|保留率|命中率%|Range Mean%|P50|P95|P99|MAX|'); l.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'); for(const r of [report.original,report.shadow]) l.push(`|${r.label}|${r.events}|${r.samples}|${r.event_retention_pct??100}|${r.hit_rate_pct}|${r.range_mean_pct}|${r.range_p50_pct}|${r.range_p95_pct}|${r.range_p99_pct}|${r.range_max_pct}|`); l.push(''); l.push('## Shadow：六種 P/E'); l.push(''); l.push('|P/E|樣本|命中率%|Mean%|P50|P95|P99|MAX|'); l.push('|---|---:|---:|---:|---:|---:|---:|---:|'); for(const r of report.shadow_by_pe) l.push(`|${r.pe_method_label}|${r.samples}|${r.hit_rate_pct}|${r.range_mean_pct}|${r.range_p50_pct}|${r.range_p95_pct}|${r.range_p99_pct}|${r.range_max_pct}|`); l.push(''); l.push('## 被排除事件'); l.push(''); l.push(`共 ${report.excluded_event_count} 個；其中 epsilon 排除 ${report.exclusion_reasons.epsilon_or_nonpositive}，growth>3 排除 ${report.exclusion_reasons.growth_above_cap}。`); l.push(''); l.push('## Shadow 仍存在的 Top 20 極端值'); l.push(''); l.push('|股票|季度|Growth|P/E|Range Error%|全年EPS|Future High|Fair High|'); l.push('|---|---|---:|---|---:|---:|---:|---:|'); for(const r of report.shadow_top_outliers) l.push(`|${r.stock_code}|${r.fiscal_period}|${r.growth_multiplier}|${r.pe_method_label}|${r.range_error_pct}|${r.estimated_annual_eps}|${r.future_high}|${r.fair_high}|`); l.push(''); l.push('> 這是影子研究，不會修改正式估值公式。'); return `${l.join('\n')}\n`; }

function main(){
  const valuation=readJson(VALUATION_FILE), outlier=readJson(OUTLIER_FILE);
  const yoyRows=valuation.rows.filter(r=>r.eps_method==='yoy_scaled_remaining');
  const contextMap=new Map((outlier.top_outlier_events||[]).map(()=>[]));
  // Reconstruct event context from the outlier study's full threshold information is not possible,
  // so derive eligibility by joining all unique events against quarterly EPS files exactly as round 1 did.
  const FIN_ROOT=path.join(ROOT,'data_finmind_quarterly_financial_quality');
  const epsCache=new Map();
  const periodParts=p=>{const m=String(p).match(/^(20\d{2})Q([1-4])$/);return m?{year:+m[1],quarter:+m[2]}:null;};
  const periodKey=(y,q)=>`${y}Q${q}`;
  function load(stock){ if(epsCache.has(stock))return epsCache.get(stock); const map=new Map(),dir=path.join(FIN_ROOT,stock); if(fs.existsSync(dir)) for(const f of fs.readdirSync(dir)){ if(!/^20\d{2}Q[1-4]\.json$/.test(f))continue; const p=readJson(path.join(dir,f)),eps=Number(p.standalone_quarter?.eps); if(Number.isFinite(eps))map.set(p.fiscal_period||f.slice(0,-5),eps); } epsCache.set(stock,map); return map; }
  function ctx(stock,period){ const p=periodParts(period); if(!p)return null; const m=load(stock); let ytd=0,py=0; for(let q=1;q<=p.quarter;q++){ const a=m.get(periodKey(p.year,q)),b=m.get(periodKey(p.year-1,q)); if(!Number.isFinite(a)||!Number.isFinite(b))return null; ytd+=a; py+=b; } return {py_ytd:py,growth:ytd/py}; }
  const events=new Map();
  for(const row of yoyRows){ const k=`${row.stock_code}:${row.fiscal_period}`; if(!events.has(k))events.set(k,ctx(row.stock_code,row.fiscal_period)); }
  const EPSILON=1e-6,MAX_GROWTH=3;
  const eligible=new Set(), excluded=new Map(); let epsExcluded=0,growthExcluded=0;
  for(const [k,c] of events){ if(!c||!Number.isFinite(c.py_ytd)||c.py_ytd<=EPSILON||!Number.isFinite(c.growth)){ excluded.set(k,'epsilon_or_nonpositive'); epsExcluded++; continue; } if(c.growth>MAX_GROWTH){ excluded.set(k,'growth_above_cap'); growthExcluded++; continue; } eligible.add(k); }
  const shadowRows=yoyRows.filter(r=>eligible.has(`${r.stock_code}:${r.fiscal_period}`));
  const originalStats=stats(yoyRows), shadowStats=stats(shadowRows);
  const shadowTop=[...shadowRows].sort((a,b)=>Number(b.range_error_pct)-Number(a.range_error_pct)).slice(0,20).map(r=>{const c=events.get(`${r.stock_code}:${r.fiscal_period}`);return {...r,growth_multiplier:round(c?.growth,8)};});
  const report={schema_version:1,dataset:'eps_yoy_scaled_shadow_study',generated_at:new Date().toISOString(),source_generated_at:valuation.generated_at||null,shadow_rule:{epsilon:EPSILON,max_growth_multiplier:MAX_GROWTH},original:{label:'原始 yoy_scaled_remaining',events:events.size,...originalStats,event_retention_pct:100},shadow:{label:'Shadow: epsilon + growth≤3',events:eligible.size,...shadowStats,event_retention_pct:round(events.size?eligible.size/events.size*100:0,2)},excluded_event_count:events.size-eligible.size,exclusion_reasons:{epsilon_or_nonpositive:epsExcluded,growth_above_cap:growthExcluded},shadow_by_pe:byPe(shadowRows),shadow_top_outliers:shadowTop};
  writeJson(OUT_JSON,report); fs.writeFileSync(OUT_MD,markdown(report));
  console.log(JSON.stringify({output_json:path.relative(ROOT,OUT_JSON),events:events.size,shadow_events:eligible.size,retention_pct:report.shadow.event_retention_pct,shadow_mean:report.shadow.range_mean_pct,shadow_p95:report.shadow.range_p95_pct,shadow_max:report.shadow.range_max_pct,top:shadowTop[0]||null},null,2));
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
