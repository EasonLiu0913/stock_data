'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildVariants}=require('../scripts/daily_gainers_text_variants');
const {OPENING_LINES,OPENING_TEXT}=require('../scripts/daily_gainers_brand_opening');
const raw={target_date:'20261013',stocks:[{code:'2330',name:'台積電'}]};
const rules={version:'daily-gainers-text-presentation-v1'};
function actualShaped(){
 return {schema_version:2,target_date:'20261013',scenes:[{cues:[
  [{type:'text',value:OPENING_LINES[0]}],
  [{type:'text',value:OPENING_LINES[1]+OPENING_LINES[2]}],
  [{type:'text',value:OPENING_LINES[3]}],
  [{type:'text',value:'今天成交金額約'},{type:'numeric_phrase',speech:'一兆二千零一十八億',caption:'1.2018兆'},{type:'text',value:'元。'}]
 ]}]};
}
test('realistic 3-cue V4 exact intro preserves speech/caption one source',()=>{
 const r=buildVariants(actualShaped(),raw,rules);
 assert.ok(r.speech[0].text.startsWith(OPENING_TEXT));
 assert.ok(r.captions[0].text.startsWith(OPENING_TEXT));
 assert.match(r.captions[0].text,/1\.2018兆元/);
 assert.match(r.speech[0].text,/一兆二千零一十八億元/);
 assert.equal(r.cue_pairs[0].caption_cues.length,4);
 assert.equal(r.cue_pairs[0].caption_cues.map(x=>x.speech).join(''),r.speech[0].text);
 assert.equal(r.cue_pairs[0].caption_cues.map(x=>x.caption).join(''),r.captions[0].text);
});
test('partial or altered V4 fourth sentence still rejected',()=>{
 const bad=actualShaped();bad.scenes[0].cues[2][0].value='那麼我們現在開始囉。';
 assert.throws(()=>buildVariants(bad,raw,rules),/conflicts/);
});
test('no competing subtitle content allowed for numeric_phrase',()=>{
 const bad=actualShaped();bad.scenes[0].cues[3][1].caption='1.2018 trillion';
 assert.throws(()=>buildVariants(bad,raw,rules),/Invalid explicit numeric phrase/);
});
