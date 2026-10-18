'use strict';
// D2 research-only adapter. Writes proof only to caller-supplied location, never production paths.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildPartialMarketOpening}=require('./build_daily_gainers_market_opening_phase1');
function inspect(root,date){
 if(!/^20\d{6}$/.test(date))throw Error('INVALID_DATE_FORMAT');
 const paths=['data_twse_market_chart/market_chart.json',`data_daily_gain_over_5/${date}.json`];
 const bytes=paths.map(p=>fs.readFileSync(path.join(root,p)));
 const [chart,raw]=bytes.map(b=>JSON.parse(b));
 const partial=buildPartialMarketOpening({marketChart:chart,raw,date});
 if(partial.target_date!==date||partial.status!=='partial')throw Error('INVALID_PARTIAL_MASTER');
 return {contract:'DATE_TO_VIDEO_V1_D2_PARTIAL',target_date:date,source_hashes:Object.fromEntries(paths.map((p,i)=>[p,crypto.createHash('sha256').update(bytes[i]).digest('hex')])),partial_master:partial,final_bfi82u_verified:false,ready_to_render:false,publication_authorized:false,blockers:['FINAL_DATED_BFI82U_THREE_GROUPS_PENDING','OFFICIAL_BREADTH_AND_IDENTITY_RECONCILIATION_PENDING','ORIGINAL_EDITORIAL_NOT_YET_CERTIFIED']};
}
if(require.main===module){try{const [date,root='.',out]=process.argv.slice(2);if(!date||!out)throw Error('Usage: node scripts/research_date_to_video_d2_partial.js YYYYMMDD repo-root proof-output');const r=inspect(root,date);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({date,contract:r.contract,blockers:r.blockers,output:out}));}catch(e){console.error(e.message);process.exitCode=2}}
module.exports={inspect};
