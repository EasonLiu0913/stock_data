'use strict';
// Exercise real D4 outputs, not hand-assembled recovery fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {run}=require('../scripts/research_date_to_video_d4_orchestrator');
const {verify}=require('../scripts/research_date_to_video_recovery_status_verify_v1');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-recovery-integration-'));
try{
 for(const date of ['20261008','20261013']){
  const result=run('.',date,dir),v=verify(dir);
  assert.equal(v.status,'VERIFIED_RESEARCH_ONLY',JSON.stringify(v.issues));
  assert.equal(v.target_date,date);assert.equal(result.render_authorized,false);
  assert.equal(result.publication_authorized,false);
  assert.equal(v.automatic_dispatch_authorized,false);
  assert.equal(v.tts_authorized,false);
  assert.equal(v.render_authorized,false);
  assert.equal(v.publication_authorized,false);
 }
 const p=path.join(dir,'official-data-recovery-plan.json');
 fs.appendFileSync(p,' ');
 const tampered=verify(dir);
 assert.ok(tampered.issues.includes('RECOVERY_SOURCE_SHA_MISMATCH:official-data-recovery-plan.json'));
 console.log('D4_REAL_OUTPUT_RECOVERY_STATUS_INTEGRATION_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
