#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --check scripts/detect_video_data_recovery_gaps.js
node --check scripts/plan_video_data_recovery.js
node --check scripts/verify_market_opening_master_20261008.js
node tests/research_caption_numeric_parity_20261008.test.js
node tests/research_caption_projection_full_20261008.test.js
node tests/research_caption_sentence_parity_20261008.test.js
node tests/build_research_caption_source_20261008.test.js
node tests/inspect_research_caption_source_20261008.test.js
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
const fs=require('node:fs'),assert=require('node:assert/strict');
const p=JSON.parse(fs.readFileSync('/tmp/video-recovery-proof/market-opening-v2-preview-projections.json'));
const line=p.narration.lines[4];
assert.match(line,/官方 MI_INDEX「股票」欄統計/);
assert.match(line,/不是逐檔認證的普通股母體/);
assert.equal(line,p.captions.lines[4]);
assert.equal(p.publication_authorized,false);
assert.equal(p.video_authorized,false);
console.log('V2_BREADTH_SCOPE_LABEL_AND_CAPTION_PARITY_PASS; no publish');
NODE
node - <<'NODE'
const assert=require('node:assert/strict'),fs=require('fs');
const {assemble}=require('./scripts/research_market_opening_v2_preview_adapter_20261008');
const m=JSON.parse(fs.readFileSync('/tmp/video-recovery-proof/market-opening-unified-research-master.json'));
assert.equal(m.breadth.identity_evidence.status,'UNVERIFIED');
assert.equal(m.breadth.identity_evidence.as_of_common_stock_roster_sha256,null);
assert.equal(m.breadth.identity_evidence.certified_common_stock_denominator,null);
assert.equal(m.breadth.identity_evidence.official_stock_column_denominator,m.breadth.denominator);
const a=assemble(m);assert.deepEqual(a.narration.snapshot,a.captions.snapshot);assert.deepEqual(a.narration.snapshot,a.information_cards.snapshot);
assert.deepEqual(a.narration.lines.slice(0,3),require('./scripts/daily_gainers_brand_opening').OPENING_LINES);
assert.equal(a.publication_authorized,false);assert.equal(a.video_authorized,false);
assert.equal(a.editorial_gate.status,'BLOCKED');assert.equal(a.editorial_gate.render_allowed,false);assert.equal(a.editorial_gate.tts_allowed,false);
assert.ok(a.editorial_gate.reasons.includes('certified common-stock breadth'));
assert.equal(a.narration.lines.length,a.captions.lines.length);
assert.throws(()=>assemble({...m,editorial_complete:true}));
console.log('V2_THREE_SURFACE_RESEARCH_WIRING_PASS; actual synthesis pending');
NODE
node --check scripts/research_market_opening_v2_scope_safe_20261008.js
node - <<'NODE'
const fs=require('fs'),assert=require('node:assert/strict');
const {project}=require('./scripts/research_market_opening_v2_scope_safe_20261008');
const m=JSON.parse(fs.readFileSync('/tmp/video-recovery-proof/market-opening-unified-research-master.json'));
const v=project(m);
assert.match(v.market_context.scope,/官方 MI_INDEX/);
assert.equal(v.required_market_claims_verified,true);
assert.equal(v.featured_stock_catalyst_claims_verified,false);
assert.equal(v.render_authorized,false);
assert.deepEqual(v.narration_lines,v.caption_lines);
assert.deepEqual(v.market_context,v.card_snapshot);
assert.throws(()=>project({...m,breadth:{...m.breadth,denominator:1}}));
assert.throws(()=>project({...m,institutional:{...m.institutional,foreign:{...m.institutional.foreign,net_twd:0}}}));
fs.writeFileSync('/tmp/video-recovery-proof/v2-scope-safe-market-context.json',JSON.stringify(v,null,2)+'\\n');
console.log('V2_SCOPE_SAFE_MARKET_CONTEXT_PASS; catalyst evidence and synthesis remain pending');
NODE
node --check scripts/research_v2_featured_evidence_20261008.js
node scripts/research_v2_featured_evidence_20261008.js
node - <<'NODE'
const fs=require('fs'),assert=require('node:assert/strict');
const {build}=require('./scripts/research_v2_featured_evidence_20261008');
const paths=['data_daily_gain_over_5/20261008.json','data_daily_gain_over_5/analysis-news/20261008.json','data_daily_gain_over_5/analysis-ai/20261008.json','data_daily_gain_over_5/analysis-facts/20261008.json'];
const [l,n,a,f]=paths.map(p=>JSON.parse(fs.readFileSync(p)));
const v=build(l,n,a,f);assert.ok(v.selected.length>=2);assert.equal(v.render_authorized,false);
assert.throws(()=>build({...l,target_date:'20261007'},n,a,f),/WRONG_DATE/);
const bad=structuredClone(l);bad.stocks.find(x=>x.code===a.priority_watchlist[0]).close=1;
assert.throws(()=>build(bad,n,a,f),/NOT_5_PERCENT|PRICE_CHANGE_MISMATCH/);
const wrong=structuredClone(n);wrong.analyses.find(x=>x.code===a.priority_watchlist[0]).sources=[{title:'future',url:'https://example.com',published_at:'2026-10-09'}];
assert.throws(()=>build(l,wrong,a,f),/POST_DATE_SOURCE/);
console.log('V2_FEATURED_EVIDENCE_NEGATIVE_TEST_PASS');
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
node - <<'NODE'
const fs=require('node:fs'),assert=require('node:assert/strict');
const {parse}=require('./scripts/parse_twse_official_stock_aggregate');
const date='20261013',file='data_twse_mi_index/'+date+'_twse_mi_index.json';
const payload=JSON.parse(fs.readFileSync(file,'utf8'));
const b=parse(payload,date);
assert.equal(b.target_date,date);assert.equal(b.scope,'TWSE_OFFICIAL_STOCK_COLUMN');
assert.equal(b.publication_authorized,false);assert.equal(b.legal_identity_master_certified,false);
assert.throws(()=>parse(payload,'20261008'),/INVALID_OR_STALE_MI_INDEX/);
fs.writeFileSync('/tmp/video-recovery-proof/multidate-20261013-mi-index-breadth.json',JSON.stringify(b,null,2)+'\n');
console.log('MULTIDATE_20261013_OFFICIAL_STOCK_COLUMN_PASS '+b.eligible_count+'; identity uncertified; publication false');
NODE
node --check scripts/research_multidate_input_readiness_v1.js
node tests/research_multidate_input_readiness_v1.test.js
node scripts/research_multidate_input_readiness_v1.js 20261008 > /tmp/video-recovery-proof/multidate-20261008-readiness.json
set +e
node scripts/research_multidate_input_readiness_v1.js 20261007 > /tmp/video-recovery-proof/multidate-20261007-readiness.json
multidate_missing_status=$?
set -e
test "$multidate_missing_status" -eq 3
node -e "const r=require('/tmp/video-recovery-proof/multidate-20261007-readiness.json');if(r.ready||!r.missing.includes('market-opening')||r.publication_authorized!==false)process.exit(1)"
node -e "const r=require('/tmp/video-recovery-proof/multidate-20261008-readiness.json');if(!r.ready||r.target_date!=='20261008')process.exit(1)"
sha256sum /tmp/video-recovery-proof/*.json > /tmp/video-recovery-proof/SHA256SUMS
printf 'Expected BLOCKED proof verified; no publication or dispatch.\n'
