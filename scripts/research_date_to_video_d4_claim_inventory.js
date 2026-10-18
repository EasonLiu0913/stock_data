'use strict';
// Claim-level evidence inventory, not editorial certification. Never promotes a model summary to a verified cause.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function inventory(joined,{list,facts,news,ai}){
 const date=joined?.target_date;assert.match(date||'',/^20\d{6}$/);
 assert.equal(joined.contract,'DATE_TO_VIDEO_V1_D4_EVIDENCE_JOIN');
 for(const [kind,obj] of Object.entries({list,facts,news,ai}))assert.equal(obj?.target_date,date,'WRONG_DATE_'+kind);
 assert.equal(joined.input_sha256.list,sha(list),'LIST_SHA_DRIFT');
 assert.equal(joined.input_sha256.facts,sha(facts),'FACTS_SHA_DRIFT');
 assert.equal(joined.input_sha256.news,sha(news),'NEWS_SHA_DRIFT');
 assert.equal(joined.input_sha256.ai,sha(ai),'AI_SHA_DRIFT');
 const ids=new Set(),claims=[];
 for(const row of joined.rows){
  const code=row.code;const fr=facts.stocks.find(x=>x.code===code),nr=news.analyses.find(x=>x.code===code),ar=ai.analyses.find(x=>x.code===code);
  assert.ok(fr&&nr&&ar,'MISSING_STOCK:'+code);
  const observations=[['PRICE_CHANGE',fr.price?.change_pct,'facts.price.change_pct'],['NEWS_SUMMARY',nr.reason_summary,'news.reason_summary'],['AI_SUMMARY',ar.reason_summary,'ai.reason_summary']];
  for(const [kind,value,origin] of observations){
   if(value===undefined||value===null||value==='')continue;
   const id=date+':'+code+':'+kind;assert.ok(!ids.has(id),'DUPLICATE_CLAIM_ID');ids.add(id);
   const sources=kind==='NEWS_SUMMARY'?row.sources.filter(x=>x.origin==='news'):kind==='AI_SUMMARY'?row.sources.filter(x=>x.origin==='ai'):[];
   claims.push({claim_id:id,target_date:date,code,kind,origin,statement:value,evidence_sources:sources,review_status:'REVIEW_REQUIRED',causality_verified:false,narration_authorized:false});
  }
 }
 return {contract:'DATE_TO_VIDEO_V1_D4_CLAIM_INVENTORY',target_date:date,joined_input_sha256:sha(joined),claim_count:claims.length,claims,whitelisted_claim_ids:[],claim_whitelist_verified:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
}
module.exports={inventory};
