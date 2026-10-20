'use strict';
// Research-only date entry: D4 orchestration followed by independent recovery status verification.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {run}=require('./research_date_to_video_d4_orchestrator');
const {verify}=require('./research_date_to_video_recovery_status_verify_v1');
const {inspect:inspectMedia}=require('./research_date_to_video_media_preflight_v1');
const {advise}=require('./research_date_to_video_next_action_v1');
const {build:buildDatedMediaInput,inspectSentencePacket}=require('./research_date_to_video_dated_media_input_v1');
function execute(root,date,out){
 if(!/^20\d{6}$/.test(date||''))throw Error('INVALID_TARGET_DATE');
 // Invalidate the previous handoff before any new run can fail or change date.
 const previous=path.join(out,'verified-research-entry.json');
 if(fs.existsSync(previous))fs.unlinkSync(previous);
 const d4=run(root,date,out),verification=verify(out),media=inspectMedia(out),datedMedia=buildDatedMediaInput(out);
 if(datedMedia.target_date!==null&&datedMedia.target_date!==date)throw Error('DATED_MEDIA_INPUT_DATE_MISMATCH');
 const packetPath=path.join(out,'sentence-packet-input.json');
 let sentenceHandoff=null;
 if(fs.existsSync(packetPath)){
  try{sentenceHandoff=inspectSentencePacket(out,JSON.parse(fs.readFileSync(packetPath,'utf8')));}
  catch(e){sentenceHandoff={contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_MEDIA_HANDOFF',target_date:date,status:'REJECTED',issues:['SENTENCE_PACKET_INVALID_JSON'],editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};}
 }
 const source_files=['status.json','official-data-recovery-plan.json','official-data-manifest.json'];
 const source_artifacts=source_files.map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')}));
 const result={contract:'DATE_TO_VIDEO_V1_VERIFIED_RESEARCH_ENTRY',target_date:date,research_only:true,d4_status:d4.stages?.[0]?.status||'UNKNOWN',verification_status:verification.status,verification_issues:verification.issues,blockers:d4.blockers,source_artifacts,media_preflight:{status:media.status,issues:media.issues,target_date:media.target_date},sentence_handoff:sentenceHandoff,dated_media_input:{target_date:datedMedia.target_date,media_bridge_status:datedMedia.media_bridge_status,preflight_status:datedMedia.preflight_status,source_master_sha256:datedMedia.source_master_sha256,analysis_task_sha256:datedMedia.analysis_task_sha256,blockers:datedMedia.blockers},next_action:advise(d4,verification,media),automatic_dispatch_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
 fs.writeFileSync(path.join(out,'verified-research-entry.json'),JSON.stringify(result,null,2)+'\n');
 return result;
}
if(require.main===module){const [date,root='.',out]=process.argv.slice(2);if(!date||!out){console.error('Usage: node scripts/research_date_to_video_verified_entry_v1.js YYYYMMDD repo-root output-dir');process.exit(2)}try{const result=execute(root,date,out);console.log(JSON.stringify(result,null,2));if(result.verification_status!=='VERIFIED_RESEARCH_ONLY')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={execute};
