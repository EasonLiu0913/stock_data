'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {make,slide}=require('../scripts/research_mvp10_20261013_preview_plan');
const {OPENING_TEXT}=require('../scripts/daily_gainers_brand_opening');
const {OWNER_LOCKED_DASHBOARD_VERSION,renderDashboard}=require('../scripts/research_mvp10_20261013_dashboard');
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
  assert.equal(r.plan.dashboard_layout_version,OWNER_LOCKED_DASHBOARD_VERSION);
  assert.ok(r.plan.scenes.every(sc=>sc.dashboard_layout_version===OWNER_LOCKED_DASHBOARD_VERSION));
  for(let i=1;i<=7;i++){
   const svg=fs.readFileSync(path.join(r.out,'slides',String(i).padStart(2,'0')+'.svg'),'utf8');
   assert.match(svg,/data-dashboard-version="TAIWAN_STOCK_TABLE_LIST_20261102_V1"/);
   for(const label of ['股票／代號','漲幅','外資 張','投信 張','融資 張','分點 張','量比'])
    assert.ok(svg.includes(label),'scene '+i+' missing required table column '+label);
   assert.ok(svg.includes('y="704"'),'must reserve burned-subtitle lane');
   assert.ok(svg.includes('y="359"'),'must render screenshot-style full-width stock table');
  }
  assert.ok(r.plan.scenes[0].narration.startsWith(OPENING_TEXT));
  assert.equal(r.plan.scenes[0].narration.split(OPENING_TEXT).length-1,1);
  assert.equal(r.plan.scenes[0].speech_text,r.plan.scenes[0].caption_text);
  const p=JSON.parse(fs.readFileSync(path.join(r.out,'research-preview-boundary.json')));
  assert.equal(p.publication_authorized,false);
  assert.equal(p.source_final_complete,false);
  assert.equal(p.not_a_substitute_for_original_AB,true);
  assert.ok(fs.readFileSync(path.join(r.out,'slides/01.svg'),'utf8').includes('1920 1080'));
  const slide=fs.readFileSync(path.join(r.out,'slides/01.svg'),'utf8');
  assert.ok(slide.includes('x="1100" y="24"'));
  assert.ok(slide.includes('研究粗剪｜股別與編輯未驗收｜禁止發布'));
  assert.ok(!slide.includes('y="987"'));
  assert.ok(slide.includes('y="704"'), 'on-frame burn captions have a distinct area above progress');
  assert.ok(slide.includes('y="929"'), 'footnote stays under progress overlay');
  assert.ok(slide.includes('外資 張'), 'stock-level institutional data column visible');
  assert.ok(slide.includes('融資 張'), 'margin data column visible');
  assert.ok(slide.includes('分點 張'), 'broker-flow data column visible');
  assert.ok(slide.includes('20 檔'), 'opening cards show research-universe size');
  assert.ok(slide.includes('研究候選'), 'never mislabel candidate count as all-market count');

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

test('owner-locked screenshot layout supports multiple stock rows in EVERY scene, not four-cards only',()=>{
 const a=analysis().analyses;
 const scene={title:'資金結構｜法人方向和融資槓桿',subtitle:'多股比較',stock_codes:['6834','1001','1002']};
 const svg=renderDashboard(scene,1,7,a);
 assert.ok(svg.includes('data-dashboard-version="'+OWNER_LOCKED_DASHBOARD_VERSION+'"'));
 for(const code of ['6834','1001','1002'])assert.ok(svg.includes(code),'missing stock '+code);
 assert.ok(svg.includes('股票／代號')&&svg.includes('外資 張')&&svg.includes('分點 張'));
 assert.ok(svg.includes('研究粗剪｜股別與編輯未驗收｜禁止發布'));
 const intro=renderDashboard({...scene,stock_codes:[]},0,7,a);
 assert.ok(intro.includes('20 檔'));
 assert.ok(intro.includes('並非全市場上漲家數'));
 assert.ok(intro.includes('股票／代號'),'market opening must keep same list style');
 assert.throws(()=>renderDashboard({...scene,stock_codes:['9103']},1,7,a),/DASHBOARD_STOCK_NOT_IN_RESEARCH_SOURCE/);
});
