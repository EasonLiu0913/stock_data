'use strict';
// Pure, network-free data contract gate for the TWSE-only market-opening snapshot.
// Do not use string-length heuristics to determine security type.
const fs=require('node:fs');
const path=require('node:path');
function assertDate(value) {
  if (typeof value !== 'string' || !/^20\d{6}$/.test(value)) throw new Error('INVALID_DATE');
  const iso = value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8);
  const d = new Date(iso+'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==iso) throw new Error('INVALID_DATE');
}
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function assertNum(object, keys, prefix) {
  for(const key of keys) if (!finite(object?.[key])) throw new Error('INVALID_NUMBER:'+prefix+'.'+key);
}
function validateOpeningSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('MISSING_SNAPSHOT');
  assertDate(snapshot.target_date);
  if (snapshot.market !== 'TWSE') throw new Error('MARKET_NOT_TWSE');
  if (snapshot.schema_version !== 2) throw new Error('SCHEMA_VERSION');
  if (snapshot.status!=='verified_official_market_aggregate') throw new Error('OPENING_NOT_COMPLETE');
  if (!Array.isArray(snapshot.source_manifest) || !snapshot.source_manifest.length) throw new Error('MISSING_PROVENANCE');
  for(const source of snapshot.source_manifest) {
    if (source.source_date !== snapshot.target_date) throw new Error('SOURCE_DATE_MISMATCH:'+source.source_name);
    if (source.market_scope !== 'TWSE') throw new Error('SOURCE_MARKET_MISMATCH:'+source.source_name);
    if (source.verified !== true) throw new Error('UNVERIFIED_SOURCE:'+source.source_name);
    if (!source.unit || !source.source_name) throw new Error('SOURCE_METADATA_MISSING');
    if (!/^[a-f0-9]{64}$/.test(source.sha256||'')) throw new Error('SOURCE_SHA256_INVALID:'+source.source_name);
  }
  assertNum(snapshot.taiex,['close','previous_close','change_points','change_pct'],'taiex');
  if (snapshot.taiex.previous_close <= 0) throw new Error('INVALID_PREVIOUS_CLOSE');
  const expected = (snapshot.taiex.close/snapshot.taiex.previous_close-1)*100;
  if (Math.abs(expected-snapshot.taiex.change_pct)>0.011) throw new Error('INDEX_PERCENT_MISMATCH');
  if (Math.abs(snapshot.taiex.close-snapshot.taiex.previous_close-snapshot.taiex.change_points)>0.011) throw new Error('INDEX_POINTS_MISMATCH');
  assertNum(snapshot.market_trading,['turnover_twd','shares','transactions'],'market_trading');
  if (snapshot.market_trading.turnover_twd<0 || snapshot.market_trading.shares<0 || snapshot.market_trading.transactions<0) throw new Error('NEGATIVE_TRADING_DATA');
  const b=snapshot.breadth;
  if (!b || b.scope!=='TWSE_COMMON_STOCK') throw new Error('BREADTH_SCOPE');
  assertNum(b,['advancers','decliners','unchanged','eligible_count','gainers_5pct_count'],'breadth');
  for(const k of ['advancers','decliners','unchanged','eligible_count','gainers_5pct_count']) if (!Number.isInteger(b[k]) || b[k]<0) throw new Error('BREADTH_COUNT');
  if (!Number.isInteger(b.no_trade_count) || b.no_trade_count<0) throw new Error('BREADTH_NO_TRADE_COUNT');
  if (!Number.isInteger(b.no_comparison_count) || b.no_comparison_count<0) throw new Error('BREADTH_NO_COMPARISON_COUNT');
  if (b.advancers+b.decliners+b.unchanged+b.no_trade_count+b.no_comparison_count!==b.eligible_count || b.gainers_5pct_count>b.advancers) throw new Error('BREADTH_INCONSISTENT');
  if (!Array.isArray(b.identities) || b.identities.length!==b.eligible_count) throw new Error('MISSING_CLASSIFIED_UNIVERSE');
  if (!Array.isArray(b.source_manifest) || !b.source_manifest.length) throw new Error('MISSING_COMMON_BREADTH_PROVENANCE');
  for(const source of b.source_manifest) {
    if(source.source_date!==snapshot.target_date || source.market_scope!=='TWSE' || source.verified!==true || !source.source_name || !/^[a-f0-9]{64}$/.test(source.sha256||'')) throw new Error('INVALID_COMMON_BREADTH_PROVENANCE');
  }
  const seen = new Set();
  for(const item of b.identities) {
    if (item.market!=='TWSE' || item.security_type!=='COMMON_STOCK' || item.classification_verified!==true || typeof item.code!=='string' || !item.code) throw new Error('INVALID_SECURITY_CLASSIFICATION');
    if(seen.has(item.code)) throw new Error('DUPLICATE_SECURITY');
    seen.add(item.code);
  }
  const mb=snapshot.market_opening_breadth;
  if (!mb || mb.scope!=='TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN') throw new Error('MARKET_OPENING_BREADTH_SCOPE');
  if (mb.source_date!==snapshot.target_date) throw new Error('MARKET_OPENING_BREADTH_DATE_MISMATCH');
  assertNum(mb,['advancers','decliners','unchanged','limit_up','limit_down','no_trade','no_comparison'],'market_opening_breadth');
  for(const k of ['advancers','decliners','unchanged','limit_up','limit_down','no_trade','no_comparison']) if(!Number.isInteger(mb[k])||mb[k]<0) throw new Error('MARKET_OPENING_BREADTH_COUNT');
  if (!Array.isArray(mb.source_manifest) || !mb.source_manifest.length) throw new Error('MISSING_MARKET_OPENING_BREADTH_PROVENANCE');
  for(const source of mb.source_manifest) {
    if(source.source_date!==snapshot.target_date || source.market_scope!=='TWSE' || source.verified!==true || !source.source_name || !/^[a-f0-9]{64}$/.test(source.sha256||'')) throw new Error('INVALID_MARKET_OPENING_BREADTH_PROVENANCE');
  }
  for(const [group,data] of Object.entries(snapshot.institutional || {})) {
    if (!['foreign','investment_trust','dealers'].includes(group)) throw new Error('UNKNOWN_INSTITUTION');
    assertNum(data,['buy_twd','sell_twd','net_twd'],'institutional.'+group);
    if (Math.abs(data.buy_twd-data.sell_twd-data.net_twd)>1) throw new Error('INSTITUTIONAL_NET_MISMATCH:'+group);
    if (data.unit!=='TWD' || data.market_scope!=='TWSE') throw new Error('INSTITUTIONAL_UNIT_OR_SCOPE:'+group);
  }
  return {ok:true,target_date:snapshot.target_date,market:'TWSE'};
}
function main(argv=process.argv.slice(2)) {
  const [date]=argv;
  assertDate(date);
  if(argv.length!==1) throw new Error('USAGE: node scripts/validate_daily_gainers_market_opening.js YYYYMMDD');
  const file=path.resolve(__dirname,'../data_daily_gain_over_5/market-opening-video',date+'.json');
  if(!fs.existsSync(file)) throw new Error('OPENING_SNAPSHOT_MISSING:'+file);
  const result=validateOpeningSnapshot(JSON.parse(fs.readFileSync(file,'utf8')));
  if(result.target_date!==date) throw new Error('OPENING_TARGET_DATE_MISMATCH');
  console.log(JSON.stringify({...result,status:'PASS',path:path.relative(path.resolve(__dirname,'..'),file)}));
  return result;
}
if(require.main===module){try{main();}catch(error){console.error('MARKET_OPENING_VALIDATION_FAILED:'+error.message);process.exitCode=1;}}
module.exports={validateOpeningSnapshot,main};
