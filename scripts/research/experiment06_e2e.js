'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {write,sha}=require('./experiment05_phase5_writer');
const repo=path.resolve(__dirname,'../..'),requestPath=process.argv[2];
assert(requestPath&&/^recovery-requests\/experiment-06\/request-20261008\.json$/.test(requestPath),'exact research request path');
const request=JSON.parse(fs.readFileSync(path.join(repo,requestPath),'utf8'));
assert.deepEqual(request,{schema:'exp06-request-v1',mode:'isolated_research_only',target:'daily_5pct_video',date:'20261008',dataset:'daily_gainers_list',source_dates:['20261007','20261008']});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'exp06-e2e-'));const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
try{
 const prior='20261007',date='20261008',sources=[prior,date].map(d=>fs.readFileSync(path.join(repo,'data_fubon','fubon_'+d+'_sma.json')));
 assert(!fs.existsSync(path.join(temp,'exp05-writer-20261008.json')),'initial must be missing');
 for(const d of ['scripts','data_fubon','data_daily_gain_over_5'])fs.mkdirSync(path.join(temp,d),{recursive:true});
 fs.copyFileSync(path.join(repo,'scripts/generate_daily_gainers_over_5.js'),path.join(temp,'scripts/generate_daily_gainers_over_5.js'));
 [prior,date].forEach((d,i)=>fs.writeFileSync(path.join(temp,'data_fubon','fubon_'+d+'_sma.json'),sources[i],{flag:'wx'}));
 const exec=cp.spawnSync(process.execPath,['scripts/generate_daily_gainers_over_5.js','--date',date],{cwd:temp,timeout:120000,encoding:'utf8'});assert.equal(exec.status,0,exec.stderr);
 const bytes=fs.readFileSync(path.join(temp,'data_daily_gain_over_5',date+'.json'));
 const req={target:'daily_5pct_video',mode:'isolated_research_only',dataset:'daily_gainers_list',date,prior_date:prior,source_sha256:sources.map(hash)};
 const first=write(temp,req,sources,bytes);assert.equal(first.decision,'WRITTEN_ISOLATED');
 const persisted=fs.readFileSync(path.join(temp,'exp05-writer-20261008.json'));assert.equal(hash(persisted),first.manifest.output_sha256);
 const second=write(temp,req,sources,bytes);assert.equal(second.decision,'ALREADY_COMPLETE');
 const nonProduced=['analysis-facts','analysis-news','analysis-ai','analysis','market-summary'].map(n=>({dataset:n,status:'BLOCKED_NOT_RECONSTRUCTED',reason:'No source-complete side-effect-free producer has been authorized for this E2E run'}));
 const out=path.join(repo,'tmp/research/experiment06');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'recovered-20261008.json'),persisted);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({schema:'exp06-e2e-v1',trigger:'research branch push request',request,source_sha256:req.source_sha256,output_sha256:hash(persisted),stock_count:JSON.parse(persisted).stock_count,first:first.decision,second:second.decision,initial_storage:'EMPTY',readback:'VERIFIED',nonProduced,full_video_ready:false,production_safe_paths:[],publication_effects:'NONE_REQUESTED',persistence:'GitHub Actions artifact (run-scoped retained storage), not main'},null,2)+'\n');
 console.log('EXPERIMENT_06_E2E_PARTIAL_PASS '+JSON.stringify({stocks:first.manifest.stock_count,first:first.decision,second:second.decision,readback:'VERIFIED',full_video_ready:false,blocked:nonProduced.length}));
}finally{fs.rmSync(temp,{recursive:true,force:true})}
