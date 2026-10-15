'use strict';
const assert=require('node:assert/strict');
const {project}=require('./research_caption_projection_full_20261008');
function verifySentence(spoken,caption){
 assert.equal(typeof spoken,'string','SPOKEN_TYPE');
 assert.equal(typeof caption,'string','CAPTION_TYPE');
 assert.equal(caption,project(spoken),'CAPTION_SEMANTIC_DRIFT');
 return true;
}
function verifySequence(spoken,caption){
 assert.ok(Array.isArray(spoken)&&Array.isArray(caption),'SENTENCE_ARRAY');
 assert.equal(caption.length,spoken.length,'SENTENCE_COUNT_DRIFT');
 spoken.forEach((s,i)=>verifySentence(s,caption[i]));
 return true;
}
module.exports={verifySentence,verifySequence};
