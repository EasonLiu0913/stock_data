'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {prepareDatedSentenceTimeline}=require('../scripts/research_date_to_video_dated_media_input_v1');
const {FIXED_OPENING_LINES}=require('../scripts/research_date_to_video_fixed_opening_v1');
test('dated timeline prepares structurally valid sentences but never authorizes audio or publication',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dated-timeline-'));
 try{
  const hash='a'.repeat(64);
  fs.writeFileSync(path.join(dir,'media-handoff.json'),JSON.stringify({target_date:'20261013',source_master_sha256:hash}));
  const packet={target_date:'20261013',source_master_sha256:hash,sentences:[
   ...FIXED_OPENING_LINES.map((line,i)=>({id:'opening-'+i,narration:line,subtitle:line})),
   {id:'market-1',narration:'上漲十家。',subtitle:'上漲10家。',spoken_subtitle_mappings:[{spoken:'十',display:'10'}]}
  ]};
  const result=prepareDatedSentenceTimeline(dir,packet);
  assert.equal(result.target_date,'20261013');
  assert.equal(result.sentences.length,5);
  assert.equal(result.sentences[4].caption_text,'上漲10家。');
  assert.equal(result.sentences[4].audio_sha256,null);
  assert.equal(result.sentences[4].editorial_decision,'PENDING');
  for(const key of ['audio_generation_authorized','editorial_certified','narration_authorized','render_authorized','publication_authorized'])assert.equal(result[key],false);
  const wrong=prepareDatedSentenceTimeline(dir,{...packet,target_date:'20261008'});
  assert.equal(wrong.status,'BLOCKED');assert.equal(wrong.sentences.length,0);
  const drift=prepareDatedSentenceTimeline(dir,{...packet,sentences:packet.sentences.map((s,i)=>i===4?{...s,subtitle:'上漲11家。'}:s)});
  assert.equal(drift.status,'BLOCKED');assert.equal(drift.sentences.length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('date-generic preflight validates provenance for 20261013 and 20261014 and fails closed',()=>{
 const crypto=require('node:crypto');
 const {inspect}=require('../scripts/research_date_to_video_media_preflight_v1');
 const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
 for(const date of ['20261013','20261014']){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dated-preflight-'+date+'-'));
  try{
   const put=(name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value));
   const master={target_date:date,render_authorized:false,publication_authorized:false};
   const masterHash=digest(master);
   const task={target_date:date,market_master_sha256:masterHash,render_authorized:false,publication_authorized:false};
   const review={target_date:date,editorial_certified:false,render_authorized:false,publication_authorized:false};
   const input={target_date:date,review_gate_sha256:digest(review),draft_check_sha256:null,editorial_certified:false,render_authorized:false,publication_authorized:false};
   const handoff={target_date:date,source_master_sha256:masterHash,analysis_task_sha256:digest(task),review_gate_sha256:digest(review),draft_check_sha256:null,fixed_opening_lines:FIXED_OPENING_LINES,date_parameterized_media_bridge_implemented:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
   for(const [name,value] of [['market-master.json',master],['original-analysis-task.json',task],['editorial-review.json',review],['editorial-input-manifest.json',input],['media-handoff.json',handoff]])put(name,value);
   const baseline=inspect(dir);
   assert.equal(baseline.target_date,date);
   assert.equal(baseline.status,'BLOCKED');
   assert.ok(baseline.issues.includes('EDITORIAL_CERTIFICATION_REQUIRED'));
   assert.ok(baseline.issues.includes('DATED_MEDIA_BRIDGE_NOT_IMPLEMENTED'));
   assert.ok(!baseline.issues.includes('MASTER_SHA_MATCH'));
   assert.ok(!baseline.issues.includes('TASK_SHA_MATCH'));
   assert.equal(baseline.render_authorized,false);
   assert.equal(baseline.publication_authorized,false);
   put('market-master.json',{...master,target_date:'20261008'});
   assert.ok(inspect(dir).issues.includes('MASTER_DATE_MATCH'));
   put('market-master.json',master);
   put('editorial-review.json',{...review,editorial_certified:true});
   assert.ok(inspect(dir).issues.includes('REVIEW_GATE_SHA_MATCH'));
   put('editorial-review.json',review);
   put('media-handoff.json',{...handoff,publication_authorized:true});
   assert.ok(inspect(dir).issues.includes('NO_RENDER_OR_PUBLICATION_AUTHORIZATION'));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
});
