'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {visible,convert}=require('../scripts/research_mvp10_20261013_caption_display');
test('speech-style percentages become Arabic display percentages without touching other numbers',()=>{
 assert.equal(visible('國喬漲幅百分之9.97，外資買超18915張。'),'國喬漲幅9.97%，外資買超18915張。');
 assert.equal(visible('負百分之1.95；百分之10。'),'-1.95%；10%。');
 assert.equal(visible('量比1.82倍，代號6834。'),'量比1.82倍，代號6834。');
});
test('SRT display conversion preserves timestamps and cue count with research-only source',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-caption-'));
 try{
  fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify({
   target_date:'20261013',scene_count:7,research_only:true,
   publication_authorized:false,source_final_approved:false,render_preview_only:true
  }));
  const cues=Array.from({length:7},(_,i)=>({cue:i+1,text:i===0?'漲幅百分之9.97。':'觀察代號6834，第'+(i+1)+'項。'}));
  const blocks=cues.map((c,i)=>String(i+1)+'\n00:00:'+String(i).padStart(2,'0')+',000 --> 00:00:'+String(i).padStart(2,'0')+',900\n'+c.text).join('\n\n')+'\n';
  fs.writeFileSync(path.join(dir,'daily-gainers-20261013.zh-TW.srt'),blocks);
  fs.writeFileSync(path.join(dir,'subtitle-manifest.json'),JSON.stringify({target_date:'20261013',language:'zh-TW',cues}));
  const result=convert(dir);
  assert.equal(result.percent_cues_changed,1);
  assert.equal(result.timings_preserved,true);
  const next=fs.readFileSync(path.join(dir,'daily-gainers-20261013.zh-TW.srt'),'utf8');
  assert.ok(next.includes('漲幅9.97%。'));
  const rx=/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/g;
  assert.deepEqual([...next.matchAll(rx)].map(x=>x[0]),[...blocks.matchAll(rx)].map(x=>x[0]));
  assert.throws(()=>convert(dir),/SRT_MANIFEST_OLD_TEXT_MISMATCH|SRT_DISPLAY_PERCENTAGES_NOT_CONVERTED/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('final-approved plan never enters research caption conversion',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-caption-gate-'));
 try{
  fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify({
   target_date:'20261013',scene_count:7,research_only:false,
   publication_authorized:true,source_final_approved:true,render_preview_only:false
  }));
  assert.throws(()=>convert(dir),/PREVIEW_SUBTITLE_SOURCE_GATE/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
