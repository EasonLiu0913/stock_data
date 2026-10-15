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
 const projected=parts.map(part=>({
  id:part.id||'opening',
  spoken_sentences:part.spoken_sentences,
  caption_sentences:part.spoken_sentences.map(project)
 }));
 for(const part of projected)verifySequence(part.spoken_sentences,part.caption_sentences);
 return {target_date:d.target_date,research_master_sha256:d.research_master_sha256,
  status:'RESEARCH_CAPTION_SOURCE_NOT_SRT',render_authorized:false,publication_authorized:false,parts:projected};
}
module.exports={buildResearchCaptionSource};
