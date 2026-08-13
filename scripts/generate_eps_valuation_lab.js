#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { clearCaches, getDailyPrice } = require('./lib/stock_price_provider');

const ROOT = path.resolve(__dirname, '..');
const FIN_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const EVENT_ROOT = path.join(ROOT, 'data_fundamental_events');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUT_DIR = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation');
const OUT_FILE = path.join(OUT_DIR, 'valuation-backtest.json');

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function round(v, d = 4) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }
function median(xs) { const a = xs.filter(Number.isFinite).sort((x,y)=>x-y); if (!a.length) return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
function quantile(xs, q) { const a=xs.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return null; const p=(a.length-1)*q, b=Math.floor(p), r=p-b; return a[b+1] == null ? a[b] : a[b] + r*(a[b+1]-a[b]); }
function periodKey(year, quarter) { return `${year}Q${quarter}`; }
function parsePeriod(p) { const m=String(p).match(/^(20\d{2})Q([1-4])$/); return m ? {year:+m[1], quarter:+m[2]} : null; }
function nextPeriod(p) { const x=parsePeriod(p); if(!x)return null; return x.quarter===4?periodKey(x.year+1,1):periodKey(x.year,x.quarter+1); }
function previousPeriod(p) { const x=parsePeriod(p); if(!x)return null; return x.quarter===1?periodKey(x.year-1,4):periodKey(x.year,x.quarter-1); }

function loadMarketDates() {
  const p=readJson(MARKET_FILE,{});
  return (p.data||[]).map(r=>String(r.date||'').replace(/\D/g,'')).filter(d=>/^20\d{6}$/.test(d)).sort();
}
function loadQuarterFiles(stock) {
  const dir=path.join(FIN_ROOT,stock); if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(f=>/^20\d{2}Q[1-4]\.json$/.test(f)).map(f=>{
    const p=readJson(path.join(dir,f),{}), q=p.standalone_quarter||{};
    return {period:p.fiscal_period||f.slice(0,-5), eps:Number(q.eps), known_date:p.methodology?.conservative_known_date||null};
  }).filter(r=>parsePeriod(r.period)&&Number.isFinite(r.eps)).sort((a,b)=>a.period.localeCompare(b.period));
}
function loadEvents(stock) {
  const dir=path.join(EVENT_ROOT,stock); if(!fs.existsSync(dir))return new Map();
  const map=new Map();
  for(const f of fs.readdirSync(dir).filter(x=>/^20\d{2}\.json$/.test(x))){
    const p=readJson(path.join(dir,f),{});
    for(const e of p.events||[]){ if(e.event_type==='formal_financial_report' && e.fiscal_period && e.effective_trading_date) map.set(e.fiscal_period,e); }
  }
  return map;
}
function epsByPeriod(rows) { return new Map(rows.map(r=>[r.period,r.eps])); }
function ttmEps(rows,current){ const map=epsByPeriod(rows); let p=current,sum=0,n=0; for(let i=0;i<4;i++){ const v=map.get(p); if(Number.isFinite(v)){sum+=v;n++;} p=previousPeriod(p); } return n===4?sum:null; }
function ytdEps(rows,current){ const x=parsePeriod(current), map=epsByPeriod(rows); let sum=0; for(let q=1;q<=x.quarter;q++){const v=map.get(periodKey(x.year,q)); if(!Number.isFinite(v))return null; sum+=v;} return sum; }
function forecastAnnualEps(rows,current,method){
  const x=parsePeriod(current), map=epsByPeriod(rows), ytd=ytdEps(rows,current); if(!x||!Number.isFinite(ytd))return null;
  if(method==='annualized_ytd') return ytd/x.quarter*4;
  if(method==='seasonal_prior_year') { let sum=ytd; for(let q=x.quarter+1;q<=4;q++){const v=map.get(periodKey(x.year-1,q)); if(!Number.isFinite(v))return null; sum+=v;} return sum; }
  if(method==='yoy_scaled_remaining') { const pyYtd=[...Array(x.quarter)].reduce((s,_,i)=>s+(map.get(periodKey(x.year-1,i+1))||0),0); if(!(pyYtd>0))return null; const growth=ytd/pyYtd; let sum=ytd; for(let q=x.quarter+1;q<=4;q++){const v=map.get(periodKey(x.year-1,q)); if(!Number.isFinite(v))return null; sum+=v*growth;} return sum; }
  if(method==='ttm') return ttmEps(rows,current);
  return null;
}
function priceOnOrBefore(stock,date,marketDates){
  const target=String(date).replace(/\D/g,'');
  for(let i=marketDates.length-1;i>=0;i--){
    const d=marketDates[i];
    if(d>target)continue;
    const p=getDailyPrice(stock,d,{root:ROOT});
    if(p)return {date:d,...p};
  }
  return null;
}
function futureHigh(stock,startDate,endDate,marketDates){
  if(!endDate)return null;
  let best=null;
  for(const d of marketDates){
    if(d<startDate)continue;
    if(d>=endDate)break;
    const p=getDailyPrice(stock,d,{root:ROOT});
    if(p&&Number.isFinite(p.high)&&(!best||p.high>best.high)) best={date:d,high:p.high};
  }
  return best;
}
function buildHistoricalPeSeries(stock,rows,events,currentPeriod,marketDates){ const out=[]; for(const r of rows){ if(r.period>=currentPeriod)break; const ev=events.get(r.period); if(!ev)continue; const ttm=ttmEps(rows,r.period); const px=priceOnOrBefore(stock,ev.effective_trading_date,marketDates); if(Number.isFinite(ttm)&&ttm>0&&px)out.push(px.close/ttm); } return out.slice(-12); }
function rangeError(low,high,target){ if(!Number.isFinite(target)||!Number.isFinite(low)||!Number.isFinite(high))return null; if(target<low)return (low-target)/target*100; if(target>high)return (target-high)/target*100; return 0; }
function centerError(center,target){ return Number.isFinite(center)&&Number.isFinite(target)&&target>0 ? Math.abs(center-target)/target*100 : null; }

const EPS_METHODS=[
  ['ttm','近四季實際 EPS'],
  ['annualized_ytd','YTD 年化 EPS'],
  ['seasonal_prior_year','已公布 YTD + 去年同期剩餘季度'],
  ['yoy_scaled_remaining','已公布 YTD + 去年剩餘季度×今年 YTD 年增倍率'],
];
const PE_METHODS=[
  ['hist_q25_q75','個股歷史 P/E 25%–75% 區間'],
  ['hist_p20','個股歷史 P/E 中位數 ±20%'],
  ['current_pe20','事件日 TTM P/E ±20%'],
  ['fixed_10_20','固定 10–20 倍（基準組）'],
  ['fixed_15_25','固定 15–25 倍（基準組）'],
  ['fixed_20_30','固定 20–30 倍（基準組）'],
];
function peRange(method,hist,currentPe){
  if(method==='hist_q25_q75')return [quantile(hist,.25),quantile(hist,.75)];
  if(method==='hist_p20'){const m=median(hist);return Number.isFinite(m)?[m*.8,m*1.2]:[null,null];}
  if(method==='current_pe20')return Number.isFinite(currentPe)?[currentPe*.8,currentPe*1.2]:[null,null];
  if(method==='fixed_10_20')return [10,20]; if(method==='fixed_15_25')return [15,25]; if(method==='fixed_20_30')return [20,30]; return [null,null];
}
function analyzeStock(stock,marketDates){
  const rows=loadQuarterFiles(stock), events=loadEvents(stock); if(rows.length<4||!events.size)return [];
  const results=[];
  for(const r of rows){
    clearCaches();
    const ev=events.get(r.period); if(!ev)continue;
    const nextEv=events.get(nextPeriod(r.period));
    if(!nextEv)continue;
    const start=String(ev.effective_trading_date).replace(/\D/g,'');
    const end=String(nextEv.effective_trading_date).replace(/\D/g,'');
    const high=futureHigh(stock,start,end,marketDates); if(!high)continue;
    const base=priceOnOrBefore(stock,start,marketDates), ttm=ttmEps(rows,r.period); if(!base||!(ttm>0))continue;
    const currentPe=base.close/ttm;
    const hist=buildHistoricalPeSeries(stock,rows,events,r.period,marketDates);
    for(const [em,el] of EPS_METHODS){
      const annual=forecastAnnualEps(rows,r.period,em); if(!(annual>0))continue;
      for(const [pm,pl] of PE_METHODS){
        const [plo,phi]=peRange(pm,hist,currentPe); if(!(plo>0&&phi>0))continue;
        const low=annual*plo, highVal=annual*phi, center=(low+highVal)/2;
        results.push({stock_code:stock,fiscal_period:r.period,effective_trading_date:start,next_report_date:end,base_close:round(base.close,2),future_high_date:high.date,future_high:round(high.high,2),eps_method:em,eps_method_label:el,pe_method:pm,pe_method_label:pl,estimated_annual_eps:round(annual,4),pe_low:round(plo,2),pe_high:round(phi,2),fair_low:round(low,2),fair_high:round(highVal,2),fair_center:round(center,2),range_error_pct:round(rangeError(low,highVal,high.high),4),center_error_pct:round(centerError(center,high.high),4),hit_range:high.high>=low&&high.high<=highVal});
      }
    }
  }
  clearCaches();
  return results;
}
function summarize(rows){ const map=new Map(); for(const r of rows){const k=`${r.eps_method}__${r.pe_method}`; if(!map.has(k))map.set(k,[]); map.get(k).push(r);} return [...map.entries()].map(([formula,a])=>({formula,eps_method:a[0].eps_method,eps_method_label:a[0].eps_method_label,pe_method:a[0].pe_method,pe_method_label:a[0].pe_method_label,samples:a.length,hit_rate_pct:round(a.filter(x=>x.hit_range).length/a.length*100,2),mean_range_error_pct:round(a.reduce((s,x)=>s+x.range_error_pct,0)/a.length,2),median_center_error_pct:round(median(a.map(x=>x.center_error_pct)),2)})).sort((a,b)=>a.mean_range_error_pct-b.mean_range_error_pct||b.hit_rate_pct-a.hit_rate_pct); }
function main(){
  const marketDates=loadMarketDates();
  const stocks=fs.existsSync(FIN_ROOT)?fs.readdirSync(FIN_ROOT,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^\d{4,6}$/.test(d.name)).map(d=>d.name):[];
  const rows=[];
  for(let i=0;i<stocks.length;i++){
    const s=stocks[i];
    rows.push(...analyzeStock(s,marketDates));
    if((i+1)%25===0||i===stocks.length-1) console.log(`[eps-valuation] ${i+1}/${stocks.length} stocks, ${rows.length} formula rows`);
  }
  const payload={schema_version:1,dataset:'eps_valuation_backtest',generated_at:new Date().toISOString(),methodology:{information_rule:'Only quarterly EPS and P/E observations available no later than each financial-report effective trading date are used.',target_rule:'Future-quarter target is the maximum daily high from the report effective trading date until the next quarterly report effective trading date, exclusive. Samples without a known next quarterly report are excluded as incomplete.',pe_history_rule:'Historical P/E uses only earlier report events and at most the previous 12 observations.',price_source:'scripts/lib/stock_price_provider.js'},formula_count:EPS_METHODS.length*PE_METHODS.length,stock_count:new Set(rows.map(r=>r.stock_code)).size,sample_count:rows.length,formula_summary:summarize(rows),rows};
  writeJson(OUT_FILE,payload);
  console.log(JSON.stringify({output:path.relative(ROOT,OUT_FILE),stocks:payload.stock_count,samples:payload.sample_count,formulas:payload.formula_summary.length},null,2));
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
module.exports={forecastAnnualEps,ttmEps,ytdEps,rangeError,centerError,peRange,futureHigh,priceOnOrBefore};
