'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),target='20261008',prior='20261007';
const sourceNames=[prior,target].map(d=>'fubon_'+d+'_sma.json');
const sourceFiles=sourceNames.map(n=>path.join(root,'data_fubon',n));
for(const f of sourceFiles)assert(fs.statSync(f).size>1000,'missing actual source '+f);
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const originalSourceHash=sourceFiles.map(sha);
const t=fs.mkdtempSync(path.join(os.tmpdir(),'exp05-phase3-real-'));
try{
 for(const d of ['scripts','data_fubon','data_daily_gain_over_5'])fs.mkdirSync(path.join(t,d),{recursive:true});
 fs.copyFileSync(path.join(root,'scripts/generate_daily_gainers_over_5.js'),path.join(t,'scripts/generate_daily_gainers_over_5.js'));
 sourceFiles.forEach((f,i)=>fs.copyFileSync(f,path.join(t,'data_fubon',sourceNames[i])));
 const child=cp.spawnSync(process.execPath,['scripts/generate_daily_gainers_over_5.js','--date',target],{cwd:t,encoding:'utf8',env:{PATH:process.env.PATH,HOME:t},timeout:120000});
 assert.equal(child.status,0,child.stderr);
 const outputFile=path.join(t,'data_daily_gain_over_5',target+'.json'),data=JSON.parse(fs.readFileSync(outputFile,'utf8'));
 assert.equal(data.target_date,target);assert.equal(data.previous_date,prior);assert.equal(data.threshold_pct,5);assert.equal(data.stock_count,data.stocks.length);assert(data.stock_count>0);
 assert.deepEqual(data.source_files,sourceNames.map(n=>'data_fubon/'+n));
 assert.deepEqual(sourceFiles.map(sha),originalSourceHash,'original inputs must remain intact');
 for(const stock of data.stocks){assert(stock.change_pct>=5);assert(stock.previous_close>0&&stock.close>0);}
 const evidence={schema:'experiment05-phase3-real-archived-input-v1',source_ref:'a78576294ef7f15354ed1a17b042f302184dbdd0',target_date:target,previous_date:prior,source_sha256:Object.fromEntries(sourceNames.map((n,i)=>[n,originalSourceHash[i]])),output_sha256:sha(outputFile),stock_count:data.stock_count,output_scope:'os.tmpdir only',publication_effects:'NONE_REQUESTED',production_safe_paths:[],note:'real archived SMA inputs; actual generator; no live crawler; not a production recovery proof'};
 const report=path.join(root,'tmp/research/experiment05-phase3');fs.mkdirSync(report,{recursive:true});fs.writeFileSync(path.join(report,'real-source-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log('EXPERIMENT_05_PHASE3_REAL_ARCHIVED_SOURCE_PASS '+JSON.stringify({date:target,stock_count:data.stock_count,production_safe_paths:0}));
}finally{fs.rmSync(t,{recursive:true,force:true})}
