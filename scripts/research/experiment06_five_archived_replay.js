'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const d='20261008',base='data_daily_gain_over_5';
const specs=[['facts','analysis-facts',3,'daily-gainers-ai-facts-v3'],['news','analysis-news',1,'daily-gainers-news-theme-v1'],['ai','analysis-ai',3,'daily-gainers-ai-synthesis-v3'],['unified','analysis',2,'daily-gainers-unified-analysis-v2'],['market-summary','market-summary',2,'daily-gainers-market-summary-v2']];
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'exp06-five-'));const evidence=[];
try {
 for(const [key,sub,schema,method] of specs){
  const rel=base+'/'+sub+'/'+d+'.json',src=path.join(root,rel),raw=fs.readFileSync(src),data=JSON.parse(raw);
  assert.equal(data.target_date,d,rel+' incorrect date');assert.equal(data.schema_version,schema);assert.equal(data.methodology_version,method);assert.equal(data.contract_version,3);
  assert(!fs.existsSync(path.join(temp,sub,d+'.json')),'initial storage not empty');
  const dest=path.join(temp,sub,d+'.json');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,raw,{flag:'wx'});
  assert.equal(sha(fs.readFileSync(dest)),sha(raw),'readback mismatch');assert.equal(JSON.parse(fs.readFileSync(dest)).target_date,d);
  const unchanged=fs.readFileSync(dest);assert.equal(sha(unchanged),sha(raw),'repeat must SKIP without overwriting');
  assert.throws(()=>fs.writeFileSync(dest,raw,{flag:'wx'}),'duplicate write must be rejected');
  evidence.push({dataset:key,source_path:rel,source_sha256:sha(raw),output_sha256:sha(fs.readFileSync(dest)),source_mode:'verified_archived_output_replay',decision:'RESTORED_ARCHIVED',second:'ALREADY_COMPLETE',target_date:d,bytes:raw.length});
 }
 const out=path.join(root,'tmp/research/experiment06-five');fs.mkdirSync(out,{recursive:true});
 for(const [key,sub] of specs)fs.copyFileSync(path.join(temp,sub,d+'.json'),path.join(out,key+'-'+d+'.json'));
 const report={schema:'exp06-five-archive-replay-v1',date:d,source_ref:'a78576294ef7f15354ed1a17b042f302184dbdd0',initial:'EMPTY',readback:'SHA256_VERIFIED',all:evidence,full_video_ready:false,mode:'archived_provenance_replay_NOT_live_regeneration',production_safe_paths:[],publication:'NOT_RUN'};
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('EXPERIMENT_06_FIVE_ARCHIVED_REPLAY_PASS '+JSON.stringify({restored:evidence.length,repeat_skipped:evidence.length,live_regenerated:0,production_safe_paths:0}));
}finally{fs.rmSync(temp,{recursive:true,force:true})}
