'use strict';
const {OPENING_LINES}=require('./daily_gainers_brand_opening');
const {build}=require('./build_daily_gainers_m3_regime_assertions');
const {compile}=require('./build_daily_gainers_m3_bound_claims');
function createDraft(ledger=build()){
 const claims=compile(ledger);
 const scenes=[
 ...OPENING_LINES.map((spoken,i)=>({id:'brand-'+(i+1),spoken,evidence_ids:[],source_refs:[],role:'anchor'})),
 {id:'market',spoken:'十月八日，台股加權指數下跌四百九十二點九三點。官方股票欄上漲四百二十五、下跌五百四十、持平一百零九、未成交三、無比價五；當日盤面偏弱，不代表趨勢反轉。',evidence_ids:claims[0].evidence_ids,source_refs:claims[0].source_refs,role:'anchor'},
 {id:'turnover',spoken:'台灣證交所整體市場成交金額約九千二百四十五億元，低於前五個交易日平均；這不是普通股單獨成交額。',evidence_ids:claims[1].evidence_ids,source_refs:claims[1].source_refs,role:'anchor'},
 {id:'institutions',spoken:'研究資料顯示，三大法人合計賣超約九百一十六億元，外資賣超、投信買超、自營商賣超；目前發布口徑尚待認證，也無法據此推定買賣對手。',evidence_ids:claims[2].evidence_ids,source_refs:claims[2].source_refs,role:'anchor'},
 {id:'caution',spoken:'產業成交熱度不等於法人資金淨流入；觀察到的強勢股名單也不代表全市場完整清單。行情解讀，仍應留意來源限制與個股交易風險。',evidence_ids:[...claims[3].evidence_ids,...claims[4].evidence_ids],source_refs:[...claims[3].source_refs,...claims[4].source_refs],role:'analyst'}
 ];
 return {date:ledger.date,contract:'M4-SPOKEN-OPENING-PARITY-v1',status:'DRAFT_RESEARCH_ONLY',style:{anchor:70,analyst:30},scenes:scenes.map((s,i)=>({...s,order:i+1,display_text:s.spoken,srt_text:s.spoken,locale:'zh-TW'})),estimated_duration_seconds:null,actual_tts_duration_seconds:null,publication_authorized:false,prompt_a_complete:false,prompt_b_eligible:false,limitations:['正式發布來源口徑尚未認證','實際60–90秒以M5 TTS計時為準','本版本不是可直接上傳的SRT時間軸']};
}
function validate(d,ledger=build()){
 const expected=createDraft(ledger);
 if(JSON.stringify(d)!==JSON.stringify(expected))throw Error('M4_DRAFT_PARITY_OR_SOURCE_MISMATCH');
 if(d.scenes.length!==7||d.scenes.some((s,i)=>s.spoken!==s.srt_text||s.spoken!==s.display_text||s.order!==i+1))throw Error('M4_SCENE_PARITY');
 return {scenes:d.scenes.length,publication_authorized:false};
}
if(require.main===module){const d=createDraft();validate(d);console.log(JSON.stringify(d,null,2));}
module.exports={createDraft,validate};
