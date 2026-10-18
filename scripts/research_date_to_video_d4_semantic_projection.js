'use strict';
// Research-only single-source semantic projection contract; no media, narration or approval.
const assert=require('node:assert/strict');
function project(outline,master,review){
 assert.equal(outline.target_date,master.target_date,'PROJECTION_MASTER_DATE_MISMATCH');
 assert.equal(outline.target_date,review.target_date,'PROJECTION_REVIEW_DATE_MISMATCH');
 const crypto=require('node:crypto'),sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
 assert.equal(outline.market_master_sha256,sha(master),'PROJECTION_STALE_MASTER');
 assert.equal(outline.review_gate_sha256,sha(review),'PROJECTION_STALE_REVIEW');
 assert.ok(Array.isArray(outline.sections)&&outline.sections.length>0,'PROJECTION_EMPTY_OUTLINE');
 const approved=new Set(review.approved_claim_ids||[]);
 const sections=outline.sections.map(s=>{
  const pending=s.evidence.filter(e=>e.type==='claim_id'&&!approved.has(e.id)).map(e=>e.id);
  assert.equal(s.claim_review_pending,pending.length>0,'PROJECTION_STALE_CLAIM_FLAG');
  return {id:s.id,section:s.section,observation:s.observation,interpretation:s.interpretation,uncertainty:s.uncertainty,evidence:s.evidence,review_status:pending.length?'REVIEW_REQUIRED':'STRUCTURAL_ONLY_NOT_EDITORIAL_CERTIFIED',pending_claim_ids:pending};
 });
 return {contract:'DATE_TO_VIDEO_V1_D4_SINGLE_MASTER_SEMANTIC_PROJECTION',target_date:outline.target_date,source_outline_sha256:sha(outline),market_master_sha256:sha(master),review_gate_sha256:sha(review),sections,consumer_contracts:{narration:{source_section_ids:sections.map(s=>s.id),script:null},subtitles:{source_section_ids:sections.map(s=>s.id),srt:null},scene_cards:{source_section_ids:sections.map(s=>s.id),cards:null}},status:'RESEARCH_PROJECTION_ONLY_EDITORIAL_REVIEW_REQUIRED',editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={project};
