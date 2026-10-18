'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {run}=require('../scripts/research_date_to_video_d4_orchestrator');
for(const date of ['20261008','20261013']){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-'));
 const r=run('.',date,dir);
 assert.equal(r.target_date,date);assert.equal(r.render_authorized,false);assert.equal(r.publication_authorized,false);
 assert.ok(fs.existsSync(path.join(dir,'status.json')));
 if(['EVIDENCE_JOINED_NOT_CERTIFIED','PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING'].includes(r.stages[0].status)){
  const claims=JSON.parse(fs.readFileSync(path.join(dir,'claims.json')));
  assert.equal(claims.target_date,date);assert.ok(claims.claim_count>0);
  const institutional=JSON.parse(fs.readFileSync(path.join(dir,'institutional-evidence.json')));
  assert.equal(institutional.target_date,date);
  if(date==='20261008'){assert.equal(institutional.status,'VERIFIED');assert.equal(institutional.final_six_rows_verified,true);assert.equal(r.stages[1].status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');}
  if(date==='20261013'){assert.equal(institutional.status,'WAITING_SOURCE');assert.ok(r.blockers.includes('FINAL_DATED_BFI82U_THREE_GROUPS_PENDING'));}
  const breadth=JSON.parse(fs.readFileSync(path.join(dir,'breadth-evidence.json')));
  assert.equal(breadth.target_date,date);assert.equal(breadth.publication_authorized,false);
  if(date==='20261008'){assert.equal(breadth.status,'OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED');assert.equal(breadth.legal_identity_master_certified,false);assert.equal(r.stages[1].status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');}
  if(date==='20261013'){assert.equal(breadth.status,'OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED');assert.equal(breadth.legal_identity_master_certified,false);assert.ok(!r.blockers.includes('DATED_MI_INDEX_STOCK_AGGREGATE_PENDING'));}
  const master=JSON.parse(fs.readFileSync(path.join(dir,'market-master.json')));
  assert.equal(master.target_date,date);assert.equal(master.publication_authorized,false);
  if(date==='20261008'){assert.equal(master.status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');assert.ok(master.market_trading.turnover_twd>0);assert.equal(master.ordinary_share_identity_certified,false);}
  if(date==='20261013')assert.equal(master.status,'WAITING_SOURCE');
  const brief=JSON.parse(fs.readFileSync(path.join(dir,'editorial-research-brief.json')));
  assert.equal(brief.target_date,date);assert.equal(brief.editorial_certified,false);assert.equal(brief.narration_authorized,false);assert.equal(brief.render_authorized,false);assert.equal(brief.original_analysis,null);
  if(date==='20261008'){assert.equal(brief.status,'OBSERVATIONS_READY_INDEPENDENT_ANALYSIS_REQUIRED');assert.equal(brief.observations.length,3);assert.equal(brief.derived_comparisons.breadth_net_count,master.breadth.advancers-master.breadth.decliners);assert.equal(brief.derived_comparisons.institutional_total_net_twd,['foreign','investment_trust','dealers'].reduce((sum,name)=>sum+master.institutional[name].net_twd,0));assert.equal(brief.derived_comparisons.interpretation_status,'OBSERVATION_ONLY_NO_CAUSAL_CLAIM');}
  if(date==='20261013'){assert.equal(brief.status,'WAITING_MARKET_MASTER');assert.equal(brief.observations.length,0);assert.equal(brief.derived_comparisons,undefined);}
  const task=JSON.parse(fs.readFileSync(path.join(dir,'original-analysis-task.json')));
  assert.equal(task.target_date,date);assert.equal(task.market_master_sha256,brief.source_master_sha256);assert.equal(task.draft,null);assert.equal(task.independent_review_required,true);assert.equal(task.narration_authorized,false);assert.equal(task.render_authorized,false);
  if(date==='20261008'){assert.equal(task.status,'READY_FOR_EVIDENCE_GROUNDED_DRAFT');assert.equal(task.required_sections.length,5);}
  if(date==='20261013')assert.equal(task.status,'WAITING_MARKET_MASTER');
  const review=JSON.parse(fs.readFileSync(path.join(dir,'editorial-review.json')));
  assert.equal(review.claim_whitelist_verified,false);assert.equal(review.render_authorized,false);
  if(date==='20261013'){assert.equal(r.stages[0].status,'PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING');assert.ok(r.blockers.includes('MISSING:market-opening'));}
 }else assert.equal(r.stages[0].status,'WAITING_SOURCE');
 console.log('D4_ORCHESTRATOR_DATE_STATUS '+date+' '+r.stages[0].status);
}
const draftDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-draft-'));
fs.writeFileSync(path.join(draftDir,'original-analysis-draft-input.json'),JSON.stringify({target_date:'20261008',insights:[]}));
const rejected=run('.','20261008',draftDir);
const draftCheck=JSON.parse(fs.readFileSync(path.join(draftDir,'original-analysis-draft-check.json')));
assert.equal(draftCheck.status,'REJECTED');assert.equal(draftCheck.reason,'EMPTY_INSIGHTS');assert.equal(draftCheck.narration_authorized,false);assert.equal(rejected.render_authorized,false);assert.ok(rejected.blockers.includes('ORIGINAL_ANALYSIS_DRAFT_REJECTED'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-missing-'));
const missing=run('.','20261014',dir);assert.equal(missing.stages[0].status,'WAITING_SOURCE');
assert.equal(missing.render_authorized,false);assert.equal(missing.artifacts.length,1);
console.log('D4_ORCHESTRATOR_FAIL_CLOSED_PASS');
