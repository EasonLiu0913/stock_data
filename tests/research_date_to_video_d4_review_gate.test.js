'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {review}=require('../scripts/research_date_to_video_d4_review_gate');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const inventory={contract:'DATE_TO_VIDEO_V1_D4_CLAIM_INVENTORY',target_date:'20261008',claims:[{claim_id:'20261008:1301:NEWS_SUMMARY',kind:'NEWS_SUMMARY',evidence_sources:[{url:'https://example.org/source'}]}]};
const base={target_date:'20261008',inventory_sha256:sha(inventory),decisions:[]};
let result=review(inventory,base);assert.equal(result.claim_whitelist_verified,false);assert.equal(result.render_authorized,false);
const accepted={claim_id:inventory.claims[0].claim_id,decision:'APPROVE',reviewer:'independent-editor',rationale:'Source read and inference qualified',evidence_checked:true,causal_language_prohibited:true};
result=review(inventory,{...base,decisions:[accepted]});assert.equal(result.approved_claim_ids.length,1);assert.equal(result.editorial_certified,false);assert.equal(result.render_authorized,false);
assert.throws(()=>review(inventory,{...base,inventory_sha256:'stale'}),/REVIEW_INVENTORY_SHA_MISMATCH/);
assert.throws(()=>review(inventory,{...base,decisions:[{...accepted,evidence_checked:false}]}),/EVIDENCE_NOT_CHECKED/);
assert.throws(()=>review(inventory,{...base,decisions:[{...accepted,causal_language_prohibited:false}]}),/CAUSAL_LANGUAGE_UNREVIEWED/);
assert.throws(()=>review(inventory,{...base,decisions:[accepted,accepted]}),/DUPLICATE_REVIEW_DECISION/);
assert.throws(()=>review(inventory,{...base,decisions:[{...accepted,claim_id:'unknown'}]}),/UNKNOWN_CLAIM_ID/);
console.log('D4_INDEPENDENT_REVIEW_GATE_FIXTURE_PASS no editorial or render auto-approval');

const {preflight}=require('../scripts/research_date_to_video_d4_candidate_preflight');
const candidate={contract:'DATE_TO_VIDEO_V1_D4_AUTHORED_RESEARCH_CANDIDATE',target_date:inventory.target_date,insights:[{id:'fixture',evidence:[{type:'claim_id',id:inventory.claims[0].claim_id}]}]};
const master={target_date:inventory.target_date};
const current=preflight(candidate,master,inventory,result);assert.equal(current.status,'STRUCTURAL_PREFLIGHT_ONLY');assert.equal(current.editorial_certified,false);assert.equal(current.narration_authorized,false);assert.equal(current.render_authorized,false);
assert.throws(()=>preflight(candidate,master,inventory,{...result,inventory_sha256:'stale'}),/CANDIDATE_REVIEW_INVENTORY_SHA_MISMATCH/);
const changed={...inventory,claims:[...inventory.claims,{claim_id:'20261008:1301:PRICE_CHANGE',kind:'PRICE_CHANGE',evidence_sources:[]}]};assert.throws(()=>preflight(candidate,master,changed,result),/CANDIDATE_REVIEW_INVENTORY_SHA_MISMATCH/);
console.log('D4_CANDIDATE_REVIEW_INVENTORY_BINDING_FAIL_CLOSED_PASS');

assert.throws(()=>review(inventory,{...base,decisions:[{...accepted,reviewer:' '}]}),/REVIEW_PROVENANCE_MISSING/);
assert.throws(()=>review(inventory,{...base,decisions:[{...accepted,rationale:' '}]}),/REVIEW_PROVENANCE_MISSING/);
assert.throws(()=>review(inventory,{...base,decisions:[{...accepted,decision:'PENDING'}]}),/INVALID_REVIEW_DECISION/);
const rejectedDecision=review(inventory,{...base,decisions:[{claim_id:accepted.claim_id,decision:'REJECT',reviewer:'independent-editor',rationale:'Insufficient evidence'}]});assert.deepEqual(rejectedDecision.approved_claim_ids,[]);assert.equal(rejectedDecision.claim_whitelist_verified,false);assert.equal(rejectedDecision.editorial_certified,false);assert.equal(rejectedDecision.render_authorized,false);assert.equal(rejectedDecision.publication_authorized,false);
assert.throws(()=>review(inventory,{...base,target_date:'20261013',decisions:[accepted]}),/REVIEW_DATE_MISMATCH/);

// A dated candidate must never borrow a prior-date Master, inventory or review.
for(const [name,changed] of Object.entries({master:{master:{...master,target_date:'20261013'}},inventory:{inventory:{...inventory,target_date:'20261013'}},review:{review:{...result,target_date:'20261013'}}})){
 assert.throws(()=>preflight(candidate,changed.master||master,changed.inventory||inventory,changed.review||result),new RegExp('CANDIDATE_DATE_MISMATCH_'+name));
}
const unsourcedCandidate={...candidate,insights:[{id:'missing-master-evidence',evidence:[{type:'master_field',path:'taiex.unverified'}]}]};
const unsourced=preflight(unsourcedCandidate,master,inventory,result);
assert.equal(unsourced.status,'REVIEW_OR_EVIDENCE_PENDING');
assert.equal(unsourced.invalid_master_fields.length,1);
assert.equal(unsourced.render_authorized,false);
assert.equal(unsourced.publication_authorized,false);
console.log('D4_CANDIDATE_CROSS_DATE_AND_UNSOURCED_MASTER_FAIL_CLOSED_PASS');
