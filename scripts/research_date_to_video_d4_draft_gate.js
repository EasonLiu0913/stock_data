'use strict';
// Structural evidence gate for an externally drafted original analysis. Never grants editorial or render approval.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function validate(task,master,inventory,review,draft){
 assert.equal(task?.contract,'DATE_TO_VIDEO_V1_ORIGINAL_ANALYSIS_TASK');
 assert.equal(master?.target_date,task.target_date,'MASTER_DATE_MISMATCH');
 assert.equal(inventory?.target_date,task.target_date,'INVENTORY_DATE_MISMATCH');
 assert.equal(review?.target_date,task.target_date,'REVIEW_DATE_MISMATCH');
 assert.equal(draft?.target_date,task.target_date,'DRAFT_DATE_MISMATCH');
 assert.equal(task.market_master_sha256,sha(master),'MASTER_SHA_MISMATCH');
 assert.equal(task.claim_inventory_sha256,sha(inventory),'INVENTORY_SHA_MISMATCH');
 assert.equal(task.status,'READY_FOR_EVIDENCE_GROUNDED_DRAFT','TASK_NOT_READY');
 assert.equal(master.status,'RESEARCH_MARKET_MASTER_SOURCE_CROSSCHECKED_EDITORIAL_PENDING','MASTER_NOT_READY');
 assert.equal(review.inventory_sha256,sha(inventory),'REVIEW_SHA_MISMATCH');
 assert.ok(Array.isArray(draft.insights)&&draft.insights.length>0,'EMPTY_INSIGHTS');
 const approved=new Set(review.approved_claim_ids||[]),allowed=new Set(['taiex','market_trading','breadth','institutional']);
 const ids=new Set(),covered=new Set();
 for(const insight of draft.insights){
  assert.ok(typeof insight.id==='string'&&insight.id.trim()&&!ids.has(insight.id),'INVALID_INSIGHT_ID');ids.add(insight.id);
  assert.ok(task.required_sections.includes(insight.section),'UNKNOWN_SECTION');covered.add(insight.section);
  for(const key of ['observation','interpretation','uncertainty'])assert.ok(typeof insight[key]==='string'&&insight[key].trim(),'MISSING_'+key.toUpperCase());
  assert.ok(Array.isArray(insight.evidence)&&insight.evidence.length>0,'INSIGHT_WITHOUT_EVIDENCE');
  for(const e of insight.evidence){
   if(e.type==='master_field'){
    assert.ok(typeof e.path==='string'&&/^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*$/.test(e.path),'INVALID_MASTER_PATH');
    const parts=e.path.split('.');assert.ok(allowed.has(parts[0]),'UNSUPPORTED_MASTER_PATH');
    let value=master;for(const part of parts){assert.ok(value!==null&&typeof value==='object'&&Object.hasOwn(value,part),'MISSING_MASTER_FIELD');value=value[part]}
    assert.ok(value!==null&&typeof value!=='object','MASTER_FIELD_NOT_SCALAR');
   }else if(e.type==='claim_id'){
    assert.ok(approved.has(e.id),'UNAPPROVED_CLAIM_ID');
    assert.ok(inventory.claims.some(c=>c.claim_id===e.id),'UNKNOWN_CLAIM_ID');
   }else throw Error('UNSUPPORTED_EVIDENCE_TYPE');
  }
  if(insight.section==='selected_stock_evidence')assert.ok(insight.evidence.some(e=>e.type==='claim_id'),'STOCK_SECTION_REQUIRES_APPROVED_CLAIM');
 }
 for(const section of task.required_sections)assert.ok(covered.has(section),'MISSING_SECTION_'+section);
 return {contract:'DATE_TO_VIDEO_V1_DRAFT_EVIDENCE_GATE',target_date:task.target_date,status:'STRUCTURAL_EVIDENCE_VALIDATED_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED',draft_sha256:sha(draft),task_sha256:sha(task),insight_count:draft.insights.length,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={validate};
