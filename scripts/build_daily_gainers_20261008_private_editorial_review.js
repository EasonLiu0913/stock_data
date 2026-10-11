'use strict';
// Manual research-only editorial sample from actual verified archive; no release permission.
const {inspect}=require('./inspect_daily_gainers_editorial_real_archive');
const {build}=require('./build_daily_gainers_editorial_v1_research');
function make(){
 const {evidence:e}=inspect();
 if(e.date!=='20261008'||e.scope_verified_for_publication!==false)throw Error('RESEARCH_ARCHIVE_STATE_DRIFT');
 if(e.market_scope!=='all TWSE reported market trades, not common-stock-only'||!e.institutional_scope.includes('odd-lot after-hours and blocks'))throw Error('OFFICIAL_SCOPE_MAPPING_CHANGED');
 // Manually researched report-level transaction-mode compatibility for a contextual ratio.
 // This is NOT a declaration that the original archived publication scope was certified.
 const f={date:e.date,source_date:e.date,source_integrity_verified:true,scope_verified:true,
 source_ids:[e.source_sha256.bfi82u,e.source_sha256.fmtqik,e.source_sha256.bfiamu],
 breadth:{advance:e.breadth.advancers,decline:e.breadth.decliners,unchanged:e.breadth.unchanged},
 index_change_points:e.index_change_points,
 market:{turnover_twd:e.turnover_twd,prior_five_average_twd:e.ma5_twd,unit:'TWD',scope:'TWSE_WHOLE_MARKET'},
 institutional:{groups:e.groups,total_net_twd:e.net_twd,unit:'TWD',scope_compatible_with_turnover:true}};
 const p=build(f);
 return {...p,contract:'DAILY-GAINERS-20261008-PRIVATE-EDITORIAL-REVIEW-v1',source_scope_note:'BFI82U/FMTQIK comparable transaction modes; different participant/security universe; net-flow-to-turnover contextual scale only',scope_evidence_file:'data_research/twse-market-opening/20261008-bfi82u-fmtqik-scope-comparison-v1.md',archive_publication_scope_certified:false,publication_authorized:false,tts_authorized:false,video_authorized:false};
}
if(require.main===module)console.log(JSON.stringify(make(),null,2));
module.exports={make};
