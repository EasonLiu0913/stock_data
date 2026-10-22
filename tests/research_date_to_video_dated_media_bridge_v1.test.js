'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {plan}=require('../scripts/research_date_to_video_edge_tts_plan_v1');
const {FIXED_OPENING_LINES}=require('../scripts/research_date_to_video_fixed_opening_v1');
const {wrap,clock,build}=require('../scripts/research_date_to_video_dated_media_bridge_v1');
test('dated media bridge caption formatting preserves characters and 30-char limit',()=>{
 assert.equal(wrap('今天上漲，明天觀察。'),'今天上漲，明天觀察。');
 assert.equal(wrap('甲'.repeat(31)),'甲'.repeat(30)+'\n甲');
 assert.equal(wrap('甲'.repeat(30)+'，乙'),'甲'.repeat(30)+'\n，乙');
 assert.throws(()=>wrap('甲\n乙'),/INVALID_CAPTION/);
 assert.equal(clock(3661.234),'01:01:01,234');
});
test('dated media bridge rejects missing inventory, proof, and audio without granting authority',()=>{
 const result=build(null,null,null,'/nonexistent');
 assert.equal(result.status,'REJECTED');
 assert.equal(result.render_authorized,false);
 assert.equal(result.publication_authorized,false);
 assert.ok(result.issues.length>0);
});

test('synthetic date-scoped audio proof produces aligned SRT without granting approval',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dated-bridge-fixture-'));
 try{
  const candidate_sha256='b'.repeat(64),lines=[...FIXED_OPENING_LINES,'十月十三日上漲五％。'],captions=[...FIXED_OPENING_LINES,'10/13上漲5%。'];
  const inventory={contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_INPUT_INVENTORY',target_date:'20261013',candidate_sha256,voice:'zh-TW-YunJheNeural',rate:'+15%',status:'CANDIDATE_INVENTORY_PENDING_INDEPENDENT_EDITORIAL_REVIEW',audio_generated:false,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false,sentences:lines.map((spoken_text,i)=>({id:'sentence-'+i,order:i+1,spoken_text,caption_text:captions[i]}))};
  const commandPlan=plan(inventory);assert.equal(commandPlan.commands.length,5);
  const sentences=inventory.sentences.map((s,i)=>{const audio_file=commandPlan.commands[i].output_file,bytes=Buffer.from('synthetic-test-mp3-'+i);fs.writeFileSync(path.join(dir,audio_file),bytes);return {...s,audio_file,duration_seconds:1.25,audio_sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
  const proof={contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_PROOF',target_date:'20261013',candidate_sha256,voice:inventory.voice,rate:inventory.rate,sentences};
  const probe=()=>({status:0,stdout:JSON.stringify({streams:[{codec_name:'mp3'}],format:{duration:'1.25'}})});
  const result=build(inventory,commandPlan,proof,dir,probe);
  assert.equal(result.status,'PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED');
  assert.equal(result.sentences.length,5);assert.equal(result.total_seconds,6.25);
  assert.ok(result.srt.includes('00:00:05,000 --> 00:00:06,250\\n10/13上漲5%。'));
  assert.equal(result.render_authorized,false);assert.equal(result.editorial_certified,false);
  const altered={...proof,sentences:proof.sentences.map((item,i)=>i===4?{...item,caption_text:'10/13上漲6%。'}:item)};
  assert.equal(build(inventory,commandPlan,altered,dir,probe).status,'REJECTED');
  const wrongDate={...proof,target_date:'20261008'};
  assert.equal(build(inventory,commandPlan,wrongDate,dir,probe).status,'REJECTED');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
