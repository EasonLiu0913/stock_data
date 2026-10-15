'use strict';
const assert=require('node:assert/strict');
const {project}=require('./research_caption_projection_full_20261008');
const {verifySequence}=require('./research_caption_sentence_parity_20261008');
function buildResearchCaptionSource(d){
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
