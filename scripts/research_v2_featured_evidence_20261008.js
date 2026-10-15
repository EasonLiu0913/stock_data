'use strict';
// v2: deterministic evidence manifest, NOT proof of causation or permission to render.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const date='20261008',root='data_daily_gain_over_5/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function build(list,news,ai,facts){
 for(const d of [list,news,ai,facts])assert.equal(d.target_date,date,'WRONG_DATE');
 assert.equal(list.stock_count,list.stocks.length);assert.equal(news.stock_count,news.analyses.length);assert.equal(ai.stock_count,ai.analyses.length);assert.equal(facts.stock_count,facts.stocks.length);
 const unique=(xs,label)=>{const m=new Map();for(const x of xs){assert.match(x.code,/^\d{4,6}$/);assert.ok(!m.has(x.code),'DUPLICATE_'+label);m.set(x.code,x);}return m;};
 const nm=unique(news.analyses,'NEWS'),am=unique(ai.analyses,'AI'),fm=unique(facts.stocks,'FACTS'),lm=unique(list.stocks,'LIST');
 assert.deepEqual([...nm.keys()].sort(),[...lm.keys()].sort());assert.deepEqual([...am.keys()].sort(),[...lm.keys()].sort());assert.deepEqual([...fm.keys()].sort(),[...lm.keys()].sort());
 const priority=ai.priority_watchlist;assert.ok(Array.isArray(priority)&&priority.length>=2);
 const selected=[];for(const code of priority){
  const s=lm.get(code),n=nm.get(code),a=am.get(code),f=fm.get(code);assert.ok(s&&n&&a&&f,'PRIORITY_NOT_IN_LIST');assert.equal(n.name,s.name);assert.equal(f.name,s.name);
  const computed=(s.close/s.previous_close-1)*100;assert.ok(Number.isFinite(computed)&&computed>=5-0.011,'NOT_5_PERCENT');assert.ok(Math.abs(computed-s.change_pct)<0.025,'PRICE_CHANGE_MISMATCH');
  assert.equal(n.change_pct,s.change_pct);assert.equal(f.price.close,s.close);assert.equal(f.price.previous_close,s.previous_close);
  assert.equal(a.code,code);assert.equal(a.reason_summary.length>0,true);
  const sources=(n.sources||[]).map(x=>{assert.ok(typeof x.title==='string'&&x.title.length>0);assert.match(x.url,/^https:\/\//);assert.match(x.published_at,/^2026-10-\d\d/);assert.ok(x.published_at.slice(0,10)<='2026-10-08','POST_DATE_SOURCE');return {title:x.title,url:x.url,published_at:x.published_at};});
  const grade=n.evidence_strength;assert.ok(['none','circumstantial','corroborated','direct'].includes(grade),'UNKNOWN_GRADE');
  if(grade==='corroborated'||grade==='direct')assert.ok(sources.length>0,'UNSOURCED_CLAIM');
  selected.push({code,name:s.name,change_pct:s.change_pct,previous_close:s.previous_close,close:s.close,volume:s.volume,cause_type:n.cause_type,evidence_strength:grade,reason_summary:n.reason_summary,source_count:sources.length,sources,ai_confidence:a.confidence,ai_reason_summary:a.reason_summary,claim_status:grade==='none'?'UNKNOWN_NOT_CAUSAL':grade==='circumstantial'?'ASSOCIATION_NOT_CAUSAL':'SOURCE_CORROBORATED_NOT_CAUSAL',narration_authorized:false});
 }
 return {schema_version:2,target_date:date,status:'RESEARCH_EVIDENCE_MANIFEST',selected,source_files:[root+'20261008.json',root+'analysis-news/20261008.json',root+'analysis-ai/20261008.json',root+'analysis-facts/20261008.json'],causality_verified:false,editorial_complete:false,publication_authorized:false,tts_authorized:false,render_authorized:false};
}
if(require.main===module){const paths=[root+'20261008.json',root+'analysis-news/20261008.json',root+'analysis-ai/20261008.json',root+'analysis-facts/20261008.json'];const out=build(...paths.map(read));const sha=Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));fs.mkdirSync('/tmp/video-recovery-proof',{recursive:true});fs.writeFileSync('/tmp/video-recovery-proof/v2-featured-stock-evidence-manifest.json',JSON.stringify({...out,source_sha256:sha},null,2)+'\n');console.log('V2_FEATURED_EVIDENCE_MANIFEST_PASS selected='+out.selected.map(x=>x.code).join(',')+'; causality not certified; render forbidden');}
module.exports={build};
