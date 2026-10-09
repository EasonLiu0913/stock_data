'use strict';
// Pure, network-free data contract gate for the TWSE-only market-opening snapshot.
// Do not use string-length heuristics to determine security type.
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
  if (snapshot.schema_version !== 1) throw new Error('SCHEMA_VERSION');
  if (!Array.isArray(snapshot.source_manifest) || !snapshot.source_manifest.length) throw new Error('MISSING_PROVENANCE');
  for(const source of snapshot.source_manifest) {
    if (source.source_date !== snapshot.target_date) throw new Error('SOURCE_DATE_MISMATCH:'+source.source_name);
    if (source.market_scope !== 'TWSE') throw new Error('SOURCE_MARKET_MISMATCH:'+source.source_name);
    if (source.verified !== true) throw new Error('UNVERIFIED_SOURCE:'+source.source_name);
    if (!source.unit || !source.source_name) throw new Error('SOURCE_METADATA_MISSING');
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
  if (b.advancers+b.decliners+b.unchanged>b.eligible_count || b.gainers_5pct_count>b.advancers) throw new Error('BREADTH_INCONSISTENT');
  if (!Array.isArray(b.identities) || b.identities.length!==b.eligible_count) throw new Error('MISSING_CLASSIFIED_UNIVERSE');
  const seen = new Set();
  for(const item of b.identities) {
    if (item.market!=='TWSE' || item.security_type!=='COMMON_STOCK' || item.classification_verified!==true || typeof item.code!=='string' || !item.code) throw new Error('INVALID_SECURITY_CLASSIFICATION');
    if(seen.has(item.code)) throw new Error('DUPLICATE_SECURITY');
    seen.add(item.code);
  }
  for(const [group,data] of Object.entries(snapshot.institutional || {})) {
    if (!['foreign','investment_trust','dealers'].includes(group)) throw new Error('UNKNOWN_INSTITUTION');
    assertNum(data,['buy_twd','sell_twd','net_twd'],'institutional.'+group);
    if (Math.abs(data.buy_twd-data.sell_twd-data.net_twd)>1) throw new Error('INSTITUTIONAL_NET_MISMATCH:'+group);
    if (data.unit!=='TWD' || data.market_scope!=='TWSE') throw new Error('INSTITUTIONAL_UNIT_OR_SCOPE:'+group);
  }
  return {ok:true,target_date:snapshot.target_date,market:'TWSE'};
}
module.exports={validateOpeningSnapshot};
