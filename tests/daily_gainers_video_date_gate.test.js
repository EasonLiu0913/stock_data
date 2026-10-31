#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {OPENING_LINES, OPENING_TEXT, addOpening, assertOpening} = require('../scripts/daily_gainers_brand_opening');
assert.equal(OPENING_LINES.length,4,'MVP10 must preserve four approved V4 opening lines');
assert.equal(OPENING_LINES[3],'那麼我們開始囉。');
const oldThree=OPENING_LINES.slice(0,3).join('');
const upgraded=addOpening(oldThree+'今天是十月八日。');
assert.equal(upgraded,OPENING_TEXT+'今天是十月八日。');
assertOpening(upgraded);
assert.equal(addOpening(upgraded),upgraded,'V4 opening must be idempotent');
assert.throws(()=>addOpening('大家好，歡迎來到別的頻道。'),/conflicts/);
assert.throws(()=>addOpening('歡迎打開 CC 中文字幕觀賞'),/Obsolete CC/);
assert.throws(()=>assertOpening(OPENING_TEXT+'歡迎打開 CC 中文字幕觀賞'),/Obsolete CC/);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'video-date-gate-'));
const date='20261008';
const validator=path.resolve(__dirname,'../scripts/validate_daily_gainers_video_script.js');
const put=(name,value)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(value));};
const stocks=[{code:'9103',name:'南染'}];
const scenes=Array.from({length:5},(_,i)=>({title:'標題'+i,subtitle:'說明',bullets:['重點'],narration:'這是針對當日資料撰寫的旁白與分析內容，確認股票與日期都符合要求。'.repeat(8),stock_codes:['9103']}));
const script={schema_version:1,methodology_version:'chatgpt-video-script-v1',target_date:date,source_summary_generated_at:'2026-10-08T14:07:26.264Z',stock_count:1,privacy_status:'private',scenes};
put('data_daily_gain_over_5/'+date+'.json',{target_date:date,stock_count:1,stocks});
put('data_daily_gain_over_5/analysis-ai/'+date+'.json',{target_date:date,stock_count:1});
put('data_daily_gain_over_5/market-summary/'+date+'.json',{target_date:date,generated_at:'2026-10-09T01:56:25.509Z',status:'final',coverage:{overall:'complete'}});
put('video_scripts/daily-gainers/'+date+'.json',script);
function run(){return spawnSync(process.execPath,[validator,date],{cwd:root,encoding:'utf8'});}
try {
  const ok=run();
  assert.equal(ok.status,0,ok.stderr);
  script.target_date='20261009';
  put('video_scripts/daily-gainers/'+date+'.json',script);
  const bad=run();
  assert.notEqual(bad.status,0,'wrong-date script must be rejected');
  assert.match(bad.stderr,/date mismatch/);
  console.log('PASS: historical timestamp drift accepted; wrong date rejected');
} finally {fs.rmSync(root,{recursive:true,force:true});}
