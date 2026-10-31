'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {prepare}=require('../scripts/research_mvp10_prepare_dual_track');
const {OPENING_TEXT}=require('../scripts/daily_gainers_brand_opening');
const DATE='20261013';
function fixture(tweak){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-dual-track-'));
 const write=(file,doc)=>{
  const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(doc));
 };
 const raw={target_date:DATE,stock_count:1,stocks:[{code:'2330',name:'台積電'}]};
 const master={schema_version:2,target_date:DATE,scenes:[{cues:[
  [{type:'date',value:'2026-10-13'},{type:'text',value:'，台積電上漲'},{type:'percent',value:'5.62'},{type:'text',value:'。'}],
  [{type:'stock_code',code:'2330'},{type:'text',value:'收在'},{type:'number',value:'1820'},{type:'text',value:'元，成交'},{type:'number',value:'3698'},{type:'text',value:'張。'}]
 ]},{cues:[[{type:'text',value:'市場維持審慎觀察。'}]]}]};
 const visual={target_date:DATE,stock_count:1,scenes:[{title:'大盤 Dashboard',subtitle:'今日市場',bullets:['上漲與下跌'],footer:'TAIWANSTOCK｜每日5%強勢股研究',stock_codes:['2330']},{title:'籌碼',subtitle:'風險',bullets:[],footer:'TAIWANSTOCK｜每日5%強勢股研究',stock_codes:[]}]};
 const rules={version:'daily-gainers-text-presentation-v1'};
 if(tweak)tweak({raw,master,visual,rules});
 write('data_daily_gain_over_5/'+DATE+'.json',raw);
 write('video_scripts/daily-gainers/'+DATE+'.json',visual);
 write('video_scripts/daily-gainers/v2/'+DATE+'/master.json',master);
 write('video_scripts/daily-gainers/rules/text-presentation.v1.json',rules);
 return root;
}
test('real v2 builder emits paired oral Chinese numerals and display Arabic numerals',()=>{
 const root=fixture();
 try{
  const result=prepare(DATE,root),plan=JSON.parse(fs.readFileSync(result.plan_path,'utf8'));
  assert.equal(plan.scene_count,2);
  assert.ok(plan.scenes[0].speech_text.startsWith(OPENING_TEXT));
  assert.ok(plan.scenes[0].caption_text.startsWith(OPENING_TEXT));
  assert.match(plan.scenes[0].speech_text,/十月十三日/);
  assert.match(plan.scenes[0].speech_text,/百分之五點六二/);
  assert.match(plan.scenes[0].speech_text,/二三三零/);
  assert.match(plan.scenes[0].speech_text,/三千六百九十八/);
  assert.match(plan.scenes[0].caption_text,/10\/13/);
  assert.match(plan.scenes[0].caption_text,/5\.62%/);
  assert.match(plan.scenes[0].caption_text,/2330/);
  assert.match(plan.scenes[0].caption_text,/3,698/);
  assert.ok(!plan.scenes[0].caption_text.includes('百分之五點六二'));
  assert.equal(result.receipt.tts_text_source,'scene.speech_text');
  assert.equal(result.receipt.srt_display_source,'scene.caption_cues[].caption');
  assert.equal(result.receipt.burned_in_zh_tw_captions_primary,true);
  assert.equal(result.receipt.publication_authorized,false);
  assert.ok(plan.scenes.every(scene=>scene.caption_cues.map(x=>x.caption).join('')===scene.caption_text));
  assert.ok(plan.scenes.every(scene=>scene.caption_cues.map(x=>x.speech).join('')===scene.speech_text));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('missing current-date v2 Master fails rather than using legacy narration/SRT',()=>{
 const root=fixture();try{
  fs.rmSync(path.join(root,'video_scripts/daily-gainers/v2'),{recursive:true});
  assert.throws(()=>prepare(DATE,root),/MVP10_V2_MASTER_MISSING_FOR_DATE_20261013/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('wrong trading date cannot mix raw and semantic Master',()=>{
 const root=fixture(({master})=>master.target_date='20261008');
 try{assert.throws(()=>prepare(DATE,root),/Visual\/master date mismatch/);}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('obsolete CC in a later visual footer fails',()=>{
 const root=fixture(({visual})=>visual.scenes[1].footer='歡迎打開 CC 中文字幕觀賞');
 try{assert.throws(()=>prepare(DATE,root),/Obsolete CC/);}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('numeric semantics in free prose are rejected instead of guessing',()=>{
 const root=fixture(({master})=>master.scenes[0].cues[0][1].value='，台積電上漲5.62%');
 try{assert.throws(()=>prepare(DATE,root),/Ambiguous numbers/);}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
