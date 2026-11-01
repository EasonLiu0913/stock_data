'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {make,INPUTS}=require('../scripts/research_mvp10_isolated_candidate_workspace');
function withTemp(callback){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-workspace-test-'));
 try{return callback(dir)}finally{fs.rmSync(dir,{force:true,recursive:true})}
}
test('two real-date research workspaces hold 32/34 candidate rows, not stale aggregate claims',()=>withTemp(dir=>{
 const out=path.join(dir,'out'),result=make(process.cwd(),out);
 assert.equal(result.render_authorized,false);
 assert.deepEqual(result.outputs.map(x=>x.count),[32,34]);
 assert.deepEqual(result.outputs[0].excluded_codes.sort(),['6645','7740','9103']);
 assert.deepEqual(result.outputs[1].excluded_codes,['9103']);
 for(const item of result.outputs){
  const folder=path.join(out,item.scenario),manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
  assert.equal(manifest.all_aggregate_statistics_invalidated,true);
  assert.equal(manifest.summary_regenerated,false);
  assert.equal(manifest.video_render_authorized,false);
  assert.equal(manifest.stock_identity_scope_certified,false);
  assert.equal(manifest.classification_archive_publisher_effective_date_verified,false);
  assert(!fs.existsSync(path.join(folder,'market-summary.json')));
  assert(!fs.existsSync(path.join(folder,'video_scripts/daily-gainers/20261008.json')));
  for(const [kind] of INPUTS){
   const body=JSON.parse(fs.readFileSync(path.join(folder,kind+'-row-candidates.json')));
   assert.equal(body.stock_count,item.count);
   assert.deepEqual(body.records.map(x=>String(x.code)),manifest.code_order);
   assert(!JSON.stringify(body.records).includes('"code": "9103"'));
   assert.equal(body.canonical_daily_video_input,false);
   assert.equal(body.record_carry_forward_status,'UNVERIFIED_REQUIRES_NEW_SOURCE_RECONCILIATION');
   assert.equal(body.market_summary,undefined);
  }
 }
}));
test('preserve every frozen input source byte-for-byte',()=>withTemp(dir=>{
 const files=INPUTS.map(([,p])=>[p,fs.readFileSync(p)]);
 make(process.cwd(),path.join(dir,'candidate'));
 files.forEach(([p,buf])=>assert(fs.readFileSync(p).equals(buf),p));
}));
test('refuse to write inside project and refuse replacing existing output',()=>withTemp(dir=>{
 assert.throws(()=>make(process.cwd(),process.cwd()),/OUTPUT_INSIDE_REPOSITORY_DISALLOWED/);
 const p=path.join(dir,'existing');fs.mkdirSync(p);
 assert.throws(()=>make(process.cwd(),p),/OUTPUT_MUST_NOT_EXIST/);
}));
test('tampered dated row order fails instead of producing a candidate',()=>withTemp(dir=>{
 const root=path.join(dir,'root');
 for(const [,p] of INPUTS){const dst=path.join(root,p);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(p,dst)}
 for(const cat of ['Stock','InnovationBoard','TDR','ETF']){
  const p='data_twse/twse_industry_'+cat+'.csv',dst=path.join(root,p);
  fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(p,dst);
 }
 const p=path.join(root,'data_daily_gain_over_5/analysis-ai/20261008.json');
 const j=JSON.parse(fs.readFileSync(p));[j.analyses[0],j.analyses[1]]=[j.analyses[1],j.analyses[0]];
 fs.writeFileSync(p,JSON.stringify(j));
 assert.throws(()=>make(root,path.join(dir,'out')),/SOURCE_STOCK_ORDER_MISMATCH/);
}));
