'use strict';
// D3 dated featured-stock evidence triage; no causal or narration approval.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
function build(raw){
 assert.match(raw?.target_date||'',/^20\d{6}$/);assert.equal(raw.stock_count,raw.stocks?.length,'COUNT_MISMATCH');
 const seen=new Set(),rows=[];
 for(const s of raw.stocks){
  assert.ok(typeof s.code==='string'&&!seen.has(s.code),'DUPLICATE_CODE');seen.add(s.code);
  for(const k of ['previous_close','close','change_pct','volume'])assert.ok(Number.isFinite(s[k]),'INVALID_'+k);
  assert.ok(s.previous_close>0&&s.close>0&&s.volume>=0);
  const computed=(s.close/s.previous_close-1)*100;
  assert.ok(computed>=5-0.011&&Math.abs(computed-s.change_pct)<0.025,'PRICE_CHANGE_MISMATCH:'+s.code);
  const flags=[...(!/^\d{4}$/.test(s.code)?['NON_FOUR_DIGIT_CODE_REVIEW']:[]),...(/創/.test(s.name)?['INNOVATION_BOARD_IDENTITY_REVIEW']:[]),...(/-DR/.test(s.name)?['DEPOSITARY_RECEIPT_EXCLUDE_FROM_COMMON_STOCK']:[])];
  rows.push({code:s.code,name:s.name,change_pct:s.change_pct,computed_change_pct:Number(computed.toFixed(4)),volume:s.volume,identity_review_flags:flags,eligible_for_final_feature:false,reason:'TWSE_COMMON_STOCK_IDENTITY_AND_CATALYST_EVIDENCE_PENDING',narration_authorized:false});
 }
 return {contract:'DATE_TO_VIDEO_V1_D3_FEATURED_TRIAGE',target_date:raw.target_date,raw_sha256:crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex'),preliminary_count:rows.length,review_required_count:rows.filter(x=>x.identity_review_flags.length).length,rows,featured_selection_certified:false,causality_verified:false,render_authorized:false,publication_authorized:false};
}
module.exports={build};
