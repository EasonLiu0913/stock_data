'use strict';
const assert = require('node:assert/strict');
const {integerSpoken,decimalSpoken,buildVariants} = require('../scripts/daily_gainers_text_variants');
const {OPENING_LINES,OPENING_TEXT} = require('../scripts/daily_gainers_brand_opening');
assert.equal(integerSpoken(12500),'一萬二千五百');
assert.equal(integerSpoken(2026),'二千零二十六');
assert.equal(decimalSpoken('9.87'),'九點八七');
const raw={target_date:'20261009',stocks:[{code:'2330',name:'台積電'}]};
const doc={schema_version:2,target_date:'20261009',scenes:[{cues:[[
  {type:'date',value:'2026-10-09'},{type:'text',value:'，'},
  {type:'stock',code:'2330'},{type:'text',value:'收盤上漲'},
  {type:'percent',value:'3.25'},{type:'text',value:'，外資買超'},
  {type:'number',value:'12500'},{type:'text',value:'張。'}]]}]};
const rules={version:'daily-gainers-text-presentation-v1'};
const r=buildVariants(doc,raw,rules);
const expectedCaption='10/9，台積電收盤上漲3.25%，外資買超12,500張。';
const expectedSpeech='十月九日，台積電收盤上漲百分之三點二五，外資買超一萬二千五百張。';
assert.deepEqual(OPENING_LINES,['大家好，歡迎來到 TAIWAN STOCK！','追蹤資金，解讀行情。','錢在哪，我們就在哪！']);
assert.equal(r.captions[0].text,OPENING_TEXT+expectedCaption);
assert.equal(r.speech[0].text,OPENING_TEXT+expectedSpeech);
assert.equal(r.captions[0].text.split(OPENING_TEXT).length,2,'Brand opening must appear exactly once');
assert.deepEqual(r.cue_pairs[0].caption_cues.slice(0,3).map(x=>x.caption),OPENING_LINES);
assert.deepEqual(r.cue_pairs[0].caption_cues.slice(0,3).map(x=>x.speech),OPENING_LINES);
assert.equal(r.cue_pairs[0].caption_cues[3].caption,expectedCaption);
assert.equal(r.cue_pairs[0].caption_cues[3].speech,expectedSpeech);
assert.ok(r.display[0].text.includes('台積電（2330）'));
assert.equal(r.manifest.scene_count,1);
assert.equal(r.cue_pairs[0].caption_cues[0].caption,r.captions[0].text);
assert.equal(r.cue_pairs[0].caption_cues[0].speech,r.speech[0].text);
assert.throws(()=>buildVariants({...doc,scenes:[{cues:[[{type:'text',value:'股票漲10%'}]]}]},raw,rules),/Ambiguous numbers/);
assert.throws(()=>buildVariants(doc,{...raw,stocks:[]},rules),/not in verified/);
assert.throws(()=>buildVariants({...doc,target_date:'20261008'},raw,rules),/Date mismatch/);
assert.throws(()=>buildVariants({...doc,scenes:[{cues:[[{type:'numeric_phrase',caption:'0',speech:'零'},{type:'text',value:'星個股'}]]}]},raw,rules),/Lexical zero/);
console.log('daily gainers text variants v2 tests PASS');
