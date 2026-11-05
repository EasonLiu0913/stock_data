#!/usr/bin/env node
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const selector=path.resolve(__dirname,'../scripts/select_daily_gainers_pending_video_dates.js');
function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ts-video-date-'));
 const scripts=path.join(dir,'video_scripts','daily-gainers');
 const receipts=path.join(dir,'video_upload_receipts','daily-gainers');
 fs.mkdirSync(scripts,{recursive:true});fs.mkdirSync(receipts,{recursive:true});
 try{fn({dir,scripts,receipts});}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function script(dir,date,privacy='private',target=date){fs.writeFileSync(path.join(dir,date+'.json'),JSON.stringify({target_date:target,privacy_status:privacy}))}
function receipt(dir,date,data){fs.writeFileSync(path.join(dir,date+'.json'),JSON.stringify(data))}
function run(dir,limit=30){return execFileSync(process.execPath,[selector,dir,String(limit)],{encoding:'utf8'}).trim().split('\n').filter(Boolean)}
test('oldest outstanding dates first, older than 20261103 excluded and bounded',()=>fixture(({dir,scripts})=>{
 script(scripts,'20261013');script(scripts,'20261105');script(scripts,'20261103');script(scripts,'20261104');
 assert.deepEqual(run(dir,2),['20261103','20261104']);
 assert.deepEqual(run(dir),['20261103','20261104','20261105']);
}));
test('completed or ambiguous receipts always reserve a date to avoid reupload',()=>fixture(({dir,scripts,receipts})=>{
 for(const d of ['20261103','20261104','20261105','20261106'])script(scripts,d);
 receipt(receipts,'20261103',{target_date:'20261103',upload_status:'complete',youtube_video_id:'GiWA60DJoWI'});
 receipt(receipts,'20261104',{target_date:'20261104',upload_status:'unknown'});
 receipt(receipts,'20261105',{target_date:'20261105',upload_status:'pending'});
 assert.deepEqual(run(dir),['20261106']);
}));
test('malformed, mismatched, or nonprivate scripts are never upload eligible',()=>fixture(({dir,scripts})=>{
 script(scripts,'20261103','public');script(scripts,'20261104','private','20261103');
 fs.writeFileSync(path.join(scripts,'20261105.json'),'{broken');
 script(scripts,'20261106');assert.deepEqual(run(dir),['20261106']);
}));
test('a receipt with wrong date blocks automatic replay, rather than guessing',()=>fixture(({dir,scripts,receipts})=>{
 script(scripts,'20261104');receipt(receipts,'20261104',{target_date:'20261103'});
 assert.deepEqual(run(dir),[]);
}));

test('an initiated upload attempt blocks replay even when final receipt is missing',()=>fixture(({dir,scripts})=>{
 for(const d of ['20261104','20261105'])script(scripts,d);
 const attempts=path.join(dir,'video_upload_attempts','daily-gainers');
 fs.mkdirSync(attempts,{recursive:true});
 fs.writeFileSync(path.join(attempts,'20261104.json'),JSON.stringify({target_date:'20261104',attempt_status:'initiated'}));
 assert.deepEqual(run(dir),['20261105']);
}));
