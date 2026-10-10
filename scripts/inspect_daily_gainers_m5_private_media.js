'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
function inspect(file) {
 if(!fs.existsSync(file))throw Error('M5_MISSING_MEDIA: '+file);
 const run=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',file],{encoding:'utf8'});
 if(run.status!==0)throw Error('M5_FFPROBE_FAILED: '+file);
 const probe=JSON.parse(run.stdout);
 return {filename:path.basename(file),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),duration_seconds:Number(probe.format?.duration),streams:probe.streams};
}
function verifyMedia(root){
 const video=inspect(path.join(root,'opening.mp4'));
 const audio=inspect(path.join(root,'opening.mp3'));
 const srt=path.join(root,'opening.zh-TW.srt');
 if(!fs.existsSync(srt))throw Error('M5_MISSING_TIMED_SRT');
 const text=fs.readFileSync(srt,'utf8');
 if(!/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/.test(text))throw Error('M5_UNTIMED_SRT');
 if(video.duration_seconds<60||video.duration_seconds>90)throw Error('M5_OPENING_DURATION_OUTSIDE_60_90');
 if(!video.streams.some(s=>s.codec_type==='video'&&s.width===1920&&s.height===1080))throw Error('M5_NOT_1080P');
 if(!audio.streams.some(s=>s.codec_type==='audio'))throw Error('M5_MISSING_AUDIO_STREAM');
 return {date:'20261008',video,audio,srt_sha256:crypto.createHash('sha256').update(fs.readFileSync(srt)).digest('hex'),publication_authorized:false,status:'MEDIA_METADATA_ONLY_REQUIRES_INDEPENDENT_CONTENT_REVIEW'};
}
if(require.main===module)console.log(JSON.stringify(verifyMedia(process.argv[2]),null,2));
module.exports={verifyMedia};
