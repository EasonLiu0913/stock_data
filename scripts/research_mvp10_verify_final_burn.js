#!/usr/bin/env node
'use strict';
// Research preview FINAL-burn validation. Never grants source approval or publication.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const DATE='20261013';
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function probe(file){
 const result=spawnSync('ffprobe',['-v','error','-show_entries',
  'format=duration,size:stream=index,codec_type,codec_name,width,height,pix_fmt',
  '-of','json',file],{encoding:'utf8',maxBuffer:1<<22});
 if(result.status!==0)throw Error('FINAL_FFPROBE_FAILED:'+String(result.stderr||result.error));
 return JSON.parse(result.stdout);
}
function seconds(stamp){
 const m=/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(stamp);
 if(!m)throw Error('INVALID_SRT_TIMESTAMP');
 return (((+m[1]*60)+(+m[2]))*60+(+m[3]))+(+m[4])/1000;
}
function verify(dir){
 const get=n=>path.join(dir,n);
 const plan=read(get('plan.json')),lock=read(get('research-preview-boundary.json'));
 const pre=read(get('qa.json')),burn=read(get('subtitle-burn-evidence.json'));
 const display=read(get('research-caption-display-evidence.json'));
 const subs=read(get('subtitle-manifest.json')),tts=read(get('tts-manifest.json'));
 if(plan.target_date!==DATE||plan.scene_count!==7||plan.research_only!==true||
  plan.source_final_approved!==false||plan.publication_authorized!==false||
  lock.video_release_approved!==false||lock.publication_authorized!==false||
  lock.youtube_upload_authorized!==false||lock.not_a_substitute_for_original_AB!==true||
  burn.target_date!==DATE||burn.publication_authorized!==false||
  burn.source_final_approved!==false||burn.youtube_upload_authorized!==false||
  pre.vtuber_enabled!==true||pre.scene_count!==7||pre.duration_pass!==true)
  throw Error('UNAPPROVED_SOURCE_OR_MEDIA_NOT_VERIFIABLE');
 if(tts.engine!=='edge-tts'||tts.voice!=='zh-TW-YunJheNeural'||
  tts.rate!=='+15%'||tts.scenes?.length!==7||
  tts.scenes.some(s=>s.engine!=='edge-tts'||!s.word_boundaries?.length))
  throw Error('YUNJHE_AND_WORD_BOUNDARY_UNVERIFIED');
 const video=get('daily-gainers-20261013.mp4');
 const subtitleFile=get('daily-gainers-20261013.zh-TW.srt');
 if(!fs.statSync(video).isFile()||!fs.statSync(subtitleFile).isFile())
  throw Error('MISSING_FINAL_MEDIA');
 const actualHash=sha(video);
 if(actualHash!==burn.burned_mp4_sha256||actualHash===burn.source_mp4_sha256)
  throw Error('FINAL_BURNED_MP4_SHA_MISMATCH');
 if(burn.caption_language!=='zh-TW'||display.publication_authorized!==false||
  display.speech_text_modified!==false||display.tts_audio_modified!==false||
  display.timings_preserved!==true||display.percent_cues_changed<1||
  subs.display_format!=='arabic_number_with_percent_sign_research_preview_only')
  throw Error('DISPLAY_AND_SPEECH_NOT_SEPARATED');
 const metadata=probe(video);
 const tracks=metadata.streams||[];
 const v=tracks.find(x=>x.codec_type==='video');
 const a=tracks.find(x=>x.codec_type==='audio');
 const duration=Number(metadata.format?.duration);
 const size=Number(metadata.format?.size);
 if(!v||v.codec_name!=='h264'||v.width!==1920||v.height!==1080||
  v.pix_fmt!=='yuv420p'||!a||a.codec_name!=='aac'||
  !Number.isFinite(duration)||duration<300||duration>600||
  !Number.isFinite(size)||size<1024*1024||
  Math.abs(duration-Number(burn.duration_seconds))>0.25||
  Math.abs(duration-Number(pre.duration_seconds))>0.5)
  throw Error('FINAL_BURN_MP4_MEDIA_QA_FAILED');
 const srt=fs.readFileSync(subtitleFile,'utf8');
 if(/百分之\s*\d/i.test(srt)||/\bpercent\b/i.test(srt)||!/\d+(?:\.\d+)?%/.test(srt))
  throw Error('FINAL_SRT_ARABIC_PERCENT_DISPLAY_INVALID');
 const blocks=srt.trim().split(/\r?\n\r?\n/);
 if(blocks.length!==subs.cue_count||blocks.length!==subs.cues?.length||blocks.length<7)
  throw Error('FINAL_SUBTITLE_CUE_COUNT_MISMATCH');
 let end=0;
 for(let i=0;i<blocks.length;i++){
  const lines=blocks[i].split(/\r?\n/),range=/^(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})$/.exec(lines[1]||'');
  if(Number(lines[0])!==i+1||!range||lines.length<3||
   lines.slice(2).join('\n')!==subs.cues[i].text)throw Error('SUBTITLE_CUE_CONTENT_MISMATCH:'+i);
  const from=seconds(range[1]),to=seconds(range[2]);
  if(from<end-0.005||from>=to||to>duration+0.10)
   throw Error('SUBTITLE_CUE_TIME_INVALID:'+i);
  end=to;
 }
 const receipt={
  schema_version:1,target_date:DATE,video_file:path.basename(video),
  mp4_sha256:actualHash,mp4_size_bytes:size,
  width:v.width,height:v.height,video_codec:v.codec_name,
  pixel_format:v.pix_fmt,audio_codec:a.codec_name,
  duration_seconds:Number(duration.toFixed(3)),srt_cue_count:blocks.length,
  subtitles_burned_sha_verified:true,spoken_voice_verified:tts.voice,
  spoken_rate_verified:tts.rate,percent_display_format:'9.97%',
  research_only:true,source_final_approved:false,original_AB_pass:false,
  full_publication_approved:false,youtube_upload_authorized:false,
  decision:'RESEARCH_PREVIEW_FINAL_MEDIA_VERIFIED_NOT_PUBLISHABLE'
 };
 fs.writeFileSync(get('final-burned-preview-qa.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 return receipt;
}
if(require.main===module){
 const dir=process.argv[2];
 if(!dir)throw Error('Usage: node research_mvp10_verify_final_burn.js OUTPUT_DIR');
 console.log(JSON.stringify(verify(dir)));
}
module.exports={verify,probe,seconds};
