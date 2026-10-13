'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),date='20261008',base='data_daily_gain_over_5';
const request=JSON.parse(fs.readFileSync(path.join(root,'recovery-requests/experiment-08/request-20261008.json')));
assert.deepEqual(request,{schema:'exp08-handoff-v1',mode:'research_dry_run',target:'daily_5pct_video',date,scenario:'semantic_outputs_missing',requested_by:'chatgpt-github-connector'});
const actual=JSON.parse(fs.readFileSync(path.join(root,base,date+'.json'))),facts=JSON.parse(fs.readFileSync(path.join(root,base,'analysis-facts',date+'.json')));
assert.equal(actual.target_date,date);assert.equal(facts.target_date,date);assert.equal(actual.stock_count,facts.stock_count);
const news=JSON.parse(fs.readFileSync(path.join(root,base,'analysis-news',date+'.json'))),ai=JSON.parse(fs.readFileSync(path.join(root,'research_pending/daily-gainers-ai',date+'.json')));
assert.equal(news.target_date,date);assert.equal(ai.target_date,date);assert.equal(news.stock_count,actual.stock_count);assert.equal(ai.stock_count,actual.stock_count);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const phases=[
 {stage:'NEWS',owner:'ChatGPT scheduled research',requires:['list'],input_path:base+'/'+date+'.json',expected_output:base+'/analysis-news/'+date+'.json',validator:'scripts/validate_daily_gainers_news_analysis.js',decision:'RESEARCH_REQUIRED_NOT_DISPATCHED'},
 {stage:'AI',owner:'ChatGPT scheduled research',requires:['list','facts','news'],input_path:base+'/analysis-facts/'+date+'.json',expected_output:'research_pending/daily-gainers-ai/'+date+'.json',validator:'scripts/validate_daily_gainers_ai_analysis.js',decision:'WAIT_FOR_NEWS_AND_FACTS'},
 {stage:'UNIFIED',owner:'GitHub strict data producer',requires:['facts','news','ai'],decision:'BLOCKED_UPSTREAM',forbidden_fallback:true},
 {stage:'FINAL_SUMMARY',owner:'GitHub deterministic producer',requires:['unified'],decision:'BLOCKED_UPSTREAM'}
];
assert(phases[0].decision==='RESEARCH_REQUIRED_NOT_DISPATCHED');assert(phases[1].decision==='WAIT_FOR_NEWS_AND_FACTS');
const unsafe=['publish-daily-gainers-news-summary.yml','publish-daily-gainers-ai-analysis.yml'];
for(const name of unsafe){const s=fs.readFileSync(path.join(root,'.github/workflows',name),'utf8');assert(/pages:\s*write/.test(s),'publication risk drift '+name);assert(/deploy-pages\.yml/.test(s),'direct pages chain drift '+name)}
const result={schema:'exp08-handoff-evidence-v1',scenario:request.scenario,date,upstream:{list_sha256:sha(base+'/'+date+'.json'),facts_sha256:sha(base+'/analysis-facts/'+date+'.json')},archived_reference_only:{news_sha256:sha(base+'/analysis-news/'+date+'.json'),ai_sha256:sha('research_pending/daily-gainers-ai/'+date+'.json')},phases,actual_new_semantic_research:false,production_safe_paths:[],publication:'NOT_RUN',next_action:'ChatGPT scheduled agent must perform real-source News, validate exact-date JSON; then real-source AI synthesis and validate; production submission remains locked'};
const out=path.join(root,'tmp/research/experiment08');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'handoff.json'),JSON.stringify(result,null,2)+'\n');
console.log('EXPERIMENT_08_HANDOFF_PASS '+JSON.stringify({stages:phases.length,new_research:false,production_safe_paths:0}));
