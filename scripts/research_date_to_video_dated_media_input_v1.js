'use strict';
// Date-scoped research media input contract. This is not a renderer or an approval.
const fs=require('node:fs'),path=require('node:path');
const {inspect}=require('./research_date_to_video_media_preflight_v1');
function build(dir){
 const gate=inspect(dir);
 const read=name=>{const p=path.join(dir,name);return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null};
 const handoff=read('media-handoff.json');
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_INPUT_V1',target_date:gate.target_date,source_master_sha256:handoff?.source_master_sha256||null,analysis_task_sha256:handoff?.analysis_task_sha256||null,review_gate_sha256:handoff?.review_gate_sha256||null,draft_check_sha256:handoff?.draft_check_sha256||null,fixed_opening_lines:handoff?.fixed_opening_lines||null,market_opening_seconds:handoff?.market_opening_seconds||null,preflight_status:gate.status,blockers:[...gate.issues],narration_script:null,subtitle_sentences:null,audio_manifest:null,scene_cards:null,media_bridge_status:'NOT_IMPLEMENTED',research_only:true,editorial_certified:false,render_authorized:false,publication_authorized:false};
}
if(require.main===module){const dir=process.argv[2];if(!dir){console.error('Usage: node scripts/research_date_to_video_dated_media_input_v1.js D4-output-dir');process.exit(2)}try{console.log(JSON.stringify(build(dir),null,2))}catch(e){console.error(e.message);process.exitCode=2}}
module.exports={build};
