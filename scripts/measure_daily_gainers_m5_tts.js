'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {createDraft,validate}=require('./build_daily_gainers_m4_spoken_draft');
function measure(dir){
 const draft=createDraft();validate(draft);
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'tts-manifest.json'),'utf8'));
 if(manifest.engine!=='edge-tts'||manifest.scenes.length!==7)throw Error('M5_INCOMPLETE_EDGE_TTS');
 let total=0;const scenes=[];
 for(let i=0;i<7;i++){
  const record=manifest.scenes[i],file=path.join(dir,'audio',String(i+1).padStart(2,'0')+'.mp3');
  if(record.id!==i+1||record.spoken_text!==draft.scenes[i].spoken||!record.word_boundaries?.length)throw Error('M5_TTS_TEXT_OR_BOUNDARY_DRIFT');
  const p=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{encoding:'utf8'});
  if(p.status!==0)throw Error('M5_UNREADABLE_AUDIO');const duration=Number(p.stdout.trim());
  if(!(duration>0))throw Error('M5_BAD_DURATION');
  total+=duration;scenes.push({id:i+1,duration_seconds:duration,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
 }
 const result={date:'20261008',engine:manifest.engine,voice:manifest.voice,rate:manifest.rate,spoken_duration_seconds:total,scene_count:7,scenes,publication_authorized:false,measured_tts_only:true,full_render_duration_verified:false,duration_target_met:total>=60&&total<=90};
 fs.writeFileSync(path.join(dir,'tts-duration-proof.json'),JSON.stringify(result,null,2)+'\n');
 if(!result.duration_target_met)throw Error('M5_MEASURED_TTS_OUTSIDE_60_90');
 return result;
}
if(require.main===module)console.log(JSON.stringify(measure(process.argv[2]),null,2));
module.exports={measure};
