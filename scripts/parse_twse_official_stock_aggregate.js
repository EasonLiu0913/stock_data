'use strict';
// Read-only official MI_INDEX 股票-column aggregate. Does NOT certify per-security identity.
function parse(payload,date){
 if(!/^20\d{6}$/.test(date||'')||payload?.date!==date||payload?.stat!=='OK')throw Error('INVALID_OR_STALE_MI_INDEX');
 const matches=(payload.tables||[]).filter(t=>t?.title==='漲跌證券數合計');
 if(matches.length!==1)throw Error('OFFICIAL_SUMMARY_TABLE_NOT_UNIQUE');
 const t=matches[0];
 if(JSON.stringify(t.fields)!==JSON.stringify(['類型','整體市場','股票'])||!Array.isArray(t.data))throw Error('OFFICIAL_STOCK_COLUMN_SCHEMA');
 const rows=new Map();
 for(const row of t.data){if(!Array.isArray(row)||rows.has(row[0]))throw Error('DUPLICATE_OR_INVALID_CATEGORY');rows.set(row[0],row[2]);}
 if(rows.size!==5)throw Error('OFFICIAL_CATEGORY_COUNT');
 const pair=(s,label)=>{const m=/^([\d,]+)\(([\d,]+)\)$/.exec(String(s??''));if(!m)throw Error('INVALID_PAIR_'+label);return m.slice(1).map(n=>integer(n,label));};
 const integer=(s,label)=>{if(!/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/.test(String(s??'')))throw Error('INVALID_COUNT_'+label);const n=Number(s.replace(/,/g,''));if(!Number.isSafeInteger(n))throw Error('INVALID_COUNT_'+label);return n;};
 const [advancers,limit_up_count]=pair(rows.get('上漲(漲停)'),'UP');
 const [decliners,limit_down_count]=pair(rows.get('下跌(跌停)'),'DOWN');
 const unchanged=integer(rows.get('持平'),'FLAT'),no_trade_count=integer(rows.get('未成交'),'NO_TRADE'),no_comparison_count=integer(rows.get('無比價'),'NO_COMPARISON');
 if(limit_up_count>advancers||limit_down_count>decliners)throw Error('LIMIT_EXCEEDS_DIRECTION');
 const eligible_count=advancers+decliners+unchanged+no_trade_count+no_comparison_count;
 if(!eligible_count)throw Error('EMPTY_OFFICIAL_STOCK_AGGREGATE');
 return {target_date:date,scope:'TWSE_OFFICIAL_STOCK_COLUMN',advancers,limit_up_count,decliners,limit_down_count,unchanged,no_trade_count,no_comparison_count,eligible_count,legal_identity_master_certified:false,publication_authorized:false};
}
module.exports={parse};
