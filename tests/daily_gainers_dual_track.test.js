'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chineseInt,opening,materialize}=require('../scripts/materialize_daily_gainers_dual_track');
const date='20261102';
const legacyMarket=JSON.parse(fs.readFileSync('data_daily_gain_over_5/market-opening-video/'+date+'.json','utf8'));
// The historical fixture is schema v1; map its official MI_INDEX field into
// the new dedicated field for generator unit tests only. It is not a v2 PASS.
const market={...legacyMarket,market_opening_breadth:legacyMarket.breadth};
const agent=JSON.parse(fs.readFileSync('research_pending/daily-gainers-video-scripts/'+date+'.json','utf8'));
test('spoken numbers cover TWD magnitude and Taiwan date',()=>{
 assert.equal(chineseInt(44920),'四萬四千九百二十');
 assert.equal(chineseInt(10001),'一萬零一');
 assert.equal(chineseInt(518),'五百一十八');
});
test('verified market input produces all seven groups in order with no production directions',()=>{
 const r=opening(date,market,29);
 const x=r.narration;
 assert.equal(r.opening_generation,'deterministic-official-snapshot-v1');
 assert.doesNotMatch(x,/Dashboard|儀表板|第[一二三四五六七]列|依照.{0,10}順序/i);
 const groups=[['index_close','index_change_points','index_change_pct'],['turnover_twd'],['advancers','decliners'],['unchanged','limit_up'],['foreign_net_twd','investment_trust_net_twd','dealers_net_twd'],['total_net_twd']];
 let last=-1;for(const keys of groups)for(const k of keys){const pos=x.indexOf(r.spoken_values[k]);assert.ok(pos>last,'out of order: '+k);last=pos;}
 assert.match(x,/前五個交易日平均成交金額/);
 assert.match(x,/資金分歧/);
 assert.equal(r.market_opening_claims.total_net_twd,-54993116016);
});
test('Agent authored opening cannot overwrite trusted generator or stock research',()=>{
 const v=materialize(date,agent,market);
 assert.equal(v.scenes.length,agent.scenes.length);
 assert.equal(v.scenes[0].scene_type,'market_opening');
 assert.equal(v.scenes[1].narration,agent.scenes[1].narration);
 assert.equal(v.scenes.at(-1).narration,agent.scenes.at(-1).narration);
 assert.notEqual(v.scenes[0].narration,agent.scenes[0].narration);
});
test('wrong trading date, tampered totals, mismatched ratio, missing sources all fail closed',()=>{
 for(const mutate of [
 m=>{m.target_date='20261101';},
 m=>{m.institutional.total_net_twd=1;},
 m=>{m.trading.turnover_ratio_ma5=2;},
 m=>{m.source_manifest=[];},
 m=>{m.market_opening_breadth.scope='UNKNOWN';}
 ]){const m=structuredClone(market);mutate(m);assert.throws(()=>opening(date,m,29));}
});
