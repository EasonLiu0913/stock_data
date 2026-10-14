#!/usr/bin/env node
'use strict';
// Current-only paired-script packaging: never infer captions from speech.
const fs = require('node:fs');
const path = require('node:path');
const {validate} = require('./validate_daily_gainers_video_v2');
const date = process.argv[2];
if (!/^20\d{6}$/.test(date || '')) throw Error('Expected YYYYMMDD');
const root = process.cwd();
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const script = read('video_scripts/daily-gainers/' + date + '.json');
if (script.target_date !== date) throw Error('Script date mismatch');
const result = validate(script);
const outDir = path.join(root,'output/daily-gainers-video',date);
fs.mkdirSync(outDir,{recursive:true});
const scenes = script.scenes.map((s,i)=>({
 id:i+1,title:s.title,subtitle:s.subtitle,bullets:s.bullets,
 stock_codes:s.stock_codes || [],footer:s.footer || '',
 caption_cues:s.caption_cues,caption_text:s.caption_text,speech_text:s.speech_text
}));
const plan = {schema_version:2,methodology_version:'daily-gainers-video-paired-v2',
 target_date:date,scene_count:scenes.length,
 narration_chars:scenes.reduce((n,s)=>n+[...s.speech_text].length,0),scenes};
fs.writeFileSync(path.join(outDir,'plan.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({...result,date,scenes:scenes.length,spoken_chars:plan.narration_chars}));
