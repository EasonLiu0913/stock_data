#!/usr/bin/env node
'use strict';
// Independently recompute provisional date-aligned aggregate arithmetic from
// isolated per-security records, NOT a published analysis or approved source.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {make}=require('./research_mvp10_isolated_candidate_workspace');
const SHA=b=>crypto.createHash('sha256').update(b).digest('hex');
const round=(n,d=1)=>Math.round((n+Number.EPSILON)*10**d)/10**d;
const SOURCE=['raw','facts','news','ai','published'];
function calculate(dir,taxonomy){
 const m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 if(m.target_date!=='20261008'||m.decision!=='CANDIDATE_INPUT_ONLY_NOT_RENDERABLE'||
    m.video_render_authorized!==false||m.publication_authorized!==false||
    m.all_aggregate_statistics_invalidated!==true||m.stock_identity_scope_certified!==false)
   throw Error('UNSAFE_CANDIDATE_MANIFEST');
 const sets={};
 for(const k of SOURCE){
  const p=path.join(dir,k+'-row-candidates.json'),b=fs.readFileSync(p),expected=m.row_candidate_receipts[k];
  if(!expected||SHA(b)!==expected.sha256)throw Error('CANDIDATE_ROW_DIGEST_MISMATCH:'+k);
  const j=JSON.parse(b);
  if(j.target_date!==m.target_date||j.canonical_daily_video_input!==false||
     j.record_carry_forward_status!=='UNVERIFIED_REQUIRES_NEW_SOURCE_RECONCILIATION'||
     j.source_sha256!==m.source_sha256[k].sha256||j.records.length!==m.provisional_stock_count||
     JSON.stringify(j.records.map(x=>String(x.code)))!==JSON.stringify(m.code_order))
    throw Error('CANDIDATE_ROW_ALIGNMENT:'+k);
  sets[k]=j.records;
 }
 const byCode=Object.fromEntries(SOURCE.map(k=>[k,new Map(sets[k].map(x=>[String(x.code),x]))]));
 const aliases=new Map();
 for(const t of taxonomy.themes||[])for(const a of [t.id,...(t.aliases||[])])
  aliases.set(String(a).toLowerCase(),t.id);
 const groups=new Map(),catalyst={direct:0,corroborated:0,circumstantial:0,none:0,unavailable:0};
 const fund={institutional_positive:0,institutional_negative:0,institutional_unknown:0,
  margin_increase:0,margin_decrease:0,margin_unchanged:0,margin_unknown:0};
 const price={gain_5_to_7_count:0,gain_7_to_9_5_count:0,gain_9_5_plus_count:0};
 for(const row of sets.raw){
  const code=String(row.code),f=byCode.facts.get(code),a=byCode.published.get(code);
  if(!f||!a||!byCode.news.has(code)||!byCode.ai.has(code))throw Error('MISSING_SECURITY_CHAIN:'+code);
  const gain=Number(row.change_pct);
  if(!Number.isFinite(gain)||gain<5||Number(f.price?.change_pct)!==gain||
     Number(a.change_pct)!==gain||String(f.name)!==String(row.name)||String(a.name)!==String(row.name))
    throw Error('PRICE_OR_IDENTITY_SOURCE_CONFLICT:'+code);
  if(gain<7)price.gain_5_to_7_count++;
  else if(gain<9.5)price.gain_7_to_9_5_count++;
  else price.gain_9_5_plus_count++;
  const strength=String(a.evidence_strength);
  if(!Object.hasOwn(catalyst,strength))throw Error('UNKNOWN_EVIDENCE_STRENGTH:'+code);
  catalyst[strength]++;
  let theme=null;
  for(const v of [a.primary_theme,...(a.theme_tags||[]),...(a.cause_tags||[])]){
   const t=aliases.get(String(v).toLowerCase());if(t){theme=t;break}
  }
  if(theme){if(!groups.has(theme))groups.set(theme,[]);groups.get(theme).push({code,gain})}
  const ff=a.flow||{},nets=['foreign','investment_trust','dealer'].map(k=>ff[k]?.net_lots).filter(x=>Number.isFinite(x));
  if(!nets.length)fund.institutional_unknown++;
  else{
   const sum=nets.reduce((s,v)=>s+v,0);
   if(sum>0)fund.institutional_positive++;
   else if(sum<0)fund.institutional_negative++;
  }
  const margin=ff.margin?.margin_delta;
  if(!Number.isFinite(margin))fund.margin_unknown++;
  else if(margin>0)fund.margin_increase++;
  else if(margin<0)fund.margin_decrease++;
  else fund.margin_unchanged++;
 }
 const total=sets.raw.length,biotech=sets.raw.filter(r=>(byCode.published.get(String(r.code)).cause_tags||[]).includes('biotech'));
 const publicCount=catalyst.direct+catalyst.corroborated;
 const themeRanking=[...groups.entries()].map(([id,rows])=>({
  theme_id:id,stock_count:rows.length,avg_gain_pct:round(rows.reduce((s,r)=>s+r.gain,0)/rows.length,2),
  stock_codes:rows.map(r=>r.code)
 })).sort((a,b)=>b.stock_count-a.stock_count||b.avg_gain_pct-a.avg_gain_pct);
 const stockSignals={candidate_9919:null};
 if(byCode.raw.has('9919')){
  const row=byCode.raw.get('9919'),pub=byCode.published.get('9919'),facts=byCode.facts.get('9919');
  if(Number(row.close)!==Number(facts.price?.close)||
     pub.flow?.foreign?.net_lots!==facts.flow?.foreign?.net_lots||
     pub.flow?.margin?.margin_delta!==facts.flow?.margin?.margin_delta)
    throw Error('9919_FACTS_ANALYSIS_CONFLICT');
  stockSignals.candidate_9919={code:'9919',name:row.name,close:row.close,change_pct:row.change_pct,
   volume:row.volume,foreign_net_lots:facts.flow.foreign.net_lots,margin_delta_lots:facts.flow.margin.margin_delta,
   order_or_sales_catalyst_reverified:false};
 }
 const result={schema_version:1,scope:'RESEARCH_ONLY',target_date:m.target_date,scenario:m.scenario,
  source_manifest_sha256:SHA(fs.readFileSync(path.join(dir,'manifest.json'))),
  stock_count:total,price_bands:price,
  catalyst_counts:catalyst,reported_public_evidence_count:publicCount,
  reported_public_evidence_coverage_pct:round(publicCount/total*100,1),
  theme_ranking:themeRanking,
  biotech_cause_tag_stocks:biotech.map(x=>String(x.code)),
  biotech_cause_tag_mean_gain_pct:round(biotech.reduce((s,x)=>s+Number(x.change_pct),0)/biotech.length,2),
  funding_legacy_record_signals:fund,illustrative_stock_9919:stockSignals.candidate_9919,
  semantic_evidence_reverified:false,institutional_external_source_reverified:false,
  date_effective_stock_type_reverified:false,complete_final_analysis:false,
  market_summary_final:false,render_authorized:false,publication_authorized:false,
  decision:'RECALCULATED_RESEARCH_AGGREGATES_UNVERIFIED',
  required_next_gate:'Independent date-effective security type plus per-source semantic facts and rebuilt final analysis before canonical market summary or video script'
 };
 if(price.gain_5_to_7_count+price.gain_7_to_9_5_count+price.gain_9_5_plus_count!==total||
    Object.values(catalyst).reduce((s,x)=>s+x,0)!==total||
    fund.institutional_positive+fund.institutional_negative+fund.institutional_unknown>total ||
    Object.values(result).some(x=>x===Infinity||Number.isNaN(x)))
   throw Error('AGGREGATE_DENOMINATOR_INVALID');
 return result;
}
function run(root,out){
 if(fs.existsSync(out))throw Error('RESEARCH_WORKSPACE_EXISTS');
 const candidate=make(root,out),taxonomy=JSON.parse(fs.readFileSync(path.join(root,'config/daily-gainers-theme-taxonomy.json')));
 const reports=[];
 for(const x of candidate.outputs){
  const dir=path.join(out,x.scenario),data=calculate(dir,taxonomy);
  const report=path.join(dir,'recalculated-aggregate-research.json');
  const bytes=Buffer.from(JSON.stringify(data,null,2)+'\n');
  fs.writeFileSync(report,bytes,{flag:'wx'});
  reports.push({scenario:x.scenario,stock_count:data.stock_count,
   evidence_count:data.reported_public_evidence_count,
   coverage_pct:data.reported_public_evidence_coverage_pct,
   aggregate_sha256:SHA(bytes),render_authorized:false});
 }
 return reports;
}
if(require.main===module){
 try{
  const [root,out]=process.argv.slice(2);
  if(!root||!out)throw Error('Usage: node scripts/research_mvp10_candidate_aggregate.js ROOT NEW_TEMP_PATH');
  console.log(JSON.stringify(run(root,out),null,2));
 }catch(e){console.error(e.stack||e.message);process.exitCode=1}
}
module.exports={calculate,run};
