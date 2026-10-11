'use strict';
// Research-only narrative sourced from independently verified archived 20261008 facts.
const {inspect}=require('./inspect_daily_gainers_editorial_real_archive');
const {OPENING_LINES}=require('./daily_gainers_brand_opening');
const zh=require('./daily_gainers_spoken_zh_tw');
function build(){
 const x=inspect(),e=x.evidence,b=e.breadth;
 if(x.publication_authorized!==false||e.scope_verified_for_publication!==false)throw Error('RESEARCH_RELEASE_FLAG_DRIFT');
 if(!/BFI82U/.test(e.institutional_scope)||!e.market_scope.includes('all TWSE reported market trades'))throw Error('OFFICIAL_SCOPE_EVIDENCE_MISMATCH');
 const sum=Object.values(e.groups).reduce((a,v)=>a+v,0);
 if(sum!==e.net_twd||e.turnover_twd<=0||e.ma5_twd<=0)throw Error('REVIEW_FACT_RECONCILIATION');
 const dir=v=>v<0?'賣超':v>0?'買超':'買賣超持平';
 const breadth=b.advancers<b.decliners?'偏向弱勢':b.advancers>b.decliners?'偏向強勢':'漲跌家數相當';
 const ratio=Math.abs(e.net_twd)/e.turnover_twd*100;
 if(!Number.isFinite(ratio)||ratio>100)throw Error('CONTEXT_RATIO_ANOMALY');
 const market='十月八日，台股加權指數'+(e.index_change_points<0?'下跌':e.index_change_points>0?'上漲':'持平')+(e.index_change_points===0?'':zh.decimal(Math.abs(e.index_change_points))+'點')+'。當天上漲家數'+zh.integer(b.advancers)+'家，下跌則有'+zh.integer(b.decliners)+'家，市場'+breadth+'。';
 const turnover='台灣證交所整體市場成交金額約'+zh.toYi(e.turnover_twd)+'億元，'+(e.turnover_twd<e.ma5_twd?'低於':e.turnover_twd>e.ma5_twd?'高於':'等於')+'前五個交易日平均。';
 const institution='三大法人合計'+dir(e.net_twd)+(e.net_twd===0?'':'約'+zh.toYi(Math.abs(e.net_twd))+'億元')+'，淨額相當於當天整體市場成交金額約百分之'+zh.decimal(Math.round(ratio*100)/100)+'。外資'+dir(e.groups.foreign)+'、投信'+dir(e.groups.trust)+'、自營商'+dir(e.groups.dealers)+'。';
 const synthesis='綜合當天盤面，市場'+breadth+'，量能'+(e.turnover_twd<e.ma5_twd?'低於':e.turnover_twd>e.ma5_twd?'高於':'接近')+'前五個交易日平均，三大法人整體'+dir(e.net_twd)+'。後續觀察漲跌家數、成交量能與法人動向是否改善。';
 return {contract:'M5-V3-REAL-ARCHIVE-TEXT-REVIEW-v1',date:e.date,status:'RESEARCH_TEXT_REVIEW_ONLY',source_sha256:e.source_sha256,ratio_type:'NET_FLOW_ABSOLUTE_TO_WHOLE_MARKET_TURNOVER_CONTEXT_ONLY',derived:{institutional_net_twd:e.net_twd,market_turnover_twd:e.turnover_twd,percent:ratio},scenes:[...OPENING_LINES,market,turnover,institution,synthesis].map((speech,i)=>({scene:i+1,speech,caption:speech,display:speech})),publication_authorized:false,tts_authorized:false,video_authorized:false,limitations:['Official original archive manifests retain scopeVerified=false','Review script is not a publication-certified factual source or final approved narration','Ratio is not institutional gross trade market share']};
}
if(require.main===module)console.log(JSON.stringify(build(),null,2));
module.exports={build};
