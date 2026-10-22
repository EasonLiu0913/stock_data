'use strict';
// Explicit independent review decisions. A generated claim inventory is not itself an approval.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function review(inventory,decisions){
 assert.equal(inventory?.contract,'DATE_TO_VIDEO_V1_D4_CLAIM_INVENTORY');
 assert.equal(decisions?.target_date,inventory.target_date,'REVIEW_DATE_MISMATCH');
 assert.equal(decisions?.inventory_sha256,sha(inventory),'REVIEW_INVENTORY_SHA_MISMATCH');
 assert.ok(Array.isArray(inventory.claims)&&inventory.claims.length>0,'INVALID_CLAIM_INVENTORY');
 assert.ok(inventory.claims.every(x=>typeof x.claim_id==='string'&&x.claim_id.startsWith(inventory.target_date+':')),'INVALID_CLAIM_IDENTITY');
 assert.equal(new Set(inventory.claims.map(x=>x.claim_id)).size,inventory.claims.length,'DUPLICATE_INVENTORY_CLAIM_ID');
 assert.ok(Array.isArray(decisions.decisions),'MISSING_REVIEW_DECISIONS');
 const known=new Map(inventory.claims.map(x=>[x.claim_id,x])),seen=new Set(),approved=[];
 for(const d of decisions.decisions){
  assert.ok(known.has(d.claim_id),'UNKNOWN_CLAIM_ID');
  assert.ok(!seen.has(d.claim_id),'DUPLICATE_REVIEW_DECISION');seen.add(d.claim_id);
  assert.ok(['APPROVE','REJECT'].includes(d.decision),'INVALID_REVIEW_DECISION');
  assert.ok(typeof d.reviewer==='string'&&d.reviewer.trim()&&typeof d.rationale==='string'&&d.rationale.trim(),'REVIEW_PROVENANCE_MISSING');
  if(d.decision==='APPROVE'){
   const claim=known.get(d.claim_id);
   assert.ok(d.evidence_checked===true,'EVIDENCE_NOT_CHECKED');
   assert.ok(d.causality_checked===true||d.causal_language_prohibited===true,'CAUSAL_LANGUAGE_UNREVIEWED');
   if(claim.kind!=='PRICE_CHANGE')assert.ok(claim.evidence_sources.length>0,'NO_EXTERNAL_SOURCE');
   approved.push(d.claim_id);
  }
 }
 return {contract:'DATE_TO_VIDEO_V1_D4_REVIEW_GATE',target_date:inventory.target_date,inventory_sha256:sha(inventory),reviewed_count:seen.size,approved_claim_ids:approved,unreviewed_count:known.size-seen.size,claim_whitelist_verified:seen.size===known.size&&approved.length>0,editorial_certified:false,render_authorized:false,publication_authorized:false};
}
module.exports={review};
