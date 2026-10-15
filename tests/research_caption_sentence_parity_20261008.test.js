'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {project}=require('../scripts/research_caption_projection_full_20261008');
const {verifySentence,verifySequence}=require('../scripts/research_caption_sentence_parity_20261008');
const d=JSON.parse(fs.readFileSync('data_research/m5/ai-script-generation/20261008-original-script-v3-research.json','utf8'));
let checked=0;
for(const part of [d.opening,...d.segments]){
 const spoken=part.spoken_sentences;
 const captions=spoken.map(project);
 assert.equal(verifySequence(spoken,captions),true);
 checked+=spoken.length;
 if(captions.length){
  const omitted=captions.slice(1);
  assert.throws(()=>verifySequence(spoken,omitted),/SENTENCE_COUNT_DRIFT/);
  const altered=[...captions];altered[0]+='遺漏';
  assert.throws(()=>verifySequence(spoken,altered),/CAPTION_SEMANTIC_DRIFT/);
  const wrong=[...captions];wrong[0]=wrong[0].replace(/[0-9]/,'X')+'錯';
  assert.throws(()=>verifySequence(spoken,wrong),/CAPTION_SEMANTIC_DRIFT/);
  if(captions.length>1){const reversed=[...captions];[reversed[0],reversed[1]]=[reversed[1],reversed[0]];assert.throws(()=>verifySequence(spoken,reversed),/CAPTION_SEMANTIC_DRIFT/);}
 }
}
assert.equal(verifySentence('跌幅約百分之零點九九。','跌幅約0.99%。'),true);
assert.equal(verifySentence('漲幅約百分之九點九。','漲幅約9.9%。'),true);
assert.equal(verifySentence('平均約一兆零七十二億元。','平均約10,072億元。'),true);
console.log('FULL_CAPTION_EXACT_SENTENCE_NEGATIVE_TEST_PASS sentences='+checked+' research_only=true');
