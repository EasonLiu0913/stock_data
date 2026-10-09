'use strict';
const KEYS=['advancers','decliners','unchanged','no_trade_count','no_comparison_count'];
function verifyOfficialMarketBreadth({target_date,source_date,market,source_name,source_scope,stock_counts,source_sha256}){
 if(!/^20\d{6}$/.test(target_date||'')||target_date!==source_date)throw Error('OFFICIAL_BREADTH_DATE_MISMATCH');
 if(market!=='TWSE'||source_name!=='TWSE_MI_INDEX'||source_scope!=='TWSE_OFFICIAL_STOCK_COLUMN')throw Error('OFFICIAL_BREADTH_SCOPE_MISMATCH');
 if(!/^[a-f0-9]{64}$/.test(source_sha256||''))throw Error('OFFICIAL_BREADTH_SOURCE_SHA_REQUIRED');
 for(const k of KEYS)if(!Number.isSafeInteger(stock_counts?.[k])||stock_counts[k]<0)throw Error('OFFICIAL_BREADTH_INVALID_'+k);
 const total=KEYS.reduce((s,k)=>s+stock_counts[k],0);
 return {verified:true,target_date,market:'TWSE',source_scope,counts:{...stock_counts},total,provenance:{source_name,source_date,source_sha256},legal_identity_master_certified:false,eligible_for_opening_market_breadth:true,individual_stock_gainers_5pct_verified:false};
}
module.exports={verifyOfficialMarketBreadth};
