'use strict';
// Pure, network-free data contract gate for the TWSE-only market-opening snapshot.
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
  if (snapshot.schema_version !== 3) throw new Error('SCHEMA_VERSION');
  if (snapshot.status!=='verified_official_market_aggregate') throw new Error('OPENING_NOT_COMPLETE');
  if (!Array.isArray(snapshot.source_manifest) || !snapshot.source_manifest.length) throw new Error('MISSING_PROVENANCE');
  for(const source of snapshot.source_manifest) {
    if (source.source_date !== snapshot.target_date) throw new Error('SOURCE_DATE_MISMATCH:'+source.source_name);
    if (source.market_scope !== 'TWSE') throw new Error('SOURCE_MARKET_MISMATCH:'+source.source_name);
    if (source.verified !== true) throw new Error('UNVERIFIED_SOURCE:'+source.source_name);
    if (!source.unit || !source.source_name) throw new Error('SOURCE_METADATA_MISSING');
    if (!/^[a-f0-9]{64}$/.test(source.sha256||'')) throw new Error('SOURCE_SHA256_INVALID:'+source.source_name);
  }
  assertNum(snapshot.index,['close','previous_close','change_points','change_pct'],'index');
  if (snapshot.index.previous_close <= 0) throw new Error('INVALID_PREVIOUS_CLOSE');
  const expected = (snapshot.index.close/snapshot.index.previous_close-1)*100;
  if (Math.abs(expected-snapshot.index.change_pct)>0.011) throw new Error('INDEX_PERCENT_MISMATCH');
  if (Math.abs(snapshot.index.close-snapshot.index.previous_close-snapshot.index.change_points)>0.011) throw new Error('INDEX_POINTS_MISMATCH');
  assertNum(snapshot.trading,['turnover_twd','shares','transactions','turnover_ma5_twd','turnover_ratio_ma5'],'trading');
  if (snapshot.trading.turnover_twd<0 || snapshot.trading.shares<0 || snapshot.trading.transactions<0 || snapshot.trading.turnover_ma5_twd<=0 || Math.abs(snapshot.trading.turnover_twd/snapshot.trading.turnover_ma5_twd-snapshot.trading.turnover_ratio_ma5)>0.0001) throw new Error('INVALID_TRADING_DATA');
  // Market-opening breadth is the official MI_INDEX "股票" column. It is not
  // represented as ordinary-stock-only breadth and has its own explicit scope.
  const mb=snapshot.market_opening_breadth;
  if (!mb || mb.scope!=='TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN') throw new Error('MARKET_OPENING_BREADTH_SCOPE');
  if (mb.source_date!==snapshot.target_date) throw new Error('MARKET_OPENING_BREADTH_DATE_MISMATCH');
  assertNum(mb,['advancers','decliners','unchanged','limit_up','limit_down','no_trade','no_comparison'],'market_opening_breadth');
  for(const k of ['advancers','decliners','unchanged','limit_up','limit_down','no_trade','no_comparison']) if(!Number.isInteger(mb[k])||mb[k]<0) throw new Error('MARKET_OPENING_BREADTH_COUNT');
  if(mb.eligible_count!==mb.advancers+mb.decliners+mb.unchanged+mb.no_trade+mb.no_comparison||mb.limit_up>mb.advancers||mb.limit_down>mb.decliners) throw new Error('MARKET_OPENING_BREADTH_INCONSISTENT');
  if (!Array.isArray(mb.source_manifest) || !mb.source_manifest.length) throw new Error('MISSING_MARKET_OPENING_BREADTH_PROVENANCE');
  for(const source of mb.source_manifest) {
    if(source.source_date!==snapshot.target_date || source.market_scope!=='TWSE' || source.verified!==true || !source.source_name || !/^[a-f0-9]{64}$/.test(source.sha256||'')) throw new Error('INVALID_MARKET_OPENING_BREADTH_PROVENANCE');
  }
  const inst=snapshot.institutional || {};
  if(inst.scope!=='TWSE_BFI82U_TWD'||inst.source_date!==snapshot.target_date) throw new Error('INSTITUTIONAL_SCOPE_OR_DATE');
  for(const group of ['foreign','investment_trust','dealers']) {
    const data=inst[group];
    if (!data) throw new Error('MISSING_INSTITUTION:'+group);
    assertNum(data,['buy_twd','sell_twd','net_twd'],'institutional.'+group);
    if (data.buy_twd-data.sell_twd!==data.net_twd) throw new Error('INSTITUTIONAL_NET_MISMATCH:'+group);
    if (data.unit!=='TWD' || data.market_scope!=='TWSE') throw new Error('INSTITUTIONAL_UNIT_OR_SCOPE:'+group);
  }
  assertNum(inst,['foreign_net_twd','investment_trust_net_twd','dealers_net_twd','total_net_twd'],'institutional');
  if(inst.foreign_net_twd!==inst.foreign.net_twd || inst.investment_trust_net_twd!==inst.investment_trust.net_twd || inst.dealers_net_twd!==inst.dealers.net_twd) throw new Error('INSTITUTIONAL_FLAT_NESTED_MISMATCH');
  if(inst.foreign_net_twd+inst.investment_trust_net_twd+inst.dealers_net_twd!==inst.total_net_twd) throw new Error('INSTITUTIONAL_TOTAL_MISMATCH');
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
