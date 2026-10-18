'use strict';
// Date-scoped candidate audit only; never grants review, narration or render permission.
const assert=require('node:assert/strict');
function preflight(candidate,master,inventory,review){
 const date=candidate?.target_date;
 for(const [name,obj] of Object.entries({master,inventory,review}))assert.equal(obj?.target_date,date,'CANDIDATE_DATE_MISMATCH_'+name);
 assert.equal(candidate.contract,'DATE_TO_VIDEO_V1_D4_AUTHORED_RESEARCH_CANDIDATE');
 const approved=new Set(review.approved_claim_ids||[]),known=new Set(inventory.claims.map(x=>x.claim_id));
 const missing_claim_reviews=[],unknown_claim_ids=[],invalid_master_fields=[];
 for(const insight of candidate.insights){
  for(const e of insight.evidence){
   if(e.type==='claim_id'){
    if(!known.has(e.id))unknown_claim_ids.push({insight_id:insight.id,claim_id:e.id});
    else if(!approved.has(e.id))missing_claim_reviews.push({insight_id:insight.id,claim_id:e.id});
   }else if(e.type==='master_field'){
    let value=master;
    for(const part of e.path.split('.')){if(value===null||typeof value!=='object'||!Object.hasOwn(value,part)){value=undefined;break}value=value[part]}
    if(value===undefined||value===null||typeof value==='object')invalid_master_fields.push({insight_id:insight.id,path:e.path});
   }
  }
 }
 return {contract:'DATE_TO_VIDEO_V1_D4_CANDIDATE_PREFLIGHT',target_date:date,status:missing_claim_reviews.length||unknown_claim_ids.length||invalid_master_fields.length?'REVIEW_OR_EVIDENCE_PENDING':'STRUCTURAL_PREFLIGHT_ONLY',missing_claim_reviews,unknown_claim_ids,invalid_master_fields,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={preflight};
