'use strict';
// Research-only V2 opening adapter. The same locked Market Opening snapshot feeds all
// three preview surfaces; no production plan, audio, publication or dispatch is touched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {build,verifyProjections}=require('./research_market_opening_consumer_contract_20261008');
const {OPENING_LINES}=require('./daily_gainers_brand_opening');
function assemble(master){
 const contract=build(master);verifyProjections(master,contract);
 const v=contract.consumers.narration;
 assert.equal(v.date,'20261008');assert.equal(master.editorial_complete,false);
 // Preview-only projection is not a synthesis authorization; source identity remains uncertified.
 const count=n=>String(n);
 const lines=[
  ...OPENING_LINES,
  '我們有提供中文 CC 字幕，記得打開觀賞，那我們開始囉。',
  '今天上市市場上漲'+count(v.rising_count)+'家，下跌'+count(v.falling_count)+'家，平盤'+count(v.unchanged_count)+'家，漲停'+count(v.limit_up_count)+'家。',
  '大盤漲跌幅為'+String(v.index_change_pct)+'%，全市場成交金額為'+String(v.turnover_twd)+'元。',
  '外資淨額'+String(v.foreign_net_twd)+'元，投信'+String(v.trust_net_twd)+'元，自營商'+String(v.dealer_net_twd)+'元。',
  '依指數方向、漲跌家數與三大法人淨額交叉觀察，本日研究訊號為'+v.regime+'；這不是經過正式編輯認證的市場結論。'
 ];
 const canonical=JSON.stringify(v);
 const cards={snapshot:v,source_sha256:contract.snapshot_sha256,labels:['上漲／下跌／平盤／漲停','大盤／成交金額','外資／投信／自營商','三訊號市場觀察']};
 const result={status:'RESEARCH_ONLY',publication_authorized:false,tts_authorized:false,video_authorized:false,editorial_complete:false,master_sha256:contract.master_sha256,snapshot_sha256:contract.snapshot_sha256,narration:{snapshot:v,lines},captions:{snapshot:v,lines:[...lines]},information_cards:cards};
 for(const name of ['narration','captions','information_cards'])assert.equal(JSON.stringify(result[name].snapshot),canonical,'V2_'+name+'_DRIFT');
 assert.deepEqual(result.narration.lines,result.captions.lines);
 assert.equal(master.breadth.verified_twse_common_stock_only,false);
 assert.equal(result.tts_authorized,false);assert.equal(result.video_authorized,false);
 // A5: a successful adapter must never be mistaken for the unconditional editorial gate.
 result.editorial_gate={status:'BLOCKED',reasons:[...master.missing],render_allowed:false,tts_allowed:false};
 return result;
}
if(require.main===module){
 const root='/tmp/video-recovery-proof/';
 const master=JSON.parse(fs.readFileSync(path.join(root,'market-opening-unified-research-master.json')));
 const result=assemble(master);
 fs.writeFileSync(path.join(root,'market-opening-v2-preview-projections.json'),JSON.stringify(result,null,2)+'\n');
 console.log('MARKET_OPENING_V2_RESEARCH_ADAPTER_PASS; actual TTS/render not authorized; editorial_complete=false');
}
module.exports={assemble};
