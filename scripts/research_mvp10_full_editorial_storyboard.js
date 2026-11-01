#!/usr/bin/env node
'use strict';
// Materialize a complete RESEARCH storyboard and no-publish scenario evidence.
// This deliberately does NOT produce the canonical video_scripts or mark a
// market-summary as final. Existing source gates remain authoritative.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {run:buildAggregates}=require('./research_mvp10_candidate_aggregate');
const {inspect:conditionalDrafts}=require('./research_mvp10_conditional_editorial_drafts');
const {verify:verifyLead}=require('./research_mvp10_9919_official_claim_gate');
const {addOpening,assertOpening}=require('./daily_gainers_brand_opening');
const {verifyPresentationDocument}=require('./daily_gainers_presentation_contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(root,out){
 if(!root||!out||path.resolve(out)===path.resolve(root)||path.resolve(out).startsWith(path.resolve(root)+path.sep))
  throw Error('OUTPUT_MUST_BE_ISOLATED');
 if(fs.existsSync(out))throw Error('OUTPUT_ALREADY_EXISTS');
 const aggregates=buildAggregates(root,out);
 if(JSON.stringify(aggregates.map(x=>x.stock_count))!=='[32,34]')throw Error('SCENARIO_DRIFT');
 const baseline=path.join(out,'stock-category-only');
 const candidate=JSON.parse(fs.readFileSync(path.join(baseline,'manifest.json')));
 const summary=JSON.parse(fs.readFileSync(path.join(baseline,'recalculated-aggregate-research.json')));
 const draft=conditionalDrafts(root,'20261008');
 const lead=verifyLead(root);
 if(lead.code!=='9919'||lead.margin.delta!==-327||lead.institutional.foreign.net_shares!==-18000||
    lead.render_authorized!==false||lead.date_effective_ordinary_identity_verified!==false)
    throw Error('LEAD_ORIGINAL_SOURCE_UNVERIFIED');
 if(summary.stock_count!==32||summary.reported_public_evidence_count!==11||
    candidate.stock_identity_scope_certified!==false||draft.scenarios[0].conditional_stock_count!==32)
  throw Error('SUMMARY_OR_UNIVERSE_DRIFT');
 const oldPath=path.join(root,'video_scripts/daily-gainers/20261008.json');
 const oldBuf=fs.readFileSync(oldPath),old=JSON.parse(oldBuf);
 if(old.target_date!=='20261008'||old.stock_count!==35||old.scenes.length!==9)
  throw Error('FROZEN_SCRIPT_CONTRACT_CHANGED');
 const drafts=draft.scenarios.find(s=>s.name==='STOCK_CATEGORY_ONLY')?.affected_scene_drafts;
 if(!drafts)throw Error('STOCK_ONLY_SCENES_MISSING');
 const allowable=new Set(candidate.code_order);
 const scenes=old.scenes.map((s,i)=>{
  const original=i+1, copied={...s,bullets:[...s.bullets],stock_codes:[...(s.stock_codes||[])]};
  let changed=false;
  if(drafts[String(original)]){
   copied.narration=drafts[String(original)];
   copied.stock_codes=original===2?['9919','1325','6504']:original===3?['9919']:[];
   changed=true;
  }
  if(original===1){
   copied.title='10月8日，32檔研究候選';
   copied.subtitle='上市普通股分類尚待日期有效性確認';
   copied.bullets=['32檔 Stock 分類候選，待歷史身分確認','防疫相關分類3檔','既有佐證紀錄11檔，34.4%'];
  }else if(original===2){
   copied.title='防疫主題：3檔研究候選';
   copied.subtitle='題材分類不等於新增訂單';
   copied.bullets=['防疫分類3檔、平均漲幅9.89%','康那香、恆大、南六','逐股公司訂單仍待查證'];
  }else if(original===3){
   copied.title='康那香：價格與籌碼交叉驗證';
   copied.subtitle='同日來源已對帳，新聞因果未證實';
   copied.bullets=['9919 收16.10元','外資賣超18張','融資餘額減少327張'];
  }else if(original===8){
   const theme=summary.theme_ranking.find(t=>t.theme_id==='low_liquidity');
   if(theme?.stock_count!==2)throw Error('LOW_LIQUIDITY_COUNT_NOT_2');
   copied.narration=copied.narration.replace('三檔屬於低流動性訊號','兩檔屬於低流動性訊號');
   copied.bullets=copied.bullets.map(x=>x.replace('低流動性類有3檔','低流動性類有2檔'));
   changed=true;
  }else if(original===9){
   copied.title='明日觀察：只列可查證訊號';
   copied.subtitle='32檔仍是有條件的研究候選';
   copied.bullets=['題材能否續量','法人資金方向是否延續','不將傳聞當成訂單或業績'];
  }
  for(const code of copied.stock_codes)if(!allowable.has(String(code)))
   throw Error('NONCANDIDATE_SCENE_STOCK:'+original+':'+code);
  const text=JSON.stringify(copied);
  if(/美德醫療|南染|9103|三十五檔|35檔/.test(text))
   throw Error('LEGACY_DR_OR_35_STOCK_TEXT:'+original);
  if(copied.narration.length<75||copied.narration.length>1800||
     copied.title.length>85||copied.subtitle.length>160||copied.bullets.length>5)
    throw Error('SCENE_STRUCTURE_INVALID:'+original);
  return {...copied,source_provenance_review:original===3?
   'LEAD_NUMERIC_OFFICIAL_SOURCE_CHECK_PASS_CAUSAL_CLAIMS_UNVERIFIED':
   changed?'RECALCULATED_RESEARCH_ONLY_NOT_FINAL':
   'LEGACY_PROSE_NEEDS_FULL_SOURCE_CLAIM_REVALIDATION'};
 });
 scenes[0].narration=addOpening(scenes[0].narration);
 assertOpening(scenes[0].narration);
 const presentation=verifyPresentationDocument({scenes});
 const length=scenes.reduce((n,s)=>n+[...s.narration].length,0);
 if(length<1100||length>5500)throw Error('VIDEO_NARRATION_OUTSIDE_SOURCE_CONTRACT:'+length);
 const gate={
  schema_version:1,scope:'RESEARCH_ONLY_NOT_A_CANONICAL_SCRIPT',target_date:'20261008',
  scenario:'stock-category-only',source_script_sha256:sha(oldBuf),
  source_aggregate_sha256:aggregates[0].aggregate_sha256,
  candidate_manifest_sha256:aggregates[0].manifest_sha256,
  stock_count:32,eligible_stock_identity_verified:false,
  upstream_ai_semantic_reverified:false,market_summary_final:false,
  full_editorial_9_scene_draft:true,scene_count:9,narration_chars:length,
  independently_verified_9919_numeric_source:true,
  independent_news_causality_verified:false,
  presentation_contract:presentation,
  remaining_legacy_prose_unverified_scenes:scenes.flatMap((s,i)=>s.source_provenance_review==='LEGACY_PROSE_NEEDS_FULL_SOURCE_CLAIM_REVALIDATION'?[i+1]:[]),
  render_authorized:false,publication_authorized:false,
  decision:'FULL_EDITORIAL_DRAFT_READY_FOR_SOURCE_AUDIT_NOT_RENDER'
 };
 const output={...gate,privacy_status:'private',scenes};
 const dest=path.join(baseline,'full-nine-scene-editorial-draft.json');
 const bytes=Buffer.from(JSON.stringify(output,null,2)+'\n');
 fs.writeFileSync(dest,bytes,{flag:'wx'});
 return {path:dest,sha256:sha(bytes),narration_chars:length,unverified_scenes:gate.remaining_legacy_prose_unverified_scenes,
  scene_count:9,render_authorized:false};
}
if(require.main===module){try{
 const [root,out]=process.argv.slice(2);if(!root||!out)throw Error('Usage: node scripts/research_mvp10_full_editorial_storyboard.js REPO OUTSIDE_REPO_DIR');
 console.log(JSON.stringify(build(root,out),null,2));
}catch(e){console.error(e.stack||e.message);process.exitCode=1}}
module.exports={build};
