'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build,spokenDate}=require('../scripts/build_daily_gainers_m5_v3_real_archive_review');
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
 assert.match(r.scenes[5].speech,/淨買賣超絕對金額相對於.*整體市場成交金額的參考比率/);
 const zh=require('../scripts/daily_gainers_spoken_zh_tw');
 for(const [label,key] of [['外資','foreign'],['投信','trust'],['自營商','dealers']]){
  const v=e.groups[key];
  const wording=v<0?'賣超':v>0?'買超':'買賣超持平';
  const claim=label+wording+(v===0?'':'約'+zh.toYi(Math.abs(v))+'億元');
  assert.ok(r.scenes[5].speech.includes(claim),label+' individual amount/direction missing');
 }
 assert.match(r.scenes[6].speech,/後續觀察/);
 assert.equal(r.derived.institutional_net_twd,e.net_twd);
 assert.equal(r.derived.market_turnover_twd,e.turnover_twd);
 assert.ok(Math.abs(r.derived.percent-Math.abs(e.net_twd)/e.turnover_twd*100)<1e-10);
 assert.equal(r.ratio_type,'NET_FLOW_ABSOLUTE_TO_WHOLE_MARKET_TURNOVER_CONTEXT_ONLY');
 assert.equal(e.scope_verified_for_publication,false);
 for(const key of ['publication_authorized','tts_authorized','video_authorized'])assert.equal(r[key],false);
 assert.ok(r.limitations.some(x=>/scopeVerified=false/.test(x)));
});

test('spoken date is derived from validated source date, not a fixed historical string',()=>{
 assert.equal(spokenDate('20261008'),'十月八日');
 assert.equal(spokenDate('20261112'),'十一月十二日');
 for(const bad of ['20261301','20260230','2026108','2026-10-08'])assert.throws(()=>spokenDate(bad),/REVIEW_DATE_INVALID/);
 const r=build();assert.ok(r.scenes[3].speech.startsWith(spokenDate(r.date)+'，'));
});

test('review carries exact per-claim source evidence without upgrading publication or rights',()=>{
 const r=build(),e=inspect().evidence,m=r.claim_evidence;
 assert.equal(m.market_date.date,r.date);
 assert.equal(m.breadth.advancers,e.breadth.advancers);
 assert.equal(m.breadth.decliners,e.breadth.decliners);
 assert.equal(m.market_turnover.turnover_twd,e.turnover_twd);
 assert.equal(m.market_turnover.prior_five_mean_twd,e.ma5_twd);
 assert.deepEqual(m.institutional.groups,e.groups);
 assert.equal(m.institutional.total_net_twd,e.net_twd);
 assert.equal(m.context_ratio.percent,Math.abs(e.net_twd)/e.turnover_twd*100);
 assert.equal(m.context_ratio.not_market_share,true);
 assert.deepEqual(m.source_sha256,r.source_sha256);
 assert.equal(m.scope_verified_for_publication,false);
 assert.equal(m.rights_verified_for_publication,false);
 assert.equal(r.publication_authorized,false);
});

test('scene seven next observation is conditional, not a hardcoded weakness forecast',()=>{
 const r=build(),e=inspect().evidence,b=e.breadth;
 const continuation=b.advancers>b.decliners&&e.turnover_twd>=e.ma5_twd&&e.net_twd>=0;
 assert.ok(r.scenes[6].speech.includes(continuation?'能否延續':'如何變化'));
 assert.doesNotMatch(r.scenes[6].speech,/是否改善/);
 assert.equal(r.publication_authorized,false);
});

test('expanded commentary retains original scope boundaries and adds no new numeric claims',()=>{
 const r=build(),e=inspect().evidence;
 assert.match(r.scenes[3].speech,/上市普通股統計.*不同口徑/);
 assert.match(r.scenes[4].speech,/前五個實際交易日.*不把休市日/);
 assert.match(r.scenes[5].speech,/金額淨額.*不代表當天市場所有交易都是法人/);
 assert.match(r.scenes[6].speech,/同時對照市場廣度、成交量能與不同法人方向/);
 assert.deepEqual(r.scenes.slice(0,3).map(s=>s.speech),OPENING_LINES);
 for(const scene of r.scenes){assert.equal(scene.speech,scene.caption);assert.equal(scene.speech,scene.display);}
 assert.deepEqual(r.source_sha256,e.source_sha256);
 assert.equal(r.publication_authorized,false);
 assert.equal(r.tts_authorized,false);
 assert.equal(r.video_authorized,false);
});
