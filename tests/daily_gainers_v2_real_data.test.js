'use strict';
// Production-data contract test, deliberately no TTS or YouTube side effects.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildVariants}=require('../scripts/daily_gainers_text_variants');
const root=path.resolve(__dirname,'..');
const raw=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/20261008.json'),'utf8'));
const legacy=JSON.parse(fs.readFileSync(path.join(root,'video_scripts/daily-gainers/20261008.json'),'utf8'));
const rules=JSON.parse(fs.readFileSync(path.join(root,'video_scripts/daily-gainers/rules/text-presentation.v1.json'),'utf8'));
assert.equal(raw.stock_count,35);
assert.equal(legacy.target_date,raw.target_date);
for(const code of ['9103','6672','2305','1301']){
  const row=raw.stocks.find(s=>String(s.code)===code);
  assert.ok(row?.name,'missing genuine 20261008 code-to-name mapping '+code);
  const doc={schema_version:2,target_date:'20261008',scenes:[{cues:[[
    {type:'date',value:'2026-10-08'},{type:'text',value:'，'},
    {type:'stock',code},{type:'text',value:'上漲'},
    {type:'percent',value:'9.87'},{type:'text',value:'，成交'},
    {type:'number',value:'12500'},{type:'text',value:'張。'}
  ]]}]};
  const out=buildVariants(doc,raw,rules);
  assert.ok(out.display[0].text.includes(row.name+'（'+code+'）'));
  assert.ok(out.captions[0].text.includes('10/8，'+row.name+'上漲9.87%，成交12,500張。'));
  assert.ok(out.speech[0].text.includes('十月八日，'+row.name+'上漲百分之九點八七，成交一萬二千五百張。'));
  assert.deepEqual(out.cue_pairs[0].caption_cues.map(x=>x.caption).join(''),out.captions[0].text);
  assert.deepEqual(out.cue_pairs[0].caption_cues.map(x=>x.speech).join(''),out.speech[0].text);
}
console.log('20261008 verified stock identity and three variants fixture PASS; synthetic numeric example, not a full production script');
