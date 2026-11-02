#!/usr/bin/env node
'use strict';
// Display-only SRT percentage formatting after word-aligned EdgeTTS subtitle creation.
// Research preview; never edits speech, MP3, time offsets or production subtitle tooling.
const fs=require('node:fs'),path=require('node:path');
const PERCENT=/百分之\s*(-?\d+(?:\.\d+)?)/g;
const ENGLISH=/(?:^|[^a-z])percent(?:$|[^a-z])/i;
function visible(text){
 return String(text).replace(/負\s*百分之\s*(\d+(?:\.\d+)?)/g,'-$1%')
  .replace(PERCENT,'$1%');
}
function convert(dir){
 const planPath=path.join(dir,'plan.json'),srtPath=path.join(dir,'daily-gainers-20261013.zh-TW.srt'),
  manifestPath=path.join(dir,'subtitle-manifest.json');
 const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
 if(plan.target_date!=='20261013'||plan.scene_count!==7||
  plan.research_only!==true||plan.publication_authorized!==false||
  plan.source_final_approved!==false||plan.render_preview_only!==true)throw Error('PREVIEW_SUBTITLE_SOURCE_GATE');
 const old=fs.readFileSync(srtPath,'utf8'),m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(m.target_date!=='20261013'||!Array.isArray(m.cues)||m.cues.length<7||
  m.language!=='zh-TW')throw Error('UNTRUSTED_SUBTITLE_MANIFEST');
 if(ENGLISH.test(old))throw Error('ENGLISH_PERCENT_NOT_ALLOWED');
 const lineBreak=old.includes('\r\n')?'\r\n':'\n';
 const blocks=old.trim().split(/\r?\n\r?\n/);
 const timestamps=[];
 let changed=0;
 const out=blocks.map((block,i)=>{
  const lines=block.split(/\r?\n/);
  if(!/^\d+$/.test(lines[0])||Number(lines[0])!==i+1||
    !/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/.test(lines[1])||
    lines.length<3)throw Error('SRT_BLOCK_STRUCTURE_DRIFT:'+(i+1));
  timestamps.push(lines[1]);
  const oldDisplay=lines.slice(2).join(lineBreak);
  const newDisplay=visible(oldDisplay);
  if(newDisplay!==oldDisplay)changed++;
  return [lines[0],lines[1],...newDisplay.split(lineBreak)].join(lineBreak);
 });
 if(m.cues.length!==out.length)throw Error('SRT_MANIFEST_CUE_COUNT_MISMATCH');
 const updatedCues=m.cues.map((cue,i)=>{
  const oldText=blocks[i].split(/\r?\n/).slice(2).join(lineBreak);
  if(cue.text!==oldText)throw Error('SRT_MANIFEST_OLD_TEXT_MISMATCH:'+i);
  return {...cue,text:visible(cue.text)};
 });
 const output=out.join(lineBreak+lineBreak)+lineBreak;
 if(blocks.some((b,i)=>b.split(/\r?\n/)[1]!==out[i].split(/\r?\n/)[1]))
  throw Error('SUBTITLE_TIMING_WAS_MODIFIED');
 if(changed<1||/百分之\s*\d/.test(output)||ENGLISH.test(output))
  throw Error('SRT_DISPLAY_PERCENTAGES_NOT_CONVERTED');
 fs.writeFileSync(srtPath,output);
 fs.writeFileSync(manifestPath,JSON.stringify({...m,cues:updatedCues,
  display_format:'arabic_number_with_percent_sign_research_preview_only',
  speech_alignment_timings_unchanged:true,
  original_cue_count:m.cues.length,modified_percent_cues:changed},null,2)+'\n');
 const proof={target_date:'20261013',cue_count:out.length,percent_cues_changed:changed,
   timings_preserved:true,tts_audio_modified:false,speech_text_modified:false,
   display_percent_style:'1.95%',research_only:true,
   publication_authorized:false};
 fs.writeFileSync(path.join(dir,'research-caption-display-evidence.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 return proof;
}
if(require.main===module){
 const dir=process.argv[2];
 if(!dir)throw Error('Usage: node research_mvp10_20261013_caption_display.js OUTPUT_DIR');
 console.log(JSON.stringify(convert(dir)));
}
module.exports={visible,convert};
