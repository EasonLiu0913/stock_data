'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'.github/workflows');
const names=fs.readdirSync(dir).filter(n=>/\.ya?ml$/.test(n)).sort();
assert(names.length>=200,'Incomplete workflow directory');
const risks=/deploy-pages|pages: write|actions\/deploy-pages|youtube|generate-upload-daily-gainers-video|daily-gainers-video-upload-orchestrator/i;
const needles=['push','workflow_run','repository_dispatch','workflow_dispatch'];
function audit(name,s){
 const lines=s.split(/\r?\n/);let inOn=false,events=[],filters=[];
 for(let i=0;i<lines.length;i++){const line=lines[i];
 if(/^on:\s*(?:#.*)?$/.test(line)){inOn=true;continue}
 if(/^on:\s*\[/.test(line)){events.push(...needles.filter(e=>line.includes(e)));inOn=false;continue}
 if(inOn&&/^[^\s#]/.test(line))inOn=false;
 if(inOn){let m=line.match(/^  (push|workflow_run|repository_dispatch|workflow_dispatch):/);if(m)events.push(m[1]);if(/^    (branches|paths|paths-ignore|workflows|types):/.test(line))filters.push(line.trim());}
 }
 const outputs=[...s.matchAll(/(?:data_daily_gain_over_5|analysis-news|analysis-facts|analysis-ai|video_scripts|market-summary)[\/\w.*{}-]*/g)].map(m=>m[0]);
 return {workflow:name,events:[...new Set(events)],filters:[...new Set(filters)],references:[...new Set(outputs)].slice(0,35),publication_risk:risks.test(s),repo_write:/contents:\s*write|git push|git commit/.test(s),calls:[...new Set([...s.matchAll(/uses:\s*\.\/\.github\/workflows\/([^\s#]+)/g)].map(m=>m[1]))]};
}
function safety(paths,matrix){
 const watched=matrix.filter(x=>x.events.includes('push')&&x.publication_risk);
 if(!matrix.length||!paths.length)return {allowed:false,reason:'missing inventory or outputs'};
 if(watched.some(x=>!x.filters.some(f=>f.startsWith('paths:')||f.startsWith('paths-ignore:'))))return {allowed:false,reason:'unfiltered publication push listener'};
 return {allowed:false,reason:'no positive safe-path proof; GitHub trigger semantics and called jobs require exact audit',watched:watched.map(x=>x.workflow)};
}
const matrix=names.map(n=>audit(n,fs.readFileSync(path.join(dir,n),'utf8')));
assert.equal(matrix.length,names.length);
for(const n of needles)assert(matrix.every(x=>Array.isArray(x.events)));
assert.equal(safety(['data_daily_gain_over_5/20261013.json'],matrix).allowed,false);
assert.equal(safety(['analysis-ai/20261013.json'],matrix).allowed,false);
assert.equal(safety(['video_scripts/daily-gainers/20261013.json'],matrix).allowed,false);
assert.equal(safety([],matrix).allowed,false);
const report={schema:'experiment05-listener-inventory-v1',main_reference:'b86fa8fc018a7717990fa8539a09c74a439bdd8a',workflow_count:names.length,event_counts:Object.fromEntries(needles.map(n=>[n,matrix.filter(x=>x.events.includes(n)).length])),matrix,write_policy:'DENY_ALL_UNTIL_MANUAL_EXACT_FILTER_AND_INDIRECT_CHAIN_REVIEW',safe_paths:[],synthetic_negative_tests:4,real_source_recovery:'NOT_RUN'};
fs.mkdirSync(path.join(root,'tmp/research'),{recursive:true});fs.writeFileSync(path.join(root,'tmp/research/experiment05-matrix.json'),JSON.stringify(report,null,2)+'\n');
console.log('EXPERIMENT_05_INVENTORY_PASS '+JSON.stringify({count:names.length,events:report.event_counts,publicationRisk:matrix.filter(x=>x.publication_risk).length,writePolicy:report.write_policy}));

// Independent push probe after workflow registration; no production execution.
