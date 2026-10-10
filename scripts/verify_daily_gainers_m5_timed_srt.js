'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {createDraft,validate}=require('./build_daily_gainers_m4_spoken_draft');
function parseSrt(s){
 const blocks=s.trim().split(/\r?\n\s*\r?\n/).map(b=>b.split(/\r?\n/));
 function seconds(t){const m=/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(t);if(!m)throw Error('M5_BAD_SRT_TIME');return Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000;}
 return blocks.map((b,i)=>{assert.equal(Number(b[0]),i+1,'M5_SRT_INDEX');const m=/^(\S+) --> (\S+)$/.exec(b[1]||'');if(!m)throw Error('M5_MISSING_SRT_TIMING');return {start:seconds(m[1]),end:seconds(m[2]),text:b.slice(2).join('')};});
}
function verify(srt){
 const d=createDraft();validate(d);const cues=parseSrt(srt);assert.equal(cues.length,d.scenes.length,'M5_SCENE_CUE_COUNT');
 for(let i=0;i<cues.length;i++){assert.equal(cues[i].text,d.scenes[i].spoken,'M5_SPOKEN_CAPTION_DRIFT');assert.ok(cues[i].end>cues[i].start,'M5_NONPOSITIVE_CUE');if(i)assert.ok(cues[i].start>=cues[i-1].end,'M5_OVERLAPPING_CUES');}
 assert.ok(cues[0].start>=0&&cues.at(-1).end>=60&&cues.at(-1).end<=90,'M5_BRAND_INCLUDED_DURATION');
 return {date:'20261008',cues:cues.length,duration_seconds:cues.at(-1).end,publication_authorized:false,still_requires_measured_audio_alignment:true};
}
if(require.main===module)console.log(JSON.stringify(verify(fs.readFileSync(process.argv[2],'utf8'))));
module.exports={verify,parseSrt};
