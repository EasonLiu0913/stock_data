'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {build}=require('../scripts/research_mvp10_full_editorial_storyboard');
const {assertOpening}=require('../scripts/daily_gainers_brand_opening');
function temp(fn){const d=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-storyboard-'));try{return fn(d)}finally{fs.rmSync(d,{recursive:true,force:true})}}
test('complete 9-scene research storyboard is source-aligned but cannot be rendered or published',()=>temp(dir=>{
 const r=build(process.cwd(),path.join(dir,'candidate'));
 const j=JSON.parse(fs.readFileSync(r.path));
 assert.equal(r.scene_count,9);
 assert(r.narration_chars>=1100&&r.narration_chars<=5500);
 assert.equal(j.stock_count,32);
 assert.equal(j.full_editorial_9_scene_draft,true);
 assert.equal(j.market_summary_final,false);
 assert.equal(j.render_authorized,false);
 assert.equal(j.publication_authorized,false);
 assert.equal(j.independently_verified_9919_numeric_source,true);
 assert.equal(j.independent_news_causality_verified,false);
 assert.deepEqual(j.remaining_legacy_prose_unverified_scenes,[4,5,6,7]);
 assertOpening(j.scenes[0].narration);
 assert.equal(j.scenes[0].title,'10月8日，32檔研究候選');
 assert.deepEqual(j.scenes[1].stock_codes,['9919','1325','6504']);
 assert.deepEqual(j.scenes[2].stock_codes,['9919']);
 assert.match(j.scenes[2].narration,/康那香/);
 assert.match(j.scenes[7].narration,/兩檔屬於低流動性訊號/);
 assert.doesNotMatch(JSON.stringify(j.scenes),/美德醫療|南染|9103|三十五檔|35檔/);
 assert.equal(j.presentation_contract.obsolete_cc_prompt_allowed,false);
}));
test('original 35-code script remains byte-identical after building research-only draft',()=>temp(dir=>{
 const p='video_scripts/daily-gainers/20261008.json',old=fs.readFileSync(p);
 build(process.cwd(),path.join(dir,'candidate'));
 assert(fs.readFileSync(p).equals(old));
 assert.equal(JSON.parse(old).stock_count,35);
}));
test('cannot overwrite a prior artifact or place it inside a checkout',()=>temp(dir=>{
 const out=path.join(dir,'candidate');build(process.cwd(),out);
 assert.throws(()=>build(process.cwd(),out),/OUTPUT_ALREADY_EXISTS/);
 assert.throws(()=>build(process.cwd(),process.cwd()),/OUTPUT_MUST_BE_ISOLATED/);
}));
