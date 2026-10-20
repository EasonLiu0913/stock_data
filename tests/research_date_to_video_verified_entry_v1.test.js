'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execute}=require('../scripts/research_date_to_video_verified_entry_v1');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-verified-entry-'));
try{
 for(const date of ['20261008','20261013']){
  const result=execute('.',date,dir);
  assert.equal(result.target_date,date);
  assert.equal(result.verification_status,'VERIFIED_RESEARCH_ONLY',JSON.stringify(result.verification_issues));
  assert.equal(result.media_preflight.target_date,date);assert.equal(result.media_preflight.status,'BLOCKED');assert.ok(result.media_preflight.issues.includes('EDITORIAL_CERTIFICATION_REQUIRED'));assert.ok(result.media_preflight.issues.includes('DATED_MEDIA_BRIDGE_NOT_IMPLEMENTED'));
  assert.equal(result.tts_authorized,false);assert.equal(result.render_authorized,false);assert.equal(result.publication_authorized,false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'verified-research-entry.json'))),result);
 }
 assert.throws(()=>execute('.','2026108',dir),/INVALID_TARGET_DATE/);
 console.log('D4_VERIFIED_SINGLE_DATE_ENTRY_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
