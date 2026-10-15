#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --check scripts/detect_video_data_recovery_gaps.js
node --check scripts/plan_video_data_recovery.js
node --check scripts/verify_market_opening_master_20261008.js
node tests/video_data_recovery_gap_detector.test.js
node tests/video_data_recovery_planner.test.js
node --check scripts/parse_twse_official_stock_aggregate.js
node tests/twse_official_stock_aggregate.test.js
node --check scripts/verify_real_mi_index_20261008_readonly.js
mkdir -p /tmp/video-recovery-proof
node scripts/verify_real_mi_index_20261008_readonly.js
node --check scripts/verify_bfi82u_three_groups_20261008_readonly.js
node scripts/verify_bfi82u_three_groups_20261008_readonly.js
node --check scripts/research_market_opening_unified_master_20261008.js
node scripts/research_market_opening_unified_master_20261008.js
node --check scripts/research_market_opening_consumer_contract_20261008.js
node scripts/research_market_opening_consumer_contract_20261008.js
node - <<'NODE'
const fs=require('fs'),assert=require('node:assert/strict');
const {verifyProjections}=require('./scripts/research_market_opening_consumer_contract_20261008');
const root='/tmp/video-recovery-proof/';
const m=JSON.parse(fs.readFileSync(root+'market-opening-unified-research-master.json'));
const c=JSON.parse(fs.readFileSync(root+'market-opening-consumer-contract.json'));
assert.equal(verifyProjections(m,c),true);
for(const name of ['narration','captions','information_cards']){
 const altered=structuredClone(c);altered.consumers[name].regime='DRIFT';
 assert.throws(()=>verifyProjections(m,altered),/CONSUMER_DRIFT/);
}
const stale=structuredClone(c);stale.master_sha256='0'.repeat(64);
assert.throws(()=>verifyProjections(m,stale),/MASTER_SHA_DRIFT/);
console.log('THREE_PREVIEW_PROJECTIONS_SHA_AND_NEGATIVE_TEST_PASS; production unchanged');
NODE
node --check scripts/research_market_opening_v2_preview_adapter_20261008.js
node scripts/research_market_opening_v2_preview_adapter_20261008.js
node - <<'NODE'
const assert=require('node:assert/strict'),fs=require('fs');
const {assemble}=require('./scripts/research_market_opening_v2_preview_adapter_20261008');
const m=JSON.parse(fs.readFileSync('/tmp/video-recovery-proof/market-opening-unified-research-master.json'));
const a=assemble(m);assert.deepEqual(a.narration.snapshot,a.captions.snapshot);assert.deepEqual(a.narration.snapshot,a.information_cards.snapshot);
assert.deepEqual(a.narration.lines.slice(0,3),require('./scripts/daily_gainers_brand_opening').OPENING_LINES);
assert.equal(a.publication_authorized,false);assert.equal(a.video_authorized,false);
assert.equal(a.editorial_gate.status,'BLOCKED');assert.equal(a.editorial_gate.render_allowed,false);assert.equal(a.editorial_gate.tts_allowed,false);
assert.ok(a.editorial_gate.reasons.includes('certified common-stock breadth'));
assert.equal(a.narration.lines.length,a.captions.lines.length);
assert.throws(()=>assemble({...m,editorial_complete:true}));
console.log('V2_THREE_SURFACE_RESEARCH_WIRING_PASS; actual synthesis pending');
NODE
set +e
node scripts/detect_video_data_recovery_gaps.js 20261008 > /tmp/video-recovery-proof/gaps.json
gap_status=$?
node scripts/verify_market_opening_master_20261008.js > /tmp/video-recovery-proof/editorial.json
editorial_status=$?
set -e
node -e "const fs=require('fs');const g=JSON.parse(fs.readFileSync('/tmp/video-recovery-proof/gaps.json'));const e=JSON.parse(fs.readFileSync('/tmp/video-recovery-proof/editorial.json'));if(g.status!=='BLOCKED'||e.editorial_status!=='BLOCKED')process.exit(1)"
test "$gap_status" -eq 1
test "$editorial_status" -eq 1
sha256sum /tmp/video-recovery-proof/*.json > /tmp/video-recovery-proof/SHA256SUMS
printf 'Expected BLOCKED proof verified; no publication or dispatch.\n'
