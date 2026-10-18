'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {join}=require('../scripts/research_date_to_video_d4_evidence_join');
const {inventory}=require('../scripts/research_date_to_video_d4_claim_inventory');
const read=(kind,date)=>JSON.parse(fs.readFileSync('data_daily_gain_over_5/'+kind+'/'+date+'.json','utf8'));
for(const date of ['20261008','20261013']){
 const inputs={list:read('',date),facts:read('analysis-facts',date),news:read('analysis-news',date),ai:read('analysis-ai',date)};
 const cutoff=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6)+'T23:59:59+08:00';
 const joined=join({date,cutoff,...inputs}),claims=inventory(joined,inputs);
 assert.ok(claims.claim_count>0);assert.equal(claims.whitelisted_claim_ids.length,0);
 assert.ok(claims.claims.every(c=>c.claim_id.startsWith(date+':')&&!c.narration_authorized&&!c.causality_verified));
 assert.equal(claims.render_authorized,false);assert.equal(claims.publication_authorized,false);
 const changed=structuredClone(inputs);changed.news.analyses[0].reason_summary='tampered';
 assert.throws(()=>inventory(joined,changed),/NEWS_SHA_DRIFT/);
 console.log('D4_DATED_CLAIM_INVENTORY_PASS '+date+' claims='+claims.claim_count+' whitelist=false');
}
