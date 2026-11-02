#!/usr/bin/env node
'use strict';
// 20261013 isolated research-only 20-stock deterministic analysis candidate.
// This is an editorial review input, NEVER a publishable analysis/20...json.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=(root,p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const date='20261013';
const fmt=n=>Number(n).toLocaleString('en-US');
function change(n,label){
 if(!Number.isFinite(Number(n))||n===null||n===undefined)return label+'未取得紀錄';
 if(Number(n)>0)return label+'買超'+fmt(n)+'張';
 if(Number(n)<0)return label+'賣超'+fmt(Math.abs(n))+'張';
 return label+'淨額持平';
}
function margin(n){
 if(n==null||!Number.isFinite(Number(n)))return '融資無可靠紀錄';
 if(Number(n)>0)return '融資增加'+fmt(n)+'張';
 if(Number(n)<0)return '融資減少'+fmt(Math.abs(n))+'張';
 return '融資持平';
}
function draft(root){
 const raw=read(root,'data_daily_gain_over_5/20261013.json');
 const facts=read(root,'data_daily_gain_over_5/analysis-facts/20261013.json');
 const gate=read(root,'research-mvp10-20261013-staging.json');
 if(raw.target_date!==date||facts.target_date!==date||raw.stock_count!==20||
   !Array.isArray(raw.stocks)||raw.stocks.length!==20||
   facts.stock_count!==20||!Array.isArray(facts.stocks)||facts.stocks.length!==20||
   gate.provisional_stock_count!==20||gate.analysis_final_rebuilt!==false||
   gate.render_authorized!==false||gate.source_date_classification_certified!==false)
   throw Error('INVALID_PROVISIONAL_20_STOCK_SOURCE');
 const rawCodes=raw.stocks.map(x=>String(x.code));
 const factCodes=facts.stocks.map(x=>String(x.code));
 if(JSON.stringify(rawCodes)!==JSON.stringify(factCodes)||new Set(rawCodes).size!==20)
   throw Error('STOCK_ORDER_OR_IDENTITY_MISMATCH');
 if(rawCodes.some(x=>['1312A','6645','6924','7730','9103'].includes(x)))throw Error('NONORDINARY_SECURITY_IN_ANALYSIS');
 const rows=raw.stocks.map((s,i)=>{
  const f=facts.stocks[i],p=f.price||{},fl=f.flow||{},tech=f.technical||{};
  if(s.name!==f.name||p.change_pct!==s.change_pct||p.close!==s.close||
    p.volume!==s.volume)throw Error('FACTS_PRICE_DISAGREEMENT:'+s.code);
  if(!Number.isFinite(Number(s.change_pct))||s.change_pct<5)throw Error('INVALID_GAIN:'+s.code);
  const foreign=change(fl.foreign?.net_lots,'外資');
  const trust=change(fl.investment_trust?.net_lots,'投信');
  const dealer=change(fl.dealer?.net_lots,'自營商');
  const branch=change(fl.broker?.totals?.net,'分點統計');
  const leverage=margin(fl.margin?.margin_delta);
  const technical=Number.isFinite(Number(tech.volume_ratio_vs_previous))&&tech.volume_ratio_vs_previous!=null?
    '量比前日'+Number(tech.volume_ratio_vs_previous).toFixed(2)+'倍':'量比未取得';
  const why='當日股價上漲並不足以證明公司消息；尚無重新核准的個股事件因果證據。';
  return {
   code:String(s.code),name:s.name,change_pct:s.change_pct,
   cause_type:'unknown',cause_tags:[],evidence_strength:'none',
   confidence:'low',
   reason_summary:why+'籌碼：'+[foreign,trust,dealer,leverage,branch].join('、')+'。技術：'+technical+'。隔日仍須檢查量價和法人延續性。',
   evidence:[
    'DATED_SOURCE_PRICE: '+s.code+' '+s.name+'; close='+s.close+'; change_pct='+s.change_pct+'; volume_lots='+s.volume,
    'DETERMINISTIC_FLOW: '+[foreign,trust,dealer,leverage,branch].join('; '),
    'DETERMINISTIC_TECHNICAL: '+technical
   ],
   flow:fl,technical:tech,
   follow_up:['隔日重新核對公司正式公告與產業證據','檢查外資、投信、自營商與分點的買賣方向','核對融資變化、成交量與價格承接'],
   sources:[],
   research_editorial_status:'SOURCE_REVIEW_REQUIRED',
   independently_verified_causal_claim:false,
   prior_25_stock_narrative_reused:false
  };
 });
 const result={
  schema_version:2,methodology_version:'daily-gainers-unified-analysis-v2',
  contract_version:3,contract_policy:'latest-rules-only',
  target_date:date,previous_date:raw.previous_date,
  generated_at:null,
  source_list_file:'data_daily_gain_over_5/20261013.json',
  source_facts_file:'data_daily_gain_over_5/analysis-facts/20261013.json',
  source_ai_file:null,ignored_ai_file:'source 25-stock AI narratives not imported',
  ignored_ai_reason:'unreviewed causal claims and changed common-stock universe',
  generation_mode:'RESEARCH_DETERMINISTIC_CANDIDATE_NOT_PUBLISHED',
  stock_count:20,analyses:rows,
  market_context:{gainer_count:20,source_status:'research_unverified_ordinary_effective_date'},
  market_summary:{summary:'20 檔上市普通股候選的日期化量價及籌碼研究；公司事件原因尚無重審認證。',common_flow_clues:[]},
  priority_watchlist:[],
  research_only:true,original_published_analysis_rewritten:false,
  editorial_approval:false,source_effective_date_classification_certified:false,
  original_final_validator_pass:false,summary_final:false,
  render_authorized:false,publication_authorized:false
 };
 const review={
  target_trade_date:date,source_candidate_count:20,
  original_25_stock_causality_transferred:0,
  candidate_entries_without_causes:rows.filter(r=>r.cause_type==='unknown'&&r.evidence_strength==='none'&&r.sources.length===0).length,
  source_raw_sha256:sha(path.join(root,'data_daily_gain_over_5/20261013.json')),
  source_facts_sha256:sha(path.join(root,'data_daily_gain_over_5/analysis-facts/20261013.json')),
  stock_codes:rawCodes, all_issuer_causes_editorial_approved:false,
  date_effective_classification_certified:false,
  original_final_validator_pass:false,render_authorized:false,publication_authorized:false,
  decision:'CANDIDATE_DETERMINISTIC_20_STOCK_NEEDS_HUMAN_OR_EDITORIAL_AND_SOURCE_REVIEW'
 };
 if(review.candidate_entries_without_causes!==20)throw Error('UNSAFE_CAUSE_PROMOTION');
 return {candidate:result,review};
}
if(require.main===module){
 const [root,out]=process.argv.slice(2);
 if(!root||!out)throw Error('Usage: node draft_mvp10_20261013_20stock_analysis.js STAGE_ROOT NEW_OUTPUT_DIR');
 if(fs.existsSync(out))throw Error('OUTPUT_ALREADY_EXISTS');
 const result=draft(root);fs.mkdirSync(out,{recursive:true});
 for(const [name,v]of [['20261013-20stock-analysis-candidate.json',result.candidate],
   ['20261013-20stock-analysis-review.json',result.review]])
  fs.writeFileSync(path.join(out,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({stocks:20,causal_claims_promoted:0,source_review_required:true,render_authorized:false}));
}
module.exports={draft};
