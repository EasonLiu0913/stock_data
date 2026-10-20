'use strict';
// Complete read-only D4 audio acceptance: candidate, dated source, exact plan, existing MP3 and submitted proof.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {collect}=require('./research_date_to_video_audio_proof_collect_v1');
const {inspect}=require('./research_date_to_video_planned_audio_review_v1');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function inspectDirectory(dir){const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));return inspect(read('sentence-audio-inventory.json'),read('edge-tts-command-plan.json'),read('sentence-audio-proof.json'),path.join(dir,'audio'));}
function inspectCompleteDirectory(dir){
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 const submitted=read('sentence-audio-proof.json');
 const {proof,review}=collect(dir);
 if(sha(submitted)!==sha(proof))return {...review,status:'REJECTED',issues:[...review.issues,'SUBMITTED_AUDIO_PROOF_DRIFT'],audio_verified:false};
 return {...review,complete_d4_audio_provenance_verified:true};
}
if(require.main===module){const dir=process.argv[2];if(!dir){console.error('Usage: node scripts/research_date_to_video_audio_review_cli_v1.js D4-media-dir');process.exitCode=2;}else try{const result=inspectCompleteDirectory(dir);console.log(JSON.stringify(result,null,2));if(result.status==='REJECTED')process.exitCode=1;}catch(e){console.error('AUDIO_REVIEW_INPUT_ERROR: '+e.message);process.exitCode=2;}}
module.exports={inspectDirectory,inspectCompleteDirectory};
