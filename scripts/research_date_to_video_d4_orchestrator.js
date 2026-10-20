'use strict';
// D4 research-only orchestrator: one explicit date, deterministic evidence and review-ready artifacts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {plan}=require('./research_date_to_video_v1');
const {FIXED_OPENING_LINES}=require('./research_date_to_video_fixed_opening_v1');
const {build:buildDatedMediaInput}=require('./research_date_to_video_dated_media_input_v1');
const {prepare:prepareEditorialNarration}=require('./research_date_to_video_editorial_narration_worksheet_v1');
const {join}=require('./research_date_to_video_d4_evidence_join');
const {inventory}=require('./research_date_to_video_d4_claim_inventory');
const {review}=require('./research_date_to_video_d4_review_gate');
const {validate:validateDraft}=require('./research_date_to_video_d4_draft_gate');
const {inspect:inspectBfi82u}=require('./research_date_to_video_bfi82u_v1');
const {build:buildOfficialManifest}=require('./research_official_data_manifest_v1');
const {gate:gateOfficialManifest}=require('./research_official_manifest_master_gate_v1');
const {planRecovery}=require('./research_official_data_recovery_v1');
const {inspect:inspectMiProvenance}=require('./research_official_mi_index_provenance_v1');
const {inspect:inspectFmtqikProvenance}=require('./research_official_fmtqik_provenance_v1');
const {parse:parseBreadth}=require('./parse_twse_official_stock_aggregate');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function run(root,date,out){
 const status=plan(root,date),result={contract:'DATE_TO_VIDEO_V1_D4_ORCHESTRATOR',target_date:date,research_only:true,publication_authorized:false,render_authorized:false,ready_to_render:false,stages:status.stages,blockers:[...status.blockers],artifacts:[]};
 const write=(name,obj)=>{const body=JSON.stringify(obj,null,2)+'\n';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),body);result.artifacts.push({name,sha256:hash(body)});};
 // A repeated run must not expose artifacts from an earlier date or earlier approval state.
 // Preserve only explicit editorial inputs; clear exclusively known generated outputs.
 const generated=['status.json','evidence-join.json','claims.json','institutional-evidence.json','breadth-evidence.json','market-master.json','editorial-research-brief.json','original-analysis-task.json','editorial-review.json','editorial-input-manifest.json','media-handoff.json','dated-media-input.json','editorial-narration-worksheet.json','sentence-audio-review.json','original-analysis-draft-check.json','authored-candidate-preflight.json','independent-review-worksheet.json','candidate-semantic-outline.json','semantic-consumer-projection.json','m8vis-compatibility.json','m8vis-scene-adapter.json','featured-price-observations.json','dated-price-review-evidence.json','market-master-review-packet.json','official-data-manifest.json','official-data-recovery-plan.json','official-manifest-master-gate.json','mi-index-provenance.json','fmtqik-provenance.json'];
 for(const name of generated){const file=path.join(out,name);if(fs.existsSync(file))fs.unlinkSync(file)}
 const officialManifest=buildOfficialManifest(root,date);
 const officialGate=gateOfficialManifest(root,date,officialManifest);
 write('official-data-manifest.json',officialManifest);
 const recoveryPlan=planRecovery(root,date);
 if(recoveryPlan.manifest_sha256!==officialManifest.manifest_sha256)throw Error('OFFICIAL_RECOVERY_PLAN_MANIFEST_MISMATCH');
 write('official-data-recovery-plan.json',recoveryPlan);
 write('official-manifest-master-gate.json',officialGate);
 write('mi-index-provenance.json',inspectMiProvenance(root,date));
 write('fmtqik-provenance.json',inspectFmtqikProvenance(root,date));
 const marketOnlyMissing=status.blockers.length===1&&status.blockers[0]==='MISSING:market-opening';
 if(status.stages[0].status==='WAITING_SOURCE'&&!marketOnlyMissing){write('status.json',result);return result}
 const load=(part)=>JSON.parse(fs.readFileSync(path.join(root,'data_daily_gain_over_5',part,date+'.json'),'utf8'));
 const inputs={list:load(''),facts:load('analysis-facts/'),news:load('analysis-news/'),ai:load('analysis-ai/')};
 const cutoff=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6)+'T23:59:59+08:00';
 try{
  const joined=join({date,cutoff,...inputs}),claims=inventory(joined,inputs);
  result.stages[0].status=marketOnlyMissing?'PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING':'EVIDENCE_JOINED_NOT_CERTIFIED';
  const institutional=inspectBfi82u(root,date);
  if(officialGate.status==='PARTIAL_VERIFIED_INSTITUTIONAL_ONLY'){
   if(institutional.status!=='VERIFIED'||officialGate.institutional.raw_sha256!==institutional.raw_sha256)throw Error('OFFICIAL_MANIFEST_D4_INSTITUTIONAL_MISMATCH');
  }else if(institutional.status==='VERIFIED')throw Error('OFFICIAL_MANIFEST_D4_UNVERIFIED_INSTITUTIONAL');
  const breadthPath=path.join(root,'data_twse_mi_index',date+'_twse_mi_index.json');
  let breadth={target_date:date,status:'WAITING_SOURCE',missing:['DATED_MI_INDEX_STOCK_AGGREGATE'],publication_authorized:false};
  if(fs.existsSync(breadthPath)){
   try{const bytes=fs.readFileSync(breadthPath),expected=officialManifest.entries.find(e=>e.id==='MI_INDEX')?.provenance_diagnostic;
    if(expected?.status!=='DATED_REPOSITORY_PAYLOAD_SCHEMA_VERIFIED_RAW_HTTP_PROVENANCE_PENDING'||expected.repository_payload_sha256!==hash(bytes))throw Error('MI_INDEX_CHANGED_SINCE_OFFICIAL_MANIFEST');
    breadth={...parseBreadth(JSON.parse(bytes),date),status:'OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED',source_sha256:hash(bytes)};}
   catch(e){breadth={target_date:date,status:'REJECTED',reason:e.message,publication_authorized:false};}
  }
  let marketMaster={target_date:date,status:'WAITING_SOURCE',publication_authorized:false,editorial_complete:false};
  if(!marketOnlyMissing&&institutional.status==='VERIFIED'&&breadth.status==='OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED'){
   try{
    const base=load('market-opening/');
    if(base.target_date!==date||base.market!=='TWSE'||base.status!=='partial')throw Error('INVALID_DATED_MARKET_BASE');
    const fmtqik=officialManifest.entries.find(e=>e.id==='FMTQIK')?.provenance_diagnostic;
    const chartEvidence=base.source_manifest?.find(s=>['TWSE FMTQIK','TWSE MI_5MINS_HIST + FMTQIK dated repository chart'].includes(s.source_name)&&s.source_path_or_endpoint==='data_twse_market_chart/market_chart.json');
    const chartBytes=fs.readFileSync(path.join(root,'data_twse_market_chart/market_chart.json'));
    const datedChart=JSON.parse(chartBytes).data?.filter(r=>r.date===date);
    if(fmtqik?.status!=='DATED_DERIVED_CHART_ONLY_ORIGINAL_RAW_PENDING'||!fmtqik.derived_chart_sha256||hash(chartBytes)!==fmtqik.derived_chart_sha256||chartEvidence?.source_date!==date||(chartEvidence.source_sha256!==undefined&&chartEvidence.source_sha256!==fmtqik.derived_chart_sha256)||datedChart?.length!==1||base.market_trading?.turnover_twd!==datedChart[0].turnover||base.market_trading?.shares!==datedChart[0].volumeShares||base.market_trading?.transactions!==datedChart[0].transactions)throw Error('MARKET_BASE_DERIVED_CHART_MANIFEST_MISMATCH');
    for(const name of ['foreign','investment_trust','dealers'])for(const key of ['buy_twd','sell_twd','net_twd'])if(base.institutional?.[name]?.[key]!==institutional.institutional[name][key])throw Error('MARKET_BASE_INSTITUTIONAL_MISMATCH_'+name+'_'+key);
    const trading=base.market_trading;if(!Number.isSafeInteger(trading?.turnover_twd)||trading.turnover_twd<=0)throw Error('INVALID_DATED_TURNOVER');
    marketMaster={target_date:date,status:'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING',market:'TWSE',taiex:base.taiex,market_trading:trading,breadth, institutional:institutional.institutional,source_evidence:{market_base_sha256:hash(fs.readFileSync(path.join(root,'data_daily_gain_over_5/market-opening',date+'.json'))),mi_index_sha256:breadth.source_sha256,bfi82u_sha256:institutional.raw_sha256},ordinary_share_identity_certified:false,editorial_complete:false,publication_authorized:false};
   }catch(e){marketMaster={target_date:date,status:'REJECTED',reason:e.message,editorial_complete:false,publication_authorized:false};}
  }
  if(marketMaster.status==='RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING')write('market-master-review-packet.json',{contract:'DATE_TO_VIDEO_V1_D4_MARKET_MASTER_REVIEW_PACKET',target_date:date,market_master_sha256:hash(JSON.stringify(marketMaster)),source_evidence:marketMaster.source_evidence,checks:[{id:'DATE_AND_MARKET_SCOPE',status:'SOURCE_CROSSCHECKED_REVIEW_PENDING'},{id:'INDEX_AND_TURNOVER',status:'SOURCE_CROSSCHECKED_REVIEW_PENDING'},{id:'PREVIOUS_FIVE_TRADING_DAY_TURNOVER_COMPARISON',status:'NOT_PRESENT_IN_D4_MASTER_REQUIRES_DATED_SOURCE'},{id:'OFFICIAL_STOCK_COLUMN_BREADTH',status:'SOURCE_VERIFIED_IDENTITY_UNCERTIFIED'},{id:'THREE_INSTITUTIONAL_GROUPS',status:'SOURCE_CROSSCHECKED_REVIEW_PENDING'},{id:'INTERPRETATION_AND_CAUSALITY',status:'INDEPENDENT_EDITORIAL_REVIEW_REQUIRED'}],ordinary_share_identity_certified:false,reviewer:null,decision:'PENDING',editorial_certified:false,render_authorized:false,publication_authorized:false});
  result.stages[1].status=marketMaster.status==='RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING'?'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING':institutional.status==='VERIFIED'&&breadth.status==='OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED'?'MARKET_SOURCE_EVIDENCE_PRESENT_MASTER_UNCERTIFIED':'WAITING_FINAL_MARKET_MASTER';
  result.stages[2].status='REVIEW_REQUIRED';
  result.source_readiness={target_date:date,repo_daily_institutional_present:institutional.repo_daily_institutional_present??fs.existsSync(path.join(root,'data_twse_institutional_investors',date+'_twse_institutional_investors.json')),bfi82u_archive_status:institutional.status==='VERIFIED'?'VERIFIED':institutional.bfi82u_archive_status||institutional.status,market_master_status:marketMaster.status};
  result.blockers=[...(marketOnlyMissing?['MARKET_OPENING_DATED_BASE_MISSING']:[]),...(institutional.status==='VERIFIED'?[]:institutional.missing||['BFI82U_ARCHIVE_UNVERIFIED']),...(breadth.status==='OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED'?[]:['DATED_MI_INDEX_STOCK_AGGREGATE_PENDING']),'FINAL_MARKET_MASTER_NOT_CERTIFIED','CLAIM_REVIEW_REQUIRED'];
  const emptyReview={target_date:date,inventory_sha256:hash(JSON.stringify(claims)),decisions:[]};
  // Explicit review decisions are an input, never inferred from a research memo or claim inventory.
  const reviewInputPath=path.join(out,'editorial-review-input.json');
  let gate;
  if(fs.existsSync(reviewInputPath)){
   try{gate=review(claims,JSON.parse(fs.readFileSync(reviewInputPath,'utf8')));}
   catch(e){
    gate={contract:'DATE_TO_VIDEO_V1_D4_REVIEW_GATE',target_date:date,status:'REJECTED',reason:e.message,inventory_sha256:emptyReview.inventory_sha256,approved_claim_ids:[],claim_whitelist_verified:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
    result.blockers.push('INDEPENDENT_REVIEW_INPUT_REJECTED');
   }
  }else gate=review(claims,emptyReview);
  const editorialBrief={target_date:date,contract:'DATE_TO_VIDEO_V1_EDITORIAL_RESEARCH_BRIEF',status:marketMaster.status==='RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING'?'OBSERVATIONS_READY_INDEPENDENT_ANALYSIS_REQUIRED':'WAITING_MARKET_MASTER',source_master_sha256:hash(JSON.stringify(marketMaster)),observations:marketMaster.status==='RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING'?[{kind:'OFFICIAL_STOCK_COLUMN_BREADTH',advancers:breadth.advancers,decliners:breadth.decliners,unchanged:breadth.unchanged,limit_up_count:breadth.limit_up_count,identity_certified:false},{kind:'MARKET_TURNOVER',turnover_twd:marketMaster.market_trading.turnover_twd},{kind:'INSTITUTIONAL_FLOWS',groups:marketMaster.institutional}]:[],analysis_questions:['Is breadth consistent with index direction and turnover?','Do institutional net flows support or diverge from breadth?','Which independently reviewed stock claims provide a differentiated, non-causal interpretation?'],approved_claim_ids:gate.approved_claim_ids,original_analysis:null,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
  if(editorialBrief.observations.length===3){
   const flows=marketMaster.institutional;
   const totalNet=['foreign','investment_trust','dealers'].reduce((sum,name)=>sum+flows[name].net_twd,0);
   const breadthNet=breadth.advancers-breadth.decliners;
   editorialBrief.derived_comparisons={breadth_net_count:breadthNet,institutional_total_net_twd:totalNet,breadth_direction:Math.sign(breadthNet),institutional_direction:Math.sign(totalNet),directional_relation:Math.sign(breadthNet)===Math.sign(totalNet)?'SAME_SIGN':'DIFFERENT_SIGN',interpretation_status:'OBSERVATION_ONLY_NO_CAUSAL_CLAIM',source_master_sha256:editorialBrief.source_master_sha256};
  }
  const analysisTask={contract:'DATE_TO_VIDEO_V1_ORIGINAL_ANALYSIS_TASK',target_date:date,status:editorialBrief.status==='OBSERVATIONS_READY_INDEPENDENT_ANALYSIS_REQUIRED'?'READY_FOR_EVIDENCE_GROUNDED_DRAFT':'WAITING_MARKET_MASTER',market_master_sha256:editorialBrief.source_master_sha256,claim_inventory_sha256:hash(JSON.stringify(claims)),approved_claim_ids:gate.approved_claim_ids,required_sections:['market_breadth_vs_index','institutional_flow_vs_breadth','selected_stock_evidence','counterarguments_and_uncertainty','three_point_summary'],instructions:['Write original differentiated Traditional Chinese analysis; do not simply restate numbers or fill a fixed script template.','For each insight supply master evidence field paths or independently approved claim IDs; separate observation, interpretation and uncertainty.','Do not assert causality from directional co-movement, do not use unreviewed News or AI summaries as facts.','No stock-level narration without approved claim IDs; no approval may be inferred from an empty review.','Preserve four fixed opening lines, 30-90 second market opening, subtitle and narration semantic parity when later projected.'],draft:null,independent_review_required:true,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
  const candidatePath=path.join(root,'data_research/m5/ai-script-generation',date+'-d4-original-analysis-candidate.json');
  let validatedCandidate=null;
  if(fs.existsSync(candidatePath)){
   try{const {preflight}=require('./research_date_to_video_d4_candidate_preflight');const candidate=JSON.parse(fs.readFileSync(candidatePath,'utf8'));const candidateAudit=preflight(candidate,marketMaster,claims,gate);write('authored-candidate-preflight.json',candidateAudit);if(candidateAudit.status!=='REJECTED')validatedCandidate=candidate;}
   catch(e){write('authored-candidate-preflight.json',{contract:'DATE_TO_VIDEO_V1_D4_CANDIDATE_PREFLIGHT',target_date:date,status:'REJECTED',reason:e.message,editorial_certified:false,render_authorized:false,publication_authorized:false});result.blockers.push('AUTHORED_CANDIDATE_PREFLIGHT_REJECTED')}
  }
  if(validatedCandidate){
   try{const {inspect}=require('./research_date_to_video_d4_price_review_evidence');write('dated-price-review-evidence.json',inspect(root,date,[]));}
   catch(e){write('dated-price-review-evidence.json',{target_date:date,status:'REJECTED',reason:e.message,editorial_certified:false,render_authorized:false,publication_authorized:false});result.blockers.push('DATED_PRICE_REVIEW_EVIDENCE_REJECTED');}
  }
  // Generate a reviewer-facing worksheet from the exact candidate inventory; never fabricate approvals.
  if(fs.existsSync(path.join(out,'authored-candidate-preflight.json'))){
   const audit=JSON.parse(fs.readFileSync(path.join(out,'authored-candidate-preflight.json'),'utf8'));
   if(audit.status!=='REJECTED'&&audit.review_packet.length){
    write('independent-review-worksheet.json',{contract:'DATE_TO_VIDEO_V1_D4_INDEPENDENT_REVIEW_WORKSHEET',target_date:date,inventory_sha256:audit.inventory_sha256,candidate_sha256:audit.candidate_sha256,review_input_filename:'editorial-review-input.json',review_items:audit.review_packet.map(c=>{const pricePath=path.join(out,'dated-price-review-evidence.json');const price=fs.existsSync(pricePath)?JSON.parse(fs.readFileSync(pricePath,'utf8')).stocks?.find(s=>s.claim_id===c.claim_id):null;return {...c,dated_price_crosscheck:price?{artifact:'dated-price-review-evidence.json',status:price.status,source_list_sha256:price.source_list_sha256,source_facts_sha256:price.source_facts_sha256,independent_source_reviewed:false}:null,reviewer:null,rationale:null,decision:'PENDING',causal_language_prohibited:null}}),instructions:['Independently inspect each cited dated source before entering an APPROVE or REJECT decision.','The worksheet is not a valid approval input; submit explicit reviewer, rationale, evidence_checked and causal-language decision in editorial-review-input.json.','A price crosscheck alone does not certify a news catalyst or a stock-flow interpretation.'],editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false});
   }
  }
  // Preserve the actual authored insight structure for future single-master media projection.
  // This is an evidence outline, not a narration script or media authorization.
  if(validatedCandidate){
   const candidateAudit=JSON.parse(fs.readFileSync(path.join(out,'authored-candidate-preflight.json'),'utf8'));
   write('candidate-semantic-outline.json',{contract:'DATE_TO_VIDEO_V1_D4_CANDIDATE_SEMANTIC_OUTLINE',target_date:date,candidate_sha256:candidateAudit.candidate_sha256,inventory_sha256:candidateAudit.inventory_sha256,market_master_sha256:hash(JSON.stringify(marketMaster)),review_gate_sha256:hash(JSON.stringify(gate)),source_document:validatedCandidate.source_document,sections:validatedCandidate.insights.map(i=>({id:i.id,section:i.section,observation:i.observation,interpretation:i.interpretation,uncertainty:i.uncertainty,evidence:i.evidence,claim_review_pending:i.evidence.some(e=>e.type==='claim_id'&&!gate.approved_claim_ids.includes(e.id))})),status:'RESEARCH_OUTLINE_ONLY_EDITORIAL_REVIEW_PENDING',narration_script:null,subtitle_srt:null,scene_cards:null,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false});
  }
  if(fs.existsSync(path.join(out,'candidate-semantic-outline.json'))){
   const {project}=require('./research_date_to_video_d4_semantic_projection');
   try{const projection=project(JSON.parse(fs.readFileSync(path.join(out,'candidate-semantic-outline.json'),'utf8')),marketMaster,gate);write('semantic-consumer-projection.json',projection);write('m8vis-compatibility.json',require('./research_date_to_video_d4_m8vis_compatibility').inspect(projection));write('m8vis-scene-adapter.json',require('./research_date_to_video_d4_m8vis_adapter').adapt(projection));}
   catch(e){result.blockers.push('SEMANTIC_PROJECTION_REJECTED:'+e.message)}
  }
  // Produce a date-scoped, non-narratable factual stock-price snapshot without silently approving claims.
  const candidatePriceIds=new Set(validatedCandidate?validatedCandidate.insights.flatMap(i=>i.evidence.filter(e=>e.type==='claim_id').map(e=>e.id)):[]);
  const candidatePriceClaims=claims.claims.filter(c=>c.kind==='PRICE_CHANGE'&&candidatePriceIds.has(c.claim_id));
  if(candidatePriceClaims.length){
   const priceSnapshot={contract:'DATE_TO_VIDEO_V1_D4_FEATURED_PRICE_OBSERVATIONS',target_date:date,status:'CROSSCHECKED_PRICE_ONLY_INDEPENDENT_EDITORIAL_REVIEW_PENDING',claim_inventory_sha256:hash(JSON.stringify(claims)),stocks:candidatePriceClaims.map(c=>({code:c.code,claim_id:c.claim_id,change_pct:c.statement,evidence_sources:c.evidence_sources,review_status:gate.approved_claim_ids.includes(c.claim_id)?'EXPLICIT_REVIEW_DECISION_PRESENT':'REVIEW_REQUIRED'})),news_causality_verified:false,stock_flow_verified_for_narration:false,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
   write('featured-price-observations.json',priceSnapshot);
  }
  const draftPath=path.join(out,'original-analysis-draft-input.json');
  if(fs.existsSync(draftPath)){
   let draftCheck;
   try{draftCheck=validateDraft(analysisTask,marketMaster,claims,gate,JSON.parse(fs.readFileSync(draftPath,'utf8')));}
   catch(e){draftCheck={contract:'DATE_TO_VIDEO_V1_DRAFT_EVIDENCE_GATE',target_date:date,status:'REJECTED',reason:e.message,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};result.blockers.push('ORIGINAL_ANALYSIS_DRAFT_REJECTED');}
   write('original-analysis-draft-check.json',draftCheck);
  }
  const draftCheckPath=path.join(out,'original-analysis-draft-check.json');
  const draftCheck=fs.existsSync(draftCheckPath)?JSON.parse(fs.readFileSync(draftCheckPath,'utf8')):null;
  const reviewGateSha=hash(JSON.stringify(gate));
  const draftCheckSha=draftCheck?hash(JSON.stringify(draftCheck)):null;
  // Preserve the exact optional human/editorial input bytes, including rejected submissions.
  const editorialInputManifest={contract:'DATE_TO_VIDEO_V1_D4_EDITORIAL_INPUT_MANIFEST',target_date:date,review_input_sha256:fs.existsSync(reviewInputPath)?hash(fs.readFileSync(reviewInputPath)):null,draft_input_sha256:fs.existsSync(draftPath)?hash(fs.readFileSync(draftPath)):null,review_gate_sha256:reviewGateSha,draft_check_sha256:draftCheckSha,editorial_certified:false,render_authorized:false,publication_authorized:false};
  write('editorial-input-manifest.json',editorialInputManifest);
  const mediaHandoff={contract:'DATE_TO_VIDEO_V1_RESEARCH_MEDIA_HANDOFF',target_date:date,status:'BLOCKED_PENDING_EDITORIAL_AND_MEDIA_INPUTS',source_master_sha256:analysisTask.market_master_sha256,analysis_task_sha256:hash(JSON.stringify(analysisTask)),required_inputs:['independently_reviewed_original_analysis','approved_narration_script','narration_subtitle_sentence_parity','edge_tts_audio','vtuber_visual','scene_cards','offline_mp4_acceptance'],existing_media_components_research_only:[{path:'scripts/research_ai_v3_sentence_edge_tts_20261008.py',role:'sentence_audio',date_locked:'20261008'},{path:'scripts/research_ai_v3_sentence_media_bridge_20261008.py',role:'audio_caption_card_timeline',date_locked:'20261008'},{path:'scripts/research_ai_v3_m8vis_visual_render_20261008.py',role:'visual_preview',date_locked:'20261008'}],date_parameterized_media_bridge_implemented:false,component_reuse_requires_dated_master_and_editorial_review:true,draft_check_status:draftCheck?.status||'NOT_SUBMITTED',review_gate_sha256:reviewGateSha,draft_check_sha256:draftCheckSha,approved_claim_count:gate.approved_claim_ids.length,fixed_opening_lines:[...FIXED_OPENING_LINES],market_opening_seconds:{min:30,max:90},research_only:true,editorial_certified:false,render_authorized:false,publication_authorized:false};
  write('media-handoff.json',mediaHandoff);
  write('original-analysis-task.json',analysisTask);
  write('editorial-research-brief.json',editorialBrief);
  write('market-master.json',marketMaster);
  write('evidence-join.json',joined);write('claims.json',claims);write('institutional-evidence.json',institutional);write('breadth-evidence.json',breadth);write('editorial-review.json',gate);
  write('dated-media-input.json',buildDatedMediaInput(out));
  write('editorial-narration-worksheet.json',prepareEditorialNarration(out));
  // Optional external audio inputs are read-only and never imply editorial or rendering approval.
  const audioInputs=['sentence-audio-inventory.json','edge-tts-command-plan.json','sentence-audio-proof.json','narration-candidate.json'];
  if(audioInputs.some(name=>fs.existsSync(path.join(out,name)))){
   try{const missingAudioInputs=audioInputs.filter(name=>!fs.existsSync(path.join(out,name)));if(missingAudioInputs.length){write('sentence-audio-review.json',{contract:'DATE_TO_VIDEO_V1_RESEARCH_PLANNED_SENTENCE_AUDIO_REVIEW',target_date:date,status:'REJECTED',issues:missingAudioInputs.map(name=>'D4_AUDIO_INPUT_MISSING:'+name),audio_verified:false,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false});result.blockers.push('DATED_SENTENCE_AUDIO_REVIEW_REJECTED');}else{const {inspectDirectory}=require('./research_date_to_video_audio_review_cli_v1');const audioReview=inspectDirectory(out);
    const suppliedInventory=JSON.parse(fs.readFileSync(path.join(out,'sentence-audio-inventory.json'),'utf8'));
    const datedMedia=JSON.parse(fs.readFileSync(path.join(out,'dated-media-input.json'),'utf8'));
    const worksheet=JSON.parse(fs.readFileSync(path.join(out,'editorial-narration-worksheet.json'),'utf8'));
    const provenanceIssues=[];
    const candidatePath=path.join(out,'narration-candidate.json');
    if(!fs.existsSync(candidatePath))provenanceIssues.push('D4_AUDIO_NARRATION_CANDIDATE_REQUIRED');
    else{const candidate=JSON.parse(fs.readFileSync(candidatePath,'utf8'));const {inspectDirectory:inspectCandidate}=require('./research_date_to_video_narration_candidate_review_v1');const candidateReview=inspectCandidate(out,candidate);if(candidateReview.status!=='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED')provenanceIssues.push('D4_AUDIO_NARRATION_CANDIDATE_REJECTED');if(suppliedInventory.candidate_sha256!==hash(JSON.stringify(candidate)))provenanceIssues.push('D4_AUDIO_CANDIDATE_SHA_MISMATCH');const {prepare:prepareInventory}=require('./research_date_to_video_sentence_audio_inventory_v1');if(JSON.stringify(suppliedInventory)!==JSON.stringify(prepareInventory(worksheet,datedMedia,candidate)))provenanceIssues.push('D4_AUDIO_CANDIDATE_INVENTORY_DRIFT');}
    if(suppliedInventory.target_date!==date)provenanceIssues.push('D4_AUDIO_DATE_MISMATCH');
    if(suppliedInventory.source_master_sha256!==datedMedia.source_master_sha256)provenanceIssues.push('D4_AUDIO_MASTER_SHA_MISMATCH');
    if(suppliedInventory.worksheet_sha256!==hash(JSON.stringify(worksheet)))provenanceIssues.push('D4_AUDIO_WORKSHEET_SHA_MISMATCH');
    if(provenanceIssues.length){audioReview.issues.push(...provenanceIssues);audioReview.status='REJECTED';audioReview.audio_verified=false;}
    write('sentence-audio-review.json',audioReview);
    if(audioReview.status==='REJECTED')result.blockers.push('DATED_SENTENCE_AUDIO_REVIEW_REJECTED');}
   }catch(e){write('sentence-audio-review.json',{contract:'DATE_TO_VIDEO_V1_RESEARCH_PLANNED_SENTENCE_AUDIO_REVIEW',target_date:date,status:'REJECTED',issues:['AUDIO_INPUT_INCOMPLETE_OR_INVALID'],reason:e.message,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false});result.blockers.push('DATED_SENTENCE_AUDIO_REVIEW_REJECTED');}
  }
 }catch(e){
  result.stages[0].status='WAITING_SOURCE';result.blockers.push('D4_JOIN_REJECTED:'+e.message);
 }
 write('status.json',result);return result;
}
if(require.main===module){
 const [date,root='.',out]=process.argv.slice(2);
 if(!date||!out){console.error('Usage: node scripts/research_date_to_video_d4_orchestrator.js YYYYMMDD repo-root output-dir');process.exit(2)}
 try{const r=run(root,date,out);console.log('DATE_TO_VIDEO_D4_STATUS '+r.target_date+' '+r.stages[0].status+' '+r.artifacts.map(x=>x.name).join(','));if(r.stages[0].status==='WAITING_SOURCE'||r.stages[0].status==='PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING')process.exitCode=3}catch(e){console.error(e.message);process.exitCode=2}
}
module.exports={run};
