'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectWithMockTransport}=require('../scripts/youtube_get_only_transport');
const {evaluateYouTubeInventory}=require('../scripts/inspect_youtube_private_candidate');
const candidate={date:'20261008',sha256:'a'.repeat(64)};
const observedAtUtc='2026-10-30T08:00:00Z';
function fixture({duplicate=false,mismatch=false,missing=false}={}){
 return async request=>{
  assert.equal(request.method,'GET');
  if(request.resource==='channels')return {status:200,body:{items:[{id:'channel-1',contentDetails:{relatedPlaylists:{uploads:'uploads-1'}}}]}};
  if(request.resource==='playlistItems')return {status:200,body:{items:[{contentDetails:{videoId:'video-1'}},...(duplicate?[{contentDetails:{videoId:'video-1'}}]:[])]}};
  if(request.resource==='videos')return {status:200,body:{items:missing?[]:[{id:'video-1',snippet:{channelId:mismatch?'channel-2':'channel-1',title:'20261008'},status:{privacyStatus:'private'}}]}};
 };
}
async function run(adapter){
 const inventory=await inspectWithMockTransport(adapter);
 return evaluateYouTubeInventory({...inventory,receipt:{status:'absent_verified'},candidate,observedAtUtc});
}
test('complete offline pipeline produces redacted schema and NO_GO for existing video',async()=>{
 const r=await run(fixture());
 assert.equal(r.schema_version,'mvp10.youtube.inspection.v1');
 assert.equal(r.artifact_id,'12953454424');
 assert.equal(r.render_run_id,'41002179152');
 assert.equal(r.go_no_go,'NO_GO');
 assert.ok(r.blockers.includes('existing_candidate_do_not_upload'));
 assert.equal(r.channel_id,'channel-1');
 assert.equal(r.inventory_paginated_to_end,true);
 assert.equal(r.captions_check.status,'not_authorized');
 assert.equal(Object.hasOwn(r,'upload_authorized'),false);
 assert.equal(JSON.stringify(r).includes('Bearer'),false);
});
test('duplicate playlist video ID remains NO_GO',async()=>{
 const r=await run(fixture({duplicate:true}));
 assert.equal(r.go_no_go,'NO_GO');
 assert.equal(r.inventory_count,2);
 assert.ok(r.blockers.includes('duplicate_inventory_video_id'));
 assert.ok(r.blockers.includes('existing_candidate_do_not_upload'));
});
test('mismatched channel fails closed',async()=>{
 const r=await run(fixture({mismatch:true}));
 assert.ok(r.blockers.includes('invalid_video_readback'));
 assert.equal(r.go_no_go,'NO_GO');
});
test('missing videos.list item fails closed',async()=>{
 const r=await run(fixture({missing:true}));
 assert.ok(r.blockers.includes('incomplete_video_readback'));
});
test('upstream 403 never yields a positive evidence record',async()=>{
 await assert.rejects(run(async()=>({status:403,body:{}})),/read_failed/);
});

test('duplicate videos.list response ID fails closed even when privacy agrees',async()=>{
 const base=fixture();
 const adapter=async request=>{
  const response=await base(request);
  if(request.resource==='videos')response.body.items.push({...response.body.items[0]});
  return response;
 };
 const r=await run(adapter);
 assert.equal(r.go_no_go,'NO_GO');
 assert.ok(r.blockers.includes('duplicate_video_readback_id'));
});
