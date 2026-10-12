'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'.github/workflows');
const names=fs.readdirSync(dir).filter(n=>/\.ya?ml$/.test(n)).sort();
assert(names.length>=238,'workflow inventory shrank');
const files=Object.fromEntries(names.map(n=>[n,fs.readFileSync(path.join(dir,n),'utf8')]));
function events(y){const match=y.match(/^on:\s*\n((?:^[ \t]+.*\n|^\s*\n)*)/m);const block=match?.[1]||'';return ['push','workflow_run','repository_dispatch','workflow_dispatch','workflow_call','schedule'].filter(e=>new RegExp('^  '+e+':','m').test(block));}
const dangerous=/deploy-pages|pages:\s*write|deploy-pages@|youtube|generate-upload-daily-gainers-video|daily-gainers-video-upload-orchestrator|gh workflow run|gh api.*dispatch|git push|contents:\s*write|actions:\s*write/i;
const matrix=names.map(name=>{let y=files[name],e=events(y);return {name,events:e,trigger_block:(y.match(/^on:\s*\n((?:^[ \t]+.*\n|^\s*\n)*)/m)||[])[1]||'',calls:[...new Set([...y.matchAll(/^\s*uses:\s*['\"]?\.\/\.github\/workflows\/([a-zA-Z0-9_.-]+\.ya?ml)['\"]?\s*(?:#.*)?$/gm)].map(m=>m[1]))],dispatch_lines:y.split(/\r?\n/).filter(s=>/gh workflow run|repository_dispatch|workflow_dispatch|\/dispatches/i.test(s)).map(s=>s.trim()),risk:dangerous.test(y),direct_pages:/uses:\s*\.\/\.github\/workflows\/deploy-pages.yml/.test(y),repo_write:/git push|contents:\s*write/.test(y)}});
assert(matrix.length===names.length);
for(const entry of matrix)for(const c of entry.calls)assert(files[c],'unresolved local reusable '+entry.name+' -> '+c);
const deploy=files['deploy-pages.yml'];assert(/data\*\/\*\*/.test(deploy),'Pages wildcard drift');assert(/branches:\s*\n\s+- main/.test(deploy),'Pages main filter drift');
const candidate=['data_daily_gain_over_5/20261008.json','data_daily_gain_over_5/analysis-facts/20261008.json','data_daily_gain_over_5/analysis-news/20261008.json','video_scripts/daily-gainers/20261008.json','public/index.html','config/daily-gainers-ai-contract.json'];
const unsafe=candidate.map(p=>({path:p,reason:p.startsWith('video_scripts/')?'VIDEO_ORCHESTRATOR':p.startsWith('data')?'PAGES_DATA_WILDCARD':'PUBLICATION_OR_CONFIG',allowed:false}));
const deny=p=>!/^tmp\/research\/experiment05-phase4\/[a-z0-9-]+\.json$/.test(p)||p.includes('..');
for(const x of candidate.concat(['../tmp/research/experiment05-phase4/probe.json','tmp/research/experiment05-phase4/probe.json/extra']))assert(deny(x));
assert(!deny('tmp/research/experiment05-phase4/probe.json'));
const report={schema:'experiment05-phase4-topology-v1',main_reference:'a78576294ef7f15354ed1a17b042f302184dbdd0',count:names.length,event_counts:Object.fromEntries(['push','workflow_run','repository_dispatch','workflow_dispatch','workflow_call','schedule'].map(e=>[e,matrix.filter(x=>x.events.includes(e)).length])),matrix,unsafe,production_safe_paths:[],research_allowlist:['tmp/research/experiment05-phase4/<simple>.json'],safety:'DENY_PRODUCTION_WRITES; NO_MAIN_PUSH_OR_DISPATCH',limitation:'Static local workflow inventory. Scripts, external dispatch, runtime conditions and exact glob matching not fully proved; no global side-effect clearance.'};
const output=path.join(root,'tmp/research/experiment05-phase4');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'topology.json'),JSON.stringify(report,null,2)+'\n');console.log('EXPERIMENT_05_PHASE4_STATIC_GATE_PASS '+JSON.stringify({count:names.length,events:report.event_counts,negative:candidate.length+2,positive:1,production_safe_paths:0}));

// Independent push probe after Phase 4 workflow registration.
