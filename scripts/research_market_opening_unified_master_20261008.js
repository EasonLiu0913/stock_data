'use strict';
// Research-only unified consumer snapshot; never promotes editorial/publication status.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {parse}=require('./parse_twse_official_stock_aggregate');
const {verify}=require('./verify_bfi82u_three_groups_20261008_readonly');
const date='20261008';
function build(base,mi,official){
 assert.equal(base.target_date,date);assert.equal(base.market,'TWSE');assert.equal(base.status,'partial');
 const b=parse(mi,date),v=official.institutional;
 for(const name of ['foreign','investment_trust','dealers']){
  assert.equal(base.institutional[name].source_date,date);
  for(const key of ['buy_twd','sell_twd','net_twd'])assert.equal(base.institutional[name][key],v[name][key],'MASTER_BFI82U_'+name+'_'+key);
 }
 const t=base.market_trading;assert.ok(Number.isFinite(t.turnover_twd)&&t.turnover_twd>0);
 assert.ok(Number.isFinite(t.turnover_ma5_twd)&&t.turnover_ma5_twd>0);
 assert.equal(t.turnover_ma5_definition,'previous 5 TWSE trading days (excluding target)');
 const identity_evidence={status:'UNVERIFIED',source_scope:b.scope,official_stock_column_denominator:b.eligible_count,as_of_common_stock_roster_sha256:null,per_security_reconciliation_sha256:null,certified_common_stock_denominator:null,reason:'MI_INDEX 股票 aggregate cannot certify as-of per-security ordinary-share identities'};
 const direction=b.advancers-b.decliners;
 // Descriptive evidence, not an investment recommendation or certified editorial verdict.
 const regime={classification:'RESEARCH_ONLY',index_change_pct:base.taiex.change_pct,advancers:b.advancers,decliners:b.decliners,advance_decline_difference:direction,turnover_ratio_ma5:t.turnover_twd/t.turnover_ma5_twd,net_institutional_twd:v.total.net_twd,assessment:base.taiex.change_pct<0&&direction<0&&v.total.net_twd<0?'THREE_SIGNALS_WEAK':base.taiex.change_pct>0&&direction>0&&v.total.net_twd>0?'THREE_SIGNALS_STRONG':'MIXED',method:'Index direction + official stock-column advance/decline direction + BFI82U total net; descriptive three-signal agreement only'};
 return {schema_version:1,target_date:date,market:'TWSE',status:'research_partial',publication_authorized:false,editorial_complete:false,taiex:base.taiex,market_trading:t,breadth:{scope:'TWSE_OFFICIAL_STOCK_COLUMN',rising_count:b.advancers,falling_count:b.decliners,unchanged_count:b.unchanged,limit_up_count:b.limit_up_count,limit_down_count:b.limit_down_count,no_trade_count:b.no_trade_count,no_comparison_count:b.no_comparison_count,denominator:b.eligible_count,verified_twse_common_stock_only:false,identity_evidence},institutional:v,market_regime:regime,source_evidence:{mi_index:'data_twse_mi_index/20261008_twse_mi_index.json',bfi82u_raw_sha256:official.raw_sha256,base:'data_daily_gain_over_5/market-opening/20261008.json'},consumer_contract:'All preview narration, captions and cards must use this one snapshot; do not independently recompute',missing:['certified common-stock breadth','sector flows','editorial gate']};
}
if(require.main===module){
 const base=JSON.parse(fs.readFileSync('data_daily_gain_over_5/market-opening/'+date+'.json'));
 const mi=JSON.parse(fs.readFileSync('data_twse_mi_index/'+date+'_twse_mi_index.json'));
 const prefix='data_research/twse-market-opening/primary-archive/20261008/20261008-bfi82u';
 const verified=verify(fs.readFileSync(prefix+'.json'),JSON.parse(fs.readFileSync(prefix+'.manifest.json')));
 const result=build(base,mi,verified);
 fs.mkdirSync('/tmp/video-recovery-proof',{recursive:true});
 fs.writeFileSync('/tmp/video-recovery-proof/market-opening-unified-research-master.json',JSON.stringify(result,null,2)+'\n');
 console.log('UNIFIED_RESEARCH_MASTER_PASS '+result.market_regime.assessment+'; editorial_complete=false');
}
module.exports={build};
