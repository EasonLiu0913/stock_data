#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getDailyPrice } = require('./lib/stock_price_provider');
const { scoreComponents } = require('./summarize_mops_revenue_fundamental_acceleration_score');
const { latestKnownFinancial } = require('./summarize_two_stage_fundamental_quality_long_horizons');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const MASTER_FILE = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'financial-quality-master.json');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'two-stage-fundamental-quality-tail-excursions.json');
const HORIZONS = [20, 40, 60];
const THRESHOLDS = [20, 30, 50];
const FACTORS = [
  { id: 'monthly8_financial10', name: '月營收 ≥8 + 財報品質 ≥10', test: e => e.monthly_score >= 8 && e.financial_score >= 10 },
  { id: 'monthly9_financial10', name: '月營收 ≥9 + 財報品質 ≥10', test: e => e.monthly_score >= 9 && e.financial_score >= 10 },
];
const ELECTRONIC_INDUSTRIES = new Set([
  '半導體業', '電腦及週邊設備業', '光電業', '通信網路業', '電子零組件業', '電子通路業', '資訊服務業', '其他電子業', '電子工業',
]);

const mean = xs => { const a = xs.filter(Number.isFinite); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; };
const median = xs => { const a = xs.filter(Number.isFinite).sort((a,b)=>a-b); if (!a.length) return null; const m = Math.floor(a.length/2); return a.length%2 ? a[m] : (a[m-1]+a[m])/2; };
const round = (v,d=4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
function readJson(file, fallback=null){ try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return fallback; } }
function parseArgs(argv){ const m=new Map(); for(let i=0;i<argv.length;i++){ if(!argv[i].startsWith('--'))continue; m.set(argv[i].slice(2), argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true); } return m; }
function loadRevenueHistory(){
  const byMonth=new Map(), byStock=new Map();
  for(const entry of fs.readdirSync(REVENUE_ROOT,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^20\d{4}$/.test(e.name))){
    const month=entry.name, payload=readJson(path.join(REVENUE_ROOT,month,'monthly_revenue.json'),{}), map=new Map();
    for(const row of payload.companies||[]){ const id=String(row.stock_code); map.set(id,row); if(!byStock.has(id))byStock.set(id,new Map()); byStock.get(id).set(month,row); }
    byMonth.set(month,map);
  }
  return {byMonth,byStock};
}
function loadFinancialMaster(){ const p=readJson(MASTER_FILE); if(!p||!Array.isArray(p.stocks))throw new Error('Missing financial-quality-master.json'); return new Map(p.stocks.map(s=>[String(s.stock_id),s.rows||[]])); }
function loadMarketRows(){ const p=readJson(MARKET_FILE,{}); return (p.data||[]).filter(r=>/^20\d{6}$/.test(String(r.date))&&Number.isFinite(Number(r.close))).map(r=>({date:String(r.date),close:Number(r.close)})).sort((a,b)=>a.date.localeCompare(b.date)); }
function loadEvents(start,end,history,financialByStock){
  const out=[];
  const months=fs.readdirSync(SIGNAL_ROOT).filter(n=>/^20\d{4}\.json$/.test(n)).map(n=>n.slice(0,6)).filter(m=>(!start||m>=start)&&(!end||m<=end)).sort();
  for(const month of months){
    const payload=readJson(path.join(SIGNAL_ROOT,`${month}.json`),{}), revMap=history.byMonth.get(month)||new Map();
    for(const event of payload.events||[]){
      const stockId=String(event.stock_code), row=revMap.get(stockId)||{}, monthly=scoreComponents(event,month,history.byStock.get(stockId));
      const eventDate=event.effective_trading_date||event.conservative_availability_date||null;
      const financial=latestKnownFinancial(financialByStock.get(stockId)||[],eventDate);
      out.push({
        month, stock_id:stockId, industry:row.industry||'未分類', is_electronic:ELECTRONIC_INDUSTRIES.has(row.industry||'未分類'),
        base_trading_date:event.base_trading_date||null, monthly_score:Number(monthly.total_score), financial_score:Number(financial?.financial_quality_score), returns:event.returns||{},
      });
    }
  }
  return out;
}
function excursion(event,horizon,marketRows,indexByDate){
  const baseDate=event.base_trading_date, baseIndex=indexByDate.get(baseDate);
  if(!Number.isInteger(baseIndex)) return null;
  const target=marketRows[baseIndex+horizon];
  if(!target) return null;
  const basePrice=getDailyPrice(event.stock_id,baseDate,{root:ROOT});
  if(!basePrice?.close) return null;
  let maxHigh=-Infinity,minLow=Infinity,validDays=0;
  for(let i=1;i<=horizon;i++){
    const date=marketRows[baseIndex+i]?.date; if(!date) return null;
    const price=getDailyPrice(event.stock_id,date,{root:ROOT}); if(!price) continue;
    if(Number.isFinite(price.high)){maxHigh=Math.max(maxHigh,price.high);validDays++;}
    if(Number.isFinite(price.low))minLow=Math.min(minLow,price.low);
  }
  const endpoint=event.returns?.[`d${horizon}`];
  if(endpoint?.status!=='complete'||!Number.isFinite(Number(endpoint.stock_return_pct))) return null;
  if(!Number.isFinite(maxHigh)||!Number.isFinite(minLow)||validDays===0) return null;
  const mfe=((maxHigh/basePrice.close)-1)*100, mae=((minLow/basePrice.close)-1)*100;
  return { endpoint_return_pct:Number(endpoint.stock_return_pct), excess_return_pct:Number(endpoint.excess_return_pct), mfe_pct:mfe, mae_pct:mae, valid_days:validDays };
}
function pct(count,total){ return total?round(count/total*100):null; }
function summarize(rows){
  const n=rows.length;
  const result={ samples:n, avg_endpoint_return_pct:round(mean(rows.map(r=>r.endpoint_return_pct))), median_endpoint_return_pct:round(median(rows.map(r=>r.endpoint_return_pct))), avg_excess_return_pct:round(mean(rows.map(r=>r.excess_return_pct))), median_excess_return_pct:round(median(rows.map(r=>r.excess_return_pct))), avg_mfe_pct:round(mean(rows.map(r=>r.mfe_pct))), median_mfe_pct:round(median(rows.map(r=>r.mfe_pct))), avg_mae_pct:round(mean(rows.map(r=>r.mae_pct))), median_mae_pct:round(median(rows.map(r=>r.mae_pct))) };
  for(const t of THRESHOLDS){ result[`endpoint_ge_${t}_rate`]=pct(rows.filter(r=>r.endpoint_return_pct>=t).length,n); result[`mfe_ge_${t}_rate`]=pct(rows.filter(r=>r.mfe_pct>=t).length,n); }
  return result;
}
function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv),start=args.get('start-month')||'202401',end=args.get('end-month')||'202606';
  const history=loadRevenueHistory(), financialByStock=loadFinancialMaster(), marketRows=loadMarketRows(), indexByDate=new Map(marketRows.map((r,i)=>[r.date,i]));
  const events=loadEvents(start,end,history,financialByStock);
  const segments=[['all','全部',()=>true],['electronic','電子股',e=>e.is_electronic],['non_electronic','非電子股',e=>!e.is_electronic]];
  const rows=[]; const coverage={};
  for(const horizon of HORIZONS){
    const cache=new Map();
    for(const e of events){ const x=excursion(e,horizon,marketRows,indexByDate); if(x)cache.set(e,x); }
    coverage[`d${horizon}`]={complete_excursion_events:cache.size};
    for(const factor of FACTORS){
      for(const [segmentId,segmentName,segmentTest] of segments){
        const selected=events.filter(e=>factor.test(e)&&segmentTest(e)&&cache.has(e)).map(e=>cache.get(e));
        rows.push({factor_id:factor.id,factor_name:factor.name,segment:segmentId,segment_name:segmentName,horizon:`d${horizon}`,...summarize(selected)});
      }
    }
  }
  const out={schema_version:1,dataset:'two_stage_fundamental_quality_tail_excursions',generated_at:new Date().toISOString(),start_month:start,end_month:end,methodology:{status:'research_only',horizons:HORIZONS.map(h=>`d${h}`),thresholds_pct:THRESHOLDS,mae:'minimum intraperiod low return relative to signal base close; negative is adverse',mfe:'maximum intraperiod high return relative to signal base close',endpoint_threshold:'stock return at exact D20/D40/D60 target trading date',mfe_threshold:'whether stock touched threshold at any point after base date through horizon',price_source:'scripts/lib/stock_price_provider.js OHLC',anti_lookahead:'factor membership uses only monthly event data and latest financial score known by event date'},coverage,rows};
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true}); fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({output:path.relative(ROOT,OUTPUT),coverage,rows:rows.length},null,2));
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
module.exports={FACTORS,HORIZONS,THRESHOLDS,ELECTRONIC_INDUSTRIES,excursion,summarize};
