#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTRACT = require(path.join(ROOT, 'scripts/lib/daily_gainers_ai_contract')).DAILY_GAINERS_AI_CONTRACT;
const BASE = path.join(ROOT, 'data_daily_gain_over_5');

function assert(condition, message) { if (!condition) throw new Error(message); }
function isText(value) { return typeof value === 'string' && value.trim().length > 0; }
function isIsoTimestamp(value) { return isText(value) && !Number.isNaN(Date.parse(value)); }
function isHttpUrl(value) {
  try { const u = new URL(String(value || '')); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}
function uniqueStrings(values) {
  return Array.isArray(values) && values.every((v) => isText(v)) && new Set(values).size === values.length;
}

function validateVerificationSources(sources, code) {
  assert(Array.isArray(sources), `institutional verification sources must be array for ${code}`);
  for (const source of sources) {
    assert(source && typeof source === 'object', `institutional verification source must be object for ${code}`);
    assert(isText(source.title), `institutional verification source.title required for ${code}`);
    assert(isHttpUrl(source.url), `institutional verification source.url must be http(s) for ${code}`);
  }
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
  assert(facts.methodology_version === CONTRACT.facts.methodology_version, `facts methodology_version must be ${CONTRACT.facts.methodology_version}`);
  assert(Array.isArray(facts.stocks), 'facts stocks must be an array');
  assert(Number.isInteger(facts.stock_count) && facts.stock_count === facts.stocks.length, 'facts stock_count mismatch');

  assert(ai.target_date === date, 'AI target_date mismatch');
  assert(ai.schema_version === CONTRACT.ai.schema_version, `AI schema_version must be ${CONTRACT.ai.schema_version}`);
  assert(ai.methodology_version === CONTRACT.ai.methodology_version, `AI methodology_version must be ${CONTRACT.ai.methodology_version}`);
  assert(ai.model_role === CONTRACT.ai.model_role, `AI model_role must be ${CONTRACT.ai.model_role}`);
  assert(ai.source_facts_file === `data_daily_gain_over_5/analysis-facts/${date}.json`, 'AI source_facts_file mismatch');
  assert(Number.isInteger(ai.stock_count) && ai.stock_count === facts.stock_count, 'AI stock_count mismatch');
  assert(Array.isArray(ai.analyses) && ai.analyses.length === facts.stock_count, 'AI analyses count mismatch');

  const factCodes = facts.stocks.map((item) => String(item.code));
  const aiCodes = ai.analyses.map((item) => String(item.code));
  assert(JSON.stringify(aiCodes) === JSON.stringify(factCodes), 'AI stock order/code list must exactly match facts');

  const validCauseTypes = new Set(CONTRACT.cause_types);
  const validEvidenceStrength = new Set(CONTRACT.evidence_strength_values);
  const validConfidence = new Set(CONTRACT.confidence_values);
  const requiredFields = CONTRACT.required_ai_analysis_fields;
  const validVerification = new Set(CONTRACT.institutional_verification.allowed_statuses);
  const tagPattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

  for (let i = 0; i < ai.analyses.length; i += 1) {
    const item = ai.analyses[i];
    const fact = facts.stocks[i];
    for (const field of requiredFields) assert(Object.prototype.hasOwnProperty.call(item, field), `missing ${field} for ${item.code || fact.code}`);
    assert(String(item.code) === String(fact.code), `code mismatch at index ${i}`);
    assert(validCauseTypes.has(item.cause_type), `invalid cause_type for ${item.code}`);
    assert(uniqueStrings(item.cause_tags), `cause_tags must be unique non-empty strings for ${item.code}`);
    assert(item.cause_tags.every((tag) => tagPattern.test(tag)), `cause_tags must be lowercase snake_case ASCII for ${item.code}`);
    assert(validEvidenceStrength.has(item.evidence_strength), `invalid evidence_strength for ${item.code}`);
    assert(isText(item.reason_summary), `reason_summary required for ${item.code}`);
    assert(Array.isArray(item.evidence), `evidence must be an array for ${item.code}`);
    assert(item.evidence.every((entry) => isText(entry)), `evidence entries must be text for ${item.code}`);
    assert(validConfidence.has(item.confidence), `invalid confidence for ${item.code}`);
    assert(Array.isArray(item.follow_up), `follow_up must be an array for ${item.code}`);
    assert(item.follow_up.every((entry) => isText(entry)), `follow_up entries must be text for ${item.code}`);
    assert(Array.isArray(item.sources), `sources must be an array for ${item.code}`);
    for (const source of item.sources) {
      assert(source && typeof source === 'object', `source must be an object for ${item.code}`);
      assert(isText(source.title), `source.title required for ${item.code}`);
      assert(isHttpUrl(source.url), `source.url must be http(s) for ${item.code}`);
      if (source.published_at != null && source.published_at !== '') assert(!Number.isNaN(Date.parse(source.published_at)), `invalid source.published_at for ${item.code}`);
    }
    if (['direct', 'corroborated'].includes(item.evidence_strength)) assert(item.sources.length > 0, `${item.evidence_strength} evidence requires public source URL for ${item.code}`);
    if (['unknown', 'low_liquidity'].includes(item.cause_type)) assert(item.confidence === 'low', `${item.cause_type} must use low confidence for ${item.code}`);

    if (item.institutional_verification != null) {
      const verification = item.institutional_verification;
      assert(verification && typeof verification === 'object', `institutional_verification must be object for ${item.code}`);
      assert(validVerification.has(verification.status), `invalid institutional verification status for ${item.code}`);
      const required = fact?.flow?.institutional_verification_required === true;

      // Central contract only requires sources/checked_at/summary when external
      // institutional verification is actually required. A not_required record
      // may omit sources entirely; if sources are present, still validate them.
      if (required) {
        for (const field of CONTRACT.institutional_verification.required_fields_when_verification_required) {
          assert(Object.prototype.hasOwnProperty.call(verification, field), `institutional verification ${field} required for ${item.code}`);
        }
        assert(verification.status !== 'not_required', `institutional verification cannot be not_required for ${item.code}`);
        assert(isText(verification.summary), `institutional verification summary required for ${item.code}`);
        assert(isIsoTimestamp(verification.checked_at), `institutional verification checked_at must be ISO timestamp for ${item.code}`);
        validateVerificationSources(verification.sources, item.code);
      } else if (verification.sources != null) {
        validateVerificationSources(verification.sources, item.code);
      }
    }
  }

  if (ai.market_summary != null) {
    assert(ai.market_summary && typeof ai.market_summary === 'object', 'market_summary must be object');
    assert(isText(ai.market_summary.summary), 'market_summary.summary is required when market_summary exists');
    if (ai.market_summary.common_flow_clues != null) assert(Array.isArray(ai.market_summary.common_flow_clues), 'market_summary.common_flow_clues must be array');
  }
  if (ai.priority_watchlist != null) {
    assert(Array.isArray(ai.priority_watchlist), 'priority_watchlist must be array');
    for (const code of ai.priority_watchlist) assert(factCodes.includes(String(code)), `priority_watchlist contains unknown code ${code}`);
  }

  console.log(JSON.stringify({
    valid: true,
    contract_policy: CONTRACT.policy,
    contract_version: CONTRACT.contract_version,
    facts_methodology: CONTRACT.facts.methodology_version,
    ai_methodology: CONTRACT.ai.methodology_version,
    date,
    stock_count: facts.stock_count,
    stock_order_verified: true,
    ai_file: path.relative(ROOT, aiFile).replaceAll('\\', '/'),
  }, null, 2));
}

try { main(); } catch (error) { console.error(error.stack || error.message); process.exit(1); }
