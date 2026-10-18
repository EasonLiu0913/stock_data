'use strict';
// Dated stock price review evidence. Crosscheck is not an independent editorial approval.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function inspect(root,date,codes){
 assert.match(date,/^20\d{6}$/);assert.ok(Array.isArray(codes)&&codes.length>0&&new Set(codes).size===codes.length,'INVALID_STOCK_CODES');
 const read=p=>{const bytes=fs.readFileSync(path.join(root,p));return {data:JSON.parse(bytes),sha256:sha(bytes),path:p}};
 const list=read('data_daily_gain_over_5/'+date+'.json'),facts=read('data_daily_gain_over_5/analysis-facts/'+date+'.json');
 assert.equal(list.data.target_date,date);assert.equal(facts.data.target_date,date);assert.equal(list.data.stock_count,list.data.stocks.length);assert.equal(facts.data.stock_count,facts.data.stocks.length);
 const stocks=codes.map(code=>{
  const l=list.data.stocks.filter(x=>x.code===code),f=facts.data.stocks.filter(x=>x.code===code);assert.equal(l.length,1,'LIST_STOCK_NOT_UNIQUE_'+code);assert.equal(f.length,1,'FACTS_STOCK_NOT_UNIQUE_'+code);
  const a=l[0],b=f[0];assert.equal(a.name,b.name,'STOCK_NAME_MISMATCH_'+code);
  for(const k of ['previous_close','open','high','low','close','volume','change_pct']){assert.ok(Number.isFinite(a[k]),'INVALID_LIST_'+k+'_'+code);assert.equal(a[k],b.price?.[k],'PRICE_FIELD_MISMATCH_'+k+'_'+code)}
  assert.ok(a.previous_close>0&&a.low<=a.high&&a.close>=a.low&&a.close<=a.high,'INVALID_PRICE_RANGE_'+code);
  assert.ok(Math.abs((a.close/a.previous_close-1)*100-a.change_pct)<=0.011,'PRICE_PCT_ARITHMETIC_MISMATCH_'+code);
  return {code,name:a.name,claim_id:date+':'+code+':PRICE_CHANGE',previous_close:a.previous_close,close:a.close,change_pct:a.change_pct,source_list_sha256:list.sha256,source_facts_sha256:facts.sha256,status:'DATED_LIST_FACTS_PRICE_CROSSCHECK_ONLY',independent_source_reviewed:false,causality_verified:false,editorial_certified:false,narration_authorized:false};
 });
 return {contract:'DATE_TO_VIDEO_V1_D4_DATED_PRICE_REVIEW_EVIDENCE',target_date:date,stocks,review_decisions:[],status:'PRICE_CROSSCHECKED_INDEPENDENT_REVIEW_PENDING',editorial_certified:false,render_authorized:false,publication_authorized:false};
}
if(require.main===module){try{const [date,root='.',...codes]=process.argv.slice(2);console.log(JSON.stringify(inspect(root,date,codes),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={inspect};
