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
assert.equal(b.eligible_count,1083);
assert.equal(b.advancers+b.decliners+b.unchanged+b.no_trade_count+b.no_comparison_count,1083);
assert.ok(b.limit_up_count<=b.advancers&&b.limit_down_count<=b.decliners);
console.log('MULTIDATE_20261013_BREADTH_BUCKETS '+JSON.stringify({advancers:b.advancers,limit_up_count:b.limit_up_count,decliners:b.decliners,limit_down_count:b.limit_down_count,unchanged:b.unchanged,no_trade_count:b.no_trade_count,no_comparison_count:b.no_comparison_count,eligible_count:b.eligible_count}));
assert.equal(b.publication_authorized,false);assert.equal(b.legal_identity_master_certified,false);
assert.throws(()=>parse(payload,'20261008'),/INVALID_OR_STALE_MI_INDEX/);
fs.writeFileSync('/tmp/video-recovery-proof/multidate-20261013-mi-index-breadth.json',JSON.stringify(b,null,2)+'\n');
console.log('MULTIDATE_20261013_OFFICIAL_STOCK_COLUMN_PASS '+b.eligible_count+'; identity uncertified; publication false');
NODE
node - <<'NODE'
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const path='data_twse_institutional_investors/20261013_twse_institutional_investors.json',date='20261013';
const bytes=fs.readFileSync(path),sha256=crypto.createHash('sha256').update(bytes).digest('hex'),d=JSON.parse(bytes);
const keys=Object.keys(d);
const dateFields=Object.fromEntries(keys.filter(k=>/date|time|source|status|unit|market|count|stat/i.test(k)).map(k=>[k,typeof d[k]==='object'?(Array.isArray(d[k])?'array':'object'):d[k]]));
const arrays=Object.fromEntries(keys.filter(k=>Array.isArray(d[k])).map(k=>[k,{length:d[k].length,firstType:typeof d[k][0],firstKeys:d[k][0]&&typeof d[k][0]==='object'?Object.keys(d[k][0]).slice(0,18):[]}]));
assert.ok(bytes.length>1000&&keys.length>0);
const proof={target_date:date,source_path:path,sha256,bytes:bytes.length,root_keys:keys,date_fields:dateFields,arrays,source_scope_verified:false,bfi82u_final_market_totals_verified:false,publication_authorized:false};
fs.writeFileSync('/tmp/video-recovery-proof/multidate-20261013-institutional-schema.json',JSON.stringify(proof,null,2)+'\n');
console.log('MULTIDATE_20261013_INSTITUTIONAL_SCHEMA_INSPECT '+JSON.stringify(proof));
NODE
node --check scripts/research_date_to_video_bfi82u_v1.js
node - <<'NODE'
const assert=require('node:assert/strict'),fs=require('node:fs');
const {inspect,verify}=require('./scripts/research_date_to_video_bfi82u_v1');
const good=inspect('.','20261008'),dated=inspect('.','20261013');
assert.equal(good.status,'VERIFIED');assert.equal(good.final_six_rows_verified,true);
assert.equal(dated.status,'VERIFIED');assert.equal(dated.final_six_rows_verified,true);
assert.equal(dated.raw_sha256,'70476f592b5692b15b4097b92fd38f1114e1638af4a71c01046e7bb203b2e90d');
const root='data_research/twse-market-opening/primary-archive/20261008/20261008-bfi82u';
const bytes=fs.readFileSync(root+'.json'),manifest=JSON.parse(fs.readFileSync(root+'.manifest.json'));
assert.throws(()=>verify(bytes,manifest,'20261013'),/MANIFEST_TARGET_DATE/);
assert.throws(()=>verify(Buffer.concat([bytes,Buffer.from(' ')]),manifest,'20261008'),/RAW_SHA_MISMATCH/);
fs.writeFileSync('/tmp/video-recovery-proof/date-to-video-bfi82u-date-gate.json',JSON.stringify({verified_20261008:good,verified_20261013:dated,wrong_date_rejected:true,tampered_bytes_rejected:true},null,2)+'\n');
console.log('DATE_TO_VIDEO_BFI82U_DATE_GATE_PASS 20261008 VERIFIED 20261013 VERIFIED');
NODE
node --check scripts/research_date_to_video_d3_featured_triage.js
node - <<'NODE'
const assert=require('node:assert/strict'),fs=require('node:fs');
const {build}=require('./scripts/research_date_to_video_d3_featured_triage');
const raw=JSON.parse(fs.readFileSync('data_daily_gain_over_5/20261013.json','utf8'));
const r=build(raw);
assert.equal(r.preliminary_count,25);assert.equal(r.featured_selection_certified,false);
assert.equal(r.render_authorized,false);assert.equal(r.publication_authorized,false);
assert.ok(r.rows.find(s=>s.code==='1312A').identity_review_flags.includes('NON_FOUR_DIGIT_CODE_REVIEW'));
assert.ok(r.rows.find(s=>s.code==='9103').identity_review_flags.includes('DEPOSITARY_RECEIPT_EXCLUDE_FROM_COMMON_STOCK'));
assert.ok(r.rows.find(s=>s.code==='6645').identity_review_flags.includes('INNOVATION_BOARD_IDENTITY_REVIEW'));
assert.ok(r.rows.every(s=>s.eligible_for_final_feature===false&&s.narration_authorized===false));
assert.throws(()=>build({...raw,target_date:'20261012',stocks:raw.stocks.map((s,i)=>i? s:{...s,close:s.close+1})}),/PRICE_CHANGE_MISMATCH/);
fs.writeFileSync('/tmp/video-recovery-proof/date-to-video-d3-featured-triage.json',JSON.stringify(r,null,2)+'\n');
console.log('DATE_TO_VIDEO_D3_FEATURED_TRIAGE_PASS preliminary=25 identity_and_catalyst_pending');
NODE
node --check scripts/research_date_to_video_d3_editorial_plan.js
node - <<'NODE'
const assert=require('node:assert/strict'),fs=require('node:fs');
const {inspect}=require('./scripts/research_date_to_video_d2_partial');
const {plan}=require('./scripts/research_date_to_video_d3_editorial_plan');
for(const date of ['20261008','20261013']){
 const r=plan(inspect('.',date));
 assert.equal(r.target_date,date);assert.equal(r.original_insight_certified,false);
 assert.equal(r.render_authorized,false);assert.equal(r.publication_authorized,false);
 assert.ok(r.questions.some(q=>q.id==='FLOW_BREADTH_DIVERGENCE'));
 if(date==='20261013'){
  assert.ok(!r.blockers.includes('FINAL_DATED_BFI82U_PENDING'));
  const a=r.claims.find(c=>c.id==='20261013:BREADTH_ASYMMETRY');
  assert.equal(a.fact.directional_count,999);
  assert.equal(a.fact.decliners_minus_advancers,461);
  assert.equal(a.fact.down_share_percent,73.07);
  assert.equal(a.causality,'NOT_ASSERTED');
  const contrast=r.claims.find(c=>c.id==='20261013:WEAK_BREADTH_WITH_PRELIMINARY_GAINERS');
  assert.equal(contrast.fact.preliminary_gainers_over_5pct,25);
  assert.equal(contrast.fact.decliners,730);
  assert.equal(contrast.narration_authorized,false);
  assert.ok(contrast.limits.some(s=>s.includes('母體不完全相同')));
}
 else assert.ok(r.claims.some(c=>c.kind==='observed'&&c.evidence==='final_bfi82u'));
 fs.writeFileSync('/tmp/video-recovery-proof/date-to-video-d3-'+date+'.json',JSON.stringify(r,null,2)+'\n');
}
assert.throws(()=>plan({...inspect('.','20261013'),target_date:'20261007'}),/MASTER_DATE_MISMATCH/);
console.log('DATE_TO_VIDEO_D3_EVIDENCE_PLAN_PASS editorial_not_certified');
NODE
node --check scripts/research_date_to_video_d2_partial.js
node - <<'NODE'
const assert=require('node:assert/strict'),fs=require('node:fs');
const {inspect}=require('./scripts/research_date_to_video_d2_partial');
const r=inspect('.','20261013');
assert.equal(r.target_date,'20261013');assert.equal(r.partial_master.status,'partial');
assert.equal(r.final_bfi82u.status,'VERIFIED');
assert.equal(r.final_bfi82u_verified,true);
assert.equal(r.source_complete,true);
assert.equal(r.master_status,'SOURCE_EVIDENCE_PRESENT_EDITORIAL_PENDING');
assert.ok(!r.blockers.includes('FINAL_DATED_BFI82U_THREE_GROUPS_PENDING'));
const baseline=inspect('.','20261008');
assert.equal(baseline.final_bfi82u.status,'VERIFIED');
assert.equal(baseline.final_bfi82u_verified,true);
assert.equal(baseline.source_complete,true);
assert.equal(baseline.master_status,'SOURCE_EVIDENCE_PRESENT_EDITORIAL_PENDING');
assert.equal(baseline.ready_to_render,false);
assert.equal(baseline.publication_authorized,false);
assert.ok(!baseline.blockers.includes('FINAL_DATED_BFI82U_THREE_GROUPS_PENDING'));
assert.equal(r.partial_master.institutional.investment_trust,undefined);
assert.equal(r.ready_to_render,false);assert.equal(r.publication_authorized,false);
assert.equal(Object.keys(r.source_hashes).length,3);
assert.equal(r.official_stock_breadth.scope,'TWSE_OFFICIAL_STOCK_COLUMN');
assert.equal(r.official_stock_breadth.eligible_count,1083);
assert.equal(r.official_stock_breadth.advancers,269);
assert.equal(r.official_stock_breadth.decliners,730);
assert.equal(r.official_stock_breadth.legal_identity_master_certified,false);
assert.ok(r.blockers.includes('ORDINARY_SHARE_IDENTITY_NOT_CERTIFIED'));
assert.throws(()=>inspect('.','20261008x'),/INVALID_DATE_FORMAT/);
fs.writeFileSync('/tmp/video-recovery-proof/date-to-video-d2-20261013-partial.json',JSON.stringify(r,null,2)+'\n');
console.log('DATE_TO_VIDEO_D2_20261013_PARTIAL_PASS '+r.partial_master.market_trading.turnover_twd);
NODE
node --check scripts/research_date_to_video_v1.js
node - <<'NODE'
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {plan}=require('./scripts/research_date_to_video_v1');
assert.throws(()=>plan('.','2026108'),/INVALID_DATE_FORMAT/);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'date-to-video-d1-'));
try{
 const blocked=plan(tmp,'20261013');
 assert.equal(blocked.ready_to_render,false);assert.equal(blocked.stages[0].status,'WAITING_SOURCE');
 assert.equal(blocked.stages[1].status,'NOT_RUN');assert.equal(blocked.publication_authorized,false);
 const base=path.join(tmp,'data_daily_gain_over_5');
 for(const name of ['market-opening','analysis-facts','analysis-news','analysis-ai']){
  fs.mkdirSync(path.join(base,name),{recursive:true});
  fs.writeFileSync(path.join(base,name,'20261013.json'),JSON.stringify({target_date:'20261008'}));
 }
 const stale=plan(tmp,'20261013');assert.equal(stale.stages[0].status,'WAITING_SOURCE');assert.equal(stale.blockers.length,4);
 for(const name of ['market-opening','analysis-facts','analysis-news','analysis-ai'])fs.writeFileSync(path.join(base,name,'20261013.json'),JSON.stringify({target_date:'20261013'}));
 const present=plan(tmp,'20261013');assert.equal(present.stages[0].status,'INPUT_FILES_PRESENT');
 assert.equal(present.ready_to_render,false);assert.equal(present.stages[4].status,'NOT_RUN');
 fs.writeFileSync('/tmp/video-recovery-proof/date-to-video-d1-fixture.json',JSON.stringify({missing:blocked,stale,files_present_not_certified:present},null,2)+'\n');
 console.log('DATE_TO_VIDEO_D1_FAIL_CLOSED_PASS');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
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
