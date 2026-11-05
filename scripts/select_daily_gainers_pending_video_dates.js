#!/usr/bin/env node
'use strict';
// Pure local date selector; does not dispatch or upload anything.
// Usage: node scripts/select_daily_gainers_pending_video_dates.js [repo-root] [limit]
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.argv[2]||'.');
const limit=Number(process.argv[3]||3);
if(!Number.isSafeInteger(limit)||limit<1||limit>30)throw Error('Invalid limit');
const scriptDir=path.join(root,'video_scripts','daily-gainers');
const receiptDir=path.join(root,'video_upload_receipts','daily-gainers');
const attemptDir=path.join(root,'video_upload_attempts','daily-gainers');
const min='20261103'; // owner-authorized queue start
const valid=x=>/^20[0-9]{6}$/.test(x);
if(!fs.existsSync(scriptDir))process.exit(0);
const candidates=fs.readdirSync(scriptDir).filter(x=>/^20[0-9]{6}\.json$/.test(x))
 .map(x=>x.slice(0,-5)).filter(d=>d>=min).sort();
let count=0;
for(const date of candidates){
 const file=path.join(scriptDir,date+'.json');
 if(!fs.statSync(file).isFile())continue;
 let data;
 try{data=JSON.parse(fs.readFileSync(file,'utf8'));}catch{continue;}
 if(data.target_date!==date||data.privacy_status!=='private')continue;
 const attempt=path.join(attemptDir,date+'.json');
 // Ambiguous prior uploads require YouTube reconciliation before any retry.
 if(fs.existsSync(attempt))continue;
 const receipt=path.join(receiptDir,date+'.json');
 if(fs.existsSync(receipt)){
   // Fail closed when receipt is malformed or ambiguous. Do not retry automatically.
   let r;try{r=JSON.parse(fs.readFileSync(receipt,'utf8'));}catch{continue;}
   if(r.target_date!==date)continue;
   if(r.youtube_video_id||r.upload_status==='complete'||r.upload_status==='pending'||r.upload_status==='unknown')continue;
   continue; // any receipt reserves the date until a human/Agent verifies it
 }
 process.stdout.write(date+'\n');
 if(++count>=limit)break;
}
