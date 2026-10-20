'use strict';
// Research-only date entry: reuse verified archive or bounded BFI82U recovery before dated D4 diagnostics.
const fs=require('node:fs'),path=require('node:path');
const {recover}=require('./research_official_data_recovery_v1');
const {run}=require('./research_date_to_video_d4_orchestrator');
const {inspect:inspectMediaPreflight}=require('./research_date_to_video_media_preflight_v1');
const {derive:deriveAudioCandidate}=require('./research_date_to_video_audio_input_handoff_v1');
async function execute(root,date,out,options={}){
 if(!/^20\d{6}$/.test(date||'')||!Number.isFinite(Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z'))||new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z').toISOString().slice(0,10)!==date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8))throw Error('INVALID_TARGET_DATE');
 if(!out||path.resolve(out)===path.resolve(root)||path.resolve(out).startsWith(path.resolve(root)+path.sep))throw Error('EXTERNAL_ISOLATED_OUTPUT_DIRECTORY_REQUIRED');
 // A failed retry must never leave the previous successful entry report visible.
 const reportPath=path.join(out,'official-entry-status.json');
 if(fs.existsSync(reportPath))fs.unlinkSync(reportPath);
 const recovery=await recover(root,date,options);
 const d4=run(root,date,out);
 const datedManifest=JSON.parse(fs.readFileSync(path.join(out,'official-data-manifest.json'),'utf8'));
 if(datedManifest.target_date!==date||datedManifest.manifest_sha256!==recovery.manifest.manifest_sha256)throw Error('OFFICIAL_ENTRY_RECOVERY_D4_MANIFEST_MISMATCH');
 const recoveryPlan=JSON.parse(fs.readFileSync(path.join(out,'official-data-recovery-plan.json'),'utf8'));
 if(recoveryPlan.target_date!==date||recoveryPlan.manifest_sha256!==datedManifest.manifest_sha256)throw Error('OFFICIAL_ENTRY_RECOVERY_PLAN_MANIFEST_MISMATCH');
 const mandatorySources=datedManifest.entries.filter(e=>e.status!=='VERIFIED_RESEARCH_ONLY').map(e=>({id:e.id,status:e.status,action_required:e.action_required||null,provenance_diagnostic:e.provenance_diagnostic||null}));
 const mediaPreflight=inspectMediaPreflight(out);
 if(mediaPreflight.target_date!==null&&mediaPreflight.target_date!==date)throw Error('OFFICIAL_ENTRY_MEDIA_PREFLIGHT_DATE_MISMATCH');
 const worksheetPath=path.join(out,'editorial-narration-worksheet.json');
 const worksheet=fs.existsSync(worksheetPath)?JSON.parse(fs.readFileSync(worksheetPath,'utf8')):null;
 if(worksheet&&worksheet.target_date!==date)throw Error('OFFICIAL_ENTRY_EDITORIAL_WORKSHEET_DATE_MISMATCH');
 // Optional independently authored candidate: inspect using the existing handoff, never persist or execute its commands.
 const candidatePath=path.join(out,'narration-candidate-input.json');
 let audioCandidate=null;
 if(fs.existsSync(candidatePath)){
  if(!worksheet)audioCandidate={status:'BLOCKED',issues:['EDITORIAL_WORKSHEET_NOT_GENERATED']};
  else try{const candidate=JSON.parse(fs.readFileSync(candidatePath,'utf8'));const derived=deriveAudioCandidate(out,candidate);audioCandidate={status:derived.status,issues:derived.inventory.issues,review_status:derived.inventory.review_status,sentence_count:derived.inventory.sentences.length,command_count:derived.command_plan.commands.length,commands_executed:false,editorial_certified:false,render_authorized:false,publication_authorized:false};}
  catch(e){audioCandidate={status:'BLOCKED',issues:['NARRATION_CANDIDATE_INPUT_INVALID_OR_STALE'],commands_executed:false,render_authorized:false,publication_authorized:false};}
 }
 const draftCheckPath=path.join(out,'original-analysis-draft-check.json');
 const draftCheck=fs.existsSync(draftCheckPath)?JSON.parse(fs.readFileSync(draftCheckPath,'utf8')):null;
 if(draftCheck&&draftCheck.target_date!==date)throw Error('OFFICIAL_ENTRY_DRAFT_CHECK_DATE_MISMATCH');
 const authoredPreflightPath=path.join(out,'authored-candidate-preflight.json');
 const authoredPreflight=fs.existsSync(authoredPreflightPath)?JSON.parse(fs.readFileSync(authoredPreflightPath,'utf8')):null;
 if(authoredPreflight&&authoredPreflight.target_date!==date)throw Error('OFFICIAL_ENTRY_AUTHORED_PREFLIGHT_DATE_MISMATCH');
 const downstream={authored_candidate_status:authoredPreflight?.status||'NOT_PRESENT',authored_candidate_missing_claim_reviews:authoredPreflight?.missing_claim_reviews?.length||0,authored_candidate_invalid_master_fields:authoredPreflight?.invalid_master_fields||[],original_draft_status:draftCheck?.status||'ORIGINAL_ANALYSIS_DRAFT_REQUIRED',original_draft_reason:draftCheck?.reason||null,audio_candidate:audioCandidate,editorial_worksheet_status:worksheet?.status||'WAITING_DATED_EVIDENCE',editorial_worksheet_issues:worksheet?.issues||['EDITORIAL_WORKSHEET_NOT_GENERATED'],editorial_worksheet_sections:worksheet?.sections?.length||0,media_preflight_status:mediaPreflight.status,media_preflight_issues:mediaPreflight.issues,market_master:mandatorySources.length?'WAITING_APPROVED_DATED_SOURCES':'REQUIRES_INDEPENDENT_EDITORIAL_REVIEW',original_editorial:'NOT_AUTHORIZED',semantic_projection:'NOT_AUTHORIZED',media_render:'NOT_AUTHORIZED',acceptance_artifacts:'NOT_AUTHORIZED',required_sources:mandatorySources,complete_mp4:false};
 const report={contract:'DATE_TO_VIDEO_OFFICIAL_ENTRY_RESEARCH_V1',target_date:date,recovery_status:recovery.status,recovery_attempts:recovery.attempts,recovery_reason:recovery.reason||null,manifest_sha256:datedManifest.manifest_sha256,d4_status:d4.stages[0].status,source_actions:recoveryPlan.sources.map(s=>({id:s.id,status:s.status,action_required:s.action_required,automated_retrieval_allowed:s.automated_retrieval_allowed,provenance_diagnostic:datedManifest.entries.find(e=>e.id===s.id)?.provenance_diagnostic||null})),blockers:d4.blockers,downstream,render_authorized:false,publication_authorized:false};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 return report;
}
if(require.main===module){const [date,root='.',out]=process.argv.slice(2);execute(root,date,out).then(x=>{console.log(JSON.stringify(x,null,2));if(!['REUSED_VERIFIED_ARCHIVE','RECOVERED_VERIFIED_ARCHIVE'].includes(x.recovery_status)||x.blockers.length)process.exitCode=3}).catch(e=>{console.error(e.message);process.exitCode=2});}
module.exports={execute};
