'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {preview}=require('../scripts/build_daily_gainers_v2_preview');
const {OPENING_LINES, OPENING_TEXT}=require('../scripts/daily_gainers_brand_opening');
const root=path.resolve(__dirname,'..');
const base='video_scripts/daily-gainers';
const master=JSON.parse(fs.readFileSync(path.join(root,base,'v2/20261008/master.json'),'utf8'));
const raw=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/20261008.json'),'utf8'));
const names=new Map(raw.stocks.map(s=>[String(s.code),s.name]));
assert.equal(master.scenes.length,9);
assert.equal(master.target_date,raw.target_date);
for(let i=0;i<9;i++){
 const cues=master.scenes[i].cues;
 assert.ok(cues.length>=3,'missing cue chunks: scene '+(i+1));
 const flattened=cues.flat();
 const rebuilt=flattened.map(t=>{
   if(t.type==='text') return t.value;
   if(t.type==='numeric_phrase') return t.speech;
   if(t.type==='stock') return names.get(String(t.code));
   if(t.type==='month') return t.value===10?'十月':'九月';
   if(t.type==='date'){
     const [,m,day]=t.value.match(/^2026-(\d\d)-(\d\d)$/)||[];
     if(!m) throw new Error('bad date');
     return (m==='10'?'十':'九')+'月'+(day==='07'?'七':'八')+'日';
   }
   throw new Error('Unexpected source token '+t.type);
 }).join('');
 assert.ok(rebuilt.length>0,'empty semantic scene '+(i+1));
 assert.ok(!rebuilt.includes('歡迎來到 TAIWANSTOCK。'),'legacy opening forbidden');
}
const out=preview('20261008',root);
assert.equal(out.plan.scene_count,9);
assert.ok(out.plan.scenes.every((scene,i)=>scene.speech_text===master.scenes[i].cues.map(cue=>cue.map(t=>t.type==='text'?t.value:t.type==='numeric_phrase'?t.speech:t.type==='stock'?names.get(String(t.code)):t.type==='month'?(t.value===10?'十月':'九月'):(t.value==='2026-10-08'?'十月八日':'十月七日')).join('')).join('')),'Master must be the sole semantic speech source');
assert.deepEqual(out.plan.scenes[0].caption_cues.slice(0,3).map(c=>c.caption), OPENING_LINES);
assert.deepEqual(out.plan.scenes[0].caption_cues.slice(0,3).map(c=>c.speech), OPENING_LINES);
assert.equal(out.plan.scenes[0].speech_text.split(OPENING_TEXT).length-1,1);
assert.ok(!out.plan.scenes[0].speech_text.includes('歡迎來到 TAIWANSTOCK。'));
assert.ok(out.plan.scenes.every(s=>s.caption_cues.map(x=>x.caption).join('')===s.caption_text));
assert.ok(out.plan.scenes.every(s=>s.caption_cues.map(x=>x.speech).join('')===s.speech_text));
assert.ok(out.plan.scenes[2].speech_text.includes('美德醫療-DR'));
assert.ok(out.plan.scenes[2].stock_labels.includes('美德醫療-DR（9103）'));
assert.equal(out.plan.scenes[2].title,'美德醫療-DR（9103）與防疫概念');
assert.ok(out.plan.scenes[3].speech_text.includes('騰輝電子-KY'));
assert.ok(out.plan.scenes[4].speech_text.includes('全友'));
assert.ok(out.plan.scenes[8].caption_text.includes('零星個股'));
assert.ok(!out.plan.scenes[8].caption_text.includes('0星個股'));
assert.ok(out.plan.scenes[8].speech_text.includes('零星個股'));
assert.ok(out.plan.scenes[2].caption_text.includes('缺值當作0'));

console.log('20261008 full nine-scene typed Master + preview contract PASS; NO MP3/MP4 or upload');
