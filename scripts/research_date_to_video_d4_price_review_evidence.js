'use strict';
// Dated stock price review evidence. Crosscheck is not an independent editorial approval.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function inspect(root,date,codes){
 assert.match(date,/^20\d{6}$/);
 if(!codes.length){const candidate=JSON.parse(fs.readFileSync(path.join(root,'data_research/m5/ai-script-generation/'+date+'-d4-original-analysis-candidate.json')));assert.equal(candidate.target_date,date,'CANDIDATE_DATE_MISMATCH');codes=[...new Set(candidate.insights.flatMap(i=>i.evidence.filter(e=>e.type==='claim_id'&&e.id.startsWith(date+':')&&e.id.endsWith(':PRICE_CHANGE')).map(e=>e.id.split(':')[1])))];}
 assert.ok(Array.isArray(codes)&&codes.length>0&&new Set(codes).size===codes.length,'INVALID_STOCK_CODES');
 const read=p=>{const bytes=fs.readFileSync(path.join(root,p));return {data:JSON.parse(bytes),sha256:sha(bytes),path:p}};
 const list=read('data_daily_gain_over_5/'+date+'.json'),facts=read('data_daily_gain_over_5/analysis-facts/'+date+'.json');
 assert.equal(list.data.target_date,date);assert.equal(facts.data.target_date,date);assert.equal(list.data.stock_count,list.data.stocks.length);assert.equal(facts.data.stock_count,facts.data.stocks.length);
 // Dated flow sources are supplementary research evidence, never automatic Claim approval.
 const flowPaths={foreign:'data_twse_foreign_investors/'+date+'_twse_foreign_investors.json',trust:'data_twse_investment_trust/'+date+'_twse_investment_trust.json',dealer:'data_twse_dealers/'+date+'_twse_dealers.json',margin:'data_twse_margin_balance/'+date+'_twse_margin_balance.csv'};
 const missingFlowPaths=Object.values(flowPaths).filter(p=>!fs.existsSync(path.join(root,p)));
 const sourceBytes=missingFlowPaths.length?null:Object.fromEntries(Object.entries(flowPaths).map(([k,p])=>[k,{path:p,bytes:fs.readFileSync(path.join(root,p))}]));
 const flow=sourceBytes&&Object.fromEntries(['foreign','trust','dealer'].map(k=>{const j=JSON.parse(sourceBytes[k].bytes);assert.equal(j.date,date,'FLOW_DATE_MISMATCH_'+k);assert.equal(j.stat,'OK','FLOW_STATUS_INVALID_'+k);return [k,j]}));
 const num=x=>{const n=Number(String(x).replaceAll(',',''));assert.ok(Number.isFinite(n),'INVALID_FLOW_NUMBER');return n};
 const unique=(rows,code,k)=>{const matches=rows.filter(a=>String(a[k]).trim()===code);assert.equal(matches.length,1,'FLOW_STOCK_NOT_UNIQUE_'+code);return matches[0]};
 const csvRows=sourceBytes?sourceBytes.margin.bytes.toString('utf8').split(/\r?\n/):[];
 const csvCols=line=>[...line.matchAll(/(?:^|,)(?:"([^"]*)"|([^,]*))/g)].map(m=>m[1]??m[2]);
 const sourceMeta=sourceBytes&&Object.fromEntries(Object.entries(sourceBytes).map(([k,v])=>[k,{path:v.path,sha256:sha(v.bytes)}]));
 const stocks=codes.map(code=>{
  const l=list.data.stocks.filter(x=>x.code===code),f=facts.data.stocks.filter(x=>x.code===code);assert.equal(l.length,1,'LIST_STOCK_NOT_UNIQUE_'+code);assert.equal(f.length,1,'FACTS_STOCK_NOT_UNIQUE_'+code);
  const a=l[0],b=f[0];assert.equal(a.name,b.name,'STOCK_NAME_MISMATCH_'+code);
  for(const k of ['previous_close','open','high','low','close','volume','change_pct']){assert.ok(Number.isFinite(a[k]),'INVALID_LIST_'+k+'_'+code);assert.equal(a[k],b.price?.[k],'PRICE_FIELD_MISMATCH_'+k+'_'+code)}
  assert.ok(a.previous_close>0&&a.low<=a.high&&a.close>=a.low&&a.close<=a.high,'INVALID_PRICE_RANGE_'+code);
  assert.ok(Math.abs((a.close/a.previous_close-1)*100-a.change_pct)<=0.011,'PRICE_PCT_ARITHMETIC_MISMATCH_'+code);
  if(missingFlowPaths.length)return {dated_flow_crosscheck:{status:'DATED_RAW_FLOW_ARCHIVE_MISSING',missing_source_paths:missingFlowPaths,independent_source_reviewed:false,editorial_certified:false},code,name:a.name,claim_id:date+':'+code+':PRICE_CHANGE',previous_close:a.previous_close,close:a.close,change_pct:a.change_pct,source_list_path:list.path,source_facts_path:facts.path,source_list_sha256:list.sha256,source_facts_sha256:facts.sha256,status:'DATED_LIST_FACTS_PRICE_CROSSCHECK_ONLY',independent_source_reviewed:false,causality_verified:false,editorial_certified:false,narration_authorized:false};
  const foreign=unique(flow.foreign.data,code,1),trustRows=flow.trust.data.filter(a=>String(a[1]).trim()===code),dealer=unique(flow.dealer.data,code,0);
  assert.ok(trustRows.length===1||(trustRows.length===0&&b.flow.investment_trust.record_status==='no_record'&&b.flow.investment_trust.net_shares===null),'TRUST_RECORD_STATUS_MISMATCH_'+code);
  const trust=trustRows[0]??null;
  const margin=unique(csvRows.slice(1).filter(Boolean).map(csvCols),code,0);
  assert.equal(num(foreign[11]),b.flow.foreign.net_shares,'FOREIGN_FACTS_MISMATCH_'+code);
  if(trust)assert.equal(num(trust[5]),b.flow.investment_trust.net_shares,'TRUST_FACTS_MISMATCH_'+code);
  else assert.equal(b.flow.investment_trust.record_status,'no_record','TRUST_NO_RECORD_STATUS_REQUIRED_'+code);
  const factsDealerNet=b.flow.dealer.net_shares;
  const dealerFactsMatches=['proprietary','hedging','total'].filter((_,i)=>[4,7,10][i]!==undefined&&num(dealer[[4,7,10][i]])===factsDealerNet);
  assert.ok(dealerFactsMatches.length>0,'DEALER_FACTS_NO_MATCHING_RAW_CATEGORY_'+code);
  assert.equal(num(margin[5]),b.flow.margin.margin_prev,'MARGIN_PREV_FACTS_MISMATCH_'+code);
  assert.equal(num(margin[6]),b.flow.margin.margin_now,'MARGIN_NOW_FACTS_MISMATCH_'+code);
  const dealerProprietary=num(dealer[4]),dealerHedging=num(dealer[7]),dealerTotal=num(dealer[10]);
  assert.equal(dealerProprietary+dealerHedging,dealerTotal,'DEALER_TOTAL_MISMATCH_'+code);
  return {dated_flow_crosscheck:{foreign_net_shares:num(foreign[11]),trust_net_shares:trust?num(trust[5]):null,trust_record_status:trust?'reported':'no_record',dealer_proprietary_net_shares:dealerProprietary,dealer_hedging_net_shares:dealerHedging,dealer_total_net_shares:dealerTotal,facts_dealer_net_shares:factsDealerNet,facts_dealer_matching_categories:dealerFactsMatches,margin_previous_lots:num(margin[5]),margin_current_lots:num(margin[6]),margin_delta_lots:num(margin[6])-num(margin[5]),sources:sourceMeta,status:'DATED_RAW_FACTS_CROSSCHECK_ONLY',independent_source_reviewed:false,editorial_certified:false},code,name:a.name,claim_id:date+':'+code+':PRICE_CHANGE',previous_close:a.previous_close,close:a.close,change_pct:a.change_pct,source_list_path:list.path,source_facts_path:facts.path,source_list_sha256:list.sha256,source_facts_sha256:facts.sha256,status:'DATED_LIST_FACTS_PRICE_CROSSCHECK_ONLY',independent_source_reviewed:false,causality_verified:false,editorial_certified:false,narration_authorized:false};
 });
 return {contract:'DATE_TO_VIDEO_V1_D4_DATED_PRICE_REVIEW_EVIDENCE',target_date:date,stocks,review_decisions:[],status:'PRICE_CROSSCHECKED_INDEPENDENT_REVIEW_PENDING',editorial_certified:false,render_authorized:false,publication_authorized:false};
}
if(require.main===module){try{const [date,root='.',...codes]=process.argv.slice(2);console.log(JSON.stringify(inspect(root,date,codes),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={inspect};
