'use strict';
// Research-only stock commentary: never infer price causation from correlated events.
const assert=require('node:assert/strict');
function project(manifest){
 assert.equal(manifest.target_date,'20261008');
 assert.equal(manifest.status,'RESEARCH_EVIDENCE_MANIFEST');
 assert.equal(manifest.render_authorized,false);
 assert.ok(manifest.selected.length>=2);
 const items=manifest.selected.map(s=>{
  assert.ok(s.change_pct>=5,'NOT_5_PERCENT');
  assert.ok(Math.abs((s.close/s.previous_close-1)*100-s.change_pct)<0.025,'PRICE_CHANGE_MISMATCH');
  assert.equal(s.narration_authorized,false);
  const line=s.name+'（'+s.code+'）當日漲幅'+s.change_pct+'%。'+(s.evidence_strength==='none'?'目前缺少足夠的同期上漲原因證據。':s.evidence_strength==='circumstantial'?'目前僅能確認同期關聯，尚不足以判定上漲原因。':'已有同期來源可供研究，但尚不能直接認定價格上漲的因果關係。');
  return {code:s.code,line,claim_status:s.claim_status,editorial_review_required:true};
 });
 const lines=items.map(x=>x.line);
 return {target_date:manifest.target_date,status:'RESEARCH_CLAIM_PROJECTION',items,narration_lines:lines,caption_lines:[...lines],editorial_complete:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={project};
