'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {run}=require('../scripts/research_date_to_video_d4_orchestrator');
for(const date of ['20261008','20261013']){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-'));
 const r=run('.',date,dir);
 assert.equal(r.target_date,date);assert.equal(r.render_authorized,false);assert.equal(r.publication_authorized,false);
 assert.ok(fs.existsSync(path.join(dir,'status.json')));
 if(['EVIDENCE_JOINED_NOT_CERTIFIED','PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING'].includes(r.stages[0].status)){
  const claims=JSON.parse(fs.readFileSync(path.join(dir,'claims.json')));
  assert.equal(claims.target_date,date);assert.ok(claims.claim_count>0);
  const institutional=JSON.parse(fs.readFileSync(path.join(dir,'institutional-evidence.json')));
  assert.equal(institutional.target_date,date);
  if(date==='20261008'){assert.equal(institutional.status,'VERIFIED');assert.equal(institutional.final_six_rows_verified,true);assert.equal(r.stages[1].status,'FINAL_BFI82U_VERIFIED_MARKET_MASTER_PENDING');}
  if(date==='20261013'){assert.equal(institutional.status,'WAITING_SOURCE');assert.ok(r.blockers.includes('FINAL_DATED_BFI82U_THREE_GROUPS_PENDING'));}
  const breadth=JSON.parse(fs.readFileSync(path.join(dir,'breadth-evidence.json')));
  assert.equal(breadth.target_date,date);assert.equal(breadth.publication_authorized,false);
  if(date==='20261008'){assert.equal(breadth.status,'OFFICIAL_STOCK_COLUMN_VERIFIED_IDENTITY_UNCERTIFIED');assert.equal(breadth.legal_identity_master_certified,false);assert.equal(r.stages[1].status,'MARKET_SOURCE_EVIDENCE_PRESENT_MASTER_UNCERTIFIED');}
  if(date==='20261013'){assert.ok(r.blockers.includes('DATED_MI_INDEX_STOCK_AGGREGATE_PENDING'));}
  const review=JSON.parse(fs.readFileSync(path.join(dir,'editorial-review.json')));
  assert.equal(review.claim_whitelist_verified,false);assert.equal(review.render_authorized,false);
  if(date==='20261013'){assert.equal(r.stages[0].status,'PARTIAL_EVIDENCE_JOINED_MARKET_SOURCE_MISSING');assert.ok(r.blockers.includes('MISSING:market-opening'));}
 }else assert.equal(r.stages[0].status,'WAITING_SOURCE');
 console.log('D4_ORCHESTRATOR_DATE_STATUS '+date+' '+r.stages[0].status);
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d4-missing-'));
const missing=run('.','20261014',dir);assert.equal(missing.stages[0].status,'WAITING_SOURCE');
assert.equal(missing.render_authorized,false);assert.equal(missing.artifacts.length,1);
console.log('D4_ORCHESTRATOR_FAIL_CLOSED_PASS');
