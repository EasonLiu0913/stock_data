'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {project,phrases}=require('../scripts/research_caption_projection_full_20261008');
const d=JSON.parse(fs.readFileSync('data_research/m5/ai-script-generation/20261008-original-script-v3-research.json','utf8'));
const parts=[d.opening,...d.segments];
let changed=0,checked=0;
for(const part of parts){
 assert.deepEqual(part.spoken_sentences,part.caption_sentences,'RESEARCH_PLACEHOLDER_DRIFT');
 for(const spoken of part.spoken_sentences){
  const caption=project(spoken);checked++;
  for(const [word,digits] of phrases)if(spoken.includes(word) && !phrases.some(([longer])=>longer.length>word.length && longer.includes(word) && spoken.includes(longer))){
   assert.ok(caption.includes(digits),'MISSING_DIGITS:'+word);
   assert.ok(!caption.includes(word),'UNPROJECTED:'+word);
   changed++;
  }
  assert.equal(project(spoken),caption,'NONDETERMINISTIC');
  if(caption!==spoken){
   const mutated=caption.replace(/[0-9]/,'X');
   assert.notEqual(mutated,project(spoken),'WRONG_DIGIT_MUST_FAIL');
  }
 }
}
assert.ok(changed>=25,'INSUFFICIENT_FULL_COVERAGE');
assert.equal(project('三百六十九萬七千九百七十五股'),'3,697,975股');
assert.equal(project('四萬一千二百八十三股'),'41,283股');
console.log('FULL_SCRIPT_CAPTION_PROJECTION_RESEARCH_PASS sentences='+checked+' numeric_phrase_hits='+changed+' no_render=true');
