'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {run}=require('../scripts/research_date_to_video_d4_orchestrator');
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
 assert.equal(recoveryPlan.manifest_sha256,officialManifest.manifest_sha256);
 assert.equal(recoveryPlan.sources.length,4);
 assert.equal(recoveryPlan.sources.find(x=>x.id==='BFI82U').automated_retrieval_allowed,date==='20261013');
 assert.equal(recoveryPlan.sources.find(x=>x.id==='BFI82U').action_required,date==='20261008'?'REUSE_VERIFIED_ARCHIVE':'APPROVED_BOUNDED_RECOVERY_OR_WAIT');
 assert.ok(recoveryPlan.sources.filter(x=>x.id!=='BFI82U').every(x=>x.automated_retrieval_allowed===false));
 assert.equal(recoveryPlan.render_authorized,false);
 assert.equal(recoveryPlan.publication_authorized,false);
 for(const [id,file] of [['MI_INDEX','mi-index-provenance.json'],['FMTQIK','fmtqik-provenance.json']]){
  const diagnostic=JSON.parse(fs.readFileSync(path.join(dir,file)));
  const manifestEntry=officialManifest.entries.find(e=>e.id===id);
  const gateEntry=officialGate.unverified_sources.find(e=>e.id===id);
  assert.equal(manifestEntry.source_date,date);
  assert.equal(manifestEntry.provenance_diagnostic.status,diagnostic.status);
  assert.equal(manifestEntry.provenance_diagnostic.source_path,diagnostic.source_path);
  assert.deepEqual(gateEntry.provenance_diagnostic,manifestEntry.provenance_diagnostic);
  assert.equal(gateEntry.source_date,date);
  assert.equal(gateEntry.provenance_diagnostic.raw_http_provenance_certified,false);
 }

 for(const [name,source] of [['mi-index-provenance.json','MI_INDEX'],['fmtqik-provenance.json','FMTQIK']]){
  const p=JSON.parse(fs.readFileSync(path.join(dir,name)));assert.equal(p.target_date,date);assert.equal(p.master_authorized,false);assert.equal(p.publication_authorized,false);
  if(source==='MI_INDEX')assert.equal(p.raw_http_provenance_certified,false);
  else assert.equal(p.original_http_archive_verified,false);
 }
 if(date==='20261008'){assert.equal(officialGate.status,'PARTIAL_VERIFIED_INSTITUTIONAL_ONLY');assert.equal(officialGate.institutional.raw_sha256,officialManifest.entries[0].raw_sha256);}
 if(date==='20261013'){assert.equal(officialGate.status,'WAITING_SOURCE');assert.equal(officialGate.institutional,null);}
 if(['EVIDENCE_JOINED_NOT_CERTIFIED','PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING'].includes(r.stages[0].status)){
  const claims=JSON.parse(fs.readFileSync(path.join(dir,'claims.json')));
  assert.equal(claims.target_date,date);assert.ok(claims.claim_count>0);
  const institutional=JSON.parse(fs.readFileSync(path.join(dir,'institutional-evidence.json')));
  assert.equal(institutional.target_date,date);
  if(date==='20261008'){assert.equal(institutional.status,'VERIFIED');assert.equal(institutional.final_six_rows_verified,true);assert.equal(r.stages[1].status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING');}
  if(date==='20261013'){assert.equal(institutional.status,'WAITING_SOURCE');assert.ok(r.blockers.includes('DATED_FINAL_BFI82U_RAW_MISSING'));assert.ok(r.blockers.includes('DATED_FINAL_BFI82U_MANIFEST_MISSING'));assert.equal(r.source_readiness.bfi82u_archive_status,'MISSING_OR_INCOMPLETE');}
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
  const media=JSON.parse(fs.readFileSync(path.join(dir,'media-handoff.json')));
  assert.equal(media.target_date,date);assert.equal(media.render_authorized,false);assert.equal(media.publication_authorized,false);assert.equal(media.fixed_opening_lines.length,4);assert.equal(media.fixed_opening_lines[3],'那麼我們開始囉。');assert.ok(!JSON.stringify(media.fixed_opening_lines).includes('我們有提供中文 CC 字幕'));assert.equal(media.market_opening_seconds.min,30);assert.equal(media.market_opening_seconds.max,90);
  const noInputManifest=JSON.parse(fs.readFileSync(path.join(dir,'editorial-input-manifest.json')));
  assert.equal(noInputManifest.review_input_sha256,null);
  assert.equal(noInputManifest.draft_input_sha256,null);
  assert.equal(noInputManifest.editorial_certified,false);
  const review=JSON.parse(fs.readFileSync(path.join(dir,'editorial-review.json')));
  assert.equal(review.claim_whitelist_verified,false);assert.equal(review.render_authorized,false);
  if(date==='20261013'){assert.equal(r.stages[0].status,'PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING');assert.ok(r.blockers.includes('MARKET_OPENING_DATED_BASE_MISSING'));}
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
const crypto=require('node:crypto');
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
assert.equal(draftIntegratedCheck.status,'STRUCTURAL_EVIDENCE_VALIDATED_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED');
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
console.log('D4_REVIEW_TO_ORIGINAL_DRAFT_INTEGRATION_PASS');
console.log('D4_EXPLICIT_DATED_REVIEW_INPUT_PASS');
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
for(const name of ['featured-price-observations.json','candidate-semantic-outline.json','semantic-consumer-projection.json','m8vis-compatibility.json','m8vis-scene-adapter.json','independent-review-worksheet.json','authored-candidate-preflight.json','original-analysis-draft-check.json','market-master.json','media-handoff.json'])assert.equal(fs.existsSync(path.join(staleDir,name)),false,'STALE_OUTPUT:'+name);
console.log('D4_REUSED_OUTPUT_DIR_FAIL_CLOSED_PASS');
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
assert.match(candidateCheck.reason,/UNAPPROVED_CLAIM_ID/);
assert.ok(candidateRun.blockers.includes('ORIGINAL_ANALYSIS_DRAFT_REJECTED'));
assert.equal(candidateRun.render_authorized,false);
console.log('D4_ACTUAL_AUTHORED_CANDIDATE_REVIEW_REQUIRED_PASS');
const draftDir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-draft-'));
fs.writeFileSync(path.join(draftDir,'original-analysis-draft-input.json'),JSON.stringify({target_date:'20261008',insights:[]}));
const rejected=run('.','20261008',draftDir);
const draftCheck=JSON.parse(fs.readFileSync(path.join(draftDir,'original-analysis-draft-check.json')));
assert.equal(draftCheck.status,'REJECTED');assert.equal(draftCheck.reason,'EMPTY_INSIGHTS');assert.equal(JSON.parse(fs.readFileSync(path.join(draftDir,'media-handoff.json'))).draft_check_status,'REJECTED');assert.equal(draftCheck.narration_authorized,false);
const rejectedDraftManifest=JSON.parse(fs.readFileSync(path.join(draftDir,'editorial-input-manifest.json')));
const rejectedDraftMedia=JSON.parse(fs.readFileSync(path.join(draftDir,'media-handoff.json')));
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
