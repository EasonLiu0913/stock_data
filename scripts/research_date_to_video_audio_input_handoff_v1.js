'use strict';
// Derive date-scoped non-executing audio inputs from an independently supplied candidate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const {inspectDirectory}=require('./research_date_to_video_narration_candidate_review_v1');
const {build}=require('./research_date_to_video_dated_media_input_v1');
const {prepare}=require('./research_date_to_video_sentence_audio_inventory_v1');
const {plan}=require('./research_date_to_video_edge_tts_plan_v1');
function derive(dir,candidate){
 const review=inspectDirectory(dir,candidate);
 const worksheet=JSON.parse(fs.readFileSync(path.join(dir,'editorial-narration-worksheet.json'),'utf8'));
 const inventory=prepare(worksheet,build(dir),candidate);
 if(review.status!=='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED'){
  inventory.status='BLOCKED';inventory.sentences=[];inventory.issues=[...new Set([...inventory.issues,...review.issues])];inventory.review_status=review.status;
 }
 const commandPlan=plan(inventory);
 return {status:commandPlan.status==='REJECTED'?'BLOCKED':'PLAN_ONLY_INDEPENDENT_EDITORIAL_APPROVAL_REQUIRED',candidate,inventory,command_plan:commandPlan,commands_executed:false,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
function persist(dir,result,write=fs.writeFileSync){
 if(result.status!=='PLAN_ONLY_INDEPENDENT_EDITORIAL_APPROVAL_REQUIRED'||!result.candidate||sha(result.candidate)!==result.inventory?.candidate_sha256||plan(result.inventory).status!=='PLAN_ONLY_INDEPENDENT_EDITORIAL_APPROVAL_REQUIRED'||JSON.stringify(plan(result.inventory))!==JSON.stringify(result.command_plan))throw Error('AUDIO_HANDOFF_NOT_READY');
 const outputs=[['narration-candidate.json',result.candidate],['sentence-audio-inventory.json',result.inventory],['edge-tts-command-plan.json',result.command_plan]];
 for(const [name] of outputs)if(fs.existsSync(path.join(dir,name)))throw Error('AUDIO_HANDOFF_OUTPUT_EXISTS: '+name);
 const created=[];try{for(const [name,obj] of outputs){const file=path.join(dir,name);write(file,JSON.stringify(obj,null,2)+'\n',{flag:'wx'});created.push(file);}}catch(e){for(const file of created)fs.unlinkSync(file);throw e;}
 return outputs.map(([name])=>name);
}
if(require.main===module){const [dir,candidatePath]=process.argv.slice(2);if(!dir||!candidatePath){console.error('Usage: node scripts/research_date_to_video_audio_input_handoff_v1.js D4-output-dir candidate.json');process.exitCode=2;}else try{const result=derive(dir,JSON.parse(fs.readFileSync(candidatePath,'utf8')));if(result.status==='BLOCKED'){console.log(JSON.stringify(result,null,2));process.exitCode=1;}else{const artifacts=persist(dir,result);console.log(JSON.stringify({status:result.status,artifacts,commands_executed:false,render_authorized:false,publication_authorized:false},null,2));}}catch(e){console.error('AUDIO_INPUT_HANDOFF_ERROR: '+e.message);process.exitCode=2;}}
module.exports={derive,persist};
