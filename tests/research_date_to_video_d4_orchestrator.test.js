'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {run,inspectSchedulerHandoff}=require('../scripts/research_date_to_video_d4_orchestrator');
for(const date of ['20261008','20261013']){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-'));
 const r=run('.',date,dir);
 assert.equal(r.target_date,date);assert.equal(r.render_authorized,false);assert.equal(r.publication_authorized,false);
 assert.ok(fs.existsSync(path.join(dir,'status.json')));
 const officialManifest=JSON.parse(fs.readFileSync(path.join(dir,'official-data-manifest.json')));
 const officialGate=JSON.parse(fs.readFileSync(path.join(dir,'official-manifest-master-gate.json')));
 assert.equal(officialManifest.target_date,date);assert.equal(officialGate.target_date,date);assert.equal(officialGate.manifest_sha256,officialManifest.manifest_sha256);
 assert.equal(officialGate.master_authorized,false);assert.equal(officialGate.publication_authorized,false);
 const recoveryPlan=JSON.parse(fs.readFileSync(path.join(dir,'official-data-recovery-plan.json')));
 assert.equal(recoveryPlan.target_date,date);
 assert.equal(officialManifest.target_date,recoveryPlan.target_date);
 assert.ok(recoveryPlan.sources.every(source=>source.source_date===date));
 assert.equal(recoveryPlan.manifest_sha256,officialManifest.manifest_sha256);
 assert.equal(recoveryPlan.sources.length,4);
 assert.equal(r.official_recovery_advice.manifest_sha256,recoveryPlan.manifest_sha256);
 assert.equal(r.official_recovery_advice.source_plan_sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'official-data-recovery-plan.json'))).digest('hex'));
 assert.deepEqual(r.official_recovery_advice.sources,recoveryPlan.sources.map(({id,status,action_required,automated_retrieval_allowed})=>({id,status,action_required,automated_retrieval_allowed})));
 if(date==='20261013'){
  assert.equal(r.market_base_recovery_advice,undefined);
  assert.ok(!r.blockers.includes('MARKET_OPENING_DATED_BASE_MISSING'));
  const base=JSON.parse(fs.readFileSync(path.join('data_daily_gain_over_5/market-opening',date+'.json'),'utf8'));
  const finalBfi=base.source_manifest.find(e=>e.source_name==='TWSE BFI82U final dated official report');
  const verified=JSON.parse(fs.readFileSync(path.join(dir,'market-master.json'),'utf8'));
  const finalArchive=JSON.parse(fs.readFileSync(path.join('data_research/twse-market-opening/primary-archive',date,date+'-bfi82u.manifest.json'),'utf8'));
  assert.equal(finalBfi.source_date,date);
  assert.equal(finalBfi.source_sha256,finalArchive.sha256);
  assert.equal(verified.source_evidence.bfi82u_sha256,finalArchive.sha256);
  assert.equal(verified.status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');
  // A source-crosschecked dated master is editorial-pending, not a missing-source recovery trigger.
  assert.equal(r.stages[0].status,'EVIDENCE_JOINED_NOT_CERTIFIED');
  assert.equal(r.stages[1].status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');
  assert.equal(r.stages[2].status,'REVIEW_REQUIRED');
  assert.equal(r.official_recovery_advice.sources.find(x=>x.id==='BFI82U').action_required,'REUSE_VERIFIED_ARCHIVE');
  assert.equal(r.official_recovery_advice.sources.some(x=>x.automated_retrieval_allowed),false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'original-analysis-task.json'),'utf8')).status,'READY_FOR_EVIDENCE_GROUNDED_DRAFT');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'review-handoff-manifest.json'),'utf8')).status,'PENDING_INDEPENDENT_REVIEW');
  assert.equal(r.render_authorized,false);
  assert.equal(r.publication_authorized,false);
  // Scheduler handoff must be readable from the persisted status, not only the in-memory result.
  const readyHandoff=JSON.parse(fs.readFileSync(path.join(dir,'status.json'),'utf8'));
  assert.deepEqual(readyHandoff.stages,r.stages);
  assert.deepEqual(readyHandoff.official_recovery_advice,r.official_recovery_advice);
  assert.equal(readyHandoff.official_recovery_advice.sources.some(x=>x.automated_retrieval_allowed),false);
  assert.equal(readyHandoff.publication_authorized,false);
  console.log('D4_PERSISTED_EDITORIAL_PENDING_SCHEDULER_HANDOFF_PASS');
  console.log('D4_DATED_SOURCE_READY_EDITORIAL_PENDING_NO_REDUNDANT_RECOVERY_PASS');
 }

 assert.equal(r.official_recovery_advice.render_authorized,false);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'status.json'),'utf8')).official_recovery_advice,r.official_recovery_advice);
 assert.equal(recoveryPlan.sources.find(x=>x.id==='BFI82U').automated_retrieval_allowed,false);
 assert.equal(recoveryPlan.sources.find(x=>x.id==='BFI82U').action_required,'REUSE_VERIFIED_ARCHIVE');
 assert.ok(recoveryPlan.sources.filter(x=>x.id!=='BFI82U').every(x=>x.automated_retrieval_allowed===false));
 assert.equal(recoveryPlan.render_authorized,false);
 assert.equal(recoveryPlan.publication_authorized,false);
 for(const [id,file] of [['MI_INDEX','mi-index-provenance.json'],['FMTQIK','fmtqik-provenance.json']]){
  const diagnostic=JSON.parse(fs.readFileSync(path.join(dir,file)));
  const manifestEntry=officialManifest.entries.find(e=>e.id===id);
  const gateEntry=officialGate.validated_workflow_sources.find(e=>e.id===id);
  assert.equal(manifestEntry.source_date,date);
  assert.equal(manifestEntry.status,'WORKFLOW_OUTPUT_VALIDATED_FOR_RESEARCH_USE');
  assert.equal(manifestEntry.action_required,'REUSE_DATED_WORKFLOW_OUTPUT');
  assert.equal(manifestEntry.provenance_diagnostic.status,diagnostic.status);
  assert.equal(manifestEntry.provenance_diagnostic.source_path,diagnostic.source_path);
  assert.equal(gateEntry.source_date,date);
  assert.equal(gateEntry.source_sha256,manifestEntry.workflow_validation.source_sha256);
  assert.equal(gateEntry.independent_original_http_certified,false);
  assert.equal(manifestEntry.provenance_diagnostic.raw_http_provenance_certified,false);
 }

 for(const [name,source] of [['mi-index-provenance.json','MI_INDEX'],['fmtqik-provenance.json','FMTQIK']]){
  const p=JSON.parse(fs.readFileSync(path.join(dir,name)));assert.equal(p.target_date,date);assert.equal(p.master_authorized,false);assert.equal(p.publication_authorized,false);
  if(source==='MI_INDEX')assert.equal(p.raw_http_provenance_certified,false);
  else assert.equal(p.original_http_archive_verified,false);
 }
 if(date==='20261008'){assert.equal(officialGate.status,'PARTIAL_VERIFIED_INSTITUTIONAL_ONLY');assert.equal(officialGate.institutional.raw_sha256,officialManifest.entries[0].raw_sha256);}
 if(date==='20261013'){assert.equal(officialGate.status,'PARTIAL_VERIFIED_INSTITUTIONAL_ONLY');assert.equal(officialGate.institutional.raw_sha256,officialManifest.entries[0].raw_sha256);}
 if(['EVIDENCE_JOINED_NOT_CERTIFIED','PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING'].includes(r.stages[0].status)){
  const claims=JSON.parse(fs.readFileSync(path.join(dir,'claims.json')));
  assert.equal(claims.target_date,date);assert.ok(claims.claim_count>0);
  const institutional=JSON.parse(fs.readFileSync(path.join(dir,'institutional-evidence.json')));
  assert.equal(institutional.target_date,date);
  if(date==='20261008'){assert.equal(institutional.status,'VERIFIED');assert.equal(institutional.final_six_rows_verified,true);assert.equal(r.stages[1].status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');}
  if(date==='20261013'){assert.equal(institutional.status,'VERIFIED');assert.equal(institutional.final_six_rows_verified,true);assert.ok(!r.blockers.includes('DATED_FINAL_BFI82U_RAW_MISSING'));assert.ok(!r.blockers.includes('DATED_FINAL_BFI82U_MANIFEST_MISSING'));}
  const breadth=JSON.parse(fs.readFileSync(path.join(dir,'breadth-evidence.json')));
  assert.equal(breadth.target_date,date);assert.equal(breadth.publication_authorized,false);if(breadth.status==='OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED')assert.equal(breadth.source_sha256,officialManifest.entries.find(e=>e.id==='MI_INDEX').provenance_diagnostic.repository_payload_sha256);
  if(date==='20261008'){assert.equal(breadth.status,'OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED');assert.equal(breadth.legal_identity_master_certified,false);assert.equal(r.stages[1].status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');}
  if(date==='20261013'){assert.equal(breadth.status,'OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED');assert.equal(breadth.legal_identity_master_certified,false);assert.ok(!r.blockers.includes('DATED_MI_INDEX_STOCK_AGGREGATE_PENDING'));}
  const master=JSON.parse(fs.readFileSync(path.join(dir,'market-master.json')));
  assert.equal(master.target_date,date);assert.equal(master.publication_authorized,false);
  if(date==='20261008'){assert.equal(master.status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');assert.ok(master.market_trading.turnover_twd>0);const datedBase=JSON.parse(fs.readFileSync('data_daily_gain_over_5/market-opening/'+date+'.json'));const chartBytes=fs.readFileSync('data_twse_market_chart/market_chart.json');assert.equal(crypto.createHash('sha256').update(chartBytes).digest('hex'),officialManifest.entries.find(e=>e.id==='FMTQIK').provenance_diagnostic.derived_chart_sha256);const datedRow=JSON.parse(chartBytes).data.find(r=>r.date===date);assert.equal(datedBase.market_trading.turnover_twd,datedRow.turnover);assert.equal(datedBase.market_trading.shares,datedRow.volumeShares);assert.equal(datedBase.market_trading.transactions,datedRow.transactions);assert.equal(master.ordinary_share_identity_certified,false);}
  if(date==='20261013')assert.equal(master.status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');
  const brief=JSON.parse(fs.readFileSync(path.join(dir,'editorial-research-brief.json')));
  assert.equal(brief.target_date,date);assert.equal(brief.editorial_certified,false);assert.equal(brief.narration_authorized,false);assert.equal(brief.render_authorized,false);assert.equal(brief.original_analysis,null);
  if(date==='20261008'){assert.equal(brief.status,'OBSERVATIONS_READY_INDEPENDENT_ANALYSIS_REQUIRED');assert.equal(brief.observations.length,3);assert.equal(brief.derived_comparisons.breadth_net_count,master.breadth.advancers-master.breadth.decliners);assert.equal(brief.derived_comparisons.institutional_total_net_twd,['foreign','investment_trust','dealers'].reduce((sum,name)=>sum+master.institutional[name].net_twd,0));assert.equal(brief.derived_comparisons.interpretation_status,'OBSERVATION_ONLY_NO_CAUSAL_CLAIM');}
  if(date==='20261013'){assert.equal(brief.status,'OBSERVATIONS_READY_INDEPENDENT_ANALYSIS_REQUIRED');assert.equal(brief.observations.length,3); }
  const task=JSON.parse(fs.readFileSync(path.join(dir,'original-analysis-task.json')));
  assert.equal(task.target_date,date);assert.equal(task.market_master_sha256,brief.source_master_sha256);assert.equal(task.draft,null);assert.equal(task.independent_review_required,true);assert.equal(task.narration_authorized,false);assert.equal(task.render_authorized,false);
  if(date==='20261008'){assert.equal(task.status,'READY_FOR_EVIDENCE_GROUNDED_DRAFT');assert.equal(task.required_sections.length,5);}
  if(date==='20261013')assert.equal(task.status,'READY_FOR_EVIDENCE_GROUNDED_DRAFT');
  const media=JSON.parse(fs.readFileSync(path.join(dir,'media-handoff.json')));
  assert.equal(media.target_date,date);assert.equal(media.render_authorized,false);assert.equal(media.publication_authorized,false);assert.equal(media.fixed_opening_lines.length,4);assert.equal(media.fixed_opening_lines[3],'那麼我們開始囉。');assert.ok(!JSON.stringify(media.fixed_opening_lines).includes('我們有提供中文 CC 字幕'));assert.equal(media.date_parameterized_media_bridge_implemented,false);assert.equal(media.component_reuse_requires_dated_master_and_editorial_review,true);assert.equal(media.existing_media_components_research_only.length,3);assert.ok(media.existing_media_components_research_only.every(c=>c.date_locked==='20261008'&&c.path.startsWith('scripts/')));assert.equal(media.market_opening_seconds.min,30);assert.equal(media.market_opening_seconds.max,90);
  const noInputManifest=JSON.parse(fs.readFileSync(path.join(dir,'editorial-input-manifest.json')));
  assert.equal(noInputManifest.review_input_sha256,null);
  assert.equal(noInputManifest.draft_input_sha256,null);
  assert.equal(noInputManifest.editorial_certified,false);
  const review=JSON.parse(fs.readFileSync(path.join(dir,'editorial-review.json')));
  assert.equal(review.claim_whitelist_verified,false);assert.equal(review.render_authorized,false);
  if(date==='20261013'){assert.equal(r.stages[0].status,'EVIDENCE_JOINED_NOT_CERTIFIED');assert.ok(!r.blockers.includes('MARKET_OPENING_DATED_BASE_MISSING'));}
 }else assert.equal(r.stages[0].status,'WAITING_SOURCE');
 console.log('D4_ORCHESTRATOR_DATE_STATUS '+date+' '+r.stages[0].status);
}
const reviewDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-review-'));
fs.writeFileSync(path.join(reviewDir,'editorial-review-input.json'),JSON.stringify({target_date:'20261013',inventory_sha256:'wrong',decisions:[]}));
const reviewRejected=run('.','20261008',reviewDir);
const rejectedReview=JSON.parse(fs.readFileSync(path.join(reviewDir,'editorial-review.json')));
assert.equal(rejectedReview.status,'REJECTED');
assert.equal(rejectedReview.claim_whitelist_verified,false);
assert.equal(rejectedReview.approved_claim_ids.length,0);
assert.ok(reviewRejected.blockers.includes('INDEPENDENT_REVIEW_INPUT_REJECTED'));
assert.equal(reviewRejected.render_authorized,false);
const rejectedManifest=JSON.parse(fs.readFileSync(path.join(reviewDir,'editorial-input-manifest.json')));
assert.equal(rejectedManifest.review_input_sha256,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(reviewDir,'editorial-review-input.json'))).digest('hex'));
assert.equal(rejectedManifest.draft_input_sha256,null);
assert.equal(rejectedManifest.editorial_certified,false);
assert.equal(rejectedManifest.render_authorized,false);
console.log('D4_INDEPENDENT_REVIEW_INPUT_FAIL_CLOSED_PASS');
 // Removing a rejected cross-date input must clear old rejection and provenance on rerun.
 fs.unlinkSync(path.join(reviewDir,'editorial-review-input.json'));
 const reviewReset=run('.','20261008',reviewDir);
 const resetGate=JSON.parse(fs.readFileSync(path.join(reviewDir,'editorial-review.json'),'utf8'));
 const resetInputManifest=JSON.parse(fs.readFileSync(path.join(reviewDir,'editorial-input-manifest.json'),'utf8'));
 assert.notEqual(resetGate.status,'REJECTED');
 assert.deepEqual(resetGate.approved_claim_ids,[]);
 assert.equal(resetInputManifest.review_input_sha256,null);
 assert.equal(reviewReset.blockers.includes('INDEPENDENT_REVIEW_INPUT_REJECTED'),false);
 assert.equal(reviewReset.render_authorized,false);
 assert.equal(reviewReset.publication_authorized,false);
 console.log('D4_REJECTED_REVIEW_WITHDRAWAL_RERUN_PASS');

const reviewValidDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-reviewed-'));
run('.','20261008',reviewValidDir);
const datedClaims=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'claims.json')));
const priceClaim=datedClaims.claims.find(c=>c.kind==='PRICE_CHANGE');
assert.ok(priceClaim,'DATED_PRICE_CLAIM_REQUIRED');
const inventorySha=crypto.createHash('sha256').update(JSON.stringify(datedClaims)).digest('hex');
fs.writeFileSync(path.join(reviewValidDir,'editorial-review-input.json'),JSON.stringify({target_date:'20261008',inventory_sha256:inventorySha,decisions:[{claim_id:priceClaim.claim_id,decision:'APPROVE',reviewer:'research-fixture-reviewer',rationale:'Explicit fixture decision; not editorial certification',evidence_checked:true,causal_language_prohibited:true}]}));
const reviewValidRun=run('.','20261008',reviewValidDir);
const reviewed=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'editorial-review.json')));
assert.deepEqual(reviewed.approved_claim_ids,[priceClaim.claim_id]);
assert.equal(reviewed.claim_whitelist_verified,false);
assert.equal(reviewed.editorial_certified,false);
assert.equal(reviewValidRun.render_authorized,false);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(reviewValidDir,'original-analysis-task.json'))).approved_claim_ids,[priceClaim.claim_id]);
const draftTask=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'original-analysis-task.json')));
const mkInsight=(id,section,evidence)=>({id,section,observation:'可核對的日期限定觀察',interpretation:'獨立研究解讀，尚待編輯審核',uncertainty:'相關性不代表因果',evidence});
const datedDraft={target_date:'20261008',insights:[
 mkInsight('breadth','market_breadth_vs_index',[{type:'master_field',path:'breadth.advancers'},{type:'master_field',path:'taiex.change_points'}]),
 mkInsight('flow','institutional_flow_vs_breadth',[{type:'master_field',path:'institutional.foreign.net_twd'}]),
 mkInsight('stock','selected_stock_evidence',[{type:'claim_id',id:priceClaim.claim_id}]),
 mkInsight('counter','counterarguments_and_uncertainty',[{type:'master_field',path:'breadth.decliners'}]),
 mkInsight('summary','three_point_summary',[{type:'master_field',path:'market_trading.turnover_twd'}])
]};
assert.equal(draftTask.required_sections.length,datedDraft.insights.length);
fs.writeFileSync(path.join(reviewValidDir,'original-analysis-draft-input.json'),JSON.stringify(datedDraft));
const draftIntegrated=run('.','20261008',reviewValidDir);
const draftIntegratedCheck=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'original-analysis-draft-check.json')));
assert.equal(draftIntegratedCheck.status,'REJECTED');
assert.match(draftIntegratedCheck.reason,/^CLAIM_WHITELIST_NOT_VERIFIED(?:\n|$)/);
assert.ok(draftIntegrated.blockers.includes('ORIGINAL_ANALYSIS_DRAFT_REJECTED'));
assert.equal(draftIntegratedCheck.editorial_certified,false);
assert.equal(draftIntegratedCheck.render_authorized,false);
assert.equal(draftIntegrated.render_authorized,false);
assert.equal(JSON.parse(fs.readFileSync(path.join(reviewValidDir,'media-handoff.json'))).draft_check_status,draftIntegratedCheck.status);
const integratedMedia=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'media-handoff.json')));
const integratedReview=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'editorial-review.json')));
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(integratedMedia.review_gate_sha256,digest(integratedReview));
assert.equal(integratedMedia.draft_check_sha256,digest(draftIntegratedCheck));
assert.equal(integratedMedia.approved_claim_count,1);
assert.equal(integratedMedia.render_authorized,false);
const inputManifest=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'editorial-input-manifest.json')));
assert.equal(inputManifest.target_date,'20261008');
assert.equal(inputManifest.review_input_sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(reviewValidDir,'editorial-review-input.json'))).digest('hex'));
assert.equal(inputManifest.draft_input_sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(reviewValidDir,'original-analysis-draft-input.json'))).digest('hex'));
assert.equal(inputManifest.review_gate_sha256,integratedMedia.review_gate_sha256);
assert.equal(inputManifest.draft_check_sha256,integratedMedia.draft_check_sha256);
assert.equal(inputManifest.editorial_certified,false);
assert.equal(inputManifest.render_authorized,false);
console.log('D4_EDITORIAL_INPUT_PROVENANCE_PASS');
console.log('D4_PARTIAL_REVIEW_DRAFT_REJECTED_FAIL_CLOSED_PASS');
console.log('D4_EXPLICIT_DATED_REVIEW_INPUT_PASS');
// Revoking an external review must recompute the gate; no prior approved IDs or input hash may survive.
const savedReviewInput=fs.readFileSync(path.join(reviewValidDir,'editorial-review-input.json'));
fs.unlinkSync(path.join(reviewValidDir,'editorial-review-input.json'));
const withdrawnRun=run('.','20261008',reviewValidDir);
const withdrawnReview=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'editorial-review.json'),'utf8'));
const withdrawnManifest=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'editorial-input-manifest.json'),'utf8'));
const withdrawnHandoff=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'review-handoff-manifest.json'),'utf8'));
assert.deepEqual(withdrawnReview.approved_claim_ids,[]);
assert.equal(withdrawnManifest.review_input_sha256,null);
assert.equal(withdrawnHandoff.review_input_sha256,null);
assert.equal(withdrawnHandoff.status,'PENDING_INDEPENDENT_REVIEW');
assert.equal(JSON.parse(fs.readFileSync(path.join(reviewValidDir,'original-analysis-draft-check.json'),'utf8')).status,'REJECTED');
assert.equal(withdrawnRun.render_authorized,false);
assert.equal(withdrawnRun.publication_authorized,false);
console.log('D4_WITHDRAWN_REVIEW_RERUN_FAIL_CLOSED_PASS');
// Restore the fixture for subsequent provenance tests, which compare reviewed vs unreviewed outlines.
fs.writeFileSync(path.join(reviewValidDir,'editorial-review-input.json'),savedReviewInput);
run('.','20261008',reviewValidDir);

const actualCandidate=JSON.parse(fs.readFileSync('data_research/m5/ai-script-generation/20261008-d4-original-analysis-candidate.json'));
assert.equal(actualCandidate.target_date,'20261008');
assert.equal(actualCandidate.insights.length,5);
assert.deepEqual(new Set(actualCandidate.insights.map(i=>i.section)),new Set(draftTask.required_sections));
const candidateDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-actual-candidate-'));
fs.writeFileSync(path.join(candidateDir,'original-analysis-draft-input.json'),JSON.stringify(actualCandidate));
const candidateRun=run('.','20261008',candidateDir);
const actualPreflight=JSON.parse(fs.readFileSync(path.join(candidateDir,'authored-candidate-preflight.json')));
assert.equal(actualPreflight.status,'REVIEW_OR_EVIDENCE_PENDING');
assert.deepEqual(new Set(actualPreflight.missing_claim_reviews.map(x=>x.claim_id)),new Set(['20261008:6672:PRICE_CHANGE','20261008:2305:PRICE_CHANGE','20261008:1301:PRICE_CHANGE']));
assert.deepEqual(actualPreflight.unknown_claim_ids,[]);
assert.deepEqual(actualPreflight.invalid_master_fields,[]);
assert.equal(actualPreflight.review_packet.length,3);
assert.deepEqual(new Set(actualPreflight.review_packet.map(c=>c.claim_id)),new Set(actualPreflight.missing_claim_reviews.map(c=>c.claim_id)));
assert.ok(actualPreflight.review_packet.every(c=>c.kind==='PRICE_CHANGE'&&c.review_decision==='PENDING_INDEPENDENT_REVIEW'&&c.evidence_checked===false));
assert.ok(actualPreflight.review_packet.every(c=>c.evidence_sources.length===1&&c.evidence_sources[0].origin==='dated_list_and_facts_crosscheck'&&c.evidence_sources[0].list_sha256&&c.evidence_sources[0].facts_sha256));
const originalList=JSON.parse(fs.readFileSync('data_daily_gain_over_5/20261008.json'));
for(const item of actualPreflight.review_packet){const code=item.claim_id.split(':')[1];assert.equal(item.statement,originalList.stocks.find(x=>x.code===code).change_pct);assert.equal(item.evidence_sources[0].change_pct,item.statement);}
console.log('D4_DATED_PRICE_CLAIM_SOURCE_CROSSCHECK_PASS');
assert.equal(actualPreflight.candidate_sha256,crypto.createHash('sha256').update(JSON.stringify(actualCandidate)).digest('hex'));
assert.equal(actualPreflight.inventory_sha256,crypto.createHash('sha256').update(JSON.stringify(JSON.parse(fs.readFileSync(path.join(candidateDir,'claims.json'))))).digest('hex'));
assert.equal(actualPreflight.render_authorized,false);
const factualPrices=JSON.parse(fs.readFileSync(path.join(candidateDir,'featured-price-observations.json')));
assert.equal(factualPrices.status,'CROSSCHECKED_PRICE_ONLY_INDEPENDENT_EDITORIAL_REVIEW_PENDING');
assert.deepEqual(new Set(factualPrices.stocks.map(x=>x.code)),new Set(['6672','2305','1301']));
assert.ok(factualPrices.stocks.every(x=>x.review_status==='REVIEW_REQUIRED'&&x.evidence_sources[0].origin==='dated_list_and_facts_crosscheck'));
assert.equal(factualPrices.news_causality_verified,false);
assert.equal(factualPrices.narration_authorized,false);
assert.equal(factualPrices.render_authorized,false);
console.log('D4_FEATURED_FACTUAL_PRICE_SNAPSHOT_PASS');
const worksheet=JSON.parse(fs.readFileSync(path.join(candidateDir,'independent-review-worksheet.json')));
assert.equal(worksheet.inventory_sha256,actualPreflight.inventory_sha256);
assert.deepEqual(new Set(worksheet.review_items.map(x=>x.claim_id)),new Set(actualPreflight.review_packet.map(x=>x.claim_id)));
assert.ok(worksheet.review_items.every(x=>x.decision==='PENDING'&&x.reviewer===null&&x.evidence_checked===false));
assert.equal(worksheet.render_authorized,false);
console.log('D4_INDEPENDENT_REVIEW_WORKSHEET_PENDING_PASS');
assert.equal(worksheet.review_input_filename,'editorial-review-input.json');
assert.equal(worksheet.candidate_sha256,actualPreflight.candidate_sha256);
assert.ok(worksheet.review_items.every(x=>x.rationale===null&&x.causal_language_prohibited===null));
assert.equal(fs.existsSync(path.join(candidateDir,'editorial-review-input.json')),false);
console.log('D4_WORKSHEET_DOES_NOT_FORGE_REVIEW_INPUT_PASS');
const outline=JSON.parse(fs.readFileSync(path.join(candidateDir,'candidate-semantic-outline.json')));
assert.equal(outline.candidate_sha256,actualPreflight.candidate_sha256);
assert.equal(outline.market_master_sha256,digest(JSON.parse(fs.readFileSync(path.join(candidateDir,'market-master.json')))));
assert.equal(outline.review_gate_sha256,digest(JSON.parse(fs.readFileSync(path.join(candidateDir,'editorial-review.json')))));
assert.equal(outline.target_date,'20261008');
const reviewedOutline=JSON.parse(fs.readFileSync(path.join(reviewValidDir,'candidate-semantic-outline.json')));
assert.equal(reviewedOutline.market_master_sha256,outline.market_master_sha256);
assert.notEqual(reviewedOutline.review_gate_sha256,outline.review_gate_sha256,'REVIEW_CHANGE_MUST_INVALIDATE_OUTLINE_PROVENANCE');
assert.equal(reviewedOutline.render_authorized,false);
console.log('D4_SEMANTIC_OUTLINE_REVIEW_CHANGE_PROVENANCE_PASS');
assert.deepEqual(outline.sections.map(x=>x.id),actualCandidate.insights.map(x=>x.id));
assert.ok(outline.sections.every(x=>x.observation&&x.interpretation&&x.uncertainty));
assert.equal(outline.sections.find(x=>x.section==='selected_stock_evidence').claim_review_pending,true);
assert.equal(outline.narration_script,null);assert.equal(outline.render_authorized,false);
const projection=JSON.parse(fs.readFileSync(path.join(candidateDir,'semantic-consumer-projection.json')));
assert.equal(projection.source_outline_sha256,digest(outline));
const compat=JSON.parse(fs.readFileSync(path.join(candidateDir,'m8vis-compatibility.json')));
assert.equal(compat.status,'ADAPTER_REQUIRED_LEGACY_FIXED_SCENE_CONTRACT');
assert.equal(compat.legacy_required_scene_count,6);
assert.equal(compat.d4_section_count,5);
assert.equal(compat.legacy_renderer_compatible,false);
assert.deepEqual(compat.source_section_ids,projection.sections.map(x=>x.id));
assert.equal(compat.market_master_sha256,projection.market_master_sha256);
assert.equal(compat.render_authorized,false);
assert.equal(compat.publication_authorized,false);
const adapter=JSON.parse(fs.readFileSync(path.join(candidateDir,'m8vis-scene-adapter.json')));
assert.deepEqual(adapter.scene_ids,['opening','market','6672','2305','1301','conclusion']);
assert.deepEqual(adapter.scenes[1].source_section_ids,projection.sections.slice(0,2).map(x=>x.id));
assert.deepEqual(adapter.scenes[5].source_section_ids,projection.sections.slice(3).map(x=>x.id));
for(const code of ['6672','2305','1301']){const scene=adapter.scenes.find(x=>x.id===code);assert.equal(scene.stock_claim_id,'20261008:'+code+':PRICE_CHANGE');assert.equal(scene.stock_claim_review_pending,true);assert.deepEqual(scene.excluded_pending_claim_ids,[scene.stock_claim_id]);assert.equal(scene.caption_sentences,null);assert.equal(scene.visual_asset,null);assert.equal(scene.render_authorized,false);}
assert.equal(adapter.scenes[0].opening_branding_required,true);
assert.equal(adapter.scenes[0].facts.length,0);
assert.equal(adapter.legacy_renderer_compatible,false);
assert.equal(adapter.publication_authorized,false);
console.log('D4_M8VIS_SIX_SCENE_RESEARCH_ADAPTER_PASS');
console.log('D4_M8VIS_COMPATIBILITY_GAP_REPORTED_PASS');
assert.deepEqual(projection.factual_card_inputs.map(x=>x.section_id),projection.sections.map(x=>x.id));
assert.deepEqual(projection.scene_plan.map(x=>x.source_section_id),projection.sections.map(x=>x.id));
assert.deepEqual(projection.scene_plan.map(x=>x.sequence),[1,2,3,4,5]);
for(const slot of projection.scene_plan){assert.equal(slot.source_master_sha256,projection.market_master_sha256);assert.equal(slot.visual_asset,null);assert.equal(slot.display_authorized,false);assert.equal(slot.requires_editorial_review,true);assert.equal(projection.factual_card_inputs[slot.card_input_index].section_id,slot.source_section_id);}
for(const card of projection.factual_card_inputs){assert.equal(card.source_master_sha256,projection.market_master_sha256);assert.equal(card.display_authorized,false);assert.equal(card.editorial_text,null);assert.deepEqual(card.facts,projection.sections.find(x=>x.id===card.section_id).resolved_master_observations);}
const pendingCard=projection.factual_card_inputs.find(x=>x.section==='selected_stock_evidence');
assert.equal(pendingCard.facts.length,0);
assert.equal(pendingCard.excluded_pending_claim_ids.length,3);
assert.equal(projection.consumer_contracts.scene_cards.cards,null);
assert.ok(projection.sections[0].resolved_master_observations.length>0);
for(const entry of projection.sections[0].resolved_master_observations){let v=JSON.parse(fs.readFileSync(path.join(candidateDir,'market-master.json')));for(const key of entry.path.split('.'))v=v[key];assert.equal(entry.value,v);}
assert.equal(projection.sections.find(x=>x.section==='selected_stock_evidence').resolved_master_observations.length,0);
assert.equal(projection.market_master_sha256,outline.market_master_sha256);
assert.equal(projection.review_gate_sha256,outline.review_gate_sha256);
for(const consumer of Object.values(projection.consumer_contracts))assert.deepEqual(consumer.source_section_ids,outline.sections.map(x=>x.id));
assert.equal(projection.sections.find(x=>x.section==='selected_stock_evidence').review_status,'REVIEW_REQUIRED');
assert.equal(projection.consumer_contracts.narration.script,null);
assert.equal(projection.consumer_contracts.subtitles.srt,null);
assert.equal(projection.consumer_contracts.scene_cards.cards,null);
assert.equal(projection.render_authorized,false);
const {project}=require('../scripts/research_date_to_video_d4_semantic_projection');
assert.throws(()=>project(outline,{...JSON.parse(fs.readFileSync(path.join(candidateDir,'market-master.json'))),target_date:'20261013'},JSON.parse(fs.readFileSync(path.join(candidateDir,'editorial-review.json')))),/PROJECTION_MASTER_DATE_MISMATCH/);
assert.throws(()=>project(outline,JSON.parse(fs.readFileSync(path.join(candidateDir,'market-master.json'))),{...JSON.parse(fs.readFileSync(path.join(candidateDir,'editorial-review.json'))),approved_claim_ids:['forged']}),/PROJECTION_STALE_REVIEW/);
const projectionMaster=JSON.parse(fs.readFileSync(path.join(candidateDir,'market-master.json')));
const projectionReview=JSON.parse(fs.readFileSync(path.join(candidateDir,'editorial-review.json')));
const badOutline=JSON.parse(JSON.stringify(outline));
badOutline.sections[0].evidence[0]={type:'master_field',path:'taiex.nonexistent'};
assert.throws(()=>project(badOutline,projectionMaster,projectionReview),/PROJECTION_UNKNOWN_MASTER_FIELD/);
const emptyEvidenceOutline=JSON.parse(JSON.stringify(outline));
emptyEvidenceOutline.sections[0].evidence=[];
assert.throws(()=>project(emptyEvidenceOutline,projectionMaster,projectionReview),/PROJECTION_MISSING_EVIDENCE/);
const blankOutline=JSON.parse(JSON.stringify(outline));blankOutline.sections[0].interpretation='  ';
assert.throws(()=>project(blankOutline,projectionMaster,projectionReview),/PROJECTION_EMPTY_SEMANTIC_FIELD_interpretation/);
const duplicateOutline=JSON.parse(JSON.stringify(outline));duplicateOutline.sections[1].id=duplicateOutline.sections[0].id;
assert.throws(()=>project(duplicateOutline,projectionMaster,projectionReview),/PROJECTION_DUPLICATE_OR_EMPTY_SECTION_ID/);
const wrongDateClaim=JSON.parse(JSON.stringify(outline));wrongDateClaim.sections[2].evidence[0].id='20261013:6672:PRICE_CHANGE';
assert.throws(()=>project(wrongDateClaim,projectionMaster,projectionReview),/PROJECTION_INVALID_DATED_CLAIM_ID/);
const unknownEvidence=JSON.parse(JSON.stringify(outline));unknownEvidence.sections[0].evidence[0]={type:'unreviewed_news',id:'fake'};
assert.throws(()=>project(unknownEvidence,projectionMaster,projectionReview),/PROJECTION_UNKNOWN_EVIDENCE_TYPE/);
console.log('D4_SEMANTIC_PROJECTION_CONTENT_NEGATIVE_PASS');
console.log('D4_SEMANTIC_PROJECTION_SOURCE_FIELD_NEGATIVE_PASS');
console.log('D4_SINGLE_MASTER_PROJECTION_FAIL_CLOSED_PASS');
console.log('D4_AUTHORED_SEMANTIC_OUTLINE_RESEARCH_ONLY_PASS');
const staleDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-stale-'));
run('.','20261008',staleDir);
assert.ok(fs.existsSync(path.join(staleDir,'featured-price-observations.json')));
fs.writeFileSync(path.join(staleDir,'original-analysis-draft-check.json'),'{"status":"STALE"}');
const rerunMissing=run('.','20261014',staleDir);
assert.equal(rerunMissing.stages[0].status,'WAITING_SOURCE');
assert.ok(fs.existsSync(path.join(staleDir,'status.json')));
for(const name of ['featured-price-observations.json','candidate-semantic-outline.json','semantic-consumer-projection.json','m8vis-compatibility.json','m8vis-scene-adapter.json','independent-review-worksheet.json','authored-candidate-preflight.json','original-analysis-draft-check.json','market-master.json','media-handoff.json','dated-media-input.json','editorial-narration-worksheet.json'])assert.equal(fs.existsSync(path.join(staleDir,name)),false,'STALE_OUTPUT:'+name);
console.log('D4_REUSED_OUTPUT_DIR_FAIL_CLOSED_PASS');
// A scheduler reading a reused directory must see only the new date and its recovery state.
const reusedHandoff=JSON.parse(fs.readFileSync(path.join(staleDir,'status.json'),'utf8'));
assert.equal(reusedHandoff.target_date,'20261014');
assert.equal(reusedHandoff.stages[0].status,'WAITING_SOURCE');
assert.equal(reusedHandoff.stages[1].status,'NOT_RUN');
assert.equal(reusedHandoff.stages[2].status,'NOT_RUN');
assert.equal(reusedHandoff.official_recovery_advice.target_date,'20261014');
assert.equal(Object.hasOwn(reusedHandoff,'source_readiness'),false);
assert.equal(Object.hasOwn(reusedHandoff,'audio_recovery_advice'),false);
assert.equal(reusedHandoff.render_authorized,false);
assert.equal(reusedHandoff.publication_authorized,false);
console.log('D4_CROSS_DATE_PERSISTED_SCHEDULER_HANDOFF_FAIL_CLOSED_PASS');

const malformedDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-malformed-'));
const originalRead=fs.readFileSync;
try{
 fs.readFileSync=function(file,...args){
  if(String(file).endsWith('20261008-d4-original-analysis-candidate.json'))return '{malformed';
  return originalRead.call(this,file,...args);
 };
 const malformedRun=run('.','20261008',malformedDir);
 assert.equal(malformedRun.render_authorized,false);
 const malformedAudit=JSON.parse(originalRead(path.join(malformedDir,'authored-candidate-preflight.json')));
 assert.equal(malformedAudit.status,'REJECTED');
 assert.equal(fs.existsSync(path.join(malformedDir,'featured-price-observations.json')),false);
 assert.ok(malformedRun.blockers.includes('AUTHORED_CANDIDATE_PREFLIGHT_REJECTED'));
}finally{fs.readFileSync=originalRead}
console.log('D4_MALFORMED_CANDIDATE_FAIL_CLOSED_PASS');
console.log('D4_REAL_CANDIDATE_ACTIONABLE_PREFLIGHT_PASS');

const candidateCheck=JSON.parse(fs.readFileSync(path.join(candidateDir,'original-analysis-draft-check.json')));
assert.equal(candidateCheck.status,'REJECTED');
assert.match(candidateCheck.reason,/^CLAIM_WHITELIST_NOT_VERIFIED(?:\n|$)/);
assert.ok(candidateRun.blockers.includes('ORIGINAL_ANALYSIS_DRAFT_REJECTED'));
assert.equal(candidateRun.render_authorized,false);
console.log('D4_ACTUAL_AUTHORED_CANDIDATE_REVIEW_REQUIRED_PASS');
const draftDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-draft-'));
fs.writeFileSync(path.join(draftDir,'original-analysis-draft-input.json'),JSON.stringify({target_date:'20261008',insights:[]}));
const rejected=run('.','20261008',draftDir);
const draftCheck=JSON.parse(fs.readFileSync(path.join(draftDir,'original-analysis-draft-check.json')));
assert.equal(draftCheck.status,'REJECTED');assert.match(draftCheck.reason,/^CLAIM_WHITELIST_NOT_VERIFIED(?:\n|$)/);assert.equal(JSON.parse(fs.readFileSync(path.join(draftDir,'media-handoff.json'))).draft_check_status,'REJECTED');assert.equal(draftCheck.narration_authorized,false);
const rejectedDraftManifest=JSON.parse(fs.readFileSync(path.join(draftDir,'editorial-input-manifest.json')));
const {inspect:inspectMediaPreflight}=require('../scripts/research_date_to_video_media_preflight_v1');
const rejectedMediaPreflight=inspectMediaPreflight(draftDir);assert.equal(rejectedMediaPreflight.status,'BLOCKED');assert.equal(rejectedMediaPreflight.render_authorized,false);assert.equal(rejectedMediaPreflight.publication_authorized,false);assert.ok(rejectedMediaPreflight.issues.includes('EDITORIAL_CERTIFICATION_REQUIRED'));assert.ok(rejectedMediaPreflight.issues.includes('DATED_MEDIA_BRIDGE_NOT_IMPLEMENTED'));
const tamperedMediaPath=path.join(draftDir,'media-handoff.json');const originalMediaBytes=fs.readFileSync(tamperedMediaPath);try{const altered=JSON.parse(originalMediaBytes);altered.target_date='20261014';fs.writeFileSync(tamperedMediaPath,JSON.stringify(altered));const mismatch=inspectMediaPreflight(draftDir);assert.equal(mismatch.status,'BLOCKED');assert.ok(mismatch.issues.includes('MASTER_DATE_MATCH'));assert.ok(mismatch.issues.includes('TASK_DATE_MATCH'));assert.ok(mismatch.issues.includes('REVIEW_DATE_MATCH'));assert.ok(mismatch.issues.includes('INPUT_DATE_MATCH'));}finally{fs.writeFileSync(tamperedMediaPath,originalMediaBytes);}
const tamperedMasterPath=path.join(draftDir,'market-master.json');const originalMasterBytes=fs.readFileSync(tamperedMasterPath);try{const altered=JSON.parse(originalMasterBytes);altered.status='TAMPERED';fs.writeFileSync(tamperedMasterPath,JSON.stringify(altered));const mismatch=inspectMediaPreflight(draftDir);assert.equal(mismatch.status,'BLOCKED');assert.ok(mismatch.issues.includes('MASTER_SHA_MATCH'));}finally{fs.writeFileSync(tamperedMasterPath,originalMasterBytes);}
console.log('D4_MEDIA_PREFLIGHT_DATE_AND_MASTER_TAMPER_FAIL_CLOSED_PASS');
const tamperedReviewPath=path.join(draftDir,'editorial-review.json');const originalReviewBytes=fs.readFileSync(tamperedReviewPath);try{const altered=JSON.parse(originalReviewBytes);altered.editorial_certified=true;fs.writeFileSync(tamperedReviewPath,JSON.stringify(altered));const mismatch=inspectMediaPreflight(draftDir);assert.equal(mismatch.status,'BLOCKED');assert.ok(mismatch.issues.includes('REVIEW_GATE_SHA_MATCH'));}finally{fs.writeFileSync(tamperedReviewPath,originalReviewBytes);}
console.log('D4_MEDIA_PREFLIGHT_REVIEW_TAMPER_FAIL_CLOSED_PASS');
const tamperedDraftCheckPath=path.join(draftDir,'original-analysis-draft-check.json');const originalDraftCheckBytes=fs.readFileSync(tamperedDraftCheckPath);try{const altered=JSON.parse(originalDraftCheckBytes);altered.status='TAMPERED';fs.writeFileSync(tamperedDraftCheckPath,JSON.stringify(altered));const mismatch=inspectMediaPreflight(draftDir);assert.equal(mismatch.status,'BLOCKED');assert.ok(mismatch.issues.includes('DRAFT_CHECK_SHA_MATCH'));}finally{fs.writeFileSync(tamperedDraftCheckPath,originalDraftCheckBytes);}
console.log('D4_MEDIA_PREFLIGHT_DRAFT_TAMPER_FAIL_CLOSED_PASS');
const {build:buildDatedMediaInput}=require('../scripts/research_date_to_video_dated_media_input_v1');const datedMediaInput=buildDatedMediaInput(draftDir);assert.equal(datedMediaInput.target_date,JSON.parse(fs.readFileSync(path.join(draftDir,'media-handoff.json'))).target_date);assert.equal(datedMediaInput.source_master_sha256,JSON.parse(fs.readFileSync(path.join(draftDir,'media-handoff.json'))).source_master_sha256);assert.equal(datedMediaInput.preflight_status,'BLOCKED');assert.equal(datedMediaInput.media_bridge_status,'NOT_IMPLEMENTED');assert.equal(datedMediaInput.narration_script,null);assert.equal(datedMediaInput.audio_manifest,null);assert.equal(datedMediaInput.render_authorized,false);assert.equal(datedMediaInput.publication_authorized,false);const emittedDatedMediaInput=JSON.parse(fs.readFileSync(path.join(draftDir,'dated-media-input.json')));assert.deepEqual(emittedDatedMediaInput,datedMediaInput);console.log('D4_DATED_MEDIA_INPUT_FAIL_CLOSED_PASS');
const {inspectSentencePacket}=require('../scripts/research_date_to_video_dated_media_input_v1');const sentenceHandoff=inspectSentencePacket(draftDir,{target_date:datedMediaInput.target_date,source_master_sha256:datedMediaInput.source_master_sha256,sentences:datedMediaInput.fixed_opening_lines.map((v,i)=>({id:'opening-'+i,narration:v,subtitle:v}))});assert.equal(sentenceHandoff.sentence_parity.status,'STRUCTURAL_PARITY_ONLY_EDITORIAL_REVIEW_REQUIRED');assert.equal(sentenceHandoff.preflight_status,'BLOCKED');assert.equal(sentenceHandoff.narration_script,null);assert.equal(sentenceHandoff.narration_authorized,false);assert.equal(sentenceHandoff.render_authorized,false);console.log('D4_SENTENCE_HANDOFF_FAIL_CLOSED_PASS');
const {prepare:prepareEditorialNarration}=require('../scripts/research_date_to_video_editorial_narration_worksheet_v1');const editorialWorksheet=prepareEditorialNarration(draftDir);assert.equal(editorialWorksheet.target_date,datedMediaInput.target_date);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(draftDir,'editorial-narration-worksheet.json'))),editorialWorksheet);assert.equal(editorialWorksheet.status,'INDEPENDENT_EDITORIAL_REVIEW_REQUIRED');assert.equal(editorialWorksheet.narration_authorized,false);assert.equal(editorialWorksheet.render_authorized,false);assert.ok(editorialWorksheet.issues.includes('EDITORIAL_CERTIFICATION_REQUIRED'));assert.ok(editorialWorksheet.sections.every(x=>x.narration===null&&x.subtitle===null&&x.editorial_decision==='PENDING'));console.log('D4_EDITORIAL_NARRATION_WORKSHEET_FAIL_CLOSED_PASS');
const draftInputPath=path.join(draftDir,'original-analysis-draft-input.json'),savedDraftInput=fs.readFileSync(draftInputPath);try{const altered=JSON.parse(savedDraftInput);altered.tamper_probe='TAMPERED';fs.writeFileSync(draftInputPath,JSON.stringify(altered));const rejectedWorksheet=prepareEditorialNarration(draftDir);assert.ok(rejectedWorksheet.issues.includes('DRAFT_STRUCTURAL_EVIDENCE_REQUIRED'));assert.deepEqual(rejectedWorksheet.sections,[]);}finally{fs.writeFileSync(draftInputPath,savedDraftInput);}console.log('D4_EDITORIAL_WORKSHEET_DRAFT_TAMPER_FAIL_CLOSED_PASS');
const worksheetMasterPath=path.join(draftDir,'market-master.json'),savedWorksheetMaster=fs.readFileSync(worksheetMasterPath);try{const alteredMaster=JSON.parse(savedWorksheetMaster);alteredMaster.tamper_probe='TAMPERED';fs.writeFileSync(worksheetMasterPath,JSON.stringify(alteredMaster));const rejectedMasterWorksheet=prepareEditorialNarration(draftDir);assert.ok(rejectedMasterWorksheet.issues.includes('DATED_MASTER_TASK_REQUIRED'));assert.deepEqual(rejectedMasterWorksheet.sections,[]);}finally{fs.writeFileSync(worksheetMasterPath,savedWorksheetMaster);}console.log('D4_EDITORIAL_WORKSHEET_MASTER_TAMPER_FAIL_CLOSED_PASS');
const {inspectDirectory:inspectCandidateDirectory}=require('../scripts/research_date_to_video_narration_candidate_review_v1');const worksheetArtifactPath=path.join(draftDir,'editorial-narration-worksheet.json'),savedWorksheetArtifact=fs.readFileSync(worksheetArtifactPath);try{const alteredWorksheet=JSON.parse(savedWorksheetArtifact);alteredWorksheet.tamper_probe='TAMPERED';fs.writeFileSync(worksheetArtifactPath,JSON.stringify(alteredWorksheet));const candidateReview=inspectCandidateDirectory(draftDir,null);assert.equal(candidateReview.status,'REJECTED');assert.ok(candidateReview.issues.includes('WORKSHEET_ARTIFACT_STALE'));}finally{fs.writeFileSync(worksheetArtifactPath,savedWorksheetArtifact);}console.log('D4_NARRATION_CANDIDATE_STALE_WORKSHEET_FAIL_CLOSED_PASS');
const rejectedDraftMedia=JSON.parse(fs.readFileSync(path.join(draftDir,'media-handoff.json')));assert.deepEqual(rejectedDraftMedia.fixed_opening_lines,['大家好，歡迎來到 TAIWAN STOCK！','追蹤資金，解讀行情。','錢在哪，我們就在哪！','那麼我們開始囉。']);
assert.equal(rejectedDraftManifest.review_input_sha256,null);
assert.equal(rejectedDraftManifest.draft_input_sha256,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(draftDir,'original-analysis-draft-input.json'))).digest('hex'));
assert.equal(rejectedDraftManifest.draft_check_sha256,rejectedDraftMedia.draft_check_sha256);
assert.equal(rejectedDraftManifest.editorial_certified,false);
assert.equal(rejectedDraftManifest.render_authorized,false);
console.log('D4_REJECTED_DRAFT_PROVENANCE_PASS');assert.equal(rejected.render_authorized,false);assert.ok(rejected.blockers.includes('ORIGINAL_ANALYSIS_DRAFT_REJECTED'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-missing-'));
const missing=run('.','20261014',dir);assert.equal(missing.stages[0].status,'WAITING_SOURCE');
assert.equal(missing.render_authorized,false);assert.deepEqual(missing.artifacts.map(a=>a.name),['official-data-manifest.json','official-data-recovery-plan.json','official-manifest-master-gate.json','mi-index-provenance.json','fmtqik-provenance.json','status.json']);
const missingGate=JSON.parse(fs.readFileSync(path.join(dir,'official-manifest-master-gate.json')));assert.equal(missingGate.target_date,'20261014');assert.equal(missingGate.master_authorized,false);assert.equal(missingGate.publication_authorized,false);
console.log('D4_ORCHESTRATOR_FAIL_CLOSED_PASS');
 // Missing dated sources must not be mistaken for an editorial-only wait.
 assert.equal(missing.stages[1].status,'NOT_RUN');
 assert.equal(missing.stages[2].status,'NOT_RUN');
 assert.equal(fs.existsSync(path.join(dir,'original-analysis-task.json')),false);
 assert.equal(fs.existsSync(path.join(dir,'editorial-narration-worksheet.json')),false);
 assert.equal(fs.existsSync(path.join(dir,'review-handoff-manifest.json')),false);
 assert.equal(missing.official_recovery_advice.target_date,'20261014');
 assert.equal(missing.publication_authorized,false);
 const missingHandoff=JSON.parse(fs.readFileSync(path.join(dir,'status.json'),'utf8'));
 assert.deepEqual(missingHandoff.stages,missing.stages);
 assert.deepEqual(missingHandoff.official_recovery_advice,missing.official_recovery_advice);
 assert.equal(missingHandoff.target_date,'20261014');
 assert.equal(missingHandoff.render_authorized,false);
 assert.equal(missingHandoff.publication_authorized,false);
 console.log('D4_PERSISTED_MISSING_SOURCE_SCHEDULER_HANDOFF_PASS');
 // Recovery advice is per-source and must not be interpreted as blanket dispatch permission.
 const missingRecovery=JSON.parse(fs.readFileSync(path.join(dir,'official-data-recovery-plan.json'),'utf8'));
 assert.equal(missingRecovery.target_date,'20261014');
 assert.equal(missingRecovery.complete,false);
 assert.equal(missingRecovery.master_authorized,false);
 assert.equal(missingRecovery.render_authorized,false);
 assert.equal(missingRecovery.publication_authorized,false);
 assert.deepEqual(missingHandoff.official_recovery_advice.sources,missingRecovery.sources.map(({id,status,action_required,automated_retrieval_allowed})=>({id,status,action_required,automated_retrieval_allowed})));
 assert.ok(missingRecovery.sources.every(x=>typeof x.automated_retrieval_allowed==='boolean'));
 assert.ok(missingRecovery.sources.every(x=>!x.automated_retrieval_allowed||x.id==='BFI82U'));
 assert.ok(missingRecovery.sources.filter(x=>x.id!=='BFI82U').every(x=>x.automated_retrieval_allowed===false));
 console.log('D4_RECOVERY_ADVICE_IS_NOT_BLANKET_DISPATCH_AUTHORIZATION_PASS');
 // A scheduler may consume recovery advice, but no nested advice may elevate master/media/publication gates.
 assert.equal(missingHandoff.official_recovery_advice.master_authorized,false);
 assert.equal(missingHandoff.official_recovery_advice.render_authorized,false);
 assert.equal(missingHandoff.official_recovery_advice.publication_authorized,false);
 assert.equal(missingHandoff.ready_to_render,false);
 assert.equal(missingGate.master_authorized,false);
 assert.equal(missingGate.publication_authorized,false);
 assert.equal(missingRecovery.master_authorized,false);
 assert.equal(missingRecovery.render_authorized,false);
 assert.equal(missingRecovery.publication_authorized,false);
 console.log('D4_RECOVERY_PLAN_CANNOT_ELEVATE_DOWNSTREAM_AUTHORIZATION_PASS');
 // A scheduler must bind persisted advice to the exact dated plan bytes before acting on it.
 const missingPlanBytes=fs.readFileSync(path.join(dir,'official-data-recovery-plan.json'));
 assert.equal(missingHandoff.official_recovery_advice.source_plan_sha256,crypto.createHash('sha256').update(missingPlanBytes).digest('hex'));
 assert.equal(missingHandoff.official_recovery_advice.manifest_sha256,missingRecovery.manifest_sha256);
 const changedPlan=Buffer.from(missingPlanBytes.toString('utf8').replace('"complete": false','"complete": true'));
 assert.notEqual(crypto.createHash('sha256').update(changedPlan).digest('hex'),missingHandoff.official_recovery_advice.source_plan_sha256);
 console.log('D4_SCHEDULER_ADVICE_EXACT_PLAN_BYTE_BINDING_PASS');
 // Both persisted handoff and recovery plan must bind to the same dated official manifest.
 const missingOfficialManifest=JSON.parse(fs.readFileSync(path.join(dir,'official-data-manifest.json'),'utf8'));
 assert.equal(missingOfficialManifest.target_date,'20261014');
 assert.equal(missingRecovery.manifest_sha256,missingOfficialManifest.manifest_sha256);
 assert.equal(missingHandoff.official_recovery_advice.manifest_sha256,missingOfficialManifest.manifest_sha256);
 const changedManifest={...missingOfficialManifest,manifest_sha256:'wrong-version'};
 assert.notEqual(changedManifest.manifest_sha256,missingHandoff.official_recovery_advice.manifest_sha256);
 console.log('D4_SCHEDULER_RECOVERY_OFFICIAL_MANIFEST_VERSION_BINDING_PASS');
 const validInspection=inspectSchedulerHandoff(dir,'20261014');
 assert.equal(validInspection.status,'RESEARCH_HANDOFF_VALIDATED');
 assert.equal(validInspection.automatic_dispatch_authorized,false);
 const planFile=path.join(dir,'official-data-recovery-plan.json'),originalPlan=fs.readFileSync(planFile);
 try{
  fs.writeFileSync(planFile,Buffer.from(originalPlan.toString('utf8').replace('"complete": false','"complete": true')));
  const tamperedInspection=inspectSchedulerHandoff(dir,'20261014');
  assert.equal(tamperedInspection.status,'REJECTED');
  assert.ok(tamperedInspection.issues.includes('RECOVERY_PLAN_SHA_MISMATCH'));
 }finally{fs.writeFileSync(planFile,originalPlan);}
 assert.equal(inspectSchedulerHandoff(dir,'20261013').status,'REJECTED');
 console.log('D4_READ_ONLY_SCHEDULER_HANDOFF_INSPECTION_FAIL_CLOSED_PASS');
 const handoffStatusFile=path.join(dir,'status.json'),savedHandoffStatus=fs.readFileSync(handoffStatusFile);
 try{
  fs.writeFileSync(handoffStatusFile,'{invalid');
  const invalidJsonInspection=inspectSchedulerHandoff(dir,'20261014');
  assert.equal(invalidJsonInspection.status,'REJECTED');
  assert.ok(invalidJsonInspection.issues.includes('HANDOFF_INPUT_UNREADABLE_OR_INVALID_JSON'));
  assert.equal(invalidJsonInspection.automatic_dispatch_authorized,false);
  fs.writeFileSync(handoffStatusFile,'null');
  const invalidShapeInspection=inspectSchedulerHandoff(dir,'20261014');
  assert.equal(invalidShapeInspection.status,'REJECTED');
  assert.ok(invalidShapeInspection.issues.includes('HANDOFF_INPUT_INVALID_SHAPE'));
 }finally{fs.writeFileSync(handoffStatusFile,savedHandoffStatus);}
 console.log('D4_SCHEDULER_MALFORMED_HANDOFF_FAIL_CLOSED_PASS');
 const manifestFile=path.join(dir,'official-data-manifest.json'),savedManifest=fs.readFileSync(manifestFile);
 try{
  const modifiedManifest=JSON.parse(savedManifest);
  modifiedManifest.complete=true;
  fs.writeFileSync(manifestFile,JSON.stringify(modifiedManifest));
  const contentDriftInspection=inspectSchedulerHandoff(dir,'20261014');
  assert.equal(contentDriftInspection.status,'REJECTED');
  assert.ok(contentDriftInspection.issues.includes('OFFICIAL_MANIFEST_CONTENT_SHA_MISMATCH'));
  assert.equal(contentDriftInspection.automatic_dispatch_authorized,false);
 }finally{fs.writeFileSync(manifestFile,savedManifest);}
 assert.equal(inspectSchedulerHandoff(dir,'20261014').status,'RESEARCH_HANDOFF_VALIDATED');
 console.log('D4_SCHEDULER_MANIFEST_CONTENT_SHA_FAIL_CLOSED_PASS');
 const sourcePlanFile=path.join(dir,'official-data-recovery-plan.json'),savedSourcePlan=fs.readFileSync(sourcePlanFile);
 try{
  const duplicatedPlan=JSON.parse(savedSourcePlan);
  duplicatedPlan.sources[1]={...duplicatedPlan.sources[0]};
  fs.writeFileSync(sourcePlanFile,JSON.stringify(duplicatedPlan));
  const duplicateInspection=inspectSchedulerHandoff(dir,'20261014');
  assert.equal(duplicateInspection.status,'REJECTED');
  assert.ok(duplicateInspection.issues.includes('RECOVERY_SOURCE_CONTRACT_INVALID'));
  duplicatedPlan.sources[1]=null;
  fs.writeFileSync(sourcePlanFile,JSON.stringify(duplicatedPlan));
  const nullInspection=inspectSchedulerHandoff(dir,'20261014');
  assert.equal(nullInspection.status,'REJECTED');
  assert.ok(nullInspection.issues.includes('HANDOFF_INPUT_INVALID_SHAPE'));
 }finally{fs.writeFileSync(sourcePlanFile,savedSourcePlan);}
 console.log('D4_SCHEDULER_RECOVERY_SOURCE_SET_FAIL_CLOSED_PASS');
 const cliPath=path.resolve('scripts/research_date_to_video_d4_orchestrator.js');
 const cliOk=spawnSync(process.execPath,[cliPath,'--inspect-handoff','20261014',dir],{encoding:'utf8'});
 assert.equal(cliOk.status,0,cliOk.stderr);
 assert.equal(JSON.parse(cliOk.stdout).status,'RESEARCH_HANDOFF_VALIDATED');
 const cliWrongDate=spawnSync(process.execPath,[cliPath,'--inspect-handoff','20261013',dir],{encoding:'utf8'});
 assert.equal(cliWrongDate.status,3);
 assert.equal(JSON.parse(cliWrongDate.stdout).status,'REJECTED');
 const cliMissing=spawnSync(process.execPath,[cliPath,'--inspect-handoff','20261014'],{encoding:'utf8'});
 assert.equal(cliMissing.status,3);
 assert.equal(JSON.parse(cliMissing.stdout).automatic_dispatch_authorized,false);
 console.log('D4_READ_ONLY_SCHEDULER_HANDOFF_CLI_EXIT_CODES_PASS');
 const cliBadDate=spawnSync(process.execPath,[cliPath,'--inspect-handoff','20260230',dir],{encoding:'utf8'});
 assert.equal(cliBadDate.status,3);
 assert.ok(JSON.parse(cliBadDate.stdout).issues.includes('INVALID_TARGET_DATE'));
 const cliMissingDir=spawnSync(process.execPath,[cliPath,'--inspect-handoff','20261014',path.join(dir,'missing-directory')],{encoding:'utf8'});
 assert.equal(cliMissingDir.status,3);
 assert.ok(JSON.parse(cliMissingDir.stdout).issues.includes('HANDOFF_INPUT_UNREADABLE_OR_INVALID_JSON'));
 console.log('D4_SCHEDULER_CLI_INVALID_DATE_AND_MISSING_DIR_FAIL_CLOSED_PASS');
 const boundedPlanFile=path.join(dir,'official-data-recovery-plan.json'),boundedSaved=fs.readFileSync(boundedPlanFile);
 try{
  const forgedPlan=JSON.parse(boundedSaved);
  const bfi=forgedPlan.sources.find(x=>x.id==='BFI82U');
  bfi.automated_retrieval_allowed=true;
  bfi.action_required='REUSE_VERIFIED_ARCHIVE';
  fs.writeFileSync(boundedPlanFile,JSON.stringify(forgedPlan));
  const forgedInspection=inspectSchedulerHandoff(dir,'20261014');
  assert.equal(forgedInspection.status,'REJECTED');
  assert.ok(forgedInspection.issues.includes('RECOVERY_AUTOMATION_PRECONDITION_INVALID'));
  assert.equal(forgedInspection.automatic_dispatch_authorized,false);
 }finally{fs.writeFileSync(boundedPlanFile,boundedSaved);}
 console.log('D4_SCHEDULER_BOUNDED_RECOVERY_PRECONDITION_FAIL_CLOSED_PASS');
 assert.equal(inspectSchedulerHandoff(dir,'20261014').next_step,'WAIT_FOR_OFFICIAL_SOURCE');
 assert.equal(inspectSchedulerHandoff(dir,'20261013').next_step,'REJECT_UNTRUSTED_HANDOFF');
 const editorialDir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-scheduler-editorial-'));
 try{
  run('.', '20261013',editorialDir);
  const editorialInspection=inspectSchedulerHandoff(editorialDir,'20261013');
  assert.equal(editorialInspection.status,'RESEARCH_HANDOFF_VALIDATED');
  assert.equal(editorialInspection.next_step,'WAIT_FOR_INDEPENDENT_EDITORIAL_REVIEW');
  assert.equal(editorialInspection.automatic_dispatch_authorized,false);
 }finally{fs.rmSync(editorialDir,{recursive:true,force:true});}
 console.log('D4_SCHEDULER_NEXT_STEP_CLASSIFICATION_NO_DISPATCH_PASS');
 const classifiedCli=spawnSync(process.execPath,[cliPath,'--inspect-handoff','20261014',dir],{encoding:'utf8'});
 assert.equal(classifiedCli.status,0,classifiedCli.stderr);
 const classifiedPayload=JSON.parse(classifiedCli.stdout);
 assert.equal(classifiedPayload.next_step,'WAIT_FOR_OFFICIAL_SOURCE');
 assert.equal(classifiedPayload.automatic_dispatch_authorized,false);
 const rejectedCli=spawnSync(process.execPath,[cliPath,'--inspect-handoff','20261013',dir],{encoding:'utf8'});
 assert.equal(rejectedCli.status,3);
 assert.equal(JSON.parse(rejectedCli.stdout).next_step,'REJECT_UNTRUSTED_HANDOFF');
 console.log('D4_SCHEDULER_CLI_NEXT_STEP_MACHINE_READABLE_PASS');
 const stageFile=path.join(dir,'status.json'),stageSaved=fs.readFileSync(stageFile);
 try{
  const malformed=JSON.parse(stageSaved);malformed.stages=[null];
  fs.writeFileSync(stageFile,JSON.stringify(malformed));
  const inspected=inspectSchedulerHandoff(dir,'20261014');
  assert.equal(inspected.status,'REJECTED');
  assert.ok(inspected.issues.includes('D4_STAGE_CONTRACT_INVALID'));
  assert.equal(inspected.next_step,'REJECT_UNTRUSTED_HANDOFF');
  assert.equal(inspected.automatic_dispatch_authorized,false);
  const contradictory=JSON.parse(stageSaved);
  contradictory.stages[0].status='WAITING_SOURCE';
  contradictory.stages[1].status='RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING';
  fs.writeFileSync(stageFile,JSON.stringify(contradictory));
  const inspectedContradiction=inspectSchedulerHandoff(dir,'20261014');
  assert.equal(inspectedContradiction.status,'REJECTED');
  assert.ok(inspectedContradiction.issues.includes('D4_STAGE_SEQUENCE_INVALID'));
  assert.equal(inspectedContradiction.next_step,'REJECT_UNTRUSTED_HANDOFF');
 }finally{fs.writeFileSync(stageFile,stageSaved);}
 console.log('D4_SCHEDULER_STAGE_CONTRACT_AND_SEQUENCE_FAIL_CLOSED_PASS');
 console.log('D4_MISSING_DATED_SOURCE_DOES_NOT_ENTER_EDITORIAL_PASS');

// Reusing an output directory for another date must not leave an old certified-looking Master or review packet.
const crossDateDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-cross-date-'));
try{
 const first=run('.','20261008',crossDateDir);
 assert.equal(first.target_date,'20261008');
 assert.ok(fs.existsSync(path.join(crossDateDir,'market-master-review-packet.json')));
 const second=run('.','20261013',crossDateDir);
 assert.equal(second.target_date,'20261013');
 assert.equal(fs.existsSync(path.join(crossDateDir,'market-master-review-packet.json')),true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(crossDateDir,'market-master-review-packet.json'),'utf8')).target_date,'20261013');
 for(const file of ['status.json','official-data-manifest.json','official-manifest-master-gate.json','market-master.json','media-handoff.json']){
  const output=JSON.parse(fs.readFileSync(path.join(crossDateDir,file),'utf8'));
  assert.equal(output.target_date,'20261013',file+' must not retain previous date');
  assert.equal(output.publication_authorized,false);
 }
 assert.equal(JSON.parse(fs.readFileSync(path.join(crossDateDir,'market-master.json'))).status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');
}finally{fs.rmSync(crossDateDir,{recursive:true,force:true});}

// Reviewer handoff is an exact-byte, dated evidence index, never an approval.
const reviewHandoffDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-review-handoff-'));
try{
 const digest=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(reviewHandoffDir,name))).digest('hex');
 const first=run('.','20261013',reviewHandoffDir);
 const h=JSON.parse(fs.readFileSync(path.join(reviewHandoffDir,'review-handoff-manifest.json'),'utf8'));
 assert.equal(h.target_date,'20261013');
 assert.equal(h.inventory_sha256,crypto.createHash('sha256').update(JSON.stringify(JSON.parse(fs.readFileSync(path.join(reviewHandoffDir,'claims.json'),'utf8')))).digest('hex'));
 assert.equal(h.worksheet_sha256,digest('independent-review-worksheet.json'));
 assert.equal(h.price_evidence_sha256,digest('dated-price-review-evidence.json'));
 assert.equal(h.market_master_review_sha256,digest('market-master-review-packet.json'));
 assert.equal(h.status,'PENDING_INDEPENDENT_REVIEW');
 assert.equal(h.review_input_sha256,null);
 assert.equal(h.review_gate_sha256,digest('editorial-review.json'));
 assert.deepEqual(h.review_decisions,[]);
 for(const flag of ['editorial_certified','narration_authorized','render_authorized','publication_authorized'])assert.equal(h[flag],false);
 assert.ok(first.artifacts.some(x=>x.name==='review-handoff-manifest.json'&&x.sha256===digest('review-handoff-manifest.json')));
 run('.','20261014',reviewHandoffDir);
 assert.equal(fs.existsSync(path.join(reviewHandoffDir,'review-handoff-manifest.json')),false);
 console.log('D4_REVIEW_HANDOFF_HASH_AND_STALE_DATE_FAIL_CLOSED_PASS');
}finally{fs.rmSync(reviewHandoffDir,{recursive:true,force:true});}

// Optional audio submissions are external inputs: preserve them, reject partial submissions, clean generated review on rerun.
const audioDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-audio-'));
try{const supplied=path.join(audioDir,'sentence-audio-inventory.json');fs.writeFileSync(supplied,JSON.stringify({contract:'INVALID'}));const first=run('.','20261008',audioDir);assert.ok(first.blockers.includes('DATED_SENTENCE_AUDIO_REVIEW_REJECTED'));assert.equal(JSON.parse(fs.readFileSync(path.join(audioDir,'sentence-audio-review.json')).toString()).status,'REJECTED');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(audioDir,'sentence-audio-review.json'),'utf8')).issues,['D4_AUDIO_INPUT_MISSING:edge-tts-command-plan.json','D4_AUDIO_INPUT_MISSING:sentence-audio-proof.json','D4_AUDIO_INPUT_MISSING:narration-candidate.json']);assert.equal(first.audio_recovery_advice.actions.length,3);assert.equal(first.audio_recovery_advice.source_review_sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(audioDir,'sentence-audio-review.json'))).digest('hex'));assert.equal(first.audio_recovery_advice.actions[0].action,'SUPPLY_MISSING_RESEARCH_ARTIFACT');assert.equal(first.audio_recovery_advice.automatic_dispatch_authorized,false);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(audioDir,'status.json'),'utf8')).audio_recovery_advice,first.audio_recovery_advice);assert.equal(fs.existsSync(supplied),true);fs.unlinkSync(supplied);run('.','20261008',audioDir);assert.equal(fs.existsSync(path.join(audioDir,'sentence-audio-review.json')),false);assert.equal(JSON.parse(fs.readFileSync(path.join(audioDir,'status.json'),'utf8')).blockers.includes('DATED_SENTENCE_AUDIO_REVIEW_REJECTED'),false);assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(audioDir,'status.json'),'utf8')),'audio_recovery_advice'),false);console.log('D4_OPTIONAL_AUDIO_INPUT_FAIL_CLOSED_PASS');}finally{fs.rmSync(audioDir,{recursive:true,force:true});}

// Reusing the same directory for a missing-source date must clear previous audio review and never carry forward an audio approval signal.
const staleAudioDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-stale-audio-'));try{fs.writeFileSync(path.join(staleAudioDir,'sentence-audio-inventory.json'),JSON.stringify({contract:'INVALID'}));run('.','20261008',staleAudioDir);assert.equal(fs.existsSync(path.join(staleAudioDir,'sentence-audio-review.json')),true);fs.unlinkSync(path.join(staleAudioDir,'sentence-audio-inventory.json'));const missingSourceRerun=run('.','20261014',staleAudioDir);assert.equal(missingSourceRerun.stages[0].status,'WAITING_SOURCE');assert.equal(missingSourceRerun.official_recovery_advice.target_date,'20261014');assert.equal(JSON.parse(fs.readFileSync(path.join(staleAudioDir,'status.json'),'utf8')).target_date,'20261014');assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(staleAudioDir,'status.json'),'utf8')),'audio_recovery_advice'),false);assert.equal(fs.existsSync(path.join(staleAudioDir,'sentence-audio-review.json')),false);assert.equal(missingSourceRerun.render_authorized,false);assert.equal(missingSourceRerun.publication_authorized,false);console.log('D4_STALE_AUDIO_REVIEW_MISSING_SOURCE_RERUN_PASS');}finally{fs.rmSync(staleAudioDir,{recursive:true,force:true});}

// A complete set of malformed external audio JSON must fail closed with an explicit unverified state.
const malformedAudioDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-malformed-audio-'));try{for(const name of ['sentence-audio-inventory.json','edge-tts-command-plan.json','sentence-audio-proof.json','narration-candidate.json'])fs.writeFileSync(path.join(malformedAudioDir,name),'not-json');const malformedResult=run('.','20261008',malformedAudioDir);const malformedReview=JSON.parse(fs.readFileSync(path.join(malformedAudioDir,'sentence-audio-review.json'),'utf8'));assert.equal(malformedReview.status,'REJECTED');assert.deepEqual(malformedReview.issues,['D4_AUDIO_INPUT_INVALID_JSON']);assert.equal(malformedReview.audio_verified,false);assert.ok(malformedResult.blockers.includes('DATED_SENTENCE_AUDIO_REVIEW_REJECTED'));assert.equal(malformedResult.render_authorized,false);assert.equal(malformedResult.publication_authorized,false);console.log('D4_MALFORMED_AUDIO_FAIL_CLOSED_PASS');}finally{fs.rmSync(malformedAudioDir,{recursive:true,force:true});}

// A malformed individual audio JSON input must also fail closed, regardless of which input is damaged.
for(const damagedName of ['sentence-audio-inventory.json','edge-tts-command-plan.json','sentence-audio-proof.json','narration-candidate.json']){const damagedDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-single-malformed-'));try{for(const name of ['sentence-audio-inventory.json','edge-tts-command-plan.json','sentence-audio-proof.json','narration-candidate.json'])fs.writeFileSync(path.join(damagedDir,name),name===damagedName?'not-json':'{}');const damagedResult=run('.','20261008',damagedDir);const damagedReview=JSON.parse(fs.readFileSync(path.join(damagedDir,'sentence-audio-review.json'),'utf8'));assert.equal(damagedReview.status,'REJECTED',damagedName);assert.equal(damagedReview.audio_verified,false,damagedName);assert.ok(damagedResult.blockers.includes('DATED_SENTENCE_AUDIO_REVIEW_REJECTED'),damagedName);assert.equal(damagedResult.render_authorized,false,damagedName);assert.equal(damagedResult.publication_authorized,false,damagedName);}finally{fs.rmSync(damagedDir,{recursive:true,force:true});}}console.log('D4_SINGLE_MALFORMED_AUDIO_INPUTS_FAIL_CLOSED_PASS');

// A previous date's otherwise valid audio inventory must never be accepted as current D4 evidence.
const audioCrossDate=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-audio-cross-date-'));
try{const file=path.join(audioCrossDate,'sentence-audio-inventory.json');fs.writeFileSync(file,JSON.stringify({contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_INPUT_INVENTORY',target_date:'20261008',source_master_sha256:'old',worksheet_sha256:'old'}));fs.writeFileSync(path.join(audioCrossDate,'narration-candidate.json'),JSON.stringify({target_date:'20261008',sentences:[{id:'opening-1',narration:'遭替換的文字',subtitle:'遭替換的字幕'}]}));fs.writeFileSync(path.join(audioCrossDate,'edge-tts-command-plan.json'),'{}');fs.writeFileSync(path.join(audioCrossDate,'sentence-audio-proof.json'),'{}');const result=run('.','20261013',audioCrossDate);const review=JSON.parse(fs.readFileSync(path.join(audioCrossDate,'sentence-audio-review.json'),'utf8'));assert.equal(review.status,'REJECTED');assert.ok(review.issues.includes('D4_AUDIO_DATE_MISMATCH'));assert.ok(review.issues.includes('D4_AUDIO_MASTER_SHA_MISMATCH'));assert.ok(review.issues.includes('D4_AUDIO_WORKSHEET_SHA_MISMATCH'));assert.ok(review.issues.includes('D4_AUDIO_CANDIDATE_INVENTORY_DRIFT'));assert.ok(review.issues.includes('D4_AUDIO_DATE_MISMATCH'));assert.ok(review.issues.includes('D4_AUDIO_MASTER_SHA_MISMATCH'));assert.ok(review.issues.includes('D4_AUDIO_WORKSHEET_SHA_MISMATCH'));assert.equal(new Set(review.issues).size,review.issues.length);assert.equal(review.audio_verified,false);assert.ok(result.blockers.includes('DATED_SENTENCE_AUDIO_REVIEW_REJECTED'));assert.equal(result.render_authorized,false);console.log('D4_AUDIO_CROSS_DATE_PROVENANCE_FAIL_CLOSED_PASS');}finally{fs.rmSync(audioCrossDate,{recursive:true,force:true});}

// An external narration candidate without complete audio evidence is preserved but never accepted as audio proof.
const candidateOnlyDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-candidate-only-'));try{const file=path.join(candidateOnlyDir,'narration-candidate.json');fs.writeFileSync(file,JSON.stringify({target_date:'20261008',sentences:[]}));const result=run('.','20261008',candidateOnlyDir);assert.ok(result.blockers.includes('DATED_SENTENCE_AUDIO_REVIEW_REJECTED'));assert.equal(JSON.parse(fs.readFileSync(path.join(candidateOnlyDir,'sentence-audio-review.json'),'utf8')).status,'REJECTED');assert.equal(fs.existsSync(file),true);console.log('D4_CANDIDATE_ONLY_AUDIO_FAIL_CLOSED_PASS');}finally{fs.rmSync(candidateOnlyDir,{recursive:true,force:true});}

const {missingAudioInputs,AUDIO_INPUTS}=require('../scripts/research_date_to_video_d4_orchestrator');assert.deepEqual(missingAudioInputs('/unused',()=>false),AUDIO_INPUTS);assert.deepEqual(missingAudioInputs('/unused',()=>true),[]);assert.deepEqual(missingAudioInputs('/unused',file=>!file.endsWith('sentence-audio-proof.json')),['sentence-audio-proof.json']);console.log('D4_AUDIO_MISSING_INPUT_HELPER_PASS');
