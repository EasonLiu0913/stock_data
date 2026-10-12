'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const entries=[
 ['scripts/generate_daily_gainers_over_5.js',['data_fubon','data_daily_gain_over_5'],['files.json'], 'list and latest index'],
 ['scripts/build_daily_gainers_ai_facts.js',['data_daily_gain_over_5','data_twse_margin_balance','data_fubon_broker_details','data_twse_mi_index','analysis-facts'],[], 'facts, dependent on observed date-specific sources'],
 ['scripts/build_daily_gainers_market_summary.js',['market-summary','manifest.json'],[], 'summary and mutable manifest'],
 ['scripts/publish_daily_gainers_unified_analysis.js',['research_pending','data_daily_gain_over_5'],[], 'pending AI to published analysis'],
 ['scripts/validate_daily_gainers_video_script.js',['video_scripts','analysis-ai','market-summary'],[], 'read-only video script validator']
];
const matrix=[];
for(const [file,signals,extra,note] of entries){
 const text=fs.readFileSync(path.join(root,file),'utf8');
 for(const s of [...signals,...extra])assert(text.includes(s),file+' contract drift: '+s);
 const writes=text.split(/\r?\n/).map((s,i)=>({line:i+1,code:s.trim()})).filter(x=>/fs\.(writeFileSync|renameSync|mkdirSync|appendFileSync|rmSync|unlinkSync)/.test(x.code));
 const directTriggers=['git push','gh workflow run','actions/deploy-pages','youtube'].filter(s=>text.toLowerCase().includes(s.toLowerCase()));
 matrix.push({file,signals,writes,directTriggers,note,execution_authorized:false});
}
const workflowFiles=['daily-gainers-over-5.yml','publish-daily-gainers-ai-analysis.yml','publish-daily-gainers-news-summary.yml','publish-daily-gainers-unified-analysis.yml','daily-gainers-video-upload-orchestrator.yml','deploy-pages.yml'];
const workflow=workflowFiles.map(name=>{let t=fs.readFileSync(path.join(root,'.github/workflows',name),'utf8');return {name,main_push:/git push origin HEAD:main/.test(t),calls_pages:/uses:\s*\.\/\.github\/workflows\/deploy-pages.yml/.test(t),push_filter_data_wildcard:/data\*\/\*\*/.test(t),dispatch_render:/gh workflow run generate-upload-daily-gainers-video.yml/.test(t)}});
assert(workflow.find(x=>x.name==='deploy-pages.yml').push_filter_data_wildcard);
assert(workflow.find(x=>x.name==='daily-gainers-video-upload-orchestrator.yml').dispatch_render);
for(const x of workflow.filter(x=>/publish-daily-gainers|daily-gainers-over-5/.test(x.name)))assert(x.calls_pages);
const denied=['data_daily_gain_over_5/20261008.json','data_daily_gain_over_5/analysis-facts/20261008.json','data_daily_gain_over_5/market-summary/manifest.json','video_scripts/daily-gainers/20261008.json','public/index.html','../tmp/research/probe.json'];
for(const p of denied)assert(!/^tmp\/research\/experiment05-phase4\/[-a-z0-9]+\.json$/.test(p));
const report={schema:'experiment05-script-level-scoped-v1',main_sha:'a78576294ef7f15354ed1a17b042f302184dbdd0',producers:matrix,workflow_edges:workflow,denied,production_safe_paths:[],research_scope:'tmp/research/experiment05-phase4',claim:'5 sampled scripts and 6 high-risk workflows; not exhaustive global graph',real_producer_execution:'NOT_RUN_IN_THIS_TEST'};
const dir=path.join(root,'tmp/research/experiment05-phase4');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'script-effects.json'),JSON.stringify(report,null,2)+'\n');
console.log('EXPERIMENT_05_SCRIPT_EFFECTS_PASS '+JSON.stringify({scripts:matrix.length,workflows:workflow.length,negative:denied.length,production_safe_paths:0}));

// Independent push probe after script-effect workflow registration.
