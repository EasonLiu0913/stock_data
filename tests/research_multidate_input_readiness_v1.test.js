'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {inspectDate}=require('../scripts/research_multidate_input_readiness_v1');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'multi-date-a1-'));
try{
 const names=['market-opening','analysis-facts','analysis-news','analysis-ai'];
 for(const n of names){const p=path.join(root,'data_daily_gain_over_5',n,'20261008.json');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'{}');}
 assert.equal(inspectDate(root,'20261008').ready,true);
 const other=inspectDate(root,'20261007');assert.equal(other.ready,false);assert.deepEqual(other.missing,names);assert.equal(other.publication_authorized,false);
 assert.throws(()=>inspectDate(root,'2026-10-08'),/INVALID_DATE_FORMAT/);
 fs.unlinkSync(path.join(root,'data_daily_gain_over_5','analysis-ai','20261008.json'));
 assert.deepEqual(inspectDate(root,'20261008').missing,['analysis-ai']);
 console.log('MULTIDATE_A1_FAIL_CLOSED_PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
