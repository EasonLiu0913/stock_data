#!/usr/bin/env node
'use strict';
// Trial original validators in an ephemeral isolated checkout. Research only.
// Does NOT mark any unverified 32-stock universe as final/complete.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const {build:buildStoryboard}=require('./research_mvp10_evidence_safe_nine_scene_script');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const date='20261008';
function writeJSON(p,data){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n',{flag:'wx'})}
function copy(root,stage,p){const src=path.join(root,p),dst=path.join(stage,p);if(!fs.existsSync(src))throw Error('REQUIRED_SOURCE_MISSING:'+p);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL)}
function fromSource(root,p){return JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))}
function run(root,out){
 if(!root||!out||path.resolve(out)===path.resolve(root)||path.resolve(out).startsWith(path.resolve(root)+path.sep))
  throw Error('MUST_USE_ISOLATED_TEMP_OUTPUT');
 if(fs.existsSync(out))throw Error('TEMP_OUTPUT_ALREADY_EXISTS');
 const storyboard=buildStoryboard(root,path.join(out,'source-research'));
 const research=JSON.parse(fs.readFileSync(storyboard.path,'utf8'));
 if(research.render_authorized!==false||research.stock_count!==32||research.scenes.length!==9||
    research.eligible_stock_identity_verified!==false)throw Error('PREMATURE_INPUT_APPROVAL');
 const candidateRoot=path.join(out,'source-research','stock-category-only');
 const candidate=JSON.parse(fs.readFileSync(path.join(candidateRoot,'manifest.json')));
 if(candidate.stock_identity_scope_certified!==false||candidate.provisional_stock_count!==32)throw Error('CANDIDATE_SCOPE_UNKNOWN');
 const stage=path.join(out,'original-validator-sandbox');
 const scriptFiles=[
  'scripts/build_daily_gainers_market_summary.js',
  'scripts/validate_daily_gainers_market_summary.js',
  'scripts/validate_daily_gainers_video_script.js',
  'scripts/daily_gainers_brand_opening.js',
  'scripts/daily_gainers_mvp10_ordinary_scope_gate.js',
  'scripts/lib/daily_gainers_ai_contract.js'
 ];
 const configFiles=['config/daily-gainers-ai-contract.json','config/daily-gainers-theme-taxonomy.json'];
 for(const p of [...scriptFiles,...configFiles])copy(root,stage,p);
 const srcBase='data_daily_gain_over_5';
 const mapped=[
  {kind:'raw',original:srcBase+'/'+date+'.json',dest:srcBase+'/'+date+'.json',key:'stocks'},
  {kind:'news',original:srcBase+'/analysis-news/'+date+'.json',dest:srcBase+'/analysis-news/'+date+'.json',key:'analyses'},
  {kind:'facts',original:srcBase+'/analysis-facts/'+date+'.json',dest:srcBase+'/analysis-facts/'+date+'.json',key:'stocks'},
  {kind:'ai',original:srcBase+'/analysis-ai/'+date+'.json',dest:srcBase+'/analysis-ai/'+date+'.json',key:'analyses'}
 ];
 for(const item of mapped){
  const frozen=fromSource(root,item.original),candidateFile=path.join(candidateRoot,item.kind+'-row-candidates.json');
  const rec=JSON.parse(fs.readFileSync(candidateFile));
  if(rec.stock_count!==32||rec.canonical_daily_video_input!==false||rec.target_date!==date)
    throw Error('CANDIDATE_DATA_NOT_READY:'+item.kind);
  frozen[item.key]=rec.records;
  frozen.stock_count=rec.records.length;
  if(item.kind==='facts')frozen.market_context={...frozen.market_context,gainer_count:32,breadth_regime:'selective_risk_on'};
  if(item.kind==='ai'){
   // Critical: never carry a 35-stock market summary into a 32-stock draft.
   delete frozen.market_summary;delete frozen.priority_watchlist;
  }
  frozen.research_trial_only=true;
  frozen.original_source_claims_independently_reverified=false;
  writeJSON(path.join(stage,item.dest),frozen);
 }
 // Day-before file only used to compute official builder's baseline breadth, not classified as new video universe.
 copy(root,stage,srcBase+'/20261007.json');
 // Keep published analysis ABSENT so the unverified legacy synthesis cannot become status:'final'.
 if(fs.existsSync(path.join(stage,srcBase,'analysis',date+'.json')))throw Error('PUBLISHED_ANALYSIS_MUST_REMAIN_ABSENT');
 const script={
  schema_version:1,methodology_version:'chatgpt-video-script-v1',target_date:date,
  source_summary_generated_at:fromSource(root,'video_scripts/daily-gainers/'+date+'.json').source_summary_generated_at,
  stock_count:32,privacy_status:'private',research_trial_only:true,
  source_identity_verified:false,source_semantics_verified:false,
  scenes:research.scenes.map(s=>({title:s.title,subtitle:s.subtitle,bullets:s.bullets,
    narration:s.narration,stock_codes:s.stock_codes,footer:s.footer||''}))
 };
 writeJSON(path.join(stage,'video_scripts/daily-gainers',date+'.json'),script);
 function runCmd(args){
  const r=cp.spawnSync(process.execPath,args,{cwd:stage,encoding:'utf8',timeout:60_000});
  return {command:['node',...args].join(' '),exit_code:r.status,
   stdout:(r.stdout||'').slice(-3500),stderr:(r.stderr||'').slice(-3500)};
 }
 const build=runCmd(['scripts/build_daily_gainers_market_summary.js','--date',date]);
 if(build.exit_code!==0)throw Error('ORIGINAL_SUMMARY_BUILDER_FAILED:'+JSON.stringify(build));
 const summaryPath=path.join(stage,srcBase,'market-summary',date+'.json');
 if(!fs.existsSync(summaryPath))throw Error('SUMMARY_NOT_WRITTEN');
 const summary=JSON.parse(fs.readFileSync(summaryPath));
 if(summary.status!=='preliminary'||summary.coverage?.overall==='complete'||
    summary.breadth?.stock_count!==32||summary.source_lineage?.analysis?.available!==false)
   throw Error('UNVERIFIED_CHAIN_WRONGLY_PROMOTED_TO_FINAL');
 const validateSummary=runCmd(['scripts/validate_daily_gainers_market_summary.js','--date',date]);
 if(validateSummary.exit_code!==0)throw Error('ORIGINAL_SUMMARY_VALIDATOR_REJECTED_PRELIMINARY:'+JSON.stringify(validateSummary));
 const validateVideo=runCmd(['scripts/validate_daily_gainers_video_script.js',date]);
 if(validateVideo.exit_code===0)throw Error('STRICT_VIDEO_GATE_BYPASSED_UNVERIFIED_ANALYSIS');
 if(!/summary not final\/complete/.test(validateVideo.stderr))throw Error('UNEXPECTED_STRICT_VIDEO_FAILURE:'+validateVideo.stderr);
 const report={schema_version:1,date,scope:'RESEARCH_ONLY_TEMP_VALIDATOR_TRIAL',
  candidate_count:32,study_scenario:'stock-category-only',
  original_summary_builder:build,original_summary_validator:validateSummary,
  original_video_validator:validateVideo,
  summary_status:summary.status,summary_stage:summary.summary_stage,
  summary_coverage:summary.coverage,summary_sha256:hash(fs.readFileSync(summaryPath)),
  source_32_stock_data_canonical_schema_candidate:true,
  original_final_analysis_generated:false,original_ai_claim_semantics_reverified:false,
  date_effective_common_stock_identity_verified:false,
  full_video_validation_success:false,mp4_generated:false,render_authorized:false,
  publication_authorized:false,decision:'PRELIMINARY_ORIGINAL_VALIDATOR_PASS_VIDEO_CORRECTLY_BLOCKED',
  next_gate:'Independent dated stock-type and full 32-stock AI/published semantics required before original builder can lawfully produce final coverage; no synthetic final status'
 };
 writeJSON(path.join(out,'strict-original-validators-report.json'),report);
 return {report_path:path.join(out,'strict-original-validators-report.json'),
  decision:report.decision,summary_status:summary.status,
  summary_validator_exit:validateSummary.exit_code,video_validator_exit:validateVideo.exit_code,
  status:'PASS_EXPECTED_FAIL_CLOSED',render_authorized:false};
}
if(require.main===module){try{const [root,out]=process.argv.slice(2);if(!root||!out)throw Error('Usage: node scripts/research_mvp10_trial_original_validators.js ROOT TEMP_OUT');
 console.log(JSON.stringify(run(root,out),null,2));
}catch(e){console.error(e.stack||e.message);process.exitCode=1}}
module.exports={run};
