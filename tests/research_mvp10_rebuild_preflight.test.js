'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {analyze,SOURCES}=require('../scripts/research_mvp10_rebuild_preflight');
test('actual 20261008 reconstruction chain is inventoried and blocked before render',()=>{
 const r=analyze(process.cwd(),'20261008');
 assert.equal(r.original_stock_count,35);
 assert.equal(r.input_files.raw.row_count,35);
 assert.equal(r.input_files.news.row_count,35);
 assert.equal(r.input_files.facts.row_count,35);
 assert.equal(r.input_files.ai.row_count,35);
 assert.equal(r.input_files.published.row_count,35);
 assert.equal(r.decision,'BLOCKED_SOURCE_RECONCILIATION_REQUIRED');
 assert.equal(r.publication_authorized,false);
 assert.deepEqual(r.known_noncommon.map(x=>x.code),['9103']);
 assert.deepEqual(r.ordinary_eligibility_unresolved.map(x=>x.code),['6645','7740']);
 assert(r.affected_video_scenes.some(s=>s.explicit_excluded_stock_codes.includes('9103')));
 for(const a of Object.values(r.current_alignment))assert.equal(a.order_matches,true);
});
test('all original archived inputs remain byte-identical after read-only preflight',()=>{
 const before=SOURCES.map(([,template])=>{
  const p=template.replace('{date}','20261008');
  return [p,fs.readFileSync(p)];
 });
 analyze(process.cwd(),'20261008');
 for(const [p,buf] of before)assert(fs.readFileSync(p).equals(buf),p);
});
test('missing or forged research date fails closed',()=>{
 assert.throws(()=>analyze(process.cwd(),'20261099'),/ENOENT|INVALID_DATE/);
 assert.throws(()=>analyze(process.cwd(),'yesterday'),/INVALID_DATE/);
});
test('tampered dependency count is detected',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-preflight-'));
 try{
  for(const [,template] of SOURCES){
   const p=template.replace('{date}','20261008'),dst=path.join(temp,p);
   fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(p,dst);
  }
  const file=path.join(temp,'data_daily_gain_over_5/analysis-ai/20261008.json');
  const j=JSON.parse(fs.readFileSync(file,'utf8'));j.stock_count+=1;
  fs.writeFileSync(file,JSON.stringify(j));
  assert.throws(()=>analyze(temp,'20261008'),/SOURCE_COUNT_MISMATCH:ai/);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
