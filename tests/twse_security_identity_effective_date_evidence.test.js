'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=JSON.parse(fs.readFileSync('data_research/twse-market-opening/20261008-security-identity-effective-date-evidence.json','utf8'));
test('TWSE market holiday does not imply complete issuer identity event coverage',()=>{
 assert.deepEqual(data.trading_calendar.map(x=>x.date),['20261008','20261009','20261010']);
 assert.equal(data.trading_calendar[1].classification,'MARKET_HOLIDAY_NATIONAL_DAY_SUBSTITUTE');
 assert.equal(data.event_exhaustiveness.complete_security_type_event_register_for_window_verified,false);
 assert.equal(data.event_exhaustiveness.absence_of_event_proved,false);
});
test('delisting publication date and status-effective date are distinct',()=>{
 const x=data.observed_notices.find(x=>x.code==='1589');
 assert.equal(x.notice_date,'20261008');assert.equal(x.effective_date,'20261118');
 assert.equal(x.is_effective_on_target,false);
});
test('historical as-of security identity master and Prompt B remain blocked',()=>{
 assert.equal(data.source_snapshot_provenance.isin_stock_candidates,1085);
 assert.equal(data.source_snapshot_provenance.full_target_dated_isin_original_snapshot_available,false);
 assert.equal(data.classification.historical_master_complete,false);
 assert.equal(data.classification.prompt_b_eligible,false);
 assert.equal(data.classification.publication_authorized,false);
 assert.equal(data.classification.m1_decision,'BLOCKED_ON_HISTORICAL_MASTER_PROVENANCE');
});
test('date fields cannot silently become the historical per-security master',()=>{
 assert.equal(data.date_semantics.length,5);
 assert.ok(data.date_semantics.every(x=>x.represents_full_snapshot_effective_date===false));
 assert.equal(data.event_exhaustiveness.all_1085_code_membership_effective_on_target_verified,false);
});
