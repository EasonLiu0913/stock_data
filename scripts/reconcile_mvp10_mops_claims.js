#!/usr/bin/env node
'use strict';
// Research-only semantic bridge. Revenue figures are facts, never proof of a price catalyst.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const CODES={
  '2305':{name:'全友',revenue:196565,yoy:212.80,source:'domestic'},
  '3416':{name:'融程電',revenue:534569,yoy:95.90,source:'domestic'},
  '6672':{name:'騰輝電子-KY',revenue:1020897,yoy:201.68,source:'foreign'}
};
const expectedUrls={
  domestic:'https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_115_9_0.html',
  foreign:'https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_115_9_1.html'
};
function reconcile(receipt,published){
  assert.equal(receipt.research_only,true);
  assert.equal(receipt.target_trade_date,'20261008');
  assert.equal(receipt.official_source_period,'ROC115/09');
  assert.equal(receipt.official_table_columns_verified,true);
  assert.equal(receipt.company_event_caused_market_movement_verified,false);
  assert.equal(receipt.render_authorized,false);
  assert.equal(receipt.publication_authorized,false);
  assert.equal(published.target_date,'20261008');
  assert.equal(published.stock_count,35);
  assert.equal(published.analyses.length,35);
  const pages=receipt.pages||[];
  assert.equal(pages.length,2);
  for(const [kind,url] of Object.entries(expectedUrls)){
    const p=pages.find(x=>x.url===url);
    assert.ok(p,'official page missing: '+kind);
    assert.equal(p.http_status,200);
    assert.match(p.response_sha256||'',/^[a-f0-9]{64}$/);
    assert.ok(p.response_length>1000);
    assert.equal(p.error,null);
  }
  const byCode=new Map(published.analyses.map(x=>[String(x.code),x]));
  assert.equal(byCode.size,35);
  const validated=(receipt.official_revenue_claims_validated||[]).map(String).sort();
  assert.deepEqual(validated,Object.keys(CODES).sort());
  const allowed=[];
  for(const [code,spec] of Object.entries(CODES)){
    const original=byCode.get(code),r=receipt.official_column_proof?.[code];
    assert.ok(original,'missing published code '+code);
    assert.equal(original.name,spec.name);
    assert.equal(r?.verified,true);
    assert.equal(r.company_name,spec.name);
    assert.equal(r.revenue_thousand_ntd,spec.revenue);
    assert.equal(r.official_yoy_pct,spec.yoy);
    const url=expectedUrls[spec.source];
    const page=pages.find(x=>x.url===url);
    assert.ok(page.target_rows?.[code],'official dated row absent '+code);
    const rows=pages.filter(p=>p.target_rows?.[code]);
    assert.equal(rows.length,1,'duplicate company across official pages');
    allowed.push({code,name:spec.name,source_url:url,source_period:'2026-09',
      revenue_thousand_ntd:spec.revenue,year_on_year_percent:spec.yoy,
      assertion_type:'ISSUER_REPORTED_REVENUE_FACT_ONLY',
      historical_market_price_causation_verified:false,
      original_legacy_evidence_strength:original.evidence_strength});
  }
  // No legacy direct/corroborated strength is inherited. All must be re-reviewed.
  const strong=published.analyses.filter(x=>['direct','corroborated'].includes(x.evidence_strength));
  assert.equal(strong.length,11,'frozen review scope changed');
  const unresolved=strong.filter(x=>!CODES[String(x.code)]).map(x=>({
    code:String(x.code),name:x.name,
    legacy_strength:x.evidence_strength,
    decision:'UNVERIFIED_COMPANY_EVENT_OR_CAUSATION_REQUIRES_REWRITE_OR_SOURCE_REVIEW'
  }));
  assert.equal(unresolved.length,8);
  return {
    schema_version:1,target_trade_date:'20261008',source_period:'2026-09',
    research_only:true,primary_revenue_facts:allowed,
    unresolved_legacy_strong_claims:unresolved,
    reviewed_legacy_strong_claim_count:strong.length,
    source_fact_validated_count:allowed.length,
    legacy_claims_remaining_review_count:unresolved.length,
    issuer_revenue_facts_are_price_catalysts:false,
    all_company_causal_statements_certified:false,
    published_analysis_rewritten:false,
    summary_final:false,render_authorized:false,publication_authorized:false,
    next_required_action:'Rebuild truthful 32-stock published analysis in isolated workspace; preserve ordinary-stock date gate, remove unsupported causal claims, rerun unchanged original validators.'
  };
}
if(require.main===module){
  if(process.argv.length!==5)throw Error('Usage: node reconcile_mvp10_mops_claims.js receipt.json original-published.json report.json');
  const result=reconcile(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),
    JSON.parse(fs.readFileSync(process.argv[3],'utf8')));
  fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({fact_count:result.source_fact_validated_count,
    unresolved:result.legacy_claims_remaining_review_count,
    render_authorized:result.render_authorized}));
}
module.exports={reconcile};
