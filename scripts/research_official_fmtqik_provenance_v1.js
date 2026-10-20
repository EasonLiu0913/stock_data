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

// Independent staged-candidate integrity audit; caller metadata is not an authenticated HTTP transcript.
function inspectStagedCandidate(root,date){
 const {inspectCandidate}=require('./research_official_fmtqik_raw_candidate_v1');
 inspectCandidate(Buffer.from('{"fields":["日期","成交金額"],"data":[]}'),date);
 const dir=path.join(root,'fmtqik-candidate',date),raw=path.join(dir,'response.json'),file=path.join(dir,'candidate-manifest.json');
 const base={contract:'FMTQIK_STAGED_CANDIDATE_INTEGRITY_AUDIT_V1',target_date:date,status:'WAITING_SOURCE',raw_http_provenance_certified:false,endpoint_approved:false,master_authorized:false,render_authorized:false,publication_authorized:false};
 if(!fs.existsSync(raw)||!fs.existsSync(file))return base;
 try{
  const bytes=fs.readFileSync(raw),m=JSON.parse(fs.readFileSync(file,'utf8')),candidate=inspectCandidate(bytes,date);
  if(m.contract!=='FMTQIK_STAGED_HTTP_CANDIDATE_V1'||m.target_date!==date||m.sha256!==sha(bytes)||m.bytes!==bytes.length)throw Error('CANDIDATE_MANIFEST_INTEGRITY_MISMATCH');
  if(candidate.status!=='CANDIDATE_TABLE_SHAPE_ONLY_CONTRACT_REVIEW_REQUIRED'||JSON.stringify(m.candidate_inspection)!==JSON.stringify(candidate))throw Error('CANDIDATE_INSPECTION_MISMATCH');
  if(m.http_status!==200||!/^application\/json\b/i.test(m.content_type||''))throw Error('CANDIDATE_HTTP_METADATA_MISMATCH');
  if(m.http_metadata_evidence!=='CALLER_SUPPLIED_UNVERIFIED'||m.endpoint_approved!==false||m.raw_http_provenance_certified!==false||m.master_authorized!==false||m.render_authorized!==false||m.publication_authorized!==false)throw Error('CANDIDATE_AUTHORIZATION_STATE_MISMATCH');
  const receiptPath=path.join(dir,'direct-fetch-receipt.json');
  let receiptStatus='NOT_PRESENT_CALLER_STAGED_CANDIDATE';
  if(fs.existsSync(receiptPath)){
   const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
   const expected='https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date='+date+'&response=json';
   if(receipt.contract!=='FMTQIK_DIRECT_FETCH_RECEIPT_RESEARCH_V1'||receipt.target_date!==date||receipt.request_url!==expected||receipt.request_url!==m.source_url_unapproved||receipt.observed_at!==m.observed_at||receipt.http_status!==m.http_status||receipt.content_type!==m.content_type||receipt.response_sha256!==sha(bytes)||receipt.response_bytes!==bytes.length||receipt.capture_method!=='NODE_HTTPS_GET'||receipt.independently_attested!==false||receipt.source_contract_review_required!==true||['raw_http_provenance_certified','endpoint_approved','master_authorized','render_authorized','publication_authorized'].some(k=>receipt[k]!==false))throw Error('DIRECT_FETCH_RECEIPT_MISMATCH');
   if(receipt.response_headers!==undefined){const h=receipt.response_headers;if(!h||typeof h!=='object'||Array.isArray(h)||h['content-type']!==receipt.content_type||!Number.isFinite(Date.parse(receipt.request_started_at))||receipt.request_finished_at!==receipt.observed_at||Date.parse(receipt.request_started_at)>Date.parse(receipt.request_finished_at))throw Error('DIRECT_FETCH_RECEIPT_HEADERS_OR_TIMING_MISMATCH');}
   receiptStatus='DIRECT_FETCH_RECEIPT_MATCHES_STAGED_BYTES_UNATTESTED';
  }
  return {...base,status:'STAGED_BYTES_AND_MANIFEST_MATCH_HTTP_PROVENANCE_PENDING',receipt_status:receiptStatus,sha256:sha(bytes),bytes:bytes.length,complete_six_field_candidate:candidate.complete_six_field_candidate,source_contract_review_required:true};
 }catch(e){return {...base,status:'REJECTED',reason:e.message};}
}
module.exports={inspect,inspectStagedCandidate};
