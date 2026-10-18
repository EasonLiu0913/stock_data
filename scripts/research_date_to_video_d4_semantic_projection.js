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
 const seen=new Set();
 const sections=outline.sections.map(s=>{
  assert.ok(typeof s.id==='string'&&s.id.trim()&&!seen.has(s.id),'PROJECTION_DUPLICATE_OR_EMPTY_SECTION_ID');seen.add(s.id);
  for(const key of ['section','observation','interpretation','uncertainty'])assert.ok(typeof s[key]==='string'&&s[key].trim(),'PROJECTION_EMPTY_SEMANTIC_FIELD_'+key);
  assert.ok(Array.isArray(s.evidence)&&s.evidence.length>0,'PROJECTION_MISSING_EVIDENCE');
  for(const e of s.evidence){
   if(e.type==='master_field'){
    assert.ok(typeof e.path==='string'&&e.path.length>0,'PROJECTION_INVALID_MASTER_PATH');
    let value=master;
    for(const part of e.path.split('.')){assert.ok(value!==null&&typeof value==='object'&&Object.hasOwn(value,part),'PROJECTION_UNKNOWN_MASTER_FIELD');value=value[part]}
    assert.ok(value!==null&&value!==undefined&&typeof value!=='object','PROJECTION_UNRESOLVED_MASTER_FIELD');
   }else if(e.type==='claim_id')assert.ok(typeof e.id==='string'&&/^\\d{8}:[0-9A-Za-z-]+:[A-Z_]+$/.test(e.id)&&e.id.startsWith(outline.target_date+':'),'PROJECTION_INVALID_DATED_CLAIM_ID');
   else assert.fail('PROJECTION_UNKNOWN_EVIDENCE_TYPE');
  }
  const pending=s.evidence.filter(e=>e.type==='claim_id'&&!approved.has(e.id)).map(e=>e.id);
  assert.equal(s.claim_review_pending,pending.length>0,'PROJECTION_STALE_CLAIM_FLAG');
  return {id:s.id,section:s.section,observation:s.observation,interpretation:s.interpretation,uncertainty:s.uncertainty,evidence:s.evidence,review_status:pending.length?'REVIEW_REQUIRED':'STRUCTURAL_ONLY_NOT_EDITORIAL_CERTIFIED',pending_claim_ids:pending};
 });
 return {contract:'DATE_TO_VIDEO_V1_D4_SINGLE_MASTER_SEMANTIC_PROJECTION',target_date:outline.target_date,source_outline_sha256:sha(outline),market_master_sha256:sha(master),review_gate_sha256:sha(review),sections,consumer_contracts:{narration:{source_section_ids:sections.map(s=>s.id),script:null},subtitles:{source_section_ids:sections.map(s=>s.id),srt:null},scene_cards:{source_section_ids:sections.map(s=>s.id),cards:null}},status:'RESEARCH_PROJECTION_ONLY_EDITORIAL_REVIEW_REQUIRED',editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={project};
