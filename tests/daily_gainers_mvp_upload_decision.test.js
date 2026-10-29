'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {decide} = require('../scripts/daily_gainers_mvp_upload_decision');
const id = 'AbC123xyz_';
test('never upload without explicit owner pilot authorization', () => {
  assert.equal(decide({receipt:null,verifiedAbsence:true}).action,'blocked');
});
test('unknown outcome must not dispatch a duplicate upload', () => {
  assert.equal(decide({receipt:null,authorized:true}).action,'blocked');
  assert.equal(decide({receipt:{upload_status:'started'},authorized:true}).action,'blocked');
});
test('partial upload resumes captions, never reuploads MP4', () => {
  assert.deepEqual(decide({authorized:true,receipt:{youtube_video_id:id,privacy:'private',upload_status:'video_created'}}),{action:'captions_only',videoId:id});
});
test('completed upload is idempotent', () => {
  assert.equal(decide({authorized:true,receipt:{youtube_video_id:id,privacy:'private',upload_status:'complete'}}).action,'already_uploaded');
});
test('reject invalid/nonprivate receipt', () => {
  for(const receipt of [{youtube_video_id:id,privacy:'public',upload_status:'complete'}, {youtube_video_id:'',privacy:'private',upload_status:'video_created'}, {youtube_video_id:id,privacy:'private',upload_status:'unknown'}]){
    assert.equal(decide({authorized:true,receipt}).action,'blocked');
  }
});
test('allow first upload only after separately verified absence', () => {
  assert.equal(decide({authorized:true,verifiedAbsence:true,receipt:null}).action,'first_upload');
});
