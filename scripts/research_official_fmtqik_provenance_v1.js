'use strict';
// Research-only FMTQIK-derived chart provenance. Never represents a dated original HTTP response.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function inspect(root,date){
 if(!/^20\d{6}$/.test(date||'')||!Number.isFinite(Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z'))||new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z').toISOString().slice(0,10)!==date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8))throw Error('INVALID_TARGET_DATE');
 const rel='data_twse_market_chart/market_chart.json',file=path.join(root,rel);
 const base={contract:'FMTQIK_DERIVED_CHART_PROVENANCE_V1',target_date:date,source_path:rel,status:'WAITING_SOURCE',original_http_archive_verified:false,raw_http_provenance_certified:false,master_authorized:false,publication_authorized:false};
 if(!fs.existsSync(file))return base;
 try{
  const bytes=fs.readFileSync(file),chart=JSON.parse(bytes);
  if(chart.sources?.volume!=='TWSE FMTQIK'||chart.units?.turnover!=='TWD'||!Array.isArray(chart.data))throw Error('DERIVED_CHART_SOURCE_UNIT_SCHEMA_MISMATCH');
  if(chart.data.some(x=>typeof x.date!=='string'||!/^20\d{6}$/.test(x.date)||!Number.isFinite(Date.parse(x.date.slice(0,4)+'-'+x.date.slice(4,6)+'-'+x.date.slice(6,8)+'T00:00:00Z'))||new Date(x.date.slice(0,4)+'-'+x.date.slice(4,6)+'-'+x.date.slice(6,8)+'T00:00:00Z').toISOString().slice(0,10)!==x.date.slice(0,4)+'-'+x.date.slice(4,6)+'-'+x.date.slice(6,8)))throw Error('INVALID_DERIVED_CHART_DATE_SCHEMA');
  const matches=chart.data.filter(x=>x.date===date);
  if(matches.length!==1)throw Error(matches.length?'DUPLICATE_DATED_CHART_ROW':'DATED_CHART_ROW_MISSING');
  const r=matches[0];for(const k of ['turnover','volumeShares','transactions'])if(!Number.isSafeInteger(r[k])||r[k]<=0)throw Error('INVALID_DERIVED_'+k);
  return {...base,status:'DATED_DERIVED_CHART_ONLY_ORIGINAL_RAW_PENDING',chart_sha256:sha(bytes),chart_bytes:bytes.length,observations:{source_date:date,turnover_twd:r.turnover,volume_shares:r.volumeShares,transactions:r.transactions}};
 }catch(e){return {...base,status:'REJECTED',reason:e.message};}
}
if(require.main===module){try{console.log(JSON.stringify(inspect(process.argv[3]||'.',process.argv[2]),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={inspect};
