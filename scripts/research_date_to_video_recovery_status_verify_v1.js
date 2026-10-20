'use strict';
// Research-only verifier for a single dated D4 output directory; no side effects.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function verify(dir){
 const status=JSON.parse(fs.readFileSync(path.join(dir,'status.json'),'utf8'));
 const issues=[],date=status.target_date;
 if(!/^20\d{6}$/.test(date||''))issues.push('INVALID_TARGET_DATE');
 function check(advice,file,shaField){
  if(!advice)return;
  if(advice.target_date!==date)issues.push('RECOVERY_ADVICE_DATE_MISMATCH:'+file);
  const p=path.join(dir,file);
  if(!fs.existsSync(p)){issues.push('RECOVERY_SOURCE_MISSING:'+file);return;}
  if(sha(fs.readFileSync(p))!==advice[shaField])issues.push('RECOVERY_SOURCE_SHA_MISMATCH:'+file);
 }
 check(status.official_recovery_advice,'official-data-recovery-plan.json','source_plan_sha256');
 check(status.audio_recovery_advice,'sentence-audio-review.json','source_review_sha256');
 if(fs.existsSync(path.join(dir,'sentence-audio-review.json'))&&!status.audio_recovery_advice)issues.push('AUDIO_RECOVERY_ADVICE_MISSING');
 if(status.audio_recovery_advice&&!fs.existsSync(path.join(dir,'sentence-audio-review.json')))issues.push('AUDIO_RECOVERY_SOURCE_MISSING');
 if(!status.official_recovery_advice)issues.push('OFFICIAL_RECOVERY_ADVICE_MISSING');
 for(const key of ['publication_authorized','render_authorized','ready_to_render'])if(status[key]!==false)issues.push('D4_AUTHORIZATION_LOCK_INVALID:'+key);
 return {contract:'DATE_TO_VIDEO_V1_RECOVERY_STATUS_VERIFICATION',target_date:date,research_only:true,status:issues.length?'REJECTED':'VERIFIED_RESEARCH_ONLY',issues,automatic_dispatch_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
}
if(require.main===module){const dir=process.argv[2];if(!dir){console.error('Usage: node scripts/research_date_to_video_recovery_status_verify_v1.js d4-output-dir');process.exit(2)}try{const r=verify(dir);console.log(JSON.stringify(r,null,2));if(r.status==='REJECTED')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={verify};
