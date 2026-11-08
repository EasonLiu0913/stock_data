#!/usr/bin/env node
'use strict';
// Fail closed immediately before reserving an upload attempt or calling YouTube video insert.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const date=process.argv[2];
if(!/^20\d{6}$/.test(date||''))throw Error('Explicit verified YYYYMMDD required');
const root=path.join('output','daily-gainers-video',date);
const p=path.join(root,'thumbnail.jpg'),png=path.join(root,'thumbnail.png'),q=path.join(root,'thumbnail-qa.json');
function error(reason){throw Error('UPLOAD_BLOCKED_NO_THUMBNAIL '+reason);}
for(const file of [p,png,q])if(!fs.existsSync(file)||fs.statSync(file).size<20)error('missing/empty '+file);
const qa=JSON.parse(fs.readFileSync(q,'utf8'));
if(qa.status!=='PASS'||qa.date!==date||qa.template_version!=='v1'||qa.frame_px!==3||qa.mock!==false)error('wrong QA status/date/version/frame');
const raw=JSON.parse(fs.readFileSync(path.join('data_daily_gain_over_5',date+'.json'),'utf8'));
if(raw.target_date!==date||raw.stock_count!==qa.stock_count)error('stock count/date mismatch');
const o=JSON.parse(fs.readFileSync(path.join('data_daily_gain_over_5','market-opening-video',date+'.json'),'utf8'));
const regime=o.index?.change_points>0?'up':o.index?.change_points<0?'down':'flat';
if(o.target_date!==date||o.index?.source_date!==date||qa.market_regime!==regime||!Number.isFinite(o.index.change_pct)||Math.abs(qa.market_change_pct-o.index.change_pct)>0.015)error('market direction/date mismatch');
const image=fs.readFileSync(p);
if(image.length<15000||image.length>2*1024*1024||image[0]!==0xff||image[1]!==0xd8)error('invalid JPEG size/header');
if(crypto.createHash('sha256').update(image).digest('hex')!==qa.jpeg_sha256)error('thumbnail SHA mismatch');
for(const file of [p,png]){
 const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',file],{encoding:'utf8'});
 if(probe.status!==0||probe.stdout.trim()!=='1280,720')error('invalid resolution '+file);
}
// Sample perpendicular to the top edge at x=10. Sampling along the top row
// only observes the horizontal 3px border and cannot detect its thickness.
const im=spawnSync('ffmpeg',['-loglevel','error','-i',png,'-vf','crop=1:4:10:0,format=rgb24','-f','rawvideo','-'],{encoding:null,maxBuffer:1024*1024});
if(im.status!==0||im.stdout?.length!==12)error('PNG pixel probe failed');
const rgb={up:[0xD9,0x1F,0x32],down:[0x0C,0xA7,0x4D],flat:[0x44,0x7D,0xA8]}[regime];
for(let pixel=0;pixel<3;pixel++)if(!rgb.every((x,i)=>im.stdout[pixel*3+i]===x))error('3px border color incorrect at pixel '+pixel);
if(rgb.every((x,i)=>im.stdout[9+i]===x))error('frame thicker than 3px at top edge');
if(qa.source_files?.length<6||!qa.source_files.every(f=>fs.existsSync(f)))error('provenance missing');
if(!qa.source_sha256||Object.keys(qa.source_sha256).length!==qa.source_files.length)error('source hash manifest missing');
for(const file of qa.source_files){
 const recorded=qa.source_sha256[file];
 if(!/^[0-9a-f]{64}$/.test(recorded||''))error('missing source SHA for '+file);
 const current=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(current!==recorded)error('source changed after thumbnail rendering: '+file);
}
console.log(JSON.stringify({status:'THUMBNAIL_RENDER_VERIFIED',date,sha256:qa.jpeg_sha256,market_regime:regime}));
