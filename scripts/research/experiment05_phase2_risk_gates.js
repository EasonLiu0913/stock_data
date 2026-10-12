'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const main='a78576294ef7f15354ed1a17b042f302184dbdd0';
const audit={
 schema:'experiment05-phase2-risk-gates-v1',main_sha:main,
 sources:[
 {producer:'daily-gainers-over-5.yml',output:'data_daily_gain_over_5/YYYYMMDD.json',triggers:['deploy-pages.yml:push:data*/**','direct workflow_call:deploy-pages.yml'],effect:'PAGES',decision:'DENY'},
 {producer:'publish-daily-gainers-ai-analysis.yml',output:'data_daily_gain_over_5/analysis-facts/YYYYMMDD.json',triggers:['direct workflow_call:deploy-pages.yml'],effect:'PAGES',decision:'DENY'},
 {producer:'publish-daily-gainers-news-summary.yml',output:'data_daily_gain_over_5/analysis-news/YYYYMMDD.json',triggers:['direct workflow_call:deploy-pages.yml'],effect:'PAGES',decision:'DENY'},
 {producer:'publish-daily-gainers-unified-analysis.yml',output:'data_daily_gain_over_5/analysis/YYYYMMDD.json',triggers:['direct workflow_call:deploy-pages.yml'],effect:'PAGES',decision:'DENY'},
 {producer:'daily-gainers-video-upload-orchestrator.yml',output:'video_scripts/daily-gainers/YYYYMMDD.json',triggers:['push:main:video_scripts/daily-gainers/*.json','gh workflow run retry-upload-daily-gainers-video.yml','gh workflow run generate-upload-daily-gainers-video.yml'],effect:'YOUTUBE_OR_RENDER',decision:'DENY'}
 ],safe_paths:['tmp/research/experiment05-phase2/'],production_safe_paths:[],
 status:'BLOCKED_TRANSITIVE_GLOBAL_AUDIT_AND_REAL_SOURCE_PENDING'
};
const required=[
 ['deploy-pages.yml',[/data\*\/\*\*/,/actions\/deploy-pages/]],
 ['daily-gainers-over-5.yml',[/git push origin HEAD:main/,/uses: \.\/\.github\/workflows\/deploy-pages.yml/]],
 ['publish-daily-gainers-ai-analysis.yml',[/git push origin HEAD:main/,/uses: \.\/\.github\/workflows\/deploy-pages.yml/]],
 ['publish-daily-gainers-news-summary.yml',[/git push origin HEAD:main/,/uses: \.\/\.github\/workflows\/deploy-pages.yml/]],
 ['publish-daily-gainers-unified-analysis.yml',[/git push origin HEAD:main/,/uses: \.\/\.github\/workflows\/deploy-pages.yml/]],
 ['daily-gainers-video-upload-orchestrator.yml',[/video_scripts\/daily-gainers\/\*\.json/,/gh workflow run retry-upload-daily-gainers-video.yml/,/gh workflow run generate-upload-daily-gainers-video.yml/]]
];
for(const [name,patterns] of required){const s=read('.github/workflows/'+name);for(const p of patterns)assert(p.test(s),name+': contract drift '+p)}
const normal=p=>{assert(!path.posix.isAbsolute(p));const n=path.posix.normalize(p);assert(n===p&&!n.startsWith('../')&&!p.includes('\\')&&!p.includes('\0'),'unsafe path');return n;};
function permitted(p){try{const n=normal(p);return /^tmp\/research\/experiment05-phase2\/[a-zA-Z0-9_-]+\.json$/.test(n)}catch{return false}}
const negative=['data_daily_gain_over_5/20261013.json','data_daily_gain_over_5/analysis-news/20261013.json','data_daily_gain_over_5/analysis-facts/20261013.json','data_daily_gain_over_5/analysis-ai/20261013.json','video_scripts/daily-gainers/20261013.json','public/index.html','../data_daily_gain_over_5/20261013.json','tmp/research/experiment05-phase2/../../public/a.json','tmp/research/experiment05-phase2/a.json/extra','tmp/research/experiment05-phase2/evil.yml'];
for(const p of negative)assert.equal(permitted(p),false,'unexpected allow '+p);
assert.equal(permitted('tmp/research/experiment05-phase2/source-probe.json'),true);
assert.equal(audit.production_safe_paths.length,0);
fs.mkdirSync(path.join(root,'tmp/research/experiment05-phase2'),{recursive:true});
const output=path.join(root,'tmp/research/experiment05-phase2/risk-gates.json');
fs.writeFileSync(output,JSON.stringify({...audit,negative_tests:negative.length,positive_tests:1},null,2)+'\n');
console.log('EXPERIMENT_05_PHASE2_RISK_GATES_PASS '+JSON.stringify({negative:negative.length,positive:1,production_safe_paths:0,source_contracts:audit.sources.length}));
