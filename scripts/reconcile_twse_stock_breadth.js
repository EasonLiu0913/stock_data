'use strict';
// Research-only reconciliation; never creates publishable breadth or infers identities.
// Official TWSE "股票" counts and classified row counts must be independently sourced.
const BUCKETS=['advancers','decliners','unchanged','no_trade_count','no_comparison_count'];
function reconcile({date,official,computed,classificationVerified=false,scopeVerified=false}){
 if(!/^20\d{6}$/.test(date||''))throw Error('INVALID_DATE');
 if(!classificationVerified)throw Error('HISTORICAL_CLASSIFICATION_REQUIRED');
 if(!scopeVerified)throw Error('OFFICIAL_STOCK_SCOPE_NOT_VERIFIED');
 for(const [name,source] of [['official',official],['computed',computed]]){
  if(source?.date!==date)throw Error(name.toUpperCase()+'_DATE_MISMATCH');
  for(const key of BUCKETS)if(!Number.isSafeInteger(source[key])||source[key]<0)throw Error(name.toUpperCase()+'_MISSING_OR_INVALID_'+key);
 }
 const differences=BUCKETS.filter(key=>official[key]!==computed[key]).map(key=>({category:key,official:official[key],computed:computed[key],delta:computed[key]-official[key]}));
 const total=Object.values(BUCKETS).reduce((s,key)=>s+computed[key],0);
 if(computed.eligible_count!==total)throw Error('ELIGIBLE_COUNT_NOT_RECONCILED');
 return {date,verified: differences.length===0,scope:'TWSE_COMMON_STOCK',differences,official_total:BUCKETS.reduce((s,k)=>s+official[k],0),computed_total:total,publication_authorized:false};
}
module.exports={BUCKETS,reconcile};
