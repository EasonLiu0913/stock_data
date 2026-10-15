'use strict';
const assert=require('node:assert/strict');
// Dated, reviewed editorial projection. Never guess arbitrary Chinese numerals.
const phrases=[
['四萬九千三百一十三點四四','49,313.44'],['四百九十二點九三','492.93'],['零點九九','0.99'],
['四百二十五','425'],['五百四十','540'],['一百零九','109'],['十四家','14家'],['兩家','2家'],
['九千二百四十五','9,245'],['一兆零七十二','1兆72'],['七百五十九','759'],['三十億元','30億元'],['一百八十七','187'],
['五百五十五','555'],['五百零五','505'],['九點九','9.9'],['二百五十一','251'],['二十張','20張'],['二十一張','21張'],
['六十四點七','64.7'],['五十八點九','58.9'],['九點八五','9.85'],['三百六十九萬七千九百七十五','3,697,975'],
['五千股','5,000股'],['四萬一千二百八十三','41,283'],['八十一點三','81.3'],['七十五點四','75.4'],
['七點八二','7.82'],['一萬四千二百二十五','14,225'],['一萬三千九百四十','13,940'],
['三項','3項'],['第四季','第4季'],['第一，','第1，'],['第二，','第2，'],['第三，','第3，']
];
const sorted=[...phrases].sort((a,b)=>b[0].length-a[0].length);
function project(sentence){
 assert.equal(typeof sentence,'string','SPOKEN_TYPE');
 let result=sentence;
 const tokens=[];
 for(const [word,number] of sorted){
  // Protect replacements from subsequent phrase matches.
  result=result.split(word).joinWithPlaceholder;
  if(result===undefined)throw Error('INTERNAL');
 }
 return result;
}
module.exports={phrases};
