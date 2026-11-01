'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {verify}=require('../scripts/research_mvp10_9919_official_claim_gate');
test('9919 numeric claims are checked against separate dated quote, flows and margin source files',()=>{
 const r=verify(process.cwd());
 assert.equal(r.target_date,'20261008');
 assert.equal(r.code,'9919');
 assert.equal(r.render_authorized,false);
 assert.equal(r.date_effective_ordinary_identity_verified,false);
 assert.equal(r.external_news_catalyst_verified,false);
 assert.equal(r.margin.delta,-327);
 assert.equal(r.institutional.foreign.net_shares,-18000);
 assert(Object.keys(r.source_sha256).length>=7);
});
test('source-date mismatch rejects (rather than using previous-date fallback)',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-9919-'));
 const files=[
 'data_daily_gain_over_5/20261008.json','data_daily_gain_over_5/analysis-facts/20261008.json',
 'data_daily_gain_over_5/analysis/20261008.json','data_twse_mi_index/20261008_twse_mi_index.json',
 'data_twse_foreign_investors/20261008_twse_foreign_investors.json',
 'data_twse_investment_trust/20261008_twse_investment_trust.json',
 'data_twse_dealers/20261008_twse_dealers.json',
 'data_twse_margin_balance/20261008_twse_margin_balance.csv'];
 try{
  for(const p of files){fs.mkdirSync(path.dirname(path.join(tmp,p)),{recursive:true});fs.copyFileSync(p,path.join(tmp,p))}
  const p=path.join(tmp,'data_twse_foreign_investors/20261008_twse_foreign_investors.json');
  const j=JSON.parse(fs.readFileSync(p));j.date='20261007';fs.writeFileSync(p,JSON.stringify(j));
  assert.throws(()=>verify(tmp),/INSTITUTIONAL_DATE:foreign/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
