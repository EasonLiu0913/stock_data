'use strict';
// Read-only ffprobe media verification. Structural hashes alone do not prove a playable MP3.
const cp=require('node:child_process'),path=require('node:path');
function inspect(proof,audioDir,probe=cp.spawnSync){
 const issues=[],items=Array.isArray(proof?.sentences)?proof.sentences:[];
 if(proof?.contract!=='DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_PROOF'||!items.length)issues.push('PROOF_REQUIRED');
 for(const [i,s] of items.entries()){
  if(typeof s?.audio_file!=='string'||!/^[a-zA-Z0-9_-]+\.mp3$/.test(s.audio_file)){issues.push('FILE_'+i);continue;}
  const result=probe('ffprobe',['-v','error','-show_entries','stream=codec_name:format=duration','-of','json',path.join(audioDir,s.audio_file)],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  if(result.error||result.status!==0){issues.push('FFPROBE_'+i);continue;}
  let info;try{info=JSON.parse(result.stdout)}catch{issues.push('PROBE_JSON_'+i);continue;}
  const duration=Number(info?.format?.duration),codec=info?.streams?.some(x=>x.codec_name==='mp3');
  if(!codec||!Number.isFinite(duration)||duration<=0.1||duration>=120||Math.abs(duration-s.duration_seconds)>0.15)issues.push('MEDIA_MISMATCH_'+i);
 }
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_MEDIA_PROBE',status:issues.length?'REJECTED':'PLAYABLE_MEDIA_PROBE_ONLY_EDITORIAL_REVIEW_REQUIRED',issues,media_probed:issues.length===0,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={inspect};
