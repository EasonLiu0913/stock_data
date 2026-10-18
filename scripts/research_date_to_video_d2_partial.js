'use strict';
// D2 research-only adapter. Writes proof only to caller-supplied location, never production paths.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildPartialMarketOpening}=require('./build_daily_gainers_market_opening_phase1');
const {parse}=require('./parse_twse_official_stock_aggregate');
function inspect(root,date){
 if(!/^20\d{6}$/.test(date))throw Error('INVALID_DATE_FORMAT');
 const paths=['data_twse_market_chart/market_chart.json',`data_daily_gain_over_5/${date}.json`];
 const bytes=paths.map(p=>fs.readFileSync(path.join(root,p)));
 const [chart,raw]=bytes.map(b=>JSON.parse(b));
 const partial=buildPartialMarketOpening({marketChart:chart,raw,date});
 const breadthPath=`data_twse_mi_index/${date}_twse_mi_index.json`;
 let official_stock_breadth=null,breadth_source_hash=null;
 if(fs.existsSync(path.join(root,breadthPath))){
  const b=fs.readFileSync(path.join(root,breadthPath));
  official_stock_breadth=parse(JSON.parse(b),date);
  breadth_source_hash=crypto.createHash('sha256').update(b).digest('hex');
 }
 if(partial.target_date!==date||partial.status!=='partial')throw Error('INVALID_PARTIAL_MASTER');
 return {contract:'DATE_TO_VIDEO_V1_D2_PARTIAL',target_date:date,source_hashes:{...Object.fromEntries(paths.map((p,i)=>[p,crypto.createHash('sha256').update(bytes[i]).digest('hex')])),...(breadth_source_hash?{[breadthPath]:breadth_source_hash}:{})},partial_master:partial,official_stock_breadth,final_bfi82u_verified:false,ready_to_render:false,publication_authorized:false,blockers:['FINAL_DATED_BFI82U_THREE_GROUPS_PENDING',...(official_stock_breadth?['ORDINARY_SHARE_IDENTITY_NOT_CERTIFIED']:['OFFICIAL_STOCK_COLUMN_BREADTH_PENDING']),'ORIGINAL_EDITORIAL_NOT_YET_CERTIFIED']};
}
if(require.main===module){try{const [date,root='.',out]=process.argv.slice(2);if(!date||!out)throw Error('Usage: node scripts/research_date_to_video_d2_partial.js YYYYMMDD repo-root proof-output');const r=inspect(root,date);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({date,contract:r.contract,blockers:r.blockers,output:out}));}catch(e){console.error(e.message);process.exitCode=2}}
module.exports={inspect};
