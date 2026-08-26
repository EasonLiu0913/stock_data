#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT: CONTRACT } = require('./lib/daily_gainers_ai_contract');
const ROOT = path.resolve(__dirname, '..');
const runtimeFiles = [
  'scripts/build_daily_gainers_ai_facts.js',
  'scripts/validate_daily_gainers_ai_analysis.js',
  'scripts/publish_daily_gainers_unified_analysis.js',
  'scripts/daily_gainers_ai_contract_cli.js',
  '.github/workflows/analyze-daily-gainers-margin-flow-2200.yml',
  '.github/workflows/publish-daily-gainers-ai-analysis.yml',
  '.github/workflows/publish-daily-gainers-unified-analysis.yml',
];
const methodologyLiteral = /daily-gainers-(?:ai-(?:facts|synthesis)|unified-analysis)-v\d+/g;
const violations = [];
for (const relative of runtimeFiles) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) { violations.push(`${relative}: missing runtime file`); continue; }
  const text = fs.readFileSync(file, 'utf8');
  const matches = [...text.matchAll(methodologyLiteral)].map((m) => m[0]);
  if (matches.length) violations.push(`${relative}: hard-coded methodology literals: ${[...new Set(matches)].join(', ')}`);
}
const checks = [
  ['scripts/build_daily_gainers_ai_facts.js', 'daily_gainers_ai_contract'],
  ['scripts/validate_daily_gainers_ai_analysis.js', 'daily_gainers_ai_contract'],
  ['scripts/publish_daily_gainers_unified_analysis.js', 'daily_gainers_ai_contract'],
  ['.github/workflows/publish-daily-gainers-ai-analysis.yml', 'daily_gainers_ai_contract_cli.js'],
  ['.github/workflows/analyze-daily-gainers-margin-flow-2200.yml', 'daily_gainers_ai_contract_cli.js'],
  ['.github/workflows/publish-daily-gainers-unified-analysis.yml', 'publish_daily_gainers_unified_analysis.js'],
];
for (const [relative, needle] of checks) {
  const text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  if (!text.includes(needle)) violations.push(`${relative}: missing ${needle}`);
}
if (violations.length) {
  console.error('Daily gainers AI contract consistency check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log(JSON.stringify({ valid: true, policy: CONTRACT.policy, contract_version: CONTRACT.contract_version, facts: CONTRACT.facts, ai: CONTRACT.ai, published: CONTRACT.published, checked_runtime_files: runtimeFiles }, null, 2));
