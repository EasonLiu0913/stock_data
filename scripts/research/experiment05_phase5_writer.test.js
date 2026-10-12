'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {write,sha}=require('./experiment05_phase5_writer');
const root=path.resolve(__dirname,'../..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'exp05-phase5-'));
try{
 const dates=['20261007','20261008'];const source=dates.map(d=>fs.readFileSync(path.join(root,'data_fubon','fubon_'+d+'_sma.json')));
 for(const d of ['scripts','data_fubon','data_daily_gain_over_5'])fs.mkdirSync(path.join(tmp,d),{recursive:true});
 fs.copyFileSync(path.join(root,'scripts/generate_daily_gainers_over_5.js'),path.join(tmp,'scripts/generate_daily_gainers_over_5.js'));
 dates.forEach((d,i)=>fs.writeFileSync(path.join(tmp,'data_fubon','fubon_'+d+'_sma.json'),source[i]));
 const x=cp.spawnSync(process.execPath,['scripts/generate_daily_gainers_over_5.js','--date','20261008'],{cwd:tmp,encoding:'utf8',timeout:120000});assert.equal(x.status,0,x.stderr);
 const output=fs.readFileSync(path.join(tmp,'data_daily_gain_over_5/20261008.json'));
 const req={target:'daily_5pct_video',mode:'isolated_research_only',dataset:'daily_gainers_list',date:'20261008',prior_date:'20261007',source_sha256:source.map(sha)};
 const first=write(tmp,req,source,output);assert.equal(first.decision,'WRITTEN_ISOLATED');assert.equal(first.manifest.stock_count,35);
 assert.equal(write(tmp,req,source,output).decision,'ALREADY_COMPLETE');
 const fails=[
 ()=>write(tmp,{...req,date:'20261007'},source,output),
 ()=>write(tmp,{...req,source_sha256:['bad',req.source_sha256[1]]},source,output),
 ()=>write(tmp,{...req,mode:'production'},source,output),
 ()=>write(tmp,{...req,dataset:'video_scripts'},source,output),
 ()=>write(tmp,{...req,extra:'deploy-pages'},source,output),
 ()=>write(tmp,req,source,Buffer.from('{"target_date":"20261007"}')),
 ()=>write(root,req,source,output)
 ];
 for(const fn of fails)assert.throws(fn);
 fs.writeFileSync(path.join(tmp,'exp05-writer-20261008.json'),'corrupt');assert.throws(()=>write(tmp,req,source,output));
 const report={schema:'exp05-phase5-test-v1',main_sha:'a78576294ef7f15354ed1a17b042f302184dbdd0',result:'ISOLATED_REAL_ARCHIVED_INPUT_PASS',stock_count:first.manifest.stock_count,source_sha256:req.source_sha256,output_sha256:first.manifest.output_sha256,negative_tests:fails.length+1,idempotency:true,production_safe_paths:[],publication:'NOT_RUN'};
 const out=path.join(root,'tmp/research/experiment05-phase5');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'writer-evidence.json'),JSON.stringify(report,null,2)+'\n');
 console.log('EXPERIMENT_05_PHASE5_WRITER_PASS '+JSON.stringify({stocks:35,negative:fails.length+1,idempotency:true,production_safe_paths:0}));
}finally{fs.rmSync(tmp,{recursive:true,force:true})}

// Independent CI trigger probe after registration.
