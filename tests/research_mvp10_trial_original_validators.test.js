'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {run}=require('../scripts/research_mvp10_trial_original_validators');
function temp(fn){const d=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-validator-trial-'));try{return fn(d)}finally{fs.rmSync(d,{recursive:true,force:true})}}
test('real original validators accept preliminary and correctly reject non-final stock universe',()=>temp(dir=>{
 const r=run(process.cwd(),path.join(dir,'trial'));const j=JSON.parse(fs.readFileSync(r.report_path));
 assert.equal(r.status,'PASS_EXPECTED_FAIL_CLOSED');
 assert.equal(j.candidate_count,32);
 assert.equal(j.summary_status,'preliminary');
 assert.equal(j.original_summary_validator.exit_code,0);
 assert.notEqual(j.original_video_validator.exit_code,0);
 assert.match(j.original_video_validator.stderr,/summary not final\/complete/);
 assert.equal(j.full_video_validation_success,false);
 assert.equal(j.date_effective_common_stock_identity_verified,false);
 assert.equal(j.original_final_analysis_generated,false);
 assert.equal(j.render_authorized,false);
 assert.equal(j.mp4_generated,false);
 assert.equal(j.publication_authorized,false);
 assert.equal(j.summary_coverage.analysis,'missing');
}));
test('frozen 20261008 root raw and video script remain unchanged',()=>temp(dir=>{
 const p=['data_daily_gain_over_5/20261008.json','video_scripts/daily-gainers/20261008.json',
  'data_daily_gain_over_5/market-summary/20261008.json'];
 const original=p.map(x=>fs.readFileSync(x));
 run(process.cwd(),path.join(dir,'trial'));
 p.forEach((x,i)=>assert(fs.readFileSync(x).equals(original[i]),x));
}));
test('existing directory or root output prohibited',()=>temp(dir=>{
 assert.throws(()=>run(process.cwd(),process.cwd()),/MUST_USE_ISOLATED_TEMP_OUTPUT/);
 const p=path.join(dir,'trial');fs.mkdirSync(p);
 assert.throws(()=>run(process.cwd(),p),/TEMP_OUTPUT_ALREADY_EXISTS/);
}));
