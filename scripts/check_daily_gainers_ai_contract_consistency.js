#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT: CONTRACT } = require('./lib/daily_gainers_ai_contract');

const ROOT = path.resolve(__dirname, '..');
const runtimeFiles = [
  'scripts/build_daily_gainers_ai_facts.js',
  'scripts/validate_daily_gainers_ai_analysis.js',
  'scripts/daily_gainers_ai_contract_cli.js',
  '.github/workflows/analyze-daily-gainers-margin-flow-2200.yml',
  '.github/workflows/publish-daily-gainers-ai-analysis.yml',
];

const methodologyLiteral = /daily-gainers-ai-(?:facts|synthesis)-v\d+/g;
const violations = [];

for (const relative of runtimeFiles) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) {
    violations.push(`${relative}: missing runtime file`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  const matches = [...text.matchAll(methodologyLiteral)].map((match) => match[0]);
  if (matches.length) violations.push(`${relative}: hard-coded methodology literals: ${[...new Set(matches)].join(', ')}`);
}

const generator = fs.readFileSync(path.join(ROOT, 'scripts/build_daily_gainers_ai_facts.js'), 'utf8');
const validator = fs.readFileSync(path.join(ROOT, 'scripts/validate_daily_gainers_ai_analysis.js'), 'utf8');
const publisher = fs.readFileSync(path.join(ROOT, '.github/workflows/publish-daily-gainers-ai-analysis.yml'), 'utf8');
const evening = fs.readFileSync(path.join(ROOT, '.github/workflows/analyze-daily-gainers-margin-flow-2200.yml'), 'utf8');

if (!generator.includes('daily_gainers_ai_contract')) violations.push('generator does not load central contract');
if (!validator.includes('daily_gainers_ai_contract')) violations.push('validator does not load central contract');
if (!publisher.includes('daily_gainers_ai_contract_cli.js')) violations.push('publish workflow does not use central contract CLI');
if (!evening.includes('daily_gainers_ai_contract_cli.js')) violations.push('evening facts workflow does not use central contract CLI');

if (violations.length) {
  console.error('Daily gainers AI contract consistency check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(JSON.stringify({
  valid: true,
  policy: CONTRACT.policy,
  contract_version: CONTRACT.contract_version,
  facts: CONTRACT.facts,
  ai: CONTRACT.ai,
  checked_runtime_files: runtimeFiles,
}, null, 2));
