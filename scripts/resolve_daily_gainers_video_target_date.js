#!/usr/bin/env node
'use strict';
// Production candidate: fail closed; no hidden use of latest historical video script.
// The invocation date is a Taipei calendar date; if TWSE is closed, today's
// raw/same-date script cannot accidentally be replaced by an older file.
const fs=require('node:fs');
const path=require('node:path');
const input=(process.argv[2]||'').trim();
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const today=parts.year+parts.month+parts.day;
const date=input||today;
function fail(code){process.stderr.write(code+'\n');process.exit(2);}
if(!/^20\d{6}$/.test(date))fail('INVALID_DATE');
if(!input && !/^20\d{6}$/.test(today))fail('EXPECTED_DATE_UNPROVEN');
// Manual history remains research-only until a separate release approval; no silent historical execution.
if(input && input!==today)fail('HISTORICAL_DATE_REQUIRES_SEPARATE_AUTHORIZATION');
const root='data_daily_gain_over_5';
for(const p of [path.join(root,date+'.json'),path.join('video_scripts/daily-gainers',date+'.json')]){
 if(!fs.existsSync(p)||!fs.statSync(p).isFile()||!fs.statSync(p).size)fail('TARGET_DATE_INPUT_MISSING:'+p);
}
const raw=JSON.parse(fs.readFileSync(path.join(root,date+'.json'),'utf8'));
const script=JSON.parse(fs.readFileSync(path.join('video_scripts/daily-gainers',date+'.json'),'utf8'));
if(raw.target_date!==date||script.target_date!==date)fail('TARGET_DATE_MISMATCH');
process.stdout.write(date+'\n');
