'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {inspect,parseCsv}=require('../scripts/report_twse_market_opening_official_event_matrix');
const file='data_research/twse-market-opening/official-event-evidence-matrix-20261008.csv';
test('20 official-event research rows are complete and historical M1 stays BLOCKED',()=>{
 const x=inspect(file);assert.equal(x.row_count,20);assert.equal(x.decision,'BLOCKED');assert.equal(x.production_authorized,false);assert.equal(x.prompt_b_eligible,false);assert.equal(x.full_original_historical_archive_verified,false);
 assert.deepEqual(x.high_priority,['3054','3673','3717','5292','7780']);
});
test('major five priority events retain explicit provenance and unresolved gaps',()=>{
 const x=inspect(file);for(const code of x.high_priority){const row=x.rows.find(r=>r.code===code);assert.ok(row.official_evidence_url.startsWith('https://'));assert.ok(row.remaining_gap);assert.notEqual(row.evidence_verdict,'SOURCE_COMPARISON_ONLY');}
 assert.equal(x.rows.find(r=>r.code==='3673').event_class,'CFI_IDENTITY');
 assert.equal(x.rows.find(r=>r.code==='7780').event_class,'PAR_VALUE_REPLACEMENT_SHARES');
});
test('csv matrix never silently accepts unlisted or missing issue codes',()=>{
 assert.equal(parseCsv('code,reason\n3054,DATE')[0].code,'3054');
 assert.equal(inspect(file).rows.length,20);
});

test('historical five-code first-party corroboration does not silently resolve date semantics',()=>{
 const report=inspect(file);
 const five=['1303','2465','2482','2486','2491'];
 assert.equal(report.source_comparison_only_count,0);
 for(const code of five){const item=report.rows.find(r=>r.code===code);assert.ok(item.evidence_verdict.startsWith('OFFICIAL_'));assert.match(item.effective_date,/^20[0-9]{6}$|^19[0-9]{6}$/);assert.ok(item.remaining_gap); }
 assert.equal(report.decision,'BLOCKED');assert.equal(report.full_original_historical_archive_verified,false);
});
