'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../scripts/build_daily_gainers_m5_v3_real_archive_review');
const {inspect}=require('../scripts/inspect_daily_gainers_editorial_real_archive');
const {OPENING_LINES}=require('../scripts/daily_gainers_brand_opening');

test('genuine archive seven-scene V3 review is exact, traceable and release locked',()=>{
 const r=build(),x=inspect(),e=x.evidence;
 assert.equal(r.contract,'M5-V3-REAL-ARCHIVE-TEXT-REVIEW-v1');
 assert.equal(r.status,'RESEARCH_TEXT_REVIEW_ONLY');
 assert.equal(r.date,e.date);
 assert.deepEqual(r.source_sha256,e.source_sha256);
 assert.equal(r.scenes.length,7);
 assert.deepEqual(r.scenes.map(s=>s.scene),[1,2,3,4,5,6,7]);
 for(const s of r.scenes){
  assert.equal(typeof s.speech,'string');
  assert.ok(s.speech.length>0);
  assert.equal(s.speech,s.caption);
  assert.equal(s.speech,s.display);
 }
 assert.deepEqual(r.scenes.slice(0,3).map(s=>s.speech),OPENING_LINES);
 assert.match(r.scenes[3].speech,/上漲家數.*家，下跌則有.*家/);
 assert.match(r.scenes[4].speech,/前五個交易日平均/);
 assert.match(r.scenes[5].speech,/三大法人合計.*外資.*投信.*自營商/);
 assert.match(r.scenes[5].speech,/淨額相當於.*整體市場成交金額/);
 assert.match(r.scenes[6].speech,/後續觀察/);
 assert.equal(r.derived.institutional_net_twd,e.net_twd);
 assert.equal(r.derived.market_turnover_twd,e.turnover_twd);
 assert.ok(Math.abs(r.derived.percent-Math.abs(e.net_twd)/e.turnover_twd*100)<1e-10);
 assert.equal(r.ratio_type,'NET_FLOW_ABSOLUTE_TO_WHOLE_MARKET_TURNOVER_CONTEXT_ONLY');
 assert.equal(e.scope_verified_for_publication,false);
 for(const key of ['publication_authorized','tts_authorized','video_authorized'])assert.equal(r[key],false);
 assert.ok(r.limitations.some(x=>/scopeVerified=false/.test(x)));
});
