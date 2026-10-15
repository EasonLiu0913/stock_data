'use strict';
const assert=require('node:assert/strict');
const {verifyProjection,cases}=require('../scripts/research_caption_numeric_parity_20261008');
for(const [spoken,digits] of cases){
 assert.equal(verifyProjection(spoken,digits),true);
 assert.throws(()=>verifyProjection(spoken,'0'),/CAPTION_NUMBER_DRIFT/);
 assert.throws(()=>verifyProjection(spoken,spoken+' '+digits),/CAPTION_NOT_PROJECTED/);
}
console.log('CAPTION_NUMERIC_HIGH_RISK_NEGATIVE_TEST_PASS research_only=true');
