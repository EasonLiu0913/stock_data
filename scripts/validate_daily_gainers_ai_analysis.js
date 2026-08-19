#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'data_daily_gain_over_5');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function main() {
  const date = process.argv[2];
  assert(/^20\d{6}$/.test(String(date || '')), 'Usage: node scripts/validate_daily_gainers_ai_analysis.js YYYYMMDD');

  const factsFile = path.join(BASE, 'analysis-facts', `${date}.json`);
  const aiFile = path.join(BASE, 'analysis-ai', `${date}.json`);
  assert(fs.existsSync(factsFile), `Missing facts file: ${path.relative(ROOT, factsFile)}`);
  assert(fs.existsSync(aiFile), `Missing AI analysis file: ${path.relative(ROOT, aiFile)}`);

  const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
  const ai = JSON.parse(fs.readFileSync(aiFile, 'utf8'));
  assert(facts.target_date === date, 'facts target_date mismatch');
  assert(ai.target_date === date, 'AI target_date mismatch');
  assert(ai.schema_version === 1, 'AI schema_version must be 1');
  assert(ai.methodology_version === 'daily-gainers-ai-synthesis-v1', 'unexpected AI methodology_version');
  assert(ai.source_facts_file === `data_daily_gain_over_5/analysis-facts/${date}.json`, 'AI source_facts_file mismatch');
  assert(Array.isArray(ai.analyses), 'AI analyses must be an array');
  assert(ai.analyses.length === facts.stock_count, `AI analyses count ${ai.analyses.length} != facts ${facts.stock_count}`);

  const factCodes = facts.stocks.map((item) => String(item.code));
  const aiCodes = ai.analyses.map((item) => String(item.code));
  assert(JSON.stringify(aiCodes) === JSON.stringify(factCodes), 'AI stock order/code list must exactly match facts');

  const validBias = new Set(['bullish', 'neutral', 'cautious', 'bearish']);
  const validConfidence = new Set(['high', 'medium', 'low']);
  for (const item of ai.analyses) {
    assert(isText(item.name), `missing name for ${item.code}`);
    assert(isText(item.funding_structure), `missing funding_structure for ${item.code}`);
    assert(isText(item.synthesis), `missing synthesis for ${item.code}`);
    assert(Array.isArray(item.supporting_signals), `supporting_signals must be array for ${item.code}`);
    assert(Array.isArray(item.conflicting_signals), `conflicting_signals must be array for ${item.code}`);
    assert(Array.isArray(item.risks), `risks must be array for ${item.code}`);
    assert(Array.isArray(item.follow_up), `follow_up must be array for ${item.code}`);
    assert(validBias.has(item.continuation_bias), `invalid continuation_bias for ${item.code}`);
    assert(validConfidence.has(item.confidence), `invalid confidence for ${item.code}`);
  }

  assert(ai.market_summary && typeof ai.market_summary === 'object', 'market_summary is required');
  assert(isText(ai.market_summary.summary), 'market_summary.summary is required');
  assert(Array.isArray(ai.market_summary.common_flow_clues), 'market_summary.common_flow_clues must be array');
  assert(Array.isArray(ai.priority_watchlist), 'priority_watchlist must be array');

  console.log(JSON.stringify({
    valid: true,
    date,
    stock_count: facts.stock_count,
    ai_file: path.relative(ROOT, aiFile),
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
