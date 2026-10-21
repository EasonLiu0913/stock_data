'use strict';
// Research-only five prior trading-session turnover candidate. Derived chart is not original HTTP proof.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(root,date){
 const base={contract:'D4_PREVIOUS_FIVE_TURNOVER_CANDIDATE_V1',target_date:date,status:'WAITING_SOURCE',source_path:'data_twse_market_chart/market_chart.json',original_http_provenance_certified:false,editorial_certified:false,master_authorized:false,render_authorized:false,publication_authorized:false};
 if(!/^20\d{6}$/.test(date||'')||new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6)+'T00:00:00Z').toISOString().slice(0,10)!==date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6))throw Error('INVALID_TARGET_DATE');
 const file=path.join(root,base.source_path);if(!fs.existsSync(file))return base;
 try{
  const bytes=fs.readFileSync(file),chart=JSON.parse(bytes);
  if(chart.sources?.volume!=='TWSE FMTQIK'||chart.units?.turnover!=='TWD'||!Array.isArray(chart.data))throw Error('CHART_SCOPE_OR_UNIT_MISMATCH');
  const seen=new Set();for(const row of chart.data){if(!/^20\d{6}$/.test(row.date||'')||new Date(row.date.slice(0,4)+'-'+row.date.slice(4,6)+'-'+row.date.slice(6)+'T00:00:00Z').toISOString().slice(0,10)!==row.date||seen.has(row.date)||!Number.isSafeInteger(row.turnover)||row.turnover<=0)throw Error('INVALID_OR_DUPLICATE_CHART_ROW');seen.add(row.date)}
  const rows=chart.data.filter(x=>x.date<=date).sort((a,b)=>a.date.localeCompare(b.date));
  if(rows.filter(x=>x.date===date).length!==1)return {...base,status:'WAITING_SOURCE',reason:'TARGET_DATE_ROW_MISSING',source_sha256:sha(bytes)};
  const prior=rows.filter(x=>x.date<date).slice(-5);if(prior.length!==5)return {...base,status:'WAITING_SOURCE',reason:'FIVE_PRIOR_SESSIONS_MISSING',source_sha256:sha(bytes)};
  const current=rows.find(x=>x.date===date),sum=prior.reduce((n,x)=>n+BigInt(x.turnover),0n),average=sum/5n;
  if(sum>BigInt(Number.MAX_SAFE_INTEGER))throw Error('TURNOVER_SUM_UNSAFE');
  return {...base,status:'DERIVED_FIVE_SESSION_CANDIDATE_REVIEW_PENDING',source_sha256:sha(bytes),unit:'TWD',scope:'TWSE_WHOLE_MARKET',previous_sessions:prior.map(x=>({date:x.date,turnover_twd:x.turnover})),previous_five_total_twd:Number(sum),previous_five_average_twd:Number(average),target_turnover_twd:current.turnover,comparison_pct:(current.turnover/Number(sum)*5-1)*100,review_required:['DATED_TRADING_CALENDAR','ORIGINAL_SOURCE_PROVENANCE','MARKET_SCOPE']};
 }catch(e){return {...base,status:'REJECTED',reason:e.message}}
}
if(require.main===module)try{console.log(JSON.stringify(build(process.argv[3]||'.',process.argv[2]),null,2))}catch(e){console.error(e.message);process.exitCode=1}
module.exports={build};
