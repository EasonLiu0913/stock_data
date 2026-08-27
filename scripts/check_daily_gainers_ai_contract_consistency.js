#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {DAILY_GAINERS_AI_CONTRACT:CONTRACT}=require('./lib/daily_gainers_ai_contract');
const ROOT=path.resolve(__dirname,'..');
const runtimeFiles=[
  'scripts/validate_daily_gainers_news_analysis.js',
  'scripts/build_daily_gainers_ai_facts.js',
  'scripts/validate_daily_gainers_ai_analysis.js',
  'scripts/publish_daily_gainers_unified_analysis.js',
  'scripts/build_daily_gainers_market_summary.js',
  'scripts/validate_daily_gainers_market_summary.js',
  'scripts/daily_gainers_ai_contract_cli.js',
  '.github/workflows/daily-gainers-over-5.yml',
  '.github/workflows/publish-daily-gainers-news-summary.yml',
  '.github/workflows/analyze-daily-gainers-margin-flow-2200.yml',
  '.github/workflows/publish-daily-gainers-ai-analysis.yml',
  '.github/workflows/publish-daily-gainers-unified-analysis.yml',
  '.github/workflows/backfill-daily-gainers-market-summary-v2.yml'
];
const literal=/daily-gainers-(?:news-theme|ai-(?:facts|synthesis)|unified-analysis|market-summary)-v\d+/g,violations=[];
for(const r of runtimeFiles){const f=path.join(ROOT,r);if(!fs.existsSync(f)){violations.push(`${r}: missing runtime file`);continue}const m=[...fs.readFileSync(f,'utf8').matchAll(literal)].map(x=>x[0]);if(m.length)violations.push(`${r}: hard-coded methodology literals: ${[...new Set(m)].join(', ')}`)}
const checks=[
 ['scripts/validate_daily_gainers_news_analysis.js','daily_gainers_ai_contract'],
 ['scripts/build_daily_gainers_market_summary.js','isLatestNews'],
 ['scripts/build_daily_gainers_market_summary.js','isLatestPublished'],
 ['scripts/validate_daily_gainers_market_summary.js','isLatestNews'],
 ['.github/workflows/publish-daily-gainers-news-summary.yml','validate_daily_gainers_news_analysis.js'],
 ['.github/workflows/publish-daily-gainers-news-summary.yml','build_daily_gainers_market_summary.js'],
 ['.github/workflows/publish-daily-gainers-ai-analysis.yml','build_daily_gainers_market_summary.js'],
 ['.github/workflows/backfill-daily-gainers-market-summary-v2.yml','analysis-news']
];
for(const [r,n] of checks){const f=path.join(ROOT,r);if(!fs.readFileSync(f,'utf8').includes(n))violations.push(`${r}: missing ${n}`)}
if(violations.length){console.error('Daily gainers AI contract consistency check failed:');for(const v of violations)console.error(`- ${v}`);process.exit(1)}
console.log(JSON.stringify({valid:true,policy:CONTRACT.policy,contract_version:CONTRACT.contract_version,news:CONTRACT.news,facts:CONTRACT.facts,ai:CONTRACT.ai,published:CONTRACT.published,market_summary:CONTRACT.market_summary,checked_runtime_files:runtimeFiles},null,2));
