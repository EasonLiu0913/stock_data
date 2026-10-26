'use strict';
// D4-to-M8VIS research storyboard only. No fabricated narration, timing, media or approval.
const assert=require('node:assert/strict');
// Derive dated stock slots from authored claim evidence; never reuse 20261008 tickers for other dates.
function adapt(p){
 assert.equal(p.contract,'DATE_TO_VIDEO_V1_D4_SINGLE_MASTER_SEMANTIC_PROJECTION','ADAPTER_PROJECTION_REQUIRED');
 assert.equal(p.render_authorized,false,'ADAPTER_RENDER_LOCK_REQUIRED');
 assert.equal(p.publication_authorized,false,'ADAPTER_PUBLICATION_LOCK_REQUIRED');
 const sections=new Map(p.sections.map(s=>[s.section,s]));
 assert.equal(sections.size,p.sections.length,'ADAPTER_DUPLICATE_SEMANTIC_SECTION');
 assert.deepEqual([...sections.keys()],['market_breadth_vs_index','institutional_flow_vs_breadth','selected_stock_evidence','counterarguments_and_uncertainty','three_point_summary'],'ADAPTER_SECTION_CONTRACT_DRIFT');
 const selectedSection=sections.get('selected_stock_evidence');
 const stockIds=[...new Set(selectedSection.evidence.filter(e=>e.type==='claim_id'&&e.id.startsWith(p.target_date+':')&&e.id.endsWith(':PRICE_CHANGE')).map(e=>e.id.split(':')[1]))];
 assert.ok(stockIds.length>0,'ADAPTER_STOCK_CLAIM_MISSING');
 const map=[['opening',[]],['market',['market_breadth_vs_index','institutional_flow_vs_breadth']],...stockIds.map(id=>[id,['selected_stock_evidence']]),['conclusion',['counterarguments_and_uncertainty','three_point_summary']]];
 const scenes=map.map(([id,names])=>{
  const chosen=names.map(n=>sections.get(n));assert.ok(chosen.every(Boolean),'ADAPTER_MISSING_SECTION');
  const selected=stockIds.includes(id);
  const claim=selected?p.target_date+':'+id+':PRICE_CHANGE':null;
  if(selected)assert.ok(chosen[0].evidence.some(e=>e.type==='claim_id'&&e.id===claim),'ADAPTER_STOCK_CLAIM_MISSING');
  const facts=chosen.flatMap(s=>s.resolved_master_observations.map(x=>({section_id:s.id,...x})));
  const pending=selected?chosen[0].pending_claim_ids.filter(x=>x===claim):[...new Set(chosen.flatMap(s=>s.pending_claim_ids))];
  return {id,source_section_ids:chosen.map(s=>s.id),market_master_sha256:p.market_master_sha256,facts,stock_claim_id:claim,stock_claim_review_pending:selected?pending.length>0:false,excluded_pending_claim_ids:pending,opening_branding_required:id==='opening',caption_sentences:null,start_seconds:null,end_seconds:null,visual_asset:null,render_authorized:false};
 });
 return {contract:'DATE_TO_VIDEO_V1_D4_M8VIS_DATED_SCENE_ADAPTER_RESEARCH',target_date:p.target_date,source_outline_sha256:p.source_outline_sha256,market_master_sha256:p.market_master_sha256,scene_ids:scenes.map(s=>s.id),scenes,status:'SCENE_MAPPING_ONLY_NARRATION_AND_TIMING_PENDING',legacy_renderer_compatible:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
}

// Research-only structural join. Never infers scene timing or grants renderer authority.
function inspectDatedTimeline(adapter,bridge){
 const issues=[];
 const check=(code,ok)=>{if(!ok)issues.push(code);};
 check('ADAPTER_CONTRACT',adapter?.contract==='DATE_TO_VIDEO_V1_D4_M8VIS_DATED_SCENE_ADAPTER_RESEARCH');
 check('BRIDGE_CONTRACT',bridge?.contract==='DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_BRIDGE');
 check('DATE_MATCH',typeof adapter?.target_date==='string'&&/^20\d{6}$/.test(adapter.target_date)&&adapter.target_date===bridge?.target_date);
 check('MASTER_HASH',typeof adapter?.market_master_sha256==='string'&&/^[a-f0-9]{64}$/.test(adapter.market_master_sha256));
 check('ADAPTER_LOCK',adapter?.render_authorized===false&&adapter?.publication_authorized===false&&adapter?.editorial_certified===false&&adapter?.legacy_renderer_compatible===false);
 check('BRIDGE_LOCK',bridge?.render_authorized===false&&bridge?.publication_authorized===false&&bridge?.editorial_certified===false&&bridge?.narration_authorized===false);
 check('BRIDGE_STATUS',bridge?.status==='PLAYABLE_AUDIO_AND_SRT_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED');
 check('SCENES',Array.isArray(adapter?.scenes)&&adapter.scenes.length>0&&adapter.scenes.every(s=>s?.market_master_sha256===adapter.market_master_sha256&&s.render_authorized===false&&s.visual_asset===null&&s.stock_claim_review_pending!==true&&Array.isArray(s.excluded_pending_claim_ids)&&s.excluded_pending_claim_ids.length===0));
 check('SENTENCES',Array.isArray(bridge?.sentences)&&bridge.sentences.length>0&&bridge.sentences.every(s=>typeof s?.id==='string'&&Number.isFinite(s.start_seconds)&&Number.isFinite(s.end_seconds)&&s.end_seconds>s.start_seconds));
 check('SRT_PRESENT',typeof bridge?.srt==='string'&&bridge.srt.trim().length>0);
 check('TIMELINE_TOTAL',Number.isFinite(bridge?.total_seconds)&&bridge.total_seconds>0&&Array.isArray(bridge?.sentences)&&bridge.sentences.length>0&&Math.abs(bridge.sentences.at(-1)?.end_seconds-bridge.total_seconds)<0.001);

 // Independently reconstruct the SRT to detect stale captions, gaps, duplicate IDs and altered timestamps.
 const timeline=bridge?.sentences;
 let expectedSrt='',cursor=0,valid=Array.isArray(timeline)&&timeline.length>0;
 const clock=seconds=>{const ms=Math.round(seconds*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');};
 if(valid){
  const ids=new Set();
  for(const [i,s] of timeline.entries()){
   if(!s||typeof s.id!=='string'||!s.id.trim()||ids.has(s.id)||s.order!==i+1||typeof s.caption_text!=='string'||!s.caption_text.trim()||/[\r\n]/.test(s.caption_text)||!Number.isFinite(s.start_seconds)||!Number.isFinite(s.end_seconds)||Math.abs(s.start_seconds-cursor)>0.001||s.end_seconds<=s.start_seconds){valid=false;break;}
   ids.add(s.id);cursor=s.end_seconds;
   const parts=s.caption_text.match(/[^。！？；，、]+[。！？；，、]?/g)||[];
   if(parts.join('')!==s.caption_text){valid=false;break;}
   let line='',lines=[];
   for(let chunk of parts){if(line.length+chunk.length>30&&line){lines.push(line);line='';}while(chunk.length>30){lines.push(chunk.slice(0,30));chunk=chunk.slice(30);}line+=chunk;}
   if(line)lines.push(line);
   expectedSrt+=String(i+1)+'\n'+clock(s.start_seconds)+' --> '+clock(s.end_seconds)+'\n'+lines.join('\n')+'\n\n';
  }
 }
 check('SRT_TIMELINE_PARITY',valid&&expectedSrt===bridge?.srt&&Math.abs(cursor-bridge?.total_seconds)<0.001);
 return {contract:'DATE_TO_VIDEO_V1_D4_M8VIS_TIMELINE_INSPECTION_RESEARCH',target_date:adapter?.target_date||null,status:issues.length?'REJECTED':'STRUCTURAL_INPUTS_ONLY_SCENE_ALIGNMENT_PENDING',issues,scene_alignment_verified:false,legacy_renderer_compatible:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
}

// Explicit scene assignment from reviewed external evidence only; never guess sentence ownership.
function inspectSceneAlignment(adapter,bridge,assignments){
 const base=inspectDatedTimeline(adapter,bridge),issues=[...base.issues];
 const fail=(code,ok)=>{if(!ok)issues.push(code);};
 const scenes=Array.isArray(adapter?.scenes)?adapter.scenes:[],sentences=Array.isArray(bridge?.sentences)?bridge.sentences:[];
 fail('ASSIGNMENTS_REQUIRED',Array.isArray(assignments)&&assignments.length===scenes.length);
 fail('SCENE_INPUT_ARRAY',Array.isArray(adapter?.scenes));
 fail('SENTENCE_INPUT_ARRAY',Array.isArray(bridge?.sentences));
 fail('ADAPTER_OUTLINE_HASH',typeof adapter?.source_outline_sha256==='string'&&/^[a-f0-9]{64}$/.test(adapter.source_outline_sha256));
 fail('ASSIGNMENT_SOURCE_HASH',Array.isArray(assignments)&&assignments.every(a=>typeof a?.source_outline_sha256==='string'&&a.source_outline_sha256===adapter?.source_outline_sha256&&/^[a-f0-9]{64}$/.test(a.source_outline_sha256)));
 fail('ASSIGNMENT_MASTER_HASH',Array.isArray(assignments)&&assignments.every(a=>a?.market_master_sha256===adapter?.market_master_sha256));
 fail('ASSIGNMENT_REVIEW_LOCK',Array.isArray(assignments)&&assignments.every(a=>a?.editorial_certified===false&&a?.render_authorized===false&&a?.publication_authorized===false));

 fail('ASSIGNMENT_EVIDENCE_REFS',Array.isArray(assignments)&&assignments.every(a=>Array.isArray(a?.source_section_ids)&&(a.scene_id==='opening'?a.source_section_ids.length===0:a.source_section_ids.length>0)&&a.source_section_ids.every(id=>typeof id==='string'&&id.length>0)&&Array.isArray(a?.evidence_claim_ids)&&a.evidence_claim_ids.every(id=>typeof id==='string'&&id.startsWith(adapter?.target_date+':'))));
 fail('PENDING_CLAIM_EXCLUSION',Array.isArray(assignments)&&assignments.every((a,i)=>{const scene=scenes[i];return !!scene&&Array.isArray(scene.excluded_pending_claim_ids)&&!a?.evidence_claim_ids?.some(id=>scene.excluded_pending_claim_ids.includes(id));}));
 fail('SCENE_EVIDENCE_PARITY',Array.isArray(assignments)&&assignments.every((a,i)=>{const scene=scenes[i];return !!scene&&Array.isArray(scene.source_section_ids)&&JSON.stringify(a?.source_section_ids)===JSON.stringify(scene.source_section_ids)&&(scene.stock_claim_id?(Array.isArray(a?.evidence_claim_ids)&&a.evidence_claim_ids.length===1&&a.evidence_claim_ids[0]===scene.stock_claim_id):(Array.isArray(a?.evidence_claim_ids)&&a.evidence_claim_ids.length===0));}));
 const byId=new Map(scenes.map(s=>[s?.id,s]));
 const sentenceIds=new Set(sentences.filter(s=>s&&typeof s.id==='string').map(s=>s.id)),used=new Set(),plan=[];
 if(Array.isArray(assignments))for(const [i,a] of assignments.entries()){
  const scene=scenes[i];
  fail('SCENE_ORDER',!!scene&&a?.scene_id===scene.id&&byId.has(a.scene_id));
  fail('SCENE_SENTENCES',Array.isArray(a?.sentence_ids)&&a.sentence_ids.length>0);
  if(!Array.isArray(a?.sentence_ids))continue;
  const slice=[];
  for(const id of a.sentence_ids){
   fail('UNKNOWN_OR_DUPLICATE_SENTENCE',sentenceIds.has(id)&&!used.has(id));
   used.add(id);
   const sentence=sentences.find(s=>s?.id===id);
   if(sentence)slice.push(sentence);
  }
  if(slice.length!==a.sentence_ids.length)continue;
  const first=sentences.indexOf(slice[0]);
  fail('NONCONTIGUOUS_SCENE',slice.every((s,j)=>sentences[first+j]===s));
  if(slice.length)plan.push({scene_id:a.scene_id,sentence_ids:[...a.sentence_ids],start_seconds:slice[0].start_seconds,end_seconds:slice.at(-1).end_seconds,render_authorized:false});
 }
 fail('SENTENCE_COVERAGE',used.size===sentenceIds.size&&sentences.every(s=>used.has(s.id)));
 fail('SCENE_TIMELINE_CONTINUITY',plan.length===scenes.length&&plan.every((p,i)=>i===0?p.start_seconds===0:Math.abs(p.start_seconds-plan[i-1].end_seconds)<0.001)&&Math.abs((plan.at(-1)?.end_seconds??0)-(bridge?.total_seconds??-1))<0.001);
 return {contract:'DATE_TO_VIDEO_V1_D4_M8VIS_EXPLICIT_SCENE_ALIGNMENT_RESEARCH',target_date:adapter?.target_date||null,status:issues.length?'REJECTED':'EXPLICIT_SCENE_MAPPING_STRUCTURAL_ONLY_EDITORIAL_REVIEW_REQUIRED',issues,scene_plan:issues.length?null:plan,scene_alignment_verified:issues.length===0,legacy_renderer_compatible:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
}
module.exports={adapt,inspectDatedTimeline,inspectSceneAlignment};


