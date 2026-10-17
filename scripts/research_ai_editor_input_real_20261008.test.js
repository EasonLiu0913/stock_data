'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const {build:buildAIInput}=require('./build_ai_editor_input_v3_20261008');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const root='data_daily_gain_over_5/';
const editorInput=buildAIInput(read('/tmp/video-recovery-proof/market-opening-unified-research-master.json'),read(root+'20261008.json'),read(root+'analysis-news/20261008.json'),read(root+'analysis-facts/20261008.json'),read(root+'analysis-ai/20261008.json'));
assert.deepEqual(editorInput.candidates.map(s=>s.code),['6672','2305','1301','3416','9103','2428']);
assert.equal(editorInput.editorial_instructions.publication_authorized,false);
assert.deepEqual(editorInput.candidates.map(c=>c.facts.price.close),editorInput.candidates.map(c=>c.close),'REAL_FACTS_CLOSE_DRIFT');
assert.ok(editorInput.sources.every(s=>s.published_at<='2026-10-08'));
console.log('AI_EDITOR_INPUT_EMBEDDED_MASTER_SHA256='+editorInput.sha256);
const authored=read('data_research/m5/ai-script-generation/20261008-original-script-v3-research.json');
assert.equal(authored.research_master_sha256,editorInput.sha256,'AUTHORED_MASTER_SHA_DRIFT');
assert.equal(require('./validate_ai_script_research_v3').validate(authored,editorInput).render_authorized,false);
const dealer2305=editorInput.candidates.find(c=>c.code==='2305');
assert.ok(dealer2305,'2305_MISSING');
assert.equal(dealer2305.facts.flow.foreign.net_shares,3697975,'2305_FOREIGN_SHARES_DRIFT');
assert.equal(dealer2305.facts.flow.investment_trust.net_shares,-5000,'2305_TRUST_SHARES_DRIFT');
assert.equal(dealer2305.facts.flow.dealer.net_shares,41283,'2305_DEALER_SHARES_DRIFT');
const segment2305=authored.segments.find(s=>s.id==='2305');
assert.ok(segment2305 && segment2305.claim_ids.includes('2305_FLOW') && segment2305.card_claim_ids.includes('2305_FLOW'),'2305_FLOW_SURFACE_MISSING');
assert.ok(segment2305.spoken_sentences.some(s=>s.includes('三百六十九萬七千九百七十五股') && s.includes('賣超五千股') && s.includes('四萬一千二百八十三股')),'2305_FLOW_NARRATION_DRIFT');
assert.deepEqual(segment2305.spoken_sentences,segment2305.caption_sentences,'2305_FLOW_CAPTION_DRIFT');
console.log('2305_FLOW_DATED_SOURCE_AND_NARRATION_GUARD_PASS research_only=true');
for(const code of ['6672','1301']){
 const candidate=editorInput.candidates.find(c=>c.code===code);
 const segment=authored.segments.find(s=>s.id===code);
 assert.ok(candidate&&segment,'FEATURED_SOURCE_OR_SEGMENT_MISSING '+code);
 assert.equal(candidate.facts.price.close,candidate.close,'FEATURED_CLOSE_DRIFT '+code);
 assert.equal(candidate.facts.price.previous_close,candidate.previous_close,'FEATURED_PREVIOUS_CLOSE_DRIFT '+code);
 assert.ok(segment.claim_ids.includes(code+'_PRICE')&&segment.card_claim_ids.includes(code+'_PRICE'),'FEATURED_PRICE_SURFACE_MISSING '+code);
 assert.ok(segment.claim_ids.includes(code+'_FLOW')&&segment.card_claim_ids.includes(code+'_FLOW'),'FEATURED_FLOW_SURFACE_MISSING '+code);
 assert.deepEqual(segment.spoken_sentences,segment.caption_sentences,'FEATURED_CAPTION_DRIFT '+code);
}
console.log('6672_1301_DATED_PRICE_FLOW_SURFACE_GUARD_PASS research_only=true');
const market=editorInput.market;
assert.equal(market.target_date,authored.target_date,'MARKET_CLAIM_DATE_DRIFT');
assert.equal(market.taiex.close,49313.44,'MARKET_INDEX_CLOSE_DRIFT');
assert.equal(market.taiex.change_points,-492.93,'MARKET_INDEX_POINTS_DRIFT');
assert.equal(market.breadth.scope,'TWSE_OFFICIAL_STOCK_COLUMN','MARKET_BREADTH_SCOPE_DRIFT');
assert.deepEqual([market.breadth.rising_count,market.breadth.falling_count,market.breadth.unchanged_count,market.breadth.limit_up_count,market.breadth.limit_down_count],[425,540,109,14,2],'MARKET_BREADTH_COUNTS_DRIFT');
assert.equal(market.market_trading.turnover_twd,924509097873,'MARKET_TURNOVER_DRIFT');
assert.equal(market.market_trading.turnover_ma5_twd,1007158931238.4,'MARKET_MA5_DRIFT');
assert.deepEqual(['foreign','investment_trust','dealers'].map(k=>market.institutional[k].net_twd),[-75852293490,3008930013,-18731261604],'MARKET_INSTITUTIONAL_DRIFT');
const marketSegment=authored.segments.find(s=>s.id==='market');
assert.ok(marketSegment,'MARKET_SEGMENT_MISSING');
for(const id of ['MARKET_INDEX','MARKET_BREADTH','MARKET_TURNOVER','MARKET_INSTITUTIONAL'])assert.ok(marketSegment.claim_ids.includes(id)&&marketSegment.card_claim_ids.includes(id),'MARKET_SURFACE_MISSING '+id);
assert.deepEqual(marketSegment.spoken_sentences,marketSegment.caption_sentences,'MARKET_CAPTION_DRIFT');
console.log('MARKET_DATED_NUMERIC_SOURCE_AND_SURFACE_GUARD_PASS research_only=true');
assert.equal(Math.round((market.taiex.close-market.taiex.previous_close)*100),Math.round(market.taiex.change_points*100),'INDEX_CHANGE_ARITHMETIC_DRIFT');
assert.equal(market.market_trading.turnover_ratio_ma5,market.market_trading.turnover_twd/market.market_trading.turnover_ma5_twd,'TURNOVER_RATIO_DRIFT');
assert.equal(market.institutional.total.net_twd,['foreign','investment_trust','dealers'].reduce((sum,k)=>sum+market.institutional[k].net_twd,0),'INSTITUTIONAL_TOTAL_DRIFT');
console.log('MARKET_DERIVED_ARITHMETIC_GUARD_PASS research_only=true');
// Research-only numeric claim manifest: values are read from the dated input, never copied from a prior day's script.
const numericClaimValues={
 MARKET_INDEX:{close:market.taiex.close,change_points:market.taiex.change_points,change_pct:market.taiex.change_pct},
 MARKET_BREADTH:{scope:market.breadth.scope,rising:market.breadth.rising_count,falling:market.breadth.falling_count,unchanged:market.breadth.unchanged_count,limit_up:market.breadth.limit_up_count,limit_down:market.breadth.limit_down_count},
 MARKET_TURNOVER:{twd:market.market_trading.turnover_twd,previous_five_trading_days_mean_twd:market.market_trading.turnover_ma5_twd},
 MARKET_INSTITUTIONAL:Object.fromEntries(['foreign','investment_trust','dealers'].map(k=>[k,market.institutional[k].net_twd]))
};
for(const featured of authored.featured){
 const c=editorInput.candidates.find(x=>x.code===featured.code);
 assert.ok(c,'NUMERIC_MANIFEST_CANDIDATE_MISSING '+featured.code);
 numericClaimValues[featured.code+'_PRICE']={close:c.close,previous_close:c.previous_close,change_pct:c.change_pct,unit:'TWD_per_share'};
 numericClaimValues[featured.code+'_FLOW']=Object.fromEntries(['foreign','investment_trust','dealer'].map(k=>[k,c.facts.flow[k].net_shares]));
}
const declared=new Set(authored.claims.map(c=>c.id));
for(const [id,values] of Object.entries(numericClaimValues)){
 assert.ok(declared.has(id),'NUMERIC_MANIFEST_CLAIM_MISSING '+id);
 assert.ok(Object.values(values).every(v=>typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length>0),'NUMERIC_MANIFEST_INVALID_VALUE '+id);
 assert.ok(authored.segments.some(s=>s.claim_ids.includes(id)&&s.card_claim_ids.includes(id)),'NUMERIC_MANIFEST_SURFACE_MISSING '+id);
}
assert.equal(Object.keys(numericClaimValues).length,4+authored.featured.length*2,'NUMERIC_MANIFEST_COUNT_DRIFT');
console.log('AI_NUMERIC_CLAIM_DYNAMIC_MANIFEST_PASS claims='+Object.keys(numericClaimValues).length+' research_only=true');
const manifestPath='/tmp/video-recovery-proof/ai-numeric-claims-v3.json';
const manifest={schema_version:1,target_date:editorInput.target_date,editor_input_sha256:editorInput.sha256,source_scope:market.breadth.scope,publication_authorized:false,render_authorized:false,claims:numericClaimValues};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const manifestHash=crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
fs.appendFileSync('/tmp/video-recovery-proof/SHA256SUMS',manifestHash+'  '+manifestPath+'\n');
assert.deepEqual(read(manifestPath).claims,numericClaimValues,'NUMERIC_MANIFEST_ROUNDTRIP_DRIFT');
const tamperedManifest=read(manifestPath);
tamperedManifest.claims.MARKET_INDEX.close+=1;
assert.throws(()=>assert.deepEqual(tamperedManifest.claims,numericClaimValues,'NUMERIC_MANIFEST_ROUNDTRIP_DRIFT'),/NUMERIC_MANIFEST_ROUNDTRIP_DRIFT/,'NUMERIC_MANIFEST_NEGATIVE_TEST_FAILED');
assert.equal(read(manifestPath).claims.MARKET_INDEX.close,numericClaimValues.MARKET_INDEX.close,'NUMERIC_MANIFEST_PROOF_MUTATED');
console.log('AI_NUMERIC_CLAIM_MANIFEST_TAMPER_REJECTED research_only=true');
console.log('AI_NUMERIC_CLAIM_MANIFEST_ARTIFACT_PASS sha256='+manifestHash+' research_only=true');
// Dated projection regression: check actual caption digits against source-derived values, not only claim IDs.
const {project:projectDatedCaption}=require('./research_caption_projection_full_20261008');
const formatNumber=n=>n.toLocaleString('en-US',{useGrouping:true,maximumFractionDigits:2});
const marketProjected=marketSegment.spoken_sentences.map(projectDatedCaption);
const flow2305Projected=segment2305.spoken_sentences.map(projectDatedCaption);
const expectedIndex=formatNumber(numericClaimValues.MARKET_INDEX.close);
const expected2305Foreign=formatNumber(numericClaimValues['2305_FLOW'].foreign);
const expected2305Dealer=formatNumber(numericClaimValues['2305_FLOW'].dealer);
assert.ok(marketProjected.some(s=>s.includes(expectedIndex)),'CAPTION_MANIFEST_INDEX_DRIFT');
assert.ok(flow2305Projected.some(s=>s.includes(expected2305Foreign)&&s.includes(expected2305Dealer)),'CAPTION_MANIFEST_2305_FLOW_DRIFT');
assert.throws(()=>assert.ok(marketProjected.some(s=>s.includes(formatNumber(numericClaimValues.MARKET_INDEX.close+1))),'CAPTION_MANIFEST_INDEX_DRIFT'),/CAPTION_MANIFEST_INDEX_DRIFT/,'CAPTION_MANIFEST_NEGATIVE_TEST_FAILED');
console.log('DATED_CAPTION_NUMERIC_MANIFEST_PARITY_PASS research_only=true');
for(const featured of authored.featured){
 const segment=authored.segments.find(s=>s.id===featured.code);
 assert.ok(segment,'CAPTION_MANIFEST_FEATURED_SEGMENT_MISSING '+featured.code);
 const projected=segment.spoken_sentences.map(projectDatedCaption);
 const expectedClose=formatNumber(numericClaimValues[featured.code+'_PRICE'].close);
 assert.ok(projected.some(s=>s.includes(expectedClose)),'CAPTION_MANIFEST_FEATURED_CLOSE_DRIFT '+featured.code);
 assert.throws(()=>assert.ok(projected.some(s=>s.includes(formatNumber(numericClaimValues[featured.code+'_PRICE'].close+10000))),'CAPTION_MANIFEST_FEATURED_CLOSE_DRIFT '+featured.code),/CAPTION_MANIFEST_FEATURED_CLOSE_DRIFT/,'CAPTION_MANIFEST_FEATURED_NEGATIVE_TEST_FAILED '+featured.code);
}
console.log('DATED_CAPTION_FEATURED_CLOSE_MANIFEST_PARITY_PASS count='+authored.featured.length+' research_only=true');


console.log('AI_AUTHORED_ORIGINAL_V3_CONTRACT_PASS research_only=true');
const output='/tmp/video-recovery-proof/ai-editor-input-v3.json';
fs.writeFileSync(output,JSON.stringify(editorInput,null,2)+'\n');
const fileHash=crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
fs.appendFileSync('/tmp/video-recovery-proof/SHA256SUMS',fileHash+'  '+output+'\n');
console.log('AI_EDITOR_INPUT_V3_REAL_20261008_PASS candidates='+editorInput.candidates.length+' file_sha256='+fileHash+' research_only=true');
