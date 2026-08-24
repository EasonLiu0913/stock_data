#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DAILY_GAINERS_AI_CONTRACT } = require('./lib/daily_gainers_ai_contract');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'data_daily_gain_over_5');
const CONTRACT = DAILY_GAINERS_AI_CONTRACT;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value) {
  return isText(value) && !Number.isNaN(Date.parse(value));
}

function main() {
  const date = process.argv[2];
  const inputArg = process.argv[3] || `research_pending/daily-gainers-ai/${date}.json`;
  assert(/^20\d{6}$/.test(String(date || '')), 'Usage: node scripts/validate_daily_gainers_ai_analysis.js YYYYMMDD [ai-json-path]');

  const factsFile = path.join(BASE, 'analysis-facts', `${date}.json`);
  const aiFile = path.resolve(ROOT, inputArg);
  assert(fs.existsSync(factsFile), `Missing facts file: ${path.relative(ROOT, factsFile)}`);
  assert(fs.existsSync(aiFile), `Missing AI analysis file: ${path.relative(ROOT, aiFile)}`);

  const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
  const ai = JSON.parse(fs.readFileSync(aiFile, 'utf8'));

  assert(facts.target_date === date, 'facts target_date mismatch');
  assert(facts.schema_version === CONTRACT.facts.schema_version, `facts schema_version must be ${CONTRACT.facts.schema_version}`);
  assert(facts.methodology_version === CONTRACT.facts.methodology_version, `unexpected facts methodology_version; expected ${CONTRACT.facts.methodology_version}`);
  assert(Array.isArray(facts.stocks), 'facts stocks must be an array');
  assert(Number.isInteger(facts.stock_count), 'facts stock_count must be an integer');
  assert(facts.stock_count === facts.stocks.length, `facts stock_count ${facts.stock_count} != stocks length ${facts.stocks.length}`);

  assert(ai.target_date === date, 'AI target_date mismatch');
  assert(ai.schema_version === CONTRACT.ai.schema_version, `AI schema_version must be ${CONTRACT.ai.schema_version}`);
  assert(ai.methodology_version === CONTRACT.ai.methodology_version, `unexpected AI methodology_version; expected ${CONTRACT.ai.methodology_version}`);
  assert(ai.model_role === CONTRACT.ai.model_role, `unexpected AI model_role; expected ${CONTRACT.ai.model_role}`);
  assert(ai.source_facts_file === `data_daily_gain_over_5/analysis-facts/${date}.json`, 'AI source_facts_file mismatch');
  assert(Array.isArray(ai.analyses), 'AI analyses must be an array');
  assert(ai.analyses.length === facts.stock_count, `AI analyses count ${ai.analyses.length} != facts ${facts.stock_count}`);

  const factCodes = facts.stocks.map((item) => String(item.code));
  const aiCodes = ai.analyses.map((item) => String(item.code));
  assert(JSON.stringify(aiCodes) === JSON.stringify(factCodes), 'AI stock order/code list must exactly match facts');

  const validBias = new Set(['bullish', 'neutral', 'cautious', 'bearish']);
  const validConfidence = new Set(['high', 'medium', 'low']);
  const validVerification = new Set(CONTRACT.institutional_verification.allowed_statuses);
  const requiredVerificationFields = CONTRACT.institutional_verification.required_fields_when_verification_required;
  assert(Array.isArray(requiredVerificationFields) && requiredVerificationFields.length > 0, 'institutional verification required-fields contract is missing');

  for (let i = 0; i < ai.analyses.length; i += 1) {
    const item = ai.analyses[i];
    const fact = facts.stocks[i];
    assert(isText(item.name), `missing name for ${item.code}`);
    assert(isText(item.funding_structure), `missing funding_structure for ${item.code}`);
    assert(isText(item.synthesis), `missing synthesis for ${item.code}`);
    assert(Array.isArray(item.supporting_signals), `supporting_signals must be array for ${item.code}`);
    assert(Array.isArray(item.conflicting_signals), `conflicting_signals must be array for ${item.code}`);
    assert(Array.isArray(item.risks), `risks must be array for ${item.code}`);
    assert(Array.isArray(item.follow_up), `follow_up must be array for ${item.code}`);
    assert(validBias.has(item.continuation_bias), `invalid continuation_bias for ${item.code}`);
    assert(validConfidence.has(item.confidence), `invalid confidence for ${item.code}`);
    assert(item.institutional_verification && typeof item.institutional_verification === 'object', `institutional_verification required for ${item.code}`);

    const verification = item.institutional_verification;
    assert(validVerification.has(verification.status), `invalid institutional verification status for ${item.code}`);
    assert(Array.isArray(verification.sources), `institutional verification sources must be array for ${item.code}`);

    const required = fact?.institutional?.verification_required === true;
    if (required) {
      for (const field of requiredVerificationFields) {
        assert(Object.prototype.hasOwnProperty.call(verification, field), `institutional verification ${field} required for ${item.code}`);
      }
      assert(verification.status !== 'not_required', `institutional verification cannot be not_required for ${item.code}`);
      assert(isText(verification.summary), `institutional verification summary required for ${item.code}`);
      assert(isIsoTimestamp(verification.checked_at), `institutional verification checked_at must be an ISO timestamp for ${item.code}`);
      assert(Array.isArray(verification.sources), `institutional verification sources must be array for ${item.code}`);
    } else {
      assert(verification.status === 'not_required' || verification.status === 'verified', `unexpected institutional verification status for ${item.code}`);
    }
  }

  assert(ai.market_summary && typeof ai.market_summary === 'object', 'market_summary is required');
  assert(isText(ai.market_summary.summary), 'market_summary.summary is required');
  assert(Array.isArray(ai.market_summary.common_flow_clues), 'market_summary.common_flow_clues must be array');
  assert(Array.isArray(ai.priority_watchlist), 'priority_watchlist must be array');
  for (const code of ai.priority_watchlist) assert(factCodes.includes(String(code)), `priority_watchlist contains unknown code ${code}`);

  const pending = ai.analyses
    .filter((item) => ['pending_publication', 'inconclusive'].includes(item.institutional_verification.status))
    .map((item) => String(item.code));

  console.log(JSON.stringify({
    valid: true,
    contract_policy: CONTRACT.policy,
    facts_methodology: CONTRACT.facts.methodology_version,
    ai_methodology: CONTRACT.ai.methodology_version,
    date,
    stock_count: facts.stock_count,
    ai_analysis_count: ai.analyses.length,
    stock_order_verified: true,
    institutional_recheck_required: pending,
    ai_file: path.relative(ROOT, aiFile),
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
