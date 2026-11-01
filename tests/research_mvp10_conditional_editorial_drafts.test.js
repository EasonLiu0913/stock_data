'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {inspect}=require('../scripts/research_mvp10_conditional_editorial_drafts');
test('both conditional source-bound scenarios disclose eligibility uncertainty',()=>{
 const r=inspect(process.cwd(),'20261008');
 assert.equal(r.decision,'DRAFT_ONLY_CONDITIONAL_NOT_RENDERABLE');
 assert.equal(r.render_authorized,false);
 assert.equal(r.scenarios.length,2);
 const [stock,innov]=r.scenarios;
 assert.equal(stock.conditional_stock_count,32);
 assert.equal(innov.conditional_stock_count,34);
 assert.deepEqual(stock.conditional_biotech_codes,['9919','1325','6504']);
 assert.deepEqual(innov.conditional_biotech_codes,['9919','1325','6504','6645']);
 assert.equal(stock.conditional_biotech_average_gain_pct,9.89);
 assert.equal(stock.conditional_public_catalyst_count,11);
 assert.equal(stock.conditional_catalyst_coverage_pct,34.4);
 assert.equal(innov.conditional_biotech_average_gain_pct,9.86);
 assert.equal(innov.conditional_public_catalyst_count,12);
 assert.equal(innov.conditional_catalyst_coverage_pct,35.3);
 for(const scenario of r.scenarios){
  assert.equal(scenario.render_authorized,false);
  assert.equal(scenario.full_ai_synthesis_recomputed,false);
  assert.equal(scenario.all_scene_facts_reverified,false);
  assert.deepEqual(Object.keys(scenario.affected_scene_drafts),['1','2','3','9']);
  for(const narration of Object.values(scenario.affected_scene_drafts)){
   assert.match(narration,/研究條件草案/);
   assert.doesNotMatch(narration,/美德醫療|南染|代號九一零三/);
  }
 }
});
test('frozen original raw/analysis/news/script never change under scenario builder',()=>{
 const p=['data_daily_gain_over_5/20261008.json','data_daily_gain_over_5/analysis/20261008.json',
 'data_daily_gain_over_5/analysis-news/20261008.json','video_scripts/daily-gainers/20261008.json'];
 const before=p.map(x=>fs.readFileSync(x));
 inspect(process.cwd(),'20261008');
 p.forEach((x,i)=>assert(fs.readFileSync(x).equals(before[i]),x));
});
test('unregistered date rejects without manufacturing an unsupported video',()=>{
 assert.throws(()=>inspect(process.cwd(),'20261013'),/DRAFT_DATE_NOT_REGISTERED/);
});
