'use strict';
const assert=require('node:assert/strict');
const cases=[
['四萬九千三百一十三點四四','49,313.44'],
['四百九十二點九三','492.93'],
['三百六十九萬七千九百七十五','3,697,975'],
['四萬一千二百八十三','41,283'],
['一萬四千二百二十五','14,225'],
['一萬三千九百四十','13,940']
];
function verifyProjection(spoken,caption){
 assert.equal(typeof spoken,'string');
 assert.equal(typeof caption,'string');
 for(const [word,digits] of cases){
  if(spoken.includes(word))assert.ok(caption.includes(digits),'CAPTION_NUMBER_DRIFT:'+word);
  if(spoken.includes(word))assert.ok(!caption.includes(word),'CAPTION_NOT_PROJECTED:'+word);
 }
 return true;
}
module.exports={verifyProjection,cases};
