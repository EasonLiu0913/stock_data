'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {build}=require('../scripts/research_mvp10_evidence_safe_nine_scene_script');
const {assertOpening}=require('../scripts/daily_gainers_brand_opening');
function temp(fn){const d=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-full-reconciled-'));try{return fn(d)}finally{fs.rmSync(d,{recursive:true,force:true})}}
test('nine-scene full research draft excludes unsupported original claims and preserves V4',()=>temp(d=>{
 const result=build(process.cwd(),path.join(d,'output')),j=JSON.parse(fs.readFileSync(result.path));
 assert.equal(j.scenes.length,9);
 assert.equal(j.stock_count,32);
 assert.equal(j.render_authorized,false);
 assert.equal(j.publication_authorized,false);
 assert.equal(j.market_summary_final,false);
 assert.equal(j.eligible_stock_identity_verified,false);
 assert.deepEqual(j.remaining_legacy_prose_unverified_scenes,[]);
 assert.deepEqual(j.independent_numeric_original_source_verified_codes,['9919','6672','2305','1301','3416','2428']);
 assertOpening(j.scenes[0].narration);
 for(let index=3;index<=6;index++){
  assert.equal(j.scenes[index].source_provenance_review,'EXCHANGE_NUMERIC_SOURCE_CHECK_PASS_CAUSAL_NOT_VERIFIED');
  assert(!/年增百分之|新合約已|需求與漲價效應支撐/.test(j.scenes[index].narration));
 }
 assert.deepEqual(j.scenes[6].stock_codes,['3416','2428']);
 assert.doesNotMatch(JSON.stringify(j.scenes),/9103|美德醫療|南染|三十五檔|35檔/);
 assert.equal(j.independent_news_causality_verified,false);
 assert.equal(result.scene_count,9);
 assert(result.narration_chars>1100&&result.narration_chars<5500);
}));
test('original script remains unchanged',()=>temp(d=>{
 const p='video_scripts/daily-gainers/20261008.json',before=fs.readFileSync(p);
 build(process.cwd(),path.join(d,'output'));
 assert(fs.readFileSync(p).equals(before));
}));
test('unsafe output location and second-use workspace fail',()=>temp(d=>{
 assert.throws(()=>build(process.cwd(),process.cwd()),/OUTPUT_MUST_BE_OUTSIDE_REPOSITORY/);
 const p=path.join(d,'out');build(process.cwd(),p);
 assert.throws(()=>build(process.cwd(),p),/OUTPUT_ALREADY_EXISTS/);
}));
