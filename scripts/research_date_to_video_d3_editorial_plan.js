'use strict';
// D3 research-only editorial evidence planner: distinguish interpretation from source facts.
// No templated narration, TTS, render or publication authorization.
const assert=require('node:assert/strict');
function plan(d){
 assert.match(d?.target_date||'',/^20\d{6}$/);
 assert.equal(d.partial_master?.target_date,d.target_date,'MASTER_DATE_MISMATCH');
 const b=d.official_stock_breadth,m=d.partial_master.market_trading,i=d.final_bfi82u;
 const claims=[],questions=[],blockers=[];
 if(b){
  assert.equal(b.target_date,d.target_date);assert.equal(b.scope,'TWSE_OFFICIAL_STOCK_COLUMN');
  claims.push({id:d.target_date+':BREADTH',kind:'observed',evidence:'official_stock_breadth',fact:{advancers:b.advancers,decliners:b.decliners,unchanged:b.unchanged,limit_up:b.limit_up_count,limit_down:b.limit_down_count},scope:b.scope,causality:'NOT_ASSERTED'});
  const directional=b.advancers+b.decliners;
  assert.ok(Number.isSafeInteger(directional)&&directional>0);
  const downShare=Number((b.decliners/directional*100).toFixed(2));
  const upShare=Number((b.advancers/directional*100).toFixed(2));
  const gap=b.decliners-b.advancers;
  claims.push({id:d.target_date+':BREADTH_ASYMMETRY',kind:'derived_interpretation',evidence:[d.target_date+':BREADTH'],fact:{directional_count:directional,up_share_percent:upShare,down_share_percent:downShare,decliners_minus_advancers:gap},interpretation:gap>0?'下跌家數多於上漲家數，當日廣度偏弱':gap<0?'上漲家數多於下跌家數，當日廣度偏強':'上漲與下跌家數相同',limits:['只描述當日官方股票欄廣度','不能單獨證明趨勢反轉或個股上漲原因','不等於逐檔普通股分類'],causality:'NOT_ASSERTED'});
  const preliminary=d.partial_master.preliminary_gainers;
  if(preliminary?.count!==undefined){
   assert.ok(Number.isSafeInteger(preliminary.count)&&preliminary.count>=0);
   claims.push({id:d.target_date+':WEAK_BREADTH_WITH_PRELIMINARY_GAINERS',kind:'cross_source_observation',evidence:[d.target_date+':BREADTH_ASYMMETRY','partial_master.preliminary_gainers'],fact:{decliners:b.decliners,advancers:b.advancers,preliminary_gainers_over_5pct:preliminary.count},interpretation:gap>0&&preliminary.count>0?'廣度偏弱的同日，初步清單仍出現漲幅超過5%的標的；值得逐檔檢驗強勢是否集中於少數題材':gap<0?'廣度偏強，仍須獨立驗證強勢股清單':'尚不足以判定市場分化',limits:['初步5%清單尚未完成上市普通股身分驗證','兩來源母體不完全相同，不得以初步清單數除以官方股票欄家數','不能據此推論題材集中、主力買盤或價格因果'],causality:'NOT_ASSERTED',narration_authorized:false});
  }
  questions.push({id:'BREADTH_VS_LEADERS',angle:'大盤漲跌家數與強勢股集中度是否背離？',requires:['verified_5pct_universe','breadth_scope_reconciliation'],status:'RESEARCH_PENDING'});
 }else blockers.push('OFFICIAL_BREADTH_MISSING');
 if(m?.turnover_twd)questions.push({id:'TURNOVER_CONTEXT',angle:'量能相對前五個交易日的變化，是擴散參與還是少數標的集中？',requires:['verified_prior_five_turnover','concentration_evidence'],status:'RESEARCH_PENDING'});
 if(i?.status==='VERIFIED')claims.push({id:d.target_date+':INSTITUTIONAL',kind:'observed',evidence:'final_bfi82u',fact:i.institutional,scope:'TWSE_BFI82U_NOT_COMMON_STOCK_ONLY',causality:'NOT_ASSERTED'});
 else blockers.push('FINAL_DATED_BFI82U_PENDING');
 questions.push({id:'FLOW_BREADTH_DIVERGENCE',angle:'法人淨流向與市場廣度是否同向？若背離，哪些觀察能區分結構性分化與單日雜訊？',requires:['final_bfi82u','official_breadth','compatible_scope_review'],status:'RESEARCH_PENDING'});
 return {contract:'DATE_TO_VIDEO_V1_D3_EDITORIAL_RESEARCH_PLAN',target_date:d.target_date,claims,questions,blockers,original_insight_certified:false,editorial_complete:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={plan};
