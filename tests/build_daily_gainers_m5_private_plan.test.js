'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {build}=require('../scripts/build_daily_gainers_m5_private_plan');
test('M5 source-derived plan is seven scenes and release-locked',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m5-plan-'));
 try{
 const {plan,dir}=build(root);
 assert.equal(plan.target_date,'20261008');
 assert.equal(plan.scenes.length,7);
 assert.equal(plan.publication_authorized,false);
 for(const s of plan.scenes){assert.equal(s.speech_text,s.caption_text);assert.equal(s.caption_text,s.display_text);assert.equal(s.caption_cues[0].speech,s.speech_text);}
 assert.ok(fs.statSync(path.join(dir,'plan.json')).size>0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
