'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {verify}=require('./verify_daily_gainers_m2_user_supplied_extract');
const CHILDREN=['半導體','電腦及週邊設備','光電','通信網路','電子零組件','電子通路','資訊服務','其他電子'];
function build(input){
 const validation=verify(input);
 const source=new Map(input.industry.rows);
 const exclude=new Set([...CHILDREN,'化學','生技醫療']);
 const topLevel=input.industry.rows.filter(([name])=>!exclude.has(name)).map(([name,turnover_twd])=>({name,turnover_twd}));
 if(topLevel.length!==24)throw Error('unexpected industry taxonomy size');
 const sum=topLevel.reduce((n,r)=>n+r.turnover_twd,0);
 const institutions=input.institutional.rows;
 return {date:input.date,phase:'M2',goal_version:'goal-v2',status:'partial',publication_authorized:false,
  source_provenance:{kind:input.provenance.kind,original_http_bytes:false,raw_response_sha256:null},
  market_turnover:{scope:'TWSE FMTQIK published market scope (not ordinary common-stock-only)',
   unit:'TWD',target_twd:input.fmtqik.rows.at(-1)[2],previous_five_dates:input.fmtqik.rows.slice(0,5).map(r=>r[0]),
   previous_five_mean_twd:validation.five_day_mean_twd},
  institutional:{unit:'TWD',source_scope:'BFI82U reported three-institution amounts',net_twd:validation.institutional_net_twd,
   lines:institutions.map(r=>({name:r[0],buy_twd:r[1],sell_twd:r[2],net_twd:r[3]}))},
  industry:{unit:'TWD',index_count:34,reported_non_overlapping_top_level_count:topLevel.length,
   non_overlapping_top_level:topLevel,top_level_turnover_sum_twd:sum,
   hierarchy:{'電子':CHILDREN,'化學生技醫療':['化學','生技醫療']},
   limitations:['Industry-index turnover is not capital inflow','Aggregate and subordinate industry rows must not both contribute to one total','No independently authenticated official classification master']},
  stock_gainers_5pct:{verified:false,source_type:'requires separate strict per-security verification'},
  missing:['Independent original unmodified official HTTP bytes and source SHA256','Independent date/scope and original response provenance','Actual Node24/full repository regression and strict individual 5pct securities validation'],
  validation_scope:'owner-provided response transcription; internal consistency only'};
}
module.exports={build};
if(require.main===module){const file=path.join(__dirname,'../data_research/twse-market-opening/20261008-m2-user-supplied-official-json-extract.json');console.log(JSON.stringify(build(JSON.parse(fs.readFileSync(file,'utf8'))),null,2));}
