'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const resolver=path.resolve(__dirname,'../scripts/resolve_daily_gainers_video_target_date.js');
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const today=parts.year+parts.month+parts.day;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'video-date-main-gate-'));
function run(date=''){return cp.spawnSync(process.execPath,[resolver,date],{cwd:tmp,encoding:'utf8'});}
function write(p,obj){let dest=path.join(tmp,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(obj));}
try{
 let v=run();assert.equal(v.status,2);assert.match(v.stderr,/TARGET_DATE_INPUT_MISSING/);
 write('video_scripts/daily-gainers/20261008.json',{target_date:'20261008'});
 v=run();assert.equal(v.status,2);assert.match(v.stderr,/TARGET_DATE_INPUT_MISSING/);
 write('data_daily_gain_over_5/'+today+'.json',{target_date:today});
 write('video_scripts/daily-gainers/'+today+'.json',{target_date:today});
 v=run();assert.equal(v.status,0);assert.equal(v.stdout.trim(),today);
 v=run('20261008');assert.equal(v.status,2);assert.match(v.stderr,/HISTORICAL_DATE_REQUIRES_SEPARATE_AUTHORIZATION/);
 v=run('2026-10-12');assert.equal(v.status,2);assert.match(v.stderr,/INVALID_DATE/);
 write('video_scripts/daily-gainers/'+today+'.json',{target_date:'20261008'});
 v=run();assert.equal(v.status,2);assert.match(v.stderr,/TARGET_DATE_MISMATCH/);
 console.log('PASS production-candidate target-date negative and positive gates (6 checks)');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
