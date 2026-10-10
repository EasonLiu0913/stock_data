'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {audit}=require('../scripts/audit_daily_gainers_m2v2_core_evidence');
test('recomputes five real dated price arithmetic candidates without inventing core certification',()=>{
 const v=audit();
 assert.equal(v.count,5);assert.equal(v.strict_price_arithmetic_reconciled_count,5);
 assert.equal(v.independently_proven_core_count,0);
 assert.equal(v.material_missingness.unverified_identity_count,5);
 assert.equal(v.material_missingness.missing_original_per_security_proof_count,5);
 assert.equal(v.publication_authorized,false);
 assert.equal(v.candidates.find(c=>c.code==='6672').risk.disposition,'KNOWN_ACTIVE');
});
test('price tampering fails arithmetic reconciliation, not made safe by disclosure',()=>{
 const p=require('../data_research/twse-market-opening/20261008-m2v2-featured-candidates-preflight.json');
 const r=require('../data_research/twse-market-opening/20261008-m2v2-featured-trading-risk-review.json');
 const x=structuredClone(p);x.candidates[0].close+=1;
 const v=audit(x,r);
 assert.equal(v.strict_price_arithmetic_reconciled_count,4);
 assert.equal(v.candidates[0].core_eligible,false);
});
