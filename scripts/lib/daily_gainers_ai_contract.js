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
  for (const key of ['facts', 'ai', 'published', 'market_summary']) {
    assert(contract[key] && typeof contract[key] === 'object', `${key} contract is required`);
    assert(Number.isInteger(contract[key].schema_version), `${key}.schema_version must be an integer`);
    assert(typeof contract[key].methodology_version === 'string' && contract[key].methodology_version.length > 0, `${key}.methodology_version is required`);
  }
  assert(typeof contract.ai.model_role === 'string' && contract.ai.model_role.length > 0, 'ai.model_role is required');
  assert(typeof contract.published.path_template === 'string' && contract.published.path_template.includes('YYYYMMDD'), 'published.path_template is required');

  const summary = contract.market_summary;
  assert(typeof summary.path_template === 'string' && summary.path_template.includes('YYYYMMDD'), 'market_summary.path_template is required');
  assert(typeof summary.manifest_path === 'string' && summary.manifest_path.length > 0, 'market_summary.manifest_path is required');
  assert(typeof summary.theme_taxonomy_path === 'string' && summary.theme_taxonomy_path.length > 0, 'market_summary.theme_taxonomy_path is required');
  for (const key of ['allowed_statuses', 'coverage_statuses', 'allowed_market_regimes', 'required_fields', 'rules']) {
    assert(Array.isArray(summary[key]) && summary[key].length > 0, `market_summary.${key} must be a non-empty array`);
  }
  for (const field of ['source_lineage', 'coverage', 'breadth', 'market_context', 'theme_summary', 'catalyst_coverage', 'funding_summary', 'risk_signals', 'headline', 'market_summary', 'next_day_watch']) {
    assert(summary.required_fields.includes(field), `market_summary.required_fields must include ${field}`);
  }
  const taxonomyPath = path.resolve(ROOT, summary.theme_taxonomy_path);
  assert(fs.existsSync(taxonomyPath), `market_summary theme taxonomy is missing: ${summary.theme_taxonomy_path}`);
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
  assert(Array.isArray(taxonomy.themes) && taxonomy.themes.length > 0, 'theme taxonomy themes must be non-empty');
  const ids = new Set();
  const aliasOwners = new Map();
  for (const theme of taxonomy.themes) {
    assert(typeof theme.id === 'string' && /^[a-z0-9_]+$/.test(theme.id), `invalid theme id ${theme.id}`);
    assert(!ids.has(theme.id), `duplicate theme id ${theme.id}`);
    ids.add(theme.id);
    assert(typeof theme.label === 'string' && theme.label.length > 0, `theme ${theme.id} label is required`);
    assert(Array.isArray(theme.aliases), `theme ${theme.id} aliases must be an array`);
    for (const rawAlias of [theme.id, ...theme.aliases]) {
      const alias = String(rawAlias).toLowerCase();
      const owner = aliasOwners.get(alias);
      assert(!owner || owner === theme.id, `theme alias ${alias} is shared by ${owner} and ${theme.id}`);
      aliasOwners.set(alias, theme.id);
    }
  }
  assert(typeof taxonomy.fallback_theme?.id === 'string', 'theme taxonomy fallback_theme.id is required');

  for (const key of ['cause_types', 'evidence_strength_values', 'confidence_values', 'required_ai_analysis_fields', 'required_published_analysis_fields', 'rules']) {
    assert(Array.isArray(contract[key]) && contract[key].length > 0, `${key} must be a non-empty array`);
  }
  assert(Array.isArray(contract.institutional_verification?.required_record_statuses), 'institutional_verification.required_record_statuses must be an array');
  assert(Array.isArray(contract.institutional_verification?.allowed_statuses), 'institutional_verification.allowed_statuses must be an array');
  assert(Array.isArray(contract.institutional_verification?.required_fields_when_verification_required), 'institutional_verification.required_fields_when_verification_required must be an array');
  for (const field of ['status', 'summary', 'checked_at', 'sources']) {
    assert(contract.institutional_verification.required_fields_when_verification_required.includes(field), `institutional_verification.required_fields_when_verification_required must include ${field}`);
  }
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

function isLatestPublished(payload) {
  return Boolean(payload)
    && payload.schema_version === DAILY_GAINERS_AI_CONTRACT.published.schema_version
    && payload.methodology_version === DAILY_GAINERS_AI_CONTRACT.published.methodology_version;
}

function isLatestMarketSummary(payload) {
  return Boolean(payload)
    && payload.schema_version === DAILY_GAINERS_AI_CONTRACT.market_summary.schema_version
    && payload.methodology_version === DAILY_GAINERS_AI_CONTRACT.market_summary.methodology_version
    && payload.contract_version === DAILY_GAINERS_AI_CONTRACT.contract_version;
}

module.exports = {
  CONTRACT_PATH,
  DAILY_GAINERS_AI_CONTRACT,
  loadDailyGainersAiContract,
  isLatestFacts,
  isLatestAi,
  isLatestPublished,
  isLatestMarketSummary,
};
