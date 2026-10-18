'use strict';
// D4 date-scoped research evidence join. No AI authorship, narration or render approval.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function join({date,list,facts,news,ai,cutoff}){
 assert.match(date||'',/^20\\d{6}$/);
 assert.ok(/^\\d{4}-\\d{2}-\\d{2}T/.test(cutoff||''),'INVALID_CUTOFF');
 const cutoffMs=Date.parse(cutoff);assert.ok(Number.isFinite(cutoffMs),'INVALID_CUTOFF');
 const day=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6);
 assert.equal(cutoff.slice(0,10),day,'CUTOFF_DATE_MISMATCH');
 for(const [kind,v] of Object.entries({list,facts,news,ai})){
  assert.ok(v&&typeof v==='object','MISSING_'+kind);
  assert.equal(v.target_date,date,'WRONG_DATE_'+kind);
 }
 for(const [kind,v] of Object.entries({facts,news,ai})){
  assert.equal(v.stock_count,list.stock_count,'COUNT_MISMATCH_'+kind);
 }
 assert.equal(list.stock_count,list.stocks.length,'LIST_COUNT_MISMATCH');
 const map=(v,kind,key)=>{assert.ok(Array.isArray(v[key]),'MISSING_'+kind);const m=new Map();
  for(const row of v[key]){assert.ok(typeof row.code==='string'&&!m.has(row.code),'DUPLICATE_'+kind);m.set(row.code,row)}
  return m};
 const f=map(facts,'FACTS','stocks'),n=map(news,'NEWS','analyses'),a=map(ai,'AI','analyses');
 const rows=[];
 for(const s of list.stocks){
  const code=s.code;assert.ok(typeof code==='string','INVALID_CODE');
  const fr=f.get(code),nr=n.get(code),ar=a.get(code);
  assert.ok(fr&&nr&&ar,'MISSING_JOIN:'+code);
  for(const [kind,v] of Object.entries({facts:fr,news:nr,ai:ar})){
   if(v.name!==undefined)assert.equal(v.name,s.name,'NAME_MISMATCH:'+kind+':'+code);
  }
  const sources=[];
  for(const [kind,v] of Object.entries({news:nr,ai:ar})){
   for(const source of v.sources||[]){
    assert.ok(source.url&&source.published_at,'SOURCE_PROVENANCE_MISSING:'+code);
    const published=source.published_at;
    assert.match(published,/^\\d{4}-\\d{2}-\\d{2}(?:T.*)?$/,'INVALID_SOURCE_DATE');
    const ms=published.length===10?Date.parse(published+'T23:59:59+08:00'):Date.parse(published);
    assert.ok(Number.isFinite(ms),'INVALID_SOURCE_TIMESTAMP');
    assert.ok(ms<=cutoffMs,'POST_CUTOFF_SOURCE:'+code);
    sources.push({origin:kind,url:source.url,title:source.title||null,published_at:published});
   }
  }
  rows.push({code,name:s.name,evidence_refs:{list:'/stocks/'+list.stocks.indexOf(s),facts:'/stocks/'+facts.stocks.indexOf(fr),news:'/analyses/'+news.analyses.indexOf(nr),ai:'/analyses/'+ai.analyses.indexOf(ar)},sources,source_strength:nr.evidence_strength||'unknown',claim_status:'REVIEW_REQUIRED',causality_verified:false,narration_authorized:false});
 }
 assert.equal(f.size,rows.length,'FACTS_UNMATCHED');assert.equal(n.size,rows.length,'NEWS_UNMATCHED');assert.equal(a.size,rows.length,'AI_UNMATCHED');
 return {contract:'DATE_TO_VIDEO_V1_D4_EVIDENCE_JOIN',target_date:date,cutoff,input_sha256:{list:hash(list),facts:hash(facts),news:hash(news),ai:hash(ai)},rows,joined_count:rows.length,claim_whitelist_verified:false,editorial_certified:false,render_authorized:false,publication_authorized:false};
}
module.exports={join};
