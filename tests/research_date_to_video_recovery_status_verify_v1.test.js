'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {verify}=require('../scripts/research_date_to_video_recovery_status_verify_v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-recovery-status-'));
try{
 const official='{"target_date":"20261008"}\n',audio='{"target_date":"20261008","status":"REJECTED"}\n';
 fs.writeFileSync(path.join(dir,'official-data-recovery-plan.json'),official);
 fs.writeFileSync(path.join(dir,'sentence-audio-review.json'),audio);
 const status={target_date:'20261008',publication_authorized:false,render_authorized:false,ready_to_render:false,official_recovery_advice:{target_date:'20261008',source_plan_sha256:sha(official)},audio_recovery_advice:{target_date:'20261008',source_review_sha256:sha(audio)}};
 fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify(status));
 assert.equal(verify(dir).status,'VERIFIED_RESEARCH_ONLY');
 fs.writeFileSync(path.join(dir,'sentence-audio-review.json'),audio+' ');
 assert.ok(verify(dir).issues.includes('RECOVERY_SOURCE_SHA_MISMATCH:sentence-audio-review.json'));
 fs.writeFileSync(path.join(dir,'sentence-audio-review.json'),audio);
 status.official_recovery_advice.target_date='20261013';fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify(status));
 assert.ok(verify(dir).issues.includes('RECOVERY_ADVICE_DATE_MISMATCH:official-data-recovery-plan.json'));
 status.official_recovery_advice.target_date='20261008';status.render_authorized=true;fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify(status));
 assert.ok(verify(dir).issues.includes('D4_AUTHORIZATION_LOCK_INVALID:render_authorized'));
 console.log('D4_RECOVERY_STATUS_VERIFY_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
