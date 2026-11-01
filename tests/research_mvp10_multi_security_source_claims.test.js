'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {verify}=require('../scripts/research_mvp10_multi_security_source_claims');
const codes=['6672','2305','1301','3416','2428'];
test('five surviving 20261008 company scenes source cross-check against official dated files',()=>{
  for(const code of codes){
    const r=verify(process.cwd(),code);
    assert.equal(r.code,code);
    assert.equal(r.target_date,'20261008');
    assert.equal(r.render_authorized,false);
    assert.equal(r.external_news_catalyst_verified,false);
    assert(r.official_close>0);
    assert(Number.isFinite(r.margin.delta));
  }
});
test('independent check retains earlier verified 9919 result',()=>{
  const r=verify(process.cwd(),'9919');
  assert.equal(r.official_close,16.1);
  assert.equal(r.margin.delta,-327);
  assert.equal(r.institutional.foreign.net_shares,-18000);
});
test('unknown code and official wrong-date entry fail closed',()=>{
  assert.throws(()=>verify(process.cwd(),'0000'),/STOCK_IDENTITY_NOT_FOUND/);
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-multi-audit-'));
  const files=[
    'data_daily_gain_over_5/20261008.json','data_daily_gain_over_5/analysis-facts/20261008.json',
    'data_daily_gain_over_5/analysis/20261008.json','data_twse_mi_index/20261008_twse_mi_index.json',
    'data_twse_foreign_investors/20261008_twse_foreign_investors.json',
    'data_twse_investment_trust/20261008_twse_investment_trust.json',
    'data_twse_dealers/20261008_twse_dealers.json',
    'data_twse_margin_balance/20261008_twse_margin_balance.csv'];
  try{
    for(const f of files){const dst=path.join(tmp,f);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(f,dst)}
    const f=path.join(tmp,'data_twse_mi_index/20261008_twse_mi_index.json');
    const r=JSON.parse(fs.readFileSync(f));r.date='20261007';fs.writeFileSync(f,JSON.stringify(r));
    assert.throws(()=>verify(tmp,'6672'),/MI_DATE_OR_STATUS/);
  }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
