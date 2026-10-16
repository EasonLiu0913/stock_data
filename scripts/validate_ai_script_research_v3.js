'use strict';
const assert=require('node:assert/strict');
// Validate externally AI-authored text; never generate or repair narration.
function validate(d,master){
 assert.equal(d.schema_version,3,'SCHEMA');
 assert.equal(d.author,'ChatGPT_AI','AUTHOR');
 assert.equal(d.target_date,master.target_date,'DATE');
 assert.match(master.sha256,/^[a-f0-9]{64}$/,'HASH');
 assert.equal(d.research_master_sha256,master.sha256,'MASTER_DRIFT');
 assert.equal(d.publication_authorized,false,'PUBLICATION');
 assert.ok(d.featured.length>=2,'FEATURED');
 const stocks=new Map(master.candidates.map(s=>[s.code,s]));
 for(const f of d.featured){const s=stocks.get(f.code);assert.ok(s&&s.name===f.name,'STOCK');assert.ok(s.previous_close>0&&(s.close/s.previous_close-1)*100>=5-0.011,'GAIN');}
 const sourceIds=new Set(master.sources.map(s=>s.id)),claimIds=new Set();
 for(const c of d.claims){
  assert.ok(c.id&&!claimIds.has(c.id),'CLAIM_ID');claimIds.add(c.id);
  assert.ok(['verified_event','contemporary_association','hypothesis','unknown'].includes(c.epistemic_status),'CLAIM_GRADE');
  assert.ok(Array.isArray(c.source_ids),'SOURCE_IDS_ARRAY');
  if(c.epistemic_status==='verified_event')assert.ok(c.source_ids.length,'EVENT_SOURCE');
  if(c.epistemic_status==='contemporary_association')assert.ok(Array.isArray(c.source_ids)&&c.source_ids.length>0,'ASSOCIATION_SOURCE');
  assert.equal(new Set(c.source_ids).size,c.source_ids.length,'DUPLICATE_SOURCE_POINTER');
  for(const id of c.source_ids)assert.ok(sourceIds.has(id),'SOURCE_POINTER');
  assert.notEqual(c.causality_verified,true,'UNVERIFIED_CAUSALITY');
  if(c.epistemic_status==='verified_event')for(const id of c.source_ids){
   const src=master.sources.find(s=>s.id===id);
   assert.notEqual(src.verification,'upstream_reference_requires_editor_review','UNREVIEWED_EVENT_SOURCE');
  }
 }
 const lines=d.opening.spoken_sentences;
 assert.deepEqual(lines.slice(0,4),['大家好，歡迎來到 TAIWAN STOCK！','追蹤資金，解讀行情。','錢在哪，我們就在哪！','我們有提供中文 CC 字幕，記得打開觀賞，那我們開始囉。'],'FIXED_FOUR_LINE_OPENING');
 assert.equal(lines.filter(s=>s==='我們有提供中文 CC 字幕，記得打開觀賞，那我們開始囉。').length,1,'CC_ONCE');
 assert.deepEqual(lines,d.opening.caption_sentences,'CAPTION');
 for(const s of d.segments){assert.ok(!s.spoken_sentences.includes('我們有提供中文 CC 字幕，記得打開觀賞，那我們開始囉。'),'CC_ONLY_IN_OPENING');assert.deepEqual(s.spoken_sentences,s.caption_sentences,'SEGMENT_CAPTION');for(const id of [...s.claim_ids,...s.card_claim_ids])assert.ok(claimIds.has(id),'CLAIM_POINTER');}
 return {status:'RESEARCH_VALIDATED',editorial_complete:false,render_authorized:false,publication_authorized:false};
}
module.exports={validate};
