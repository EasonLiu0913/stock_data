'use strict';
// Research-only archive-first inspection. Never downloads, overwrites raw evidence or authorizes publication.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspect}=require('./research_date_to_video_bfi82u_v1');
const {inspect:inspectFmtqik,inspectStagedCandidate}=require('./research_official_fmtqik_provenance_v1');
const {inspect:inspectMiIndex}=require('./research_official_mi_index_provenance_v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const canonical=o=>JSON.stringify(o);
function build(root,date){
 if(!/^20\d{6}$/.test(date)||!Number.isFinite(Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z'))||new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z').toISOString().slice(0,10)!==date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8))throw Error('INVALID_TARGET_DATE');
 const registryPath=path.join(root,'config/research/official-data-registry-v1.json');
 const registryBytes=fs.readFileSync(registryPath),registry=JSON.parse(registryBytes);
 if(registry.schema_version!==1||registry.registry_id!=='date-to-video-official-data-research'||registry.research_only!==true||registry.publication_authorized!==false)throw Error('REGISTRY_CONTRACT_MISMATCH');
 const ids=['BFI82U','FMTQIK','BFIAMU','MI_INDEX'];
 if(!Array.isArray(registry.sources)||registry.sources.length!==ids.length||ids.some(id=>registry.sources.filter(s=>s.id===id).length!==1))throw Error('REGISTRY_SOURCE_SET_MISMATCH');
 const fmtqik=registry.sources.find(s=>s.id==='FMTQIK');
 if(!Array.isArray(fmtqik.candidate_evidence_dates)||fmtqik.candidate_evidence_dates.join(',')!=='20261008,20261013,20261014'||fmtqik.candidate_archiver!=='scripts/research_official_fmtqik_candidate_stage_v1.js'||fmtqik.candidate_validator!=='scripts/research_official_fmtqik_raw_candidate_v1.js'||fmtqik.endpoint_approved!==false||fmtqik.raw_http_provenance_certified!==false||fmtqik.master_authorized!==false||fmtqik.publication_authorized!==false)throw Error('FMTQIK_CANDIDATE_REGISTRY_UNAUTHORIZED_PROMOTION');
 const source=registry.sources.find(s=>s.id==='BFI82U');
 if(source.validator!=='scripts/research_date_to_video_bfi82u_v1.js')throw Error('BFI82U_VALIDATOR_NOT_REGISTERED');
 const prefix=path.join(root,'data_research/twse-market-opening/primary-archive',date,date+'-bfi82u');
 let bfi;
 try{
  const result=inspect(root,date);
  bfi=result.status==='VERIFIED'?{id:'BFI82U',status:'VERIFIED_RESEARCH_ONLY',source_date:date,raw_sha256:result.raw_sha256,raw_bytes:result.raw_bytes,archive_path:path.relative(root,prefix+'.json').split(path.sep).join('/'),final_six_rows_verified:result.final_six_rows_verified,publication_authorized:false}:{id:'BFI82U',status:'WAITING_SOURCE',source_date:date,missing:result.missing,publication_authorized:false};
 }catch(e){bfi={id:'BFI82U',status:'INVALID_ARCHIVE',source_date:date,reason:e.message,publication_authorized:false};}
 const diagnostic={FMTQIK:inspectFmtqik,MI_INDEX:inspectMiIndex};
 const entries=ids.map(id=>{
  if(id==='BFI82U')return bfi;
  const entry={id,status:'UNAPPROVED_OR_RAW_NOT_VALIDATED',source_date:date,action_required:id==='BFIAMU'?'SOURCE_CONTRACT_APPROVAL_REQUIRED':'ORIGINAL_DATED_HTTP_ARCHIVE_AND_VALIDATOR_REQUIRED',publication_authorized:false};
  if(diagnostic[id]){
   const evidence=diagnostic[id](root,date);
   entry.provenance_diagnostic={status:evidence.status,source_path:evidence.source_path,raw_http_provenance_certified:false};
   if(evidence.chart_sha256)entry.provenance_diagnostic.derived_chart_sha256=evidence.chart_sha256;
   if(evidence.repository_payload_sha256)entry.provenance_diagnostic.repository_payload_sha256=evidence.repository_payload_sha256;
   if(evidence.reason)entry.provenance_diagnostic.reason=evidence.reason;
   if(id==='FMTQIK'){const staged=inspectStagedCandidate(root,date);entry.provenance_diagnostic.staged_candidate_status=staged.status;entry.provenance_diagnostic.direct_fetch_receipt_status=staged.receipt_status||null;if(staged.reason)entry.provenance_diagnostic.staged_candidate_reason=staged.reason;entry.provenance_diagnostic.raw_http_provenance_certified=false;}
  }
  return entry;
 });
 const manifest={schema_version:1,target_date:date,registry_sha256:sha(registryBytes),entries,complete:false,master_authorized:false,render_authorized:false,publication_authorized:false};
 return {...manifest,manifest_sha256:sha(Buffer.from(canonical(manifest)))};
}
if(require.main===module){try{console.log(JSON.stringify(build(process.argv[3]||'.',process.argv[2]),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={build};
