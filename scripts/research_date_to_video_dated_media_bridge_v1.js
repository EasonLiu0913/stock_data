'use strict';
// Research-only date-parameterized bridge from independently verified MP3 evidence to SRT timing.
// Does not synthesize, render, certify editorial content, or publish.
const {inspect}=require('./research_date_to_video_planned_audio_review_v1');
function clock(seconds){
 const ms=Math.round(seconds*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);
 return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');
}
function wrap(text,limit=30){
 if(typeof text!=='string'||!text.trim()||/[\r\n]/.test(text))throw Error('INVALID_CAPTION');
 const chunks=text.match(/[^。！？；，、]+[。！？；，、]?/g)||[],lines=[];let line='';
 if(chunks.join('')!==text)throw Error('CAPTION_DRIFT');
 for(let chunk of chunks){if(line.length+chunk.length>limit&&line){lines.push(line);line='';}while(chunk.length>limit){lines.push(chunk.slice(0,limit));chunk=chunk.slice(limit);}line+=chunk;}
 if(line)lines.push(line);
 if(lines.join('')!==text||lines.some(x=>x.length>limit))throw Error('CAPTION_DRIFT');
 return lines.join('\n');
}
function build(inventory,commandPlan,proof,audioDir,probe){
 const review=inspect(inventory,commandPlan,proof,audioDir,probe);
 if(review.status!=='STRUCTURAL_AND_PLAYABLE_AUDIO_EVIDENCE_EDITORIAL_REVIEW_REQUIRED')return {contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE',status:'REJECTED',issues:review.issues,render_authorized:false,publication_authorized:false};
 let cursor=0;const sentences=proof.sentences.map(s=>{const start=cursor;cursor+=s.duration_seconds;return {id:s.id,order:s.order,spoken_text:s.spoken_text,caption_text:s.caption_text,audio_file:s.audio_file,audio_sha256:s.audio_sha256,start_seconds:Number(start.toFixed(3)),end_seconds:Number(cursor.toFixed(3))};});
 const srt=sentences.map((s,i)=>String(i+1)+'\n'+clock(s.start_seconds)+' --> '+clock(s.end_seconds)+'\n'+wrap(s.caption_text)+'\n\n').join('');
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE',target_date:inventory.target_date,candidate_sha256:inventory.candidate_sha256,status:'PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED',issues:[],sentences,srt,total_seconds:Number(cursor.toFixed(3)),editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={build,wrap,clock};
