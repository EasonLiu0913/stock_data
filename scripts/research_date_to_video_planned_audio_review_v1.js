'use strict';
// Join a dated non-executing TTS plan with independently supplied audio evidence.
const crypto=require('node:crypto'),cp=require('node:child_process');const {inspect:probeMedia}=require('./research_date_to_video_sentence_media_probe_v1');const {plan:derivePlan}=require('./research_date_to_video_edge_tts_plan_v1');const {verify}=require('./research_date_to_video_sentence_audio_proof_v1');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function inspect(inventory,commandPlan,proof,audioDir,probe=cp.spawnSync){
 const issues=[],expected=derivePlan(inventory);
 if(expected.status!=='PLAN_ONLY_INDEPENDENT_EDITORIAL_APPROVAL_REQUIRED')issues.push('INVENTORY_PLAN_REJECTED');
 if(sha(commandPlan)!==sha(expected))issues.push('COMMAND_PLAN_DRIFT');
 if(proof?.target_date!==expected.target_date||proof?.candidate_sha256!==expected.candidate_sha256)issues.push('PROOF_PLAN_PROVENANCE');
 const commands=Array.isArray(expected.commands)?expected.commands:[],sentences=Array.isArray(proof?.sentences)?proof.sentences:[];
 if(commands.length!==sentences.length)issues.push('PROOF_PLAN_SENTENCE_COUNT');
 for(const [i,c] of commands.entries())if(sentences[i]?.id!==c.sentence_id||sentences[i]?.order!==c.order||sentences[i]?.audio_file!==c.output_file||sentences[i]?.spoken_text!==c.argv[6])issues.push('PROOF_PLAN_SENTENCE_'+i);
 const audio=verify(inventory,proof,audioDir);issues.push(...audio.issues.map(x=>'AUDIO_'+x));
 const media=probeMedia(proof,audioDir,probe);issues.push(...media.issues.map(x=>'MEDIA_'+x));
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_PLANNED_SENTENCE_AUDIO_REVIEW',target_date:expected.target_date,command_plan_sha256:sha(expected),candidate_sha256:expected.candidate_sha256,status:issues.length?'REJECTED':'STRUCTURAL_AND_PLAYABLE_AUDIO_EVIDENCE_EDITORIAL_REVIEW_REQUIRED',issues,audio_verified:issues.length===0,media_probed:media.media_probed,commands_executed:false,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={inspect};
