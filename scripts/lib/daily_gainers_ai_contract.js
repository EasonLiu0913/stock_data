'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CONTRACT_PATH = path.join(ROOT, 'config', 'daily-gainers-ai-contract.json');

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid daily gainers AI contract: ${message}`);
}

function loadDailyGainersAiContract() {
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  assert(Number.isInteger(contract.contract_version), 'contract_version must be an integer');
  assert(contract.policy === 'latest-rules-only', 'policy must be latest-rules-only');
  for (const key of ['facts', 'ai']) {
    assert(contract[key] && typeof contract[key] === 'object', `${key} contract is required`);
    assert(Number.isInteger(contract[key].schema_version), `${key}.schema_version must be an integer`);
    assert(typeof contract[key].methodology_version === 'string' && contract[key].methodology_version.length > 0, `${key}.methodology_version is required`);
  }
  assert(typeof contract.ai.model_role === 'string' && contract.ai.model_role.length > 0, 'ai.model_role is required');
  assert(Array.isArray(contract.institutional_verification?.required_record_statuses), 'institutional_verification.required_record_statuses must be an array');
  assert(Array.isArray(contract.institutional_verification?.allowed_statuses), 'institutional_verification.allowed_statuses must be an array');
  return Object.freeze(contract);
}

const DAILY_GAINERS_AI_CONTRACT = loadDailyGainersAiContract();

function isLatestFacts(payload) {
  return Boolean(payload)
    && payload.schema_version === DAILY_GAINERS_AI_CONTRACT.facts.schema_version
    && payload.methodology_version === DAILY_GAINERS_AI_CONTRACT.facts.methodology_version;
}

function isLatestAi(payload) {
  return Boolean(payload)
    && payload.schema_version === DAILY_GAINERS_AI_CONTRACT.ai.schema_version
    && payload.methodology_version === DAILY_GAINERS_AI_CONTRACT.ai.methodology_version;
}

module.exports = {
  CONTRACT_PATH,
  DAILY_GAINERS_AI_CONTRACT,
  loadDailyGainersAiContract,
  isLatestFacts,
  isLatestAi,
};
