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
