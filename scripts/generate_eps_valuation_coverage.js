#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { clearCaches, getDailyPrice } = require('./lib/stock_price_provider');

const ROOT = path.resolve(__dirname, '..');
const STOCK_LIST_FILE = path.join(ROOT, 'data_twse', 'twse_industry_Stock.json');
const FIN_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const EVENT_ROOT = path.join(ROOT, 'data_fundamental_events');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUT_FILE = path.join(ROOT, 'data_prediction_analysis', 'eps-valuation', 'coverage-report.json');
const DEFAULT_WORKER_SIZE = 25;

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function periodKey(year, quarter) { return `${year}Q${quarter}`; }
function parsePeriod(p) { const m=String(p).match(/^(20\d{2})Q([1-4])$/); return m ? {year:+m[1],quarter:+m[2]} : null; }
function nextPeriod(p) { const x=parsePeriod(p); return !x?null:x.quarter===4?periodKey(x.year+1,1):periodKey(x.year,x.quarter+1); }
function previousPeriod(p) { const x=parsePeriod(p); return !x?null:x.quarter===1?periodKey(x.year-1,4):periodKey(x.year,x.quarter-1); }
function finiteNumber(v){ if(v===null||v===undefined||v==='')return null; const n=Number(v); return Number.isFinite(n)?n:null; }
function arg(name, fallback = null) { const i=process.argv.indexOf(`--${name}`); return i>=0 && process.argv[i+1]!=null ? process.argv[i+1] : fallback; }
function intArg(name, fallback) { const n=Number(arg(name,fallback)); if(!Number.isInteger(n)||n<0) throw new Error(`Invalid --${name}: ${n}`); return n; }

const REASONS={
  missing_quarterly_eps_data:'缺季度 EPS 資料',
  insufficient_quarterly_eps_history:'季度 EPS 少於 4 季',
  missing_formal_financial_report_events:'缺正式財報事件資料',
  missing_formal_event_for_period:'該季缺正式財報事件',
  missing_next_formal_report:'缺下一季正式財報事件',
  missing_future_price_window:'缺財報後至下一季報告前的股價',
  missing_event_day_price:'缺財報可交易日基準股價',
  incomplete_or_nonpositive_ttm_eps:'近四季 EPS 不完整或 TTM EPS <= 0',
  missing_eps_formula_inputs:'部分 EPS 預估公式缺必要歷史季度資料',
  missing_historical_pe_inputs:'歷史 P/E 公式缺較早財報/股價樣本'
};
function reason(code,type='data_gap'){return {code,label:REASONS[code]||code,type};}
function uniqueReasons(items){const m=new Map();for(const x of items||[])if(x&&!m.has(x.code))m.set(x.code,x);return [...m.values()];}

function loadUniverse(){
  const master=readJson(STOCK_LIST_FILE,{}), map=new Map();
  for(const [code,meta] of Object.entries(master||{}))if(/^\d{4,6}$/.test(code))map.set(code,{stock_code:code,stock_name:meta?.Name||'',industry:meta?.Industry||''});
  if(fs.existsSync(FIN_ROOT))for(const d of fs.readdirSync(FIN_ROOT,{withFileTypes:true}))if(d.isDirectory()&&/^\d{4,6}$/.test(d.name)&&!map.has(d.name))map.set(d.name,{stock_code:d.name,stock_name:'',industry:''});
  return [...map.values()].sort((a,b)=>a.stock_code.localeCompare(b.stock_code));
}
function loadMarketDates(){const p=readJson(MARKET_FILE,{});return (p.data||[]).map(r=>String(r.date||'').replace(/\D/g,'')).filter(d=>/^20\d{6}$/.test(d)).sort();}
function loadQuarterRows(stock){
  const dir=path.join(FIN_ROOT,stock);if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(f=>/^20\d{2}Q[1-4]\.json$/.test(f)).map(f=>{const file=path.join(dir,f),p=readJson(file,{}),eps=finiteNumber(p.standalone_quarter?.eps);return {period:p.fiscal_period||f.slice(0,-5),eps,known_date:p.methodology?.conservative_known_date||null,source_file:path.relative(ROOT,file)};}).filter(r=>parsePeriod(r.period)&&Number.isFinite(r.eps)).sort((a,b)=>a.period.localeCompare(b.period));
}
function loadEvents(stock){
  const dir=path.join(EVENT_ROOT,stock),map=new Map();if(!fs.existsSync(dir))return map;
  for(const f of fs.readdirSync(dir).filter(x=>/^20\d{2}\.json$/.test(x))){const file=path.join(dir,f),p=readJson(file,{});for(const e of p.events||[])if(e.event_type==='formal_financial_report'&&e.fiscal_period&&e.effective_trading_date)map.set(e.fiscal_period,{...e,source_file:path.relative(ROOT,file)});}
  return map;
}
function epsMap(rows){return new Map(rows.map(r=>[r.period,r.eps]));}
function ttmEps(rows,current){const map=epsMap(rows);let p=current,sum=0,n=0;for(let i=0;i<4;i++){const v=map.get(p);if(Number.isFinite(v)){sum+=v;n++;}p=previousPeriod(p);}return n===4?sum:null;}
function ytdEps(rows,current){const x=parsePeriod(current),map=epsMap(rows);if(!x)return null;let sum=0;for(let q=1;q<=x.quarter;q++){const v=map.get(periodKey(x.year,q));if(!Number.isFinite(v))return null;sum+=v;}return sum;}
function epsMethodAvailability(rows,current){
  const x=parsePeriod(current),map=epsMap(rows),available=[],missing=[];if(!x)return {available,missing};
  const ttm=ttmEps(rows,current);if(ttm>0)available.push('ttm');else missing.push('ttm');
  const ytd=ytdEps(rows,current);if(Number.isFinite(ytd)&&ytd>0)available.push('annualized_ytd');else missing.push('annualized_ytd');
  let seasonal=Number.isFinite(ytd);if(seasonal)for(let q=x.quarter+1;q<=4;q++)if(!Number.isFinite(map.get(periodKey(x.year-1,q))))seasonal=false;(seasonal&&ytd>0?available:missing).push('seasonal_prior_year');
  const priorYtd=[];for(let q=1;q<=x.quarter;q++)priorYtd.push(map.get(periodKey(x.year-1,q)));let yoy=Number.isFinite(ytd)&&priorYtd.every(Number.isFinite)&&priorYtd.reduce((s,v)=>s+v,0)>0;if(yoy)for(let q=x.quarter+1;q<=4;q++)if(!Number.isFinite(map.get(periodKey(x.year-1,q))))yoy=false;(yoy&&ytd>0?available:missing).push('yoy_scaled_remaining');
  return {available,missing};
}
function createPriceReader(stock){
  const scalarCache=new Map();
  return (date)=>{
    const key=String(date).replace(/\D/g,'');
    if(scalarCache.has(key)) return scalarCache.get(key);
    const value=getDailyPrice(stock,key,{root:ROOT})||null;
    clearCaches();
    scalarCache.set(key,value);
    return value;
  };
}
function priceOnOrBefore(readPrice,date,marketDates){const target=String(date).replace(/\D/g,'');for(let i=marketDates.length-1;i>=0;i--){const d=marketDates[i];if(d>target)continue;const p=readPrice(d);if(p)return {date:d,...p};}return null;}
function hasFuturePrice(readPrice,start,end,marketDates){for(const d of marketDates){if(d<start)continue;if(d>=end)break;const p=readPrice(d);if(p&&Number.isFinite(p.high))return true;}return false;}
function historicalPeObservations(readPrice,rows,events,current,marketDates){let n=0;for(const r of rows){if(r.period>=current)break;const ev=events.get(r.period),ttm=ttmEps(rows,r.period);if(!ev||!(ttm>0))continue;if(priceOnOrBefore(readPrice,ev.effective_trading_date,marketDates))n++;}return Math.min(n,12);}

function inspectStock(meta,marketDates){
  const stock=meta.stock_code,rows=loadQuarterRows(stock),events=loadEvents(stock),stockReasons=[],periodDetails=[],readPrice=createPriceReader(stock);
  if(!rows.length)stockReasons.push(reason('missing_quarterly_eps_data'));
  else if(rows.length<4)stockReasons.push(reason('insufficient_quarterly_eps_history'));
  if(!events.size)stockReasons.push(reason('missing_formal_financial_report_events'));
  const latest=rows.at(-1)?.period||null;
  let eligiblePeriods=0,estimatedFormulaRows=0;
  for(const r of rows){
    const missing=[],ev=events.get(r.period);
    if(!ev){missing.push(reason('missing_formal_event_for_period'));periodDetails.push({fiscal_period:r.period,eps:r.eps,eps_source_file:r.source_file,status:'excluded',estimated_formula_rows:0,missing});continue;}
    const np=nextPeriod(r.period),nextEv=events.get(np);
    if(!nextEv){missing.push(reason('missing_next_formal_report',r.period===latest?'future_pending':'data_gap'));periodDetails.push({fiscal_period:r.period,eps:r.eps,eps_source_file:r.source_file,event_source_file:ev.source_file,effective_trading_date:ev.effective_trading_date,next_fiscal_period:np,status:'excluded',estimated_formula_rows:0,missing});continue;}
    const start=String(ev.effective_trading_date).replace(/\D/g,''),end=String(nextEv.effective_trading_date).replace(/\D/g,'');
    const base=priceOnOrBefore(readPrice,start,marketDates),ttm=ttmEps(rows,r.period),futureOk=hasFuturePrice(readPrice,start,end,marketDates);
    if(!futureOk)missing.push(reason('missing_future_price_window'));
    if(!base)missing.push(reason('missing_event_day_price'));
    if(!(ttm>0))missing.push(reason('incomplete_or_nonpositive_ttm_eps'));
    if(!futureOk||!base||!(ttm>0)){periodDetails.push({fiscal_period:r.period,eps:r.eps,eps_source_file:r.source_file,event_source_file:ev.source_file,effective_trading_date:start,next_report_date:end,status:'excluded',estimated_formula_rows:0,missing:uniqueReasons(missing)});continue;}
    const epsMethods=epsMethodAvailability(rows,r.period),hist=historicalPeObservations(readPrice,rows,events,r.period,marketDates);
    if(epsMethods.missing.length)missing.push(reason('missing_eps_formula_inputs'));
    if(hist===0)missing.push(reason('missing_historical_pe_inputs'));
    const peMethods=hist>0?6:4,formulaRows=epsMethods.available.length*peMethods;
    eligiblePeriods++;estimatedFormulaRows+=formulaRows;
    periodDetails.push({fiscal_period:r.period,eps:r.eps,eps_source_file:r.source_file,event_source_file:ev.source_file,effective_trading_date:start,next_report_date:end,status:'eligible',estimated_formula_rows:formulaRows,available_eps_methods:epsMethods.available,missing_eps_methods:epsMethods.missing,historical_pe_observations:hist,missing:uniqueReasons(missing)});
  }
  clearCaches();for(const p of periodDetails)for(const m of p.missing||[])stockReasons.push(m);
  const all=uniqueReasons(stockReasons),blocking=all.filter(x=>x.type==='data_gap'),pending=all.filter(x=>x.type==='future_pending');
  return {stock_code:stock,stock_name:meta.stock_name,industry:meta.industry,quarterly_eps_count:rows.length,quarterly_eps_periods:rows.map(r=>r.period),formal_report_event_count:events.size,formal_report_periods:[...events.keys()].sort(),eligible_period_count:eligiblePeriods,estimated_formula_rows:estimatedFormulaRows,eligible_for_any_backtest:eligiblePeriods>0,coverage_status:eligiblePeriods>0?(blocking.length?'partial':'eligible'):'missing',missing_requirements:blocking,pending_requirements:pending,period_details:periodDetails};
}
function summarize(stocks){const counts=new Map();let eligible=0,partial=0,missing=0,pending=0;for(const s of stocks){if(s.eligible_for_any_backtest)eligible++;if(s.coverage_status==='partial')partial++;if(s.coverage_status==='missing')missing++;if(s.pending_requirements.length)pending++;for(const r of s.missing_requirements){if(!counts.has(r.code))counts.set(r.code,{code:r.code,label:r.label,stocks:0});counts.get(r.code).stocks++;}}return {total_stocks:stocks.length,eligible_stocks:eligible,partial_stocks:partial,missing_stocks:missing,stocks_with_future_pending:pending,reason_counts:[...counts.values()].sort((a,b)=>b.stocks-a.stocks||a.label.localeCompare(b.label,'zh-Hant'))};}

function runWorker(offset,limit,output){
  const universe=loadUniverse(),marketDates=loadMarketDates(),selected=universe.slice(offset,offset+limit),stocks=[];
  for(let i=0;i<selected.length;i++){
    stocks.push(inspectStock(selected[i],marketDates));
    const rss=Math.round(process.memoryUsage().rss/1024/1024);
    console.log(`[eps-coverage-worker] ${offset+i+1}/${universe.length} stock=${selected[i].stock_code} eligible=${stocks.at(-1).eligible_for_any_backtest?'yes':'no'} rss_mb=${rss}`);
  }
  writeJson(output,stocks);
}
function runIsolatedCoverage(){
  const universe=loadUniverse(),workerSize=intArg('worker-size',DEFAULT_WORKER_SIZE),stocks=[];
  for(let offset=0;offset<universe.length;offset+=workerSize){
    const limit=Math.min(workerSize,universe.length-offset);
    const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'eps-coverage-'));
    const output=path.join(tempDir,'coverage.json');
    const result=spawnSync(process.execPath,[__filename,'--worker-offset',String(offset),'--worker-limit',String(limit),'--worker-output',output],{cwd:ROOT,stdio:['ignore','inherit','inherit']});
    if(result.status!==0){fs.rmSync(tempDir,{recursive:true,force:true});throw new Error(`Coverage worker failed offset=${offset} limit=${limit} exit=${result.status}`);}
    const part=readJson(output,[]);if(!Array.isArray(part)||part.length!==limit){fs.rmSync(tempDir,{recursive:true,force:true});throw new Error(`Invalid coverage worker output offset=${offset}`);}
    stocks.push(...part);fs.rmSync(tempDir,{recursive:true,force:true});
    const eligible=stocks.filter(x=>x.eligible_for_any_backtest).length;
    const rss=Math.round(process.memoryUsage().rss/1024/1024);
    console.log(`[eps-coverage] ${stocks.length}/${universe.length} stocks, ${eligible} eligible, parent_rss_mb=${rss}`);
  }
  const payload={schema_version:1,dataset:'eps_valuation_coverage',generated_at:new Date().toISOString(),execution_mode:'isolated_coverage_workers',worker_size:workerSize,universe_source:path.relative(ROOT,STOCK_LIST_FILE),reason_definitions:REASONS,summary:summarize(stocks),stocks};
  writeJson(OUT_FILE,payload);console.log(JSON.stringify({output:path.relative(ROOT,OUT_FILE),execution_mode:payload.execution_mode,worker_size:workerSize,...payload.summary},null,2));
}
function main(){
  const workerOutput=arg('worker-output');
  if(workerOutput){runWorker(intArg('worker-offset',0),intArg('worker-limit',DEFAULT_WORKER_SIZE),path.resolve(workerOutput));return;}
  runIsolatedCoverage();
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
module.exports={inspectStock,summarize,createPriceReader,runIsolatedCoverage};
