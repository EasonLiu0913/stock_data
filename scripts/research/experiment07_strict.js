'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..'),d='20261008',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources=['data_fubon/fubon_20261007_sma.json','data_fubon/fubon_20261008_sma.json','data_twse_margin_balance/20261008_twse_margin_balance.csv','data_fubon_broker_details/fubon_20261008_券商分點進出明細.json','data_twse_mi_index/20261008_twse_mi_index.json','data_twse_foreign_investors/20261008_twse_foreign_investors.json','data_twse_investment_trust/20261008_twse_investment_trust.json','data_twse_dealers/20261008_twse_dealers.json','config/daily-gainers-ai-contract.json','config/daily-gainers-theme-taxonomy.json','research_pending/daily-gainers-ai/20261008.json','data_daily_gain_over_5/analysis-news/20261008.json'];
const scripts=['generate_daily_gainers_over_5.js','build_daily_gainers_ai_facts.js','validate_daily_gainers_news_analysis.js','validate_daily_gainers_ai_analysis.js','publish_daily_gainers_unified_analysis.js','build_daily_gainers_market_summary.js','lib/daily_gainers_ai_contract.js'];
const t=fs.mkdtempSync(path.join(os.tmpdir(),'exp07-strict-')),provenance=[];
function run(s,args){const r=cp.spawnSync(process.execPath,['scripts/'+s,...args],{cwd:t,encoding:'utf8',timeout:120000});assert.equal(r.status,0,s+': '+r.stderr);return r.stdout}
try{
 for(const p of [...sources,...scripts.map(x=>'scripts/'+x)]){const bytes=fs.readFileSync(path.join(ROOT,p));assert(bytes.length>0,p+' missing');if(p.endsWith('.json'))JSON.parse(bytes);const dest=path.join(t,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});provenance.push({path:p,sha256:sha(bytes)});}
 assert(!fs.existsSync(path.join(t,'data_daily_gain_over_5/analysis/'+d+'.json')));
 run('generate_daily_gainers_over_5.js',['--date',d]);
 run('build_daily_gainers_ai_facts.js',[d]);
 const facts=JSON.parse(fs.readFileSync(path.join(t,'data_daily_gain_over_5/analysis-facts/'+d+'.json')));
 assert.equal(facts.stock_count,35);assert(Object.values(facts.source_status).every(x=>x==='available'),'Facts incomplete');
 const ai=fs.readFileSync(path.join(t,'research_pending/daily-gainers-ai/'+d+'.json'));
 fs.mkdirSync(path.join(t,'data_daily_gain_over_5/analysis-ai'),{recursive:true});fs.writeFileSync(path.join(t,'data_daily_gain_over_5/analysis-ai/'+d+'.json'),ai,{flag:'wx'});
 fs.mkdirSync(path.join(t,'data_daily_gain_over_5/analysis-news'),{recursive:true});fs.copyFileSync(path.join(t,'data_daily_gain_over_5/analysis-news/'+d+'.json'),path.join(t,'data_daily_gain_over_5/analysis-news/'+d+'.json')); 
 run('validate_daily_gainers_news_analysis.js',[d]);run('validate_daily_gainers_ai_analysis.js',[d]);
 run('publish_daily_gainers_unified_analysis.js',[d]);
 const unified=JSON.parse(fs.readFileSync(path.join(t,'data_daily_gain_over_5/analysis/'+d+'.json')));assert.equal(unified.generation_mode,'ai_verified');assert.equal(unified.stock_count,35);
 run('build_daily_gainers_market_summary.js',['--date',d]);
 const summary=JSON.parse(fs.readFileSync(path.join(t,'data_daily_gain_over_5/market-summary/'+d+'.json')));assert.equal(summary.status,'final');assert.equal(summary.coverage.overall,'complete');
 const out=path.join(ROOT,'tmp/research/experiment07-strict');fs.mkdirSync(out,{recursive:true});
 const artifacts={};for(const [name,rel] of [['facts','analysis-facts'],['unified','analysis'],['summary','market-summary']]){let b=fs.readFileSync(path.join(t,'data_daily_gain_over_5',rel,d+'.json'));fs.writeFileSync(path.join(out,name+'-'+d+'.json'),b,{flag:'wx'});assert.equal(sha(fs.readFileSync(path.join(out,name+'-'+d+'.json'))),sha(b));artifacts[name]={sha256:sha(b)}}
 const manifest={schema:'experiment07-strict-v1',date:d,provenance,outputs:artifacts,news_mode:'existing verified archived semantic research',ai_mode:'existing verified archived AI synthesis',facts_mode:'fresh deterministic recomputation',unified_mode:'strict real original producer without fallback',summary_mode:'fresh final recomputation',new_semantic_research_performed:false,production_safe_paths:[],publication:'NOT_RUN'};
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 console.log('EXPERIMENT_07_STRICT_RECOMPUTE_PASS '+JSON.stringify({stocks:35,unified:unified.generation_mode,summary:summary.status,new_semantic_research:false,production_safe_paths:0}));
}finally{fs.rmSync(t,{recursive:true,force:true})}
