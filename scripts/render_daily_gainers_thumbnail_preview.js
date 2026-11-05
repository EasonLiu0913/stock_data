#!/usr/bin/env node
'use strict';
// Isolated, deterministic TEST-ONLY thumbnail previews. Never read live market input or upload.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {svgArtwork}=require('./build_daily_gainers_thumbnail.js');
const configs={
  up:   {accent:'#D91F32',arrow:'#ED3149',direction:'up',word:'上漲'},
  down: {accent:'#0CA74D',arrow:'#19C96A',direction:'down',word:'下跌'},
  flat: {accent:'#447DA8',arrow:'#6CA2C3',direction:'flat',word:'平盤'}
};
function run(command,args){const p=spawnSync(command,args,{encoding:'utf8'});if(p.status!==0)throw Error(command+' '+args.join(' ')+' failed: '+p.stderr);}
function xml(s){return String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function make(row,outDir){
  const {date,stock_count,market_change_pct,regime,market_question}=row;
  if(typeof market_question!=='string'||market_question.length<4||market_question.length>13||/[<>\n\r]/.test(market_question))throw Error('Invalid concise market question');
  if(!/^20\d{6}$/.test(date)||!Number.isInteger(stock_count)||stock_count<1||stock_count>300||!configs[regime]||typeof market_change_pct!=='number'||!Number.isFinite(market_change_pct))throw Error('Invalid mock preset '+JSON.stringify(row));
  if((regime==='up'&&market_change_pct<=0)||(regime==='down'&&market_change_pct>=0)||(regime==='flat'&&market_change_pct!==0))throw Error('Direction/value mismatch');
  const c=configs[regime],tag=market_change_pct>0?'+'+market_change_pct.toFixed(2)+'%':market_change_pct.toFixed(2)+'%';
  let svg=svgArtwork(date,stock_count);
  svg=svg.replaceAll('TAIWANSTOCK','TAIWAN STOCK');
  svg=svg.replace('fill="#bc121f"','fill="'+c.accent+'"').replace('fill="#ae1722"','fill="'+c.accent+'"');
  svg=svg.replaceAll('#f23449',c.arrow);
  if(regime==='down'){
    svg=svg.replace('M10 564 L180 498 L298 535 L453 330 L588 368 L771 124','M15 215 L164 255 L288 225 L416 350 L570 328 L754 491');
    svg=svg.replace('M730 135 L787 80 L784 166Z','M700 489 L779 549 L765 461Z');
  }else if(regime==='flat'){
    svg=svg.replace('M10 564 L180 498 L298 535 L453 330 L588 368 L771 124','M10 369 L170 340 L302 394 L452 350 L592 387 L762 370');
    svg=svg.replace('M730 135 L787 80 L784 166Z','M732 335 L800 370 L733 408Z');
  }
  const badge='<rect x="630" y="216" rx="15" width="213" height="97" fill="#06172c" stroke="'+c.accent+'" stroke-width="4"/>'+
      '<text x="652" y="250" fill="#ffffff" font-family="Noto Sans CJK TC,sans-serif" font-size="26" font-weight="bold">加權 '+c.word+'</text>'+
      '<text x="652" y="294" fill="'+c.arrow+'" font-family="Noto Sans CJK TC,sans-serif" font-size="43" font-weight="900">'+xml(tag)+'</text>';
  const question='<rect x="542" y="111" width="322" height="74" rx="10" fill="#06172c" opacity=".92" stroke="'+c.accent+'" stroke-width="3"/>'+ 
      '<text x="557" y="159" font-family="Noto Sans CJK TC,sans-serif" fill="#ffffff" font-size="29" font-weight="900">'+xml(market_question)+'</text>';
  const mark='<rect x="584" y="11" width="238" height="49" rx="8" fill="#26354b" stroke="#fef08a" stroke-width="2"/>'+
      '<text x="608" y="46" fill="#fef08a" font-family="Noto Sans CJK TC,sans-serif" font-size="27" font-weight="800">模擬測試 · DEMO</text>';
  svg=svg.replace('</svg>',badge+question+mark+'</svg>');
  const dir=path.join(outDir,regime+'-'+date);fs.mkdirSync(dir,{recursive:true});
  const base=path.join(dir,'base.png'),s=path.join(dir,'art.svg'),avatar=path.join(dir,'avatar.png'),dest=path.join(dir,'thumbnail.png');
  fs.writeFileSync(s,svg);
  run('rsvg-convert',['-w','1280','-h','720','-o',base,s]);
  const sprite='assets/daily-gainers-vtuber-sprite.webp';
  if(!fs.existsSync(sprite))throw Error('Missing existing presenter sprite '+sprite);
  run('ffmpeg',['-y','-loglevel','error','-i',sprite,'-vf','crop=iw/4:ih:0:0,scale=480:-1:flags=lanczos','-frames:v','1','-update','1',avatar]);
  run('ffmpeg',['-y','-loglevel','error','-i',base,'-i',avatar,'-filter_complex','[0:v][1:v]overlay=805:23:format=auto,drawbox=x=0:y=0:w=iw:h=ih:color=0x'+c.accent.slice(1)+':t=3,format=rgba','-frames:v','1','-update','1',dest]);
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',dest],{encoding:'utf8'});
  if(probe.status!==0||probe.stdout.trim()!=='1280,720')throw Error('Invalid output dimensions '+dest+' '+probe.stdout);
  fs.writeFileSync(path.join(dir,'mock-input.json'),JSON.stringify(row,null,2)+'\n');
  return {file:dest,regime,date,market_change_pct,stock_count,bytes:fs.statSync(dest).size};
}
function main(){
 const input=process.argv[2]||'thumbnail-preview-requests/demo-v1.json';
 const out=process.argv[3]||'output/thumbnail-preview-demo-v1';
 const p=JSON.parse(fs.readFileSync(input,'utf8'));
 if(p.mode!=='mock_only'||!Array.isArray(p.cases)||p.cases.length<3||p.cases.length>8)throw Error('TEST ONLY: require 3-8 mock cases');
 fs.mkdirSync(out,{recursive:true});
 const r=p.cases.map(c=>make(c,out));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({mode:'mock_only',uploaded_to_youtube:false,cases:r},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',mock_only:true,items:r},null,2));
}
if(require.main===module)main();
module.exports={make};
