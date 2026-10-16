'use strict';
// Research-only input for an AI editor. Does not write narration or authorize media.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const date='20261008',root='data_daily_gain_over_5/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function build(m,list,news,facts,ai){
 for(const x of [m,list,news,facts,ai])assert.equal(x.target_date,date,'DATE_DRIFT');
 assert.equal(m.market,'TWSE');assert.equal(m.breadth.scope,'TWSE_OFFICIAL_STOCK_COLUMN');
 const by=(xs)=>new Map(xs.map(x=>[x.code,x]));
 const n=by(news.analyses),f=by(facts.stocks),a=by(ai.analyses),l=by(list.stocks);
 const sources=[],candidates=[];
 // Provenance is research metadata, not a claim of independently reviewed causality.
 assert.equal(m.source_evidence?.mi_index,'data_twse_mi_index/20261008_twse_mi_index.json','MI_INDEX_SOURCE_DRIFT');
 assert.match(m.source_evidence?.bfi82u_raw_sha256||'',/^[a-f0-9]{64}$/,'BFI82U_SOURCE_HASH_MISSING');
 for(const code of ai.priority_watchlist){
  const s=l.get(code),item=n.get(code),fact=f.get(code),analysis=a.get(code);
  assert.ok(s&&item&&fact&&analysis,'MISSING_CANDIDATE');
  if(code==='2305'){
   assert.equal(fact.flow.dealer.net_shares,41283,'2305_FACTS_MISMATCH');
   assert.ok(!analysis.reason_summary.includes('自營商淨額0張') && !(analysis.evidence||[]).some(v=>v.includes('自營商0張')),'2305_STALE_AI');
   assert.notEqual(analysis.institutional_verification?.status,'inconclusive','2305_STALE_VERIFICATION');
  }
  assert.ok((s.close/s.previous_close-1)*100>=5-0.011,'NOT_GAINER');
  const source_ids=[];
  for(const [i,x] of (item.sources||[]).entries()){
   assert.ok(typeof x.published_at==='string' && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(x.published_at),'SOURCE_DATE_FORMAT');
   assert.ok(x.published_at.slice(0,10)<='2026-10-08','FUTURE_SOURCE');
   const id='NEWS_'+code+'_'+(i+1);source_ids.push(id);
   sources.push({id,code,title:x.title,url:x.url,published_at:x.published_at,verification:'upstream_reference_requires_editor_review'});
  }
  candidates.push({code,name:s.name,previous_close:s.previous_close,close:s.close,change_pct:s.change_pct,volume:s.volume,source_ids,news_evidence_strength:item.evidence_strength,news_hypothesis:item.reason_summary,ai_hypothesis:analysis.reason_summary,facts:fact,causality_verified:false});
 }
 const payload={schema_version:3,target_date:date,market:m,candidates,sources,editorial_instructions:{author:'ChatGPT_AI',original_analysis_required:true,upstream_summaries_are_not_verified_causality:true,publication_authorized:false}};
 const sha256=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 return {target_date:date,sha256,...payload};
}
if(require.main===module){
 const m=read('/tmp/video-recovery-proof/market-opening-unified-research-master.json');
 const out=build(m,read(root+date+'.json'),read(root+'analysis-news/'+date+'.json'),read(root+'analysis-facts/'+date+'.json'),read(root+'analysis-ai/'+date+'.json'));
 fs.writeFileSync('/tmp/video-recovery-proof/ai-editor-input-v3.json',JSON.stringify(out,null,2)+'\n');
 console.log('AI_EDITOR_INPUT_V3_RESEARCH_ONLY '+out.sha256+' candidates='+out.candidates.length);
}
module.exports={build};
