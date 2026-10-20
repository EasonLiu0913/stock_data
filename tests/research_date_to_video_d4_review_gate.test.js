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
