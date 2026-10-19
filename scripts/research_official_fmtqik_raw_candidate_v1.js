'use strict';
// Candidate-only FMTQIK original-response shape inspection; never approves an endpoint or archive.
const crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function inspectCandidate(bytes,date){
 const base={contract:'FMTQIK_ORIGINAL_RESPONSE_CANDIDATE_V1',target_date:date,status:'REJECTED',endpoint_approved:false,original_http_archive_verified:false,raw_http_provenance_certified:false,master_authorized:false,publication_authorized:false};
 if(!/^20\d{6}$/.test(date||'')||!Number.isFinite(Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z'))||new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z').toISOString().slice(0,10)!==date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8))throw Error('INVALID_TARGET_DATE');
 if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>1024*1024)return {...base,reason:'INVALID_CANDIDATE_BYTES'};
 try{
  const p=JSON.parse(bytes.toString('utf8'));
  if(!Array.isArray(p.fields)||!Array.isArray(p.data)||p.fields.length===0)return {...base,reason:'INVALID_CANDIDATE_TABLE'};
  if(p.fields.some(f=>typeof f!=='string')||new Set(p.fields).size!==p.fields.length)return {...base,reason:'INVALID_CANDIDATE_FIELDS'};
  if(p.fields[0]!=='日期')return {...base,reason:'DATE_COLUMN_IDENTITY_UNVERIFIED'};
  if(p.data.some(r=>!Array.isArray(r)||r.length!==p.fields.length))return {...base,reason:'INVALID_CANDIDATE_ROW_WIDTH'};
  const expected=String(Number(date.slice(0,4))-1911)+'/'+date.slice(4,6)+'/'+date.slice(6,8);
  const matches=p.data.filter(r=>r[0]===expected);
  if(matches.length!==1)return {...base,reason:matches.length?'DUPLICATE_TARGET_DATE':'TARGET_DATE_ROW_MISSING'};
  if(matches[0].slice(1).some(v=>typeof v!=='string'||!/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/.test(v)))return {...base,reason:'INVALID_CANDIDATE_NUMERIC_CELL'};
  return {...base,status:'CANDIDATE_TABLE_SHAPE_ONLY_CONTRACT_REVIEW_REQUIRED',candidate_sha256:sha(bytes),candidate_bytes:bytes.length,matched_roc_date:expected,field_names:p.fields,raw_units_verified:false,market_scope_verified:false};
 }catch(e){return {...base,reason:'INVALID_CANDIDATE_JSON'};}
}
module.exports={inspectCandidate};
