'use strict';
// Owner policy v1 research candidate only. Consumes per-date verified facts, not historical M4 prose.
const {OPENING_LINES}=require('./daily_gainers_brand_opening');
function build(f){
 if(!f||!/^20\d{6}$/.test(f.date)||f.source_date!==f.date||f.scope_verified!==true||f.source_integrity_verified!==true)throw Error('V3_SOURCE_DATE_SCOPE_NOT_VERIFIED');
 const n=['advance','decline','unchanged'].map(k=>f.breadth?.[k]);
 if(n.some(v=>!Number.isSafeInteger(v)||v<0)||!Number.isFinite(f.index_change_points))throw Error('V3_BREADTH_OR_INDEX_INVALID');
 const {turnover_twd,prior_five_average_twd}=f.market||{};
 const groups=f.institutional?.groups;
 if(![turnover_twd,prior_five_average_twd].every(x=>Number.isSafeInteger(x)&&x>0)||!groups||!['foreign','trust','dealers'].every(k=>Number.isSafeInteger(groups[k])))throw Error('V3_MONEY_UNVERIFIED');
 if(f.market.scope!=='TWSE_WHOLE_MARKET'||f.institutional.scope_compatible_with_turnover!==true||f.institutional.unit!=='TWD'||f.market.unit!=='TWD')throw Error('V3_INCOMPATIBLE_FLOW_TURNOVER_SCOPE');
 const net=groups.foreign+groups.trust+groups.dealers;
 if(!Number.isSafeInteger(net)||net!==f.institutional.total_net_twd)throw Error('V3_NET_RECONCILIATION');
 const breadth=n[0]>n[1]?'偏向強勢':n[0]<n[1]?'偏向弱勢':'漲跌家數相當';
 const direction=x=>x>0?'買超':x<0?'賣超':'買賣超持平';
 const number=x=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(x);
 const billions=x=>number(Math.abs(x)/1e8);
 const ratio=Math.abs(net)/turnover_twd*100;
 if(!Number.isFinite(ratio)||ratio>100)throw Error('V3_NET_RATIO_ANOMALY_REQUIRES_REVIEW');
 const index=f.index_change_points<0?'下跌':f.index_change_points>0?'上漲':'持平';
 const market='當天上漲家數'+number(n[0])+'家，下跌則有'+number(n[1])+'家，市場'+breadth+'。';
 const volume='整體市場成交金額約'+billions(turnover_twd)+'億元，'+(turnover_twd>prior_five_average_twd?'高於':turnover_twd<prior_five_average_twd?'低於':'等於')+'前五個交易日平均。';
 const institutional='三大法人合計'+direction(net)+(net===0?'': '約'+billions(net)+'億元')+'，淨額相當於當天整體市場成交金額約百分之'+number(ratio)+'。外資'+direction(groups.foreign)+'，投信'+direction(groups.trust)+'，自營商'+direction(groups.dealers)+'。';
 const synthesis='綜合今天盤面，漲跌家數顯示市場'+breadth+'，量能'+(turnover_twd>prior_five_average_twd?'高於':turnover_twd<prior_five_average_twd?'低於':'接近')+'近期平均，三大法人整體'+direction(net)+'。接下來觀察漲跌家數、量能與法人方向是否持續改善。';
 const scenes=[...OPENING_LINES,'加權指數'+index+(index==='持平'?'':number(Math.abs(f.index_change_points))+'點')+'。'+market,volume,institutional,synthesis];
 if(scenes.length!==7)throw Error('V3_SEVEN_SCENES');
 return {contract:'DAILY-GAINERS-EDITORIAL-v1-RESEARCH',date:f.date,source_ids:f.source_ids,scenes:scenes.map((speech,i)=>({scene:i+1,speech,caption:speech,display:speech})),derived:{institutional_net_twd:net,net_to_turnover_percent:ratio,breadth},publication_authorized:false,tts_authorized:false,video_authorized:false,limitations:['Owner editorial research draft; exact text and figures require separate approval','Compatibility flag must derive from independently reviewed original scope evidence']};
}
module.exports={build};
