#!/usr/bin/env node
'use strict';
// Offline-only post-render subtitle burn. It NEVER calls upload or publication APIs.
// Final subtitle SRT is generated from measured MP4 scene timing first.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const date=process.argv[2];
if(!/^20\d{6}$/.test(date||''))throw Error('Expected YYYYMMDD');
const out=path.join(process.cwd(),'output','daily-gainers-video',date);
const video=path.join(out,'daily-gainers-'+date+'.mp4');
const srt=path.join(out,'daily-gainers-'+date+'.zh-TW.srt');
const plan=JSON.parse(fs.readFileSync(path.join(out,'plan.json'),'utf8'));
if(plan.target_date!==date)throw Error('Wrong-date plan');
if(plan.scenes[0]?.scene_type!=='market_opening'||!['summary','closing_summary'].includes(plan.scenes.at(-1)?.scene_type))throw Error('Incomplete opening/closing scene contract');
if(plan.scenes.filter(s=>s.scene_type==='stock_list').length<1)throw Error('Missing stock chapters');
if(!fs.existsSync(video)||!fs.existsSync(srt))throw Error('Missing MP4 or SRT');
const original=fs.readFileSync(srt,'utf8').replace(/\r/g,'');
const blocks=original.trim().split(/\n\s*\n/).filter(Boolean);
if(blocks.length<plan.scenes.length)throw Error('Insufficient subtitle cues');
const times=blocks.map(b=>{
 const m=b.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
 if(!m)throw Error('Invalid SRT timestamp');
 const toSeconds=(a,b,c,d)=>+a*3600 + +b*60 + +c + +d/1000;
 const start=toSeconds(...m.slice(1,5)),end=toSeconds(...m.slice(5,9));
 if(!(end>start))throw Error('Invalid SRT cue duration');
 return {start,end};
});
for(let i=1;i<times.length;i++)if(times[i].start+0.05<times[i-1].start)throw Error('Unordered SRT');
function run(exe,args){
 const x=spawnSync(exe,args,{encoding:'utf8',maxBuffer:8*1024*1024});
 if(x.status!==0)throw Error(exe+' failed: '+(x.stderr||'').slice(-2500));
 return x.stdout.trim();
}
function probe(file){return JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',file]));}
const source=probe(video),sourceDuration=Number(source.format.duration);
if(source.streams.find(x=>x.codec_type==='video')?.width!==1920||source.streams.find(x=>x.codec_type==='video')?.height!==1080)throw Error('Source is not 1080p');
if(times.at(-1).end>sourceDuration+0.5)throw Error('Subtitle ends beyond MP4');
const tmp=path.join(out,'daily-gainers-'+date+'.burning.mp4');
const archive=path.join(out,'daily-gainers-'+date+'.pre-burn.mp4');
if(fs.existsSync(tmp)||fs.existsSync(archive))throw Error('Prior burn attempt must be reviewed first');
const srtArg=srt.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
const force='FontName=Noto Sans CJK TC,FontSize=21,PrimaryColour=&H00FFFFFF,OutlineColour=&H00333333,BorderStyle=1,Outline=1,Shadow=0,Alignment=2,MarginL=60,MarginR=60,MarginV=10';
run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',video,
 '-vf',"subtitles="+srtArg+":force_style='"+force+"'",
 '-c:v','libx264','-preset','veryfast','-crf','19','-c:a','copy','-movflags','+faststart',tmp]);
const check=probe(tmp),newDuration=Number(check.format.duration);
if(Math.abs(newDuration-sourceDuration)>0.25)throw Error('Burn changed duration unexpectedly');
if(check.streams.find(x=>x.codec_type==='video')?.width!==1920||check.streams.find(x=>x.codec_type==='video')?.height!==1080)throw Error('Burn output not 1080p');
fs.renameSync(video,archive);
fs.renameSync(tmp,video);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const proof={target_date:date,status:'BURN_EXECUTED_VISUAL_QA_PENDING',cues:blocks.length,source_duration:sourceDuration,burned_duration:newDuration,mp4_sha256:hash(video),srt_sha256:hash(srt),preburn_sha256:hash(archive),subtitle_region:{alignment:'bottom-center',margin_left:60,margin_right:60,margin_bottom:10,font_size:21,ass_outline:1,max_lines:2},publication_authorized:false};
fs.writeFileSync(path.join(out,'burned-caption-proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
