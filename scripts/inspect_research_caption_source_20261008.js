'use strict';
const assert=require('node:assert/strict');
const {verifySequence}=require('./research_caption_sentence_parity_20261008');
const numeral=/[零〇一二兩三四五六七八九十百千萬億兆]/u;
function segmentCaption(sentence,max=30){
 assert.equal(typeof sentence,'string','CAPTION_TYPE');
 assert.ok(Number.isInteger(max)&&max>0,'CAPTION_MAX');
 const chunks=sentence.match(/[^。！？；，、]+[。！？；，、]?/gu)||[];
 const out=[];let line='';
 for(const chunk of chunks){
  if(chunk.length>max)throw Error('CAPTION_CLAUSE_TOO_LONG');
  if(line && line.length+chunk.length>max){out.push(line);line='';}
  line+=chunk;
 }
 if(line)out.push(line);
 assert.equal(out.join(''),sentence,'CAPTION_SEGMENT_DRIFT');
 assert.ok(out.every(s=>s.length<=max),'CAPTION_WIDTH');
 return out;
}
function inspectCaptionSource(source){
 assert.equal(source.status,'RESEARCH_CAPTION_SOURCE_NOT_SRT','STATUS');
 assert.equal(source.render_authorized,false,'RENDER');
 assert.equal(source.publication_authorized,false,'PUBLICATION');
 let count=0;
 for(const part of source.parts){
  verifySequence(part.spoken_sentences,part.caption_sentences);
  for(const caption of part.caption_sentences){
   const remainder=caption.replace(/下一交易日/g,'');
   assert.ok(!numeral.test(remainder),'UNMAPPED_CHINESE_NUMERAL');
   segmentCaption(caption);count++;
  }
 }
 return count;
}
module.exports={segmentCaption,inspectCaptionSource};
