'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {make,slide}=require('../scripts/research_mvp10_20261013_preview_plan');
const {OPENING_TEXT}=require('../scripts/daily_gainers_brand_opening');
const original=()=>({target_date:'20261013',stock_count:20,
  editorial_approved:false,render_authorized:false,publication_authorized:false,
  scenes:Array.from({length:7},(_,i)=>({title:'研究場景'+i,subtitle:'財務資料',
    bullets:['籌碼研究'],narration:'外資買超三張。'.repeat(20),stock_codes:['6834']}))});
const analysis=()=>({target_date:'20261013',stock_count:20,
 editorial_approval:false,render_authorized:false,publication_authorized:false,
 analyses:Array.from({length:20},(_,i)=>({code:i===0?'6834':String(1000+i),
  cause_type:'unknown',evidence_strength:'none'}))});
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-preview-plan-'));
 const directory=path.join(root,'data_research/m5/mvp10-20261013-research');
 fs.mkdirSync(directory,{recursive:true});
 return {root,write:(s,a)=>{fs.writeFileSync(path.join(directory,'20stock-seven-scene-script-draft.json'),JSON.stringify(s));
 fs.writeFileSync(path.join(directory,'20stock-analysis-candidate.json'),JSON.stringify(a));}};
}
test('renders seven 1080p research scene slides and explicit release false',()=>{
 const x=fixture();
 try{
  x.write(original(),analysis());const r=make(x.root);
  assert.equal(r.plan.scene_count,7);
  assert.ok(r.plan.scenes[0].narration.startsWith(OPENING_TEXT));
  assert.equal(r.plan.scenes[0].narration.split(OPENING_TEXT).length-1,1);
  assert.equal(r.plan.scenes[0].speech_text,r.plan.scenes[0].caption_text);
  const p=JSON.parse(fs.readFileSync(path.join(r.out,'research-preview-boundary.json')));
  assert.equal(p.publication_authorized,false);
  assert.equal(p.source_final_complete,false);
  assert.equal(p.not_a_substitute_for_original_AB,true);
  assert.ok(fs.readFileSync(path.join(r.out,'slides/01.svg'),'utf8').includes('1920 1080'));
  assert.throws(()=>make(x.root),/PREVIEW_OUTPUT_MUST_BE_NEW/);
 }finally{fs.rmSync(x.root,{recursive:true,force:true});}
});
test('never accepts false permission flags or outside-source security code',()=>{
 const x=fixture();
 try{
  const s=original(),a=analysis();s.editorial_approved=true;x.write(s,a);
  assert.throws(()=>make(x.root),/PREVIEW_ONLY_UNAPPROVED_RESEARCH_SOURCE_REQUIRED/);
  s.editorial_approved=false;s.scenes[0].stock_codes=['9103'];x.write(s,a);
  assert.throws(()=>make(x.root),/UNSAFE_PREVIEW_SCRIPT_CLAIMS_OR_STOCK_SCOPE/);
 }finally{fs.rmSync(x.root,{recursive:true,force:true});}
});
