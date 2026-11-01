#!/usr/bin/env node
'use strict';
// Evidence-quality audit of all 32 provisional Stock-category securities.
// This is NOT company-filing verification and cannot upgrade final/complete.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verify}=require('./research_mvp10_multi_security_source_claims');
const {readCsv}=require('./research_mvp10_dated_universe_classification');
const DATE='20261008',CODE_NOT_COMMON='9103';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function open(root,p){const b=fs.readFileSync(path.join(root,p));if(!b.length)throw Error('EMPTY_SOURCE:'+p);return {value:JSON.parse(b),sha256:hash(b)}}
function audit(root){
 const input={
  raw:open(root,'data_daily_gain_over_5/'+DATE+'.json'),
  news:open(root,'data_daily_gain_over_5/analysis-news/'+DATE+'.json'),
  published:open(root,'data_daily_gain_over_5/analysis/'+DATE+'.json'),
  ai:open(root,'data_daily_gain_over_5/analysis-ai/'+DATE+'.json')
 };
 for(const [kind,obj] of Object.entries(input)){
  if(obj.value.target_date!==DATE||obj.value.stock_count!==35)throw Error('FROZEN_SOURCE_CHANGED:'+kind);
 }
 const maps={};
 for(const cat of ['Stock','InnovationBoard','TDR','ETF']){
  const p=path.join(root,'data_twse','twse_industry_'+cat+'.csv');
  maps[cat]=readCsv(fs.readFileSync(p),cat);
 }
 const news=new Map(input.news.value.analyses.map(s=>[String(s.code),s]));
 const analysis=new Map(input.published.value.analyses.map(s=>[String(s.code),s]));
 const ai=new Map(input.ai.value.analyses.map(s=>[String(s.code),s]));
 const selected=input.raw.value.stocks.filter(s=>maps.Stock.has(String(s.code)));
 const codes=selected.map(s=>String(s.code));
 if(codes.length!==32||input.raw.value.stocks.find(s=>s.code===CODE_NOT_COMMON)?.name!=='美德醫療-DR'||
    codes.includes(CODE_NOT_COMMON))throw Error('RESEARCH_SCOPE_DRIFT');
 const auditRows=[];
 for(const s of selected){
  const code=String(s.code),p=analysis.get(code),n=news.get(code),a=ai.get(code);
  if(!p||!n||!a||s.name!==maps.Stock.get(code)||p.name!==s.name||n.name!==s.name)
   throw Error('SOURCE_NAME_OR_ALIGNMENT_DRIFT:'+code);
  const matchSources=(p.sources||[]).map(source=>{
   let u;try{u=new URL(source.url)}catch(e){return {title:source.title,url:source.url,quality:'INVALID_URL',date:source.published_at||null}}
   const host=u.hostname.toLowerCase(),pub=source.published_at||null;
   const dated=pub && !Number.isNaN(Date.parse(pub)) && Date.parse(pub)<=Date.parse('2026-10-08T23:59:59+08:00');
   const isPrimary=/(^|\.)(twse\.com\.tw|mopsov\.twse\.com\.tw|mops\.twse\.com\.tw|tpex\.org\.tw)$/.test(host);
   const genericPath=/^\/(?:\d{4,6})\/?$/.test(u.pathname);
   return {title:source.title,url:source.url,claimed_publish_date:pub,
    quality:!dated?'UNVERIFIED_OR_POSTDATE':genericPath?'GENERIC_UNDATED_PROFILE':
     isPrimary?'PRIMARY_EXCHANGE_URL_UNREAD':'SECONDARY_ARTICLE_UNREAD',
    content_independently_fetched_and_verified:false};
  });
  const strong=['direct','corroborated'].includes(p.evidence_strength);
  const mismatch=n.evidence_strength!==p.evidence_strength||a.evidence_strength!==p.evidence_strength;
  let check;
  try{
   const v=verify(root,code);
   check={status:'NUMERIC_SOURCE_RECONCILED',price:v.official_close,foreign_net_shares:v.institutional.foreign.net_shares,
    margin_delta:v.margin.delta,source_count:Object.keys(v.source_sha256).length};
  }catch(e){check={status:'NUMERIC_SOURCE_CONFLICT',error:String(e.message).slice(0,360)}}
  auditRows.push({code,name:s.name,
   evidence_strength:p.evidence_strength,dated_news_source_count:matchSources.length,
   source_quality:matchSources,
   strong_claim_using_only_secondary_or_generic:strong&&matchSources.length>0&&
    matchSources.every(x=>['SECONDARY_ARTICLE_UNREAD','GENERIC_UNDATED_PROFILE'].includes(x.quality)),
   source_strength_conflict:mismatch,official_numeric_crosscheck:check,
   event_caused_price_rise_verified:false,company_event_primary_filing_verified:false,
   publisher_historical_security_category_effective_on_date_verified:false});
 }
 const count=k=>auditRows.filter(x=>x.official_numeric_crosscheck.status===k).length;
 const stronger=auditRows.filter(x=>['direct','corroborated'].includes(x.evidence_strength));
 const report={
  schema_version:1,target_date:DATE,scope:'RESEARCH_ONLY_32_STOCK_STRENGTH_AUDIT',
  original_list_count:35,provisional_stock_count:32,
  matched_official_numeric_claim_count:count('NUMERIC_SOURCE_RECONCILED'),
  original_numeric_claim_conflict_count:count('NUMERIC_SOURCE_CONFLICT'),
  strong_claims_count:stronger.length,
  strong_claims_with_only_unread_secondary_or_generic_links:stronger.filter(x=>x.strong_claim_using_only_secondary_or_generic).length,
  primary_company_disclosure_document_content_verified_count:0,
  source_strength_conflict_count:auditRows.filter(x=>x.source_strength_conflict).length,
  confirmed_original_2305_name:input.raw.value.stocks.find(s=>s.code==='2305')?.name,
  expected_2305_name:'全友',
  source_sha256:Object.fromEntries(Object.entries(input).map(([k,x])=>[k,x.sha256])),
  stock_rows:auditRows,
  historical_stock_type_verified:false,
  complete_published_ai_semantics_verified:false,
  company_event_causation_verified:false,
  market_summary_final:false,render_authorized:false,publication_authorized:false,
  decision:'NUMERIC_AUDIT_WITH_UNRESOLVED_SOURCE_CLAIMS',
  next_required_evidence:'Original dated security identity and primary company event filings for strong causal statements; replace unverified claims before original final/complete market-summary gate'
 };
 if(report.confirmed_original_2305_name!=='全友'||stronger.length!==11||
    report.source_strength_conflict_count)throw Error('UNEXPECTED_FROZEN_IDENTITY_OR_STRENGTH:'+report.confirmed_original_2305_name);
 return report;
}
if(require.main===module){try{console.log(JSON.stringify(audit(process.argv[2]||process.cwd()),null,2))}
catch(e){console.error(e.stack||e.message);process.exitCode=1}}
module.exports={audit};
