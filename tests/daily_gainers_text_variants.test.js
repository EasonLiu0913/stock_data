'use strict';
const assert = require('node:assert/strict');
const {integerSpoken,decimalSpoken,buildVariants} = require('../scripts/daily_gainers_text_variants');
const {OPENING_TEXT} = require('../scripts/daily_gainers_brand_opening');
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
assert.equal(r.captions[0].text,OPENING_TEXT+'10/9，台積電收盤上漲3.25%，外資買超12,500張。');
assert.equal(r.speech[0].text,OPENING_TEXT+'十月九日，台積電收盤上漲百分之3.25，外資買超一萬二千五百張。');
assert.ok(r.display[0].text.includes('台積電（2330）'));
assert.equal(r.manifest.scene_count,1);
assert.equal(r.cue_pairs[0].caption_cues.map(x=>x.caption).join(''),r.captions[0].text);
assert.equal(r.cue_pairs[0].caption_cues.map(x=>x.speech).join(''),r.speech[0].text);
assert.throws(()=>buildVariants({...doc,scenes:[{cues:[[{type:'text',value:'股票漲10%'}]]}]},raw,rules),/Ambiguous numbers/);
assert.throws(()=>buildVariants(doc,{...raw,stocks:[]},rules),/not in verified/);
assert.throws(()=>buildVariants({...doc,target_date:'20261008'},raw,rules),/Date mismatch/);
assert.throws(()=>buildVariants({...doc,scenes:[{cues:[[{type:'numeric_phrase',caption:'0',speech:'零'},{type:'text',value:'星個股'}]]}]},raw,rules),/Lexical zero/);
// Owner-approved exact regression: no English, no '%' in spoken TTS, caption is Arabic.
const exactPercentDoc={schema_version:2,target_date:'20261009',scenes:[{cues:[[
  {type:'text',value:'跌幅'},{type:'percent',value:'1.95'}
]]}]};
const exactPercent=buildVariants(exactPercentDoc,raw,rules);
assert.ok(exactPercent.speech[0].text.endsWith('跌幅百分之1.95'));
assert.ok(exactPercent.captions[0].text.endsWith('跌幅1.95%'));
assert.ok(!/percent|百分號|[%％]/i.test(exactPercent.speech[0].text));
assert.equal(exactPercent.cue_pairs[0].caption_cues.at(-1).speech,'跌幅百分之1.95');
assert.equal(exactPercent.cue_pairs[0].caption_cues.at(-1).caption,'跌幅1.95%');

console.log('daily gainers text variants v2 tests PASS');
