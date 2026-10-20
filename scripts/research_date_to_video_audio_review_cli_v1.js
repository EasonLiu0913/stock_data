'use strict';
// Read-only entrypoint for real date-scoped sentence audio evidence; never runs TTS or render.
const fs=require('node:fs'),path=require('node:path');const {inspect}=require('./research_date_to_video_planned_audio_review_v1');
function inspectDirectory(dir){
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 const inventory=read('sentence-audio-inventory.json'),commandPlan=read('edge-tts-command-plan.json'),proof=read('sentence-audio-proof.json');
 return inspect(inventory,commandPlan,proof,path.join(dir,'audio'));
}
if(require.main===module){const dir=process.argv[2];if(!dir){console.error('Usage: node scripts/research_date_to_video_audio_review_cli_v1.js D4-media-dir');process.exitCode=2;}else try{const result=inspectDirectory(dir);console.log(JSON.stringify(result,null,2));if(result.status==='REJECTED')process.exitCode=1;}catch(e){console.error('AUDIO_REVIEW_INPUT_ERROR: '+e.message);process.exitCode=2;}}
module.exports={inspectDirectory};
