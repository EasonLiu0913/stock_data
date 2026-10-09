'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {preview}=require('../scripts/build_daily_gainers_v2_preview');
const root=path.resolve(__dirname,'..');
const base='video_scripts/daily-gainers';
const master=JSON.parse(fs.readFileSync(path.join(root,base,'v2/20261008/master.json'),'utf8'));
const legacy=JSON.parse(fs.readFileSync(path.join(root,base,'20261008.json'),'utf8'));
const raw=JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5/20261008.json'),'utf8'));
const names=new Map(raw.stocks.map(s=>[String(s.code),s.name]));
assert.equal(master.scenes.length,9);
assert.equal(master.target_date,legacy.target_date);
const d='零一二三四五六七八九';
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
 let expected=legacy.scenes[i].narration;
 if(i===5)expected=expected.replace('台塑，代號一三零一','台塑');
 expected=expected.replace(/代號([零一二三四五六七八九]{4})/g,(whole,spoken)=>{
   const code=[...spoken].map(ch=>String(d.indexOf(ch))).join('');
   return names.get(code)||whole;
 });
 assert.equal(rebuilt,expected,'semantic omission, duplication or drift in scene '+(i+1));
}
const out=preview('20261008',root);
assert.equal(out.plan.scene_count,9);
assert.ok(out.plan.scenes.every(s=>s.caption_cues.map(x=>x.caption).join('')===s.caption_text));
assert.ok(out.plan.scenes.every(s=>s.caption_cues.map(x=>x.speech).join('')===s.speech_text));
assert.ok(out.plan.scenes[2].speech_text.includes('美德醫療-DR'));
assert.ok(out.plan.scenes[2].stock_labels.includes('美德醫療-DR（9103）'));
assert.equal(out.plan.scenes[2].title,'美德醫療-DR（9103）與防疫概念');
assert.ok(out.plan.scenes[3].speech_text.includes('騰輝電子-KY'));
assert.ok(out.plan.scenes[4].speech_text.includes('全友'));
console.log('20261008 full nine-scene typed Master + preview contract PASS; NO MP3/MP4 or upload');
