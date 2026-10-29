#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=process.cwd(),date='20261008',tmp=fs.mkdtempSync(path.join(os.tmpdir(),'historical-replay-preflight-'));
function copy(from,to=from){const dest=path.join(tmp,to);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,from),dest);}
try {
  for(const p of ['scripts/validate_daily_gainers_video_script.js','scripts/daily_gainers_brand_opening.js','data_daily_gain_over_5/20261008.json','data_daily_gain_over_5/analysis-ai/20261008.json','data_daily_gain_over_5/market-summary/20261008.json'])copy(p);
  copy('recovery-requests/video-date-selection-research/replay-input/20261008.json','video_scripts/daily-gainers/20261008.json');
  const r=cp.spawnSync(process.execPath,['scripts/validate_daily_gainers_video_script.js',date],{cwd:tmp,encoding:'utf8'});
  process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
  assert.equal(r.status,0,'derived research-only preflight must pass unchanged validator');
  const original=fs.readFileSync(path.join(root,'video_scripts/daily-gainers/20261008.json'));
  const derived=fs.readFileSync(path.join(tmp,'video_scripts/daily-gainers/20261008.json'));
  assert.notDeepEqual(original,derived,'replay source must remain independent');
  console.log('PASS derived 20261008 preflight in isolated temporary workspace; repository original untouched');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
