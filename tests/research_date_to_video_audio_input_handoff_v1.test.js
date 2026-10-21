'use strict';const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {run}=require('../scripts/research_date_to_video_d4_orchestrator');const {derive,persist}=require('../scripts/research_date_to_video_audio_input_handoff_v1');const cp=require('node:child_process');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'audio-handoff-'));try{run('.','20261008',dir);let result=derive(dir,null);assert.equal(result.status,'BLOCKED');assert.equal(result.inventory.sentences.length,0);assert.equal(result.command_plan.commands.length,0);assert.equal(result.commands_executed,false);assert.equal(result.render_authorized,false);assert.equal(result.publication_authorized,false);const worksheet=path.join(dir,'editorial-narration-worksheet.json');const obj=JSON.parse(fs.readFileSync(worksheet,'utf8'));obj.tamper='STALE';fs.writeFileSync(worksheet,JSON.stringify(obj));result=derive(dir,null);assert.ok(result.inventory.issues.includes('WORKSHEET_ARTIFACT_STALE'));assert.equal(result.command_plan.commands.length,0);console.log('D4_AUDIO_HANDOFF_STALE_WORKSHEET_FAIL_CLOSED_PASS');const cli=cp.spawnSync(process.execPath,['scripts/research_date_to_video_audio_input_handoff_v1.js',dir,path.join(dir,'missing-candidate.json')],{encoding:'utf8'});assert.notEqual(cli.status,0);assert.equal(fs.existsSync(path.join(dir,'sentence-audio-inventory.json')),false);assert.equal(fs.existsSync(path.join(dir,'edge-tts-command-plan.json')),false);console.log('D4_AUDIO_HANDOFF_NO_PARTIAL_OUTPUT_PASS');}finally{fs.rmSync(dir,{recursive:true,force:true});}

const crypto=require('node:crypto'),{plan}=require('../scripts/research_date_to_video_edge_tts_plan_v1'),{FIXED_OPENING_LINES}=require('../scripts/research_date_to_video_fixed_opening_v1');
const outputDir=fs.mkdtempSync(path.join(os.tmpdir(),'audio-output-rollback-'));try{
 const candidate={target_date:'20261008',sentences:[...FIXED_OPENING_LINES,'這是研究句子。'].map((narration,i)=>({id:'S'+(i+1),narration,subtitle:narration}))},candidateSha=crypto.createHash('sha256').update(JSON.stringify(candidate)).digest('hex');
 const sentences=[...FIXED_OPENING_LINES,'這是研究句子。'].map((spoken_text,i)=>({id:'S'+(i+1),order:i+1,spoken_text,caption_text:spoken_text,spoken_subtitle_mappings:[]}));
 const inventory={contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_INPUT_INVENTORY',status:'CANDIDATE_INVENTORY_PENDING_INDEPENDENT_EDITORIAL_REVIEW',target_date:'20261008',candidate_sha256:candidateSha,voice:'zh-TW-YunJheNeural',rate:'+15%',sentences,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
 const ready={status:'PLAN_ONLY_INDEPENDENT_EDITORIAL_APPROVAL_REQUIRED',candidate,inventory,command_plan:plan(inventory)};
 assert.throws(()=>persist(outputDir,{...ready,command_plan:{...ready.command_plan,target_date:'20261013'}}),/AUDIO_HANDOFF_NOT_READY/);
 assert.throws(()=>persist(outputDir,{...ready,command_plan:{...ready.command_plan,candidate_sha256:'f'.repeat(64)}}),/AUDIO_HANDOFF_NOT_READY/);
 const otherDate={...candidate,target_date:'20261013'};
 const otherHash=crypto.createHash('sha256').update(JSON.stringify(otherDate)).digest('hex');
 assert.throws(()=>persist(outputDir,{...ready,candidate:otherDate,inventory:{...inventory,candidate_sha256:otherHash}}),/AUDIO_HANDOFF_NOT_READY/);
 assert.throws(()=>persist(outputDir,{...ready,inventory:{...inventory,sentences:inventory.sentences.map((s,i)=>i===4?{...s,spoken_text:'遭替換的講稿'}:s)},command_plan:plan({...inventory,sentences:inventory.sentences.map((s,i)=>i===4?{...s,spoken_text:'遭替換的講稿'}:s)})}),/AUDIO_HANDOFF_SENTENCE_MISMATCH/);
 let writes=0;assert.throws(()=>persist(outputDir,ready,(file,body,options)=>{writes++;if(writes===2)throw Error('SIMULATED_SECOND_WRITE_FAILURE');fs.writeFileSync(file,body,options)}),/SIMULATED_SECOND_WRITE_FAILURE/);
 for(const name of ['narration-candidate.json','sentence-audio-inventory.json','edge-tts-command-plan.json'])assert.equal(fs.existsSync(path.join(outputDir,name)),false);
 fs.writeFileSync(path.join(outputDir,'sentence-audio-inventory.json'),'USER_INPUT');
 assert.throws(()=>persist(outputDir,ready),/AUDIO_HANDOFF_OUTPUT_EXISTS/);
 assert.equal(fs.readFileSync(path.join(outputDir,'sentence-audio-inventory.json'),'utf8'),'USER_INPUT');
 fs.unlinkSync(path.join(outputDir,'sentence-audio-inventory.json'));
 const artifacts=persist(outputDir,ready);assert.deepEqual(artifacts,['narration-candidate.json','sentence-audio-inventory.json','edge-tts-command-plan.json']);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir,'narration-candidate.json'),'utf8')),candidate);
 assert.throws(()=>persist(outputDir,{...ready,candidate:{tampered:true}}),/AUDIO_HANDOFF_NOT_READY/);
 console.log('D4_AUDIO_HANDOFF_CANDIDATE_SHA_ROLLBACK_AND_NO_OVERWRITE_PASS');
}finally{fs.rmSync(outputDir,{recursive:true,force:true});}
