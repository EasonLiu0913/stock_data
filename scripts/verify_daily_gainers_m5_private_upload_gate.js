'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
function verifyProof(p) {
 assert.equal(p.date,'20261008');
 assert.equal(p.contract,'M5-PRIVATE-TTS-VIDEO-PREVIEW-v2');
 assert.equal(p.publication_authorized,false);
 assert.equal(p.youtube_privacy,'private');
 assert.equal(p.source_finance_publication_verified,false);
 assert.equal(p.scene_count,7);
 assert.ok(p.duration_seconds>=60&&p.duration_seconds<=90);
 for(const key of ['audio','timed_srt','video_1080p','frame_inspection','source_manifest']) {
  assert.equal(p.artifacts[key].verified,true,'Missing actual proof: '+key);
  assert.match(p.artifacts[key].sha256,/^[a-f0-9]{64}$/);
 }
 assert.equal(p.caption_parity_verified,true);
 assert.equal(p.progress_caption_safe_verified,true);
 assert.equal(p.existing_preview_video_id||null,null,'Existing preview must be reused, not uploaded again');
 return {eligible_for_one_private_preview:true,date:p.date,publication_authorized:false};
}
if(require.main===module) console.log(JSON.stringify(verifyProof(JSON.parse(fs.readFileSync(process.argv[2],'utf8')))));
module.exports={verifyProof};
