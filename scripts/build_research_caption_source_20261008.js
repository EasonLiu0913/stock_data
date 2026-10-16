'use strict';
const assert=require('node:assert/strict');
const {project}=require('./research_caption_projection_full_20261008');
const {verifySequence}=require('./research_caption_sentence_parity_20261008');
function buildResearchCaptionSource(d){
 assert.equal(d.schema_version,3,'AI_V3_SCHEMA');
 assert.equal(d.author,'ChatGPT_AI','AI_V3_AUTHOR');
 assert.equal(d.editorial_complete,false,'EDITORIAL_GATE');
 assert.equal(d.render_authorized,false,'RENDER_GATE');
 assert.match(d.research_master_sha256,/^[a-f0-9]{64}$/,'MASTER_SHA');
 assert.deepEqual([d.opening,...d.segments].map(p=>p.id||'opening'),['opening','market','6672','2305','1301','conclusion'],'PART_ORDER');
 assert.deepEqual([d.opening,...d.segments].map(p=>p.spoken_sentences.length),[4,5,3,3,3,3],'SENTENCE_INVENTORY');
 assert.equal(d.target_date,'20261008','DATE');
 assert.equal(d.publication_authorized,false,'PUBLICATION');
 const parts=[d.opening,...d.segments];
 const claimIds=new Set(d.claims.map(c=>c.id));
 for(const part of parts)for(const id of [...(part.claim_ids||[]),...(part.card_claim_ids||[])])assert.ok(claimIds.has(id),'UNKNOWN_CLAIM_ID');
 const projected=parts.map(part=>({
  id:part.id||'opening',
  claim_ids:part.claim_ids||[],card_claim_ids:part.card_claim_ids||[],
  spoken_sentences:part.spoken_sentences,
  caption_sentences:part.spoken_sentences.map(project)
 }));
 for(const part of projected)verifySequence(part.spoken_sentences,part.caption_sentences);
 const media_input=projected.map((p,i)=>({scene:i+1,id:p.id,speech_sentences:p.spoken_sentences,caption_sentences:p.caption_sentences,claim_ids:p.claim_ids,card_claim_ids:p.card_claim_ids}));
 assert.deepEqual(media_input.map(p=>p.speech_sentences.length),[4,5,3,3,3,3],'MEDIA_SENTENCE_INVENTORY');
 return {target_date:d.target_date,research_master_sha256:d.research_master_sha256,
  status:'RESEARCH_CAPTION_SOURCE_NOT_SRT',render_authorized:false,publication_authorized:false,real_tts_generated:false,timed_srt_generated:false,mp4_generated:false,media_input_status:'V3_SIX_SCENE_SEMANTIC_INPUT_ONLY',media_input,parts:projected};
}
module.exports={buildResearchCaptionSource};
