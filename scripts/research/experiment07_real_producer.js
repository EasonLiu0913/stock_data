'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),date='20261008',prior='20261007',hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources=['data_fubon/fubon_20261007_sma.json','data_fubon/fubon_20261008_sma.json','data_twse_margin_balance/20261008_twse_margin_balance.csv','data_fubon_broker_details/fubon_20261008_券商分點進出明細.json','data_twse_mi_index/20261008_twse_mi_index.json','data_twse_foreign_investors/20261008_twse_foreign_investors.json','data_twse_investment_trust/20261008_twse_investment_trust.json','data_twse_dealers/20261008_twse_dealers.json','config/daily-gainers-ai-contract.json','config/daily-gainers-theme-taxonomy.json'];
const scripts=['generate_daily_gainers_over_5.js','build_daily_gainers_ai_facts.js','build_daily_gainers_market_summary.js','lib/daily_gainers_ai_contract.js'];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'exp07-live-producer-')),provenance=[];
try{
 for(const p of [...sources,...scripts.map(s=>'scripts/'+s)]){const original=path.join(root,p);assert(fs.statSync(original).size>0,'missing source '+p);const b=fs.readFileSync(original);if(p.endsWith('.json'))JSON.parse(b);const dest=path.join(tmp,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});provenance.push({file:p,sha256:hash(b),bytes:b.length});}
 assert(!fs.existsSync(path.join(tmp,'data_daily_gain_over_5',date+'.json')));
 function run(script,args){let r=cp.spawnSync(process.execPath,['scripts/'+script,...args],{cwd:tmp,encoding:'utf8',timeout:120000});assert.equal(r.status,0,script+': '+r.stderr);return r.stdout}
 run('generate_daily_gainers_over_5.js',['--date',date]);
 const list=JSON.parse(fs.readFileSync(path.join(tmp,'data_daily_gain_over_5',date+'.json')));assert.equal(list.stock_count,35);
 run('build_daily_gainers_ai_facts.js',[date]);
 const factsPath=path.join(tmp,'data_daily_gain_over_5/analysis-facts/'+date+'.json'),facts=JSON.parse(fs.readFileSync(factsPath));assert.equal(facts.target_date,date);assert.equal(facts.stock_count,35);
 const missing=Object.entries(facts.source_status).filter(([k,v])=>v!=='available').map(([k,v])=>k+':'+v);
 assert.deepEqual(missing,[],'Facts source completeness cannot be asserted');
 run('build_daily_gainers_market_summary.js',['--date',date]);
 const summaryPath=path.join(tmp,'data_daily_gain_over_5/market-summary/'+date+'.json'),summary=JSON.parse(fs.readFileSync(summaryPath));assert.equal(summary.target_date,date);assert.equal(summary.status,'preliminary');assert.notEqual(summary.coverage.overall,'complete');
 const reportDir=path.join(root,'tmp/research/experiment07');fs.mkdirSync(reportDir,{recursive:true});
 for(const [kind,file] of [['list',path.join(tmp,'data_daily_gain_over_5',date+'.json')],['facts',factsPath],['summary',summaryPath]]){const bytes=fs.readFileSync(file);fs.writeFileSync(path.join(reportDir,kind+'-'+date+'.json'),bytes,{flag:'wx'});assert.equal(hash(fs.readFileSync(path.join(reportDir,kind+'-'+date+'.json'))),hash(bytes));}
 const result={schema:'exp07-real-producer-v1',date,initial_outputs:'EMPTY',source_provenance:provenance,recreated:{list:{sha256:hash(fs.readFileSync(path.join(reportDir,'list-'+date+'.json'))),stocks:35},facts:{sha256:hash(fs.readFileSync(factsPath)),source_status:facts.source_status},market_summary:{sha256:hash(fs.readFileSync(summaryPath)),status:summary.status,coverage:summary.coverage}},not_recreated:['news_semantic_research','ai_synthesis','unified_publication','final_market_summary'],full_video_ready:false,production_safe_paths:[],publication_effects:'NONE_REQUESTED'};
 fs.writeFileSync(path.join(reportDir,'manifest.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log('EXPERIMENT_07_REAL_PRODUCER_PARTIAL_PASS '+JSON.stringify({list:35,facts:'SOURCE_COMPLETE',summary:'preliminary',final_video_ready:false,production_safe_paths:0}));
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
