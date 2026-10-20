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
  assert.deepEqual(result.source_artifacts.map(x=>x.name),['status.json','official-data-recovery-plan.json','official-data-manifest.json']);
  for(const artifact of result.source_artifacts)assert.equal(artifact.sha256,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(dir,artifact.name))).digest('hex'));
  assert.equal(result.next_action.target_date,date);assert.equal(result.next_action.render_authorized,false);assert.equal(result.next_action.automatic_dispatch_authorized,false);assert.equal(result.next_action.stage,'WAITING_OFFICIAL_SOURCES');assert.ok(result.next_action.actions.length>0);
  assert.equal(result.tts_authorized,false);assert.equal(result.render_authorized,false);assert.equal(result.publication_authorized,false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'verified-research-entry.json'))),result);
 }
 const handoff=path.join(dir,'verified-research-entry.json');
 assert.equal(JSON.parse(fs.readFileSync(handoff)).target_date,'20261013');
 assert.throws(()=>execute('.','2026108',dir),/INVALID_TARGET_DATE/);
 assert.equal(JSON.parse(fs.readFileSync(handoff)).target_date,'20261013'); // invalid input does not mutate prior output
 assert.throws(()=>execute('/nonexistent-date-to-video-root','20261008',dir));
 assert.equal(fs.existsSync(handoff),false,'failed rerun must not retain stale success handoff');
 console.log('D4_VERIFIED_SINGLE_DATE_ENTRY_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
