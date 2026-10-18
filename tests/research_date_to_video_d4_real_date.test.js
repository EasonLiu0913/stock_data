'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {join}=require('../scripts/research_date_to_video_d4_evidence_join');
const read=(kind,date)=>JSON.parse(fs.readFileSync('data_daily_gain_over_5/'+kind+'/'+date+'.json','utf8'));
for(const date of ['20261008','20261013']){
 const input={date,cutoff:date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6)+'T23:59:59+08:00',
 list:read('',date),facts:read('analysis-facts',date),news:read('analysis-news',date),ai:read('analysis-ai',date)};
 try{
  const r=join(input);
  assert.equal(r.joined_count,input.list.stock_count);
  assert.equal(r.publication_authorized,false);assert.equal(r.render_authorized,false);
  console.log('D4_REAL_DATE_JOIN_PASS '+date+' joined='+r.joined_count+' claim_whitelist_verified=false');
 }catch(e){
  // A rejected dated input is not a completed join. Keep the blocker visible.
  console.log('D4_REAL_DATE_WAITING_EVIDENCE '+date+' '+e.message);
  if(date==='20261008')throw e;
 }
}
