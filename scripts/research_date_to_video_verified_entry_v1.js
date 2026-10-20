'use strict';
// Research-only date entry: D4 orchestration followed by independent recovery status verification.
const fs=require('node:fs'),path=require('node:path');
const {run}=require('./research_date_to_video_d4_orchestrator');
const {verify}=require('./research_date_to_video_recovery_status_verify_v1');
const {inspect:inspectMedia}=require('./research_date_to_video_media_preflight_v1');
const {advise}=require('./research_date_to_video_next_action_v1');
function execute(root,date,out){
 if(!/^20\d{6}$/.test(date||''))throw Error('INVALID_TARGET_DATE');
 const d4=run(root,date,out),verification=verify(out),media=inspectMedia(out);
 const result={contract:'DATE_TO_VIDEO_V1_VERIFIED_RESEARCH_ENTRY',target_date:date,research_only:true,d4_status:d4.stages?.[0]?.status||'UNKNOWN',verification_status:verification.status,verification_issues:verification.issues,blockers:d4.blockers,media_preflight:{status:media.status,issues:media.issues,target_date:media.target_date},next_action:advise(d4,verification,media),automatic_dispatch_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
 fs.writeFileSync(path.join(out,'verified-research-entry.json'),JSON.stringify(result,null,2)+'\n');
 return result;
}
if(require.main===module){const [date,root='.',out]=process.argv.slice(2);if(!date||!out){console.error('Usage: node scripts/research_date_to_video_verified_entry_v1.js YYYYMMDD repo-root output-dir');process.exit(2)}try{const result=execute(root,date,out);console.log(JSON.stringify(result,null,2));if(result.verification_status!=='VERIFIED_RESEARCH_ONLY')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={execute};
