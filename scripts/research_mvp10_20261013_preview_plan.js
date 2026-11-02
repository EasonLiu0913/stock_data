#!/usr/bin/env node
'use strict';
// MVP10-A research preview PLAN only. Do not claim source final, media or publication PASS.
const fs=require('node:fs'),path=require('node:path');
const {addOpening,assertOpening,OPENING_TEXT}=require('./daily_gainers_brand_opening');
const {renderDashboard,OWNER_LOCKED_DASHBOARD_VERSION}=require('./research_mvp10_20261013_dashboard');
const DATE='20261013';
const INPUT='data_research/m5/mvp10-20261013-research/20stock-seven-scene-script-draft.json';
const ANALYSIS='data_research/m5/mvp10-20261013-research/20stock-analysis-candidate.json';
const OUTPUT='output/daily-gainers-video/20261013';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const xml=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function wrap(s,max=29){const a=[...String(s)];return Array.from({length:Math.ceil(a.length/max)},(_,i)=>a.slice(i*max,(i+1)*max).join(''));}
function slide(scene,i,n,analyses){
 return renderDashboard(scene,i,n,analyses);
}

function make(root='.'){
 const file=path.join(root,INPUT),aFile=path.join(root,ANALYSIS);
 const raw=read(file),a=read(aFile);
 if(raw.target_date!==DATE||a.target_date!==DATE||raw.stock_count!==20||a.stock_count!==20||
    raw.scenes?.length!==7||a.analyses?.length!==20||raw.editorial_approved!==false||
    a.editorial_approval!==false||raw.render_authorized!==false||a.render_authorized!==false||
    raw.publication_authorized!==false||a.publication_authorized!==false)
  throw Error('PREVIEW_ONLY_UNAPPROVED_RESEARCH_SOURCE_REQUIRED');
 const codes=new Set(a.analyses.map(s=>String(s.code)));
 if(codes.size!==20||a.analyses.some(s=>s.cause_type!=='unknown'||s.evidence_strength!=='none')||
   raw.scenes.some(s=>s.stock_codes.some(c=>!codes.has(String(c))))||
   raw.scenes.some(s=>/percent/i.test(s.narration)||s.narration.includes('百分之百分之')))
  throw Error('UNSAFE_PREVIEW_SCRIPT_CLAIMS_OR_STOCK_SCOPE');
 const scenes=raw.scenes.map((scene,i)=>{
  const narration=i===0?addOpening(scene.narration):scene.narration;
  if(i===0)assertOpening(narration);
  return {id:i+1,title:scene.title,subtitle:scene.subtitle,bullets:scene.bullets,
   dashboard_layout_version:OWNER_LOCKED_DASHBOARD_VERSION,
   narration,stock_codes:scene.stock_codes,
   footer:'研究粗剪｜禁止發布｜需來源與編輯審核',
   speech_text:narration,caption_text:narration};
 });
 if(!scenes[0].narration.startsWith(OPENING_TEXT)||
    scenes[0].narration.indexOf(OPENING_TEXT,OPENING_TEXT.length)!==-1)
  throw Error('RESEARCH_PREVIEW_V4_OPENING_MISSING_OR_DUPLICATE');
 const out=path.join(root,OUTPUT),dir=path.join(out,'slides');
 if(fs.existsSync(out))throw Error('PREVIEW_OUTPUT_MUST_BE_NEW');
 fs.mkdirSync(dir,{recursive:true});
 for(const s of scenes){
  const svg=slide(s,s.id-1,scenes.length,a.analyses);
  if(!svg.includes('data-dashboard-version="'+OWNER_LOCKED_DASHBOARD_VERSION+'"')||
     !svg.includes('股票／代號')||!svg.includes('外資 張')||
     !svg.includes('投信 張')||!svg.includes('融資 張')||
     !svg.includes('分點 張')||!svg.includes('量比'))
    throw Error('OWNER_APPROVED_TABLE_DASHBOARD_REQUIRED_ON_EVERY_SCENE');
  fs.writeFileSync(path.join(dir,String(s.id).padStart(2,'0')+'.svg'),svg,{flag:'wx'});
 }
 const plan={schema_version:1,methodology_version:'research-mvp10-20261013-preview-v1',
  target_date:DATE,dashboard_layout_version:OWNER_LOCKED_DASHBOARD_VERSION,scene_count:scenes.length,narration_chars:scenes.reduce((n,x)=>n+[...x.narration].length,0),
  research_only:true,source_final_approved:false,source_classification_effective_date_verified:false,
  original_video_validator_pass:false,render_preview_only:true,
  publication_authorized:false,youtube_upload_authorized:false,
  source_files:[INPUT,ANALYSIS],scenes};
 fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(out,'research-preview-boundary.json'),
  JSON.stringify({target_date:DATE,stock_count:20,scene_count:7,
   source_editorial_approved:false,source_final_complete:false,
   full_render_validation_pass:false,video_release_approved:false,
   youtube_upload_authorized:false,publication_authorized:false,
   not_a_substitute_for_original_AB:true},null,2)+'\n',{flag:'wx'});
 return {plan,out};
}
if(require.main===module){
 const {plan,out}=make(process.argv[2]||'.');
 console.log(JSON.stringify({plan:path.join(out,'plan.json'),scene_count:plan.scene_count,
  spoken_chars:plan.narration_chars,release:false,preview:true}));
}
module.exports={make,slide};
