#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const {
  DAILY_GAINERS_AI_CONTRACT: CONTRACT,
  isLatestFacts,
  isLatestAi,
} = require('./lib/daily_gainers_ai_contract');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function usage() {
  throw new Error('Usage: node scripts/daily_gainers_ai_contract_cli.js <print|facts-latest|ai-latest|assert-facts|assert-ai> [file]');
}

const command = process.argv[2];
const file = process.argv[3];

try {
  if (command === 'print') {
    process.stdout.write(`${JSON.stringify(CONTRACT)}\n`);
    process.exit(0);
  }
  if (!file) usage();
  const payload = readJson(file);
  if (command === 'facts-latest') process.exit(isLatestFacts(payload) ? 0 : 1);
  if (command === 'ai-latest') process.exit(isLatestAi(payload) ? 0 : 1);
  if (command === 'assert-facts') {
    if (!isLatestFacts(payload)) throw new Error(`Facts are not latest: expected schema=${CONTRACT.facts.schema_version}, methodology=${CONTRACT.facts.methodology_version}`);
    process.stdout.write(`${CONTRACT.facts.methodology_version}\n`);
    process.exit(0);
  }
  if (command === 'assert-ai') {
    if (!isLatestAi(payload)) throw new Error(`AI is not latest: expected schema=${CONTRACT.ai.schema_version}, methodology=${CONTRACT.ai.methodology_version}`);
    if (payload.model_role !== CONTRACT.ai.model_role) throw new Error(`AI model_role mismatch: expected ${CONTRACT.ai.model_role}`);
    process.stdout.write(`${CONTRACT.ai.methodology_version}\n`);
    process.exit(0);
  }
  usage();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(2);
}
