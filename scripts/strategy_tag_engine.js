'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getPath(object, dottedPath) {
  return String(dottedPath || '').split('.').reduce((value, key) => (
    value !== null && value !== undefined ? value[key] : undefined
  ), object);
}

function firstDefined(object, rule = {}) {
  const paths = Array.isArray(rule.paths) ? rule.paths : [rule.path];
  for (const item of paths.filter(Boolean)) {
    const value = getPath(object, item);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateRule(stock, rule = {}) {
  const actual = firstDefined(stock, rule);
  const expected = rule.value;
  switch (rule.operator) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'lt': return finiteNumber(actual) !== null && finiteNumber(actual) < Number(expected);
    case 'lte': return finiteNumber(actual) !== null && finiteNumber(actual) <= Number(expected);
    case 'gt': return finiteNumber(actual) !== null && finiteNumber(actual) > Number(expected);
    case 'gte': return finiteNumber(actual) !== null && finiteNumber(actual) >= Number(expected);
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'contains': return Array.isArray(actual) && actual.includes(expected);
    case 'truthy': return Boolean(actual);
    case 'falsy': return !actual;
    default: throw new Error(`Unsupported tag operator: ${rule.operator}`);
  }
}

function expressionMatches(expression = {}, matchedIds = new Set()) {
  const all = Array.isArray(expression.all) ? expression.all : [];
  const any = Array.isArray(expression.any) ? expression.any : [];
  const not = Array.isArray(expression.not) ? expression.not : [];
  return all.every(id => matchedIds.has(id))
    && (!any.length || any.some(id => matchedIds.has(id)))
    && not.every(id => !matchedIds.has(id));
}

function legacyStrategyMatches(stock, selector = {}) {
  const strategyId = selector.strategy_id;
  const label = selector.label;
  return stock?.formal_market_strategy?.strategy_id === strategyId
    || Boolean(stock?.formal_market_strategies?.[strategyId])
    || (Array.isArray(stock?.strategy_tags) && stock.strategy_tags.includes(label));
}

function validateRegistry(registry) {
  if (!registry || !Array.isArray(registry.tags) || !Array.isArray(registry.strategies)) {
    throw new Error('Registry must contain tags and strategies arrays');
  }
  const tagIds = new Set();
  for (const tag of registry.tags) {
    if (!tag.tag_id || tagIds.has(tag.tag_id)) throw new Error(`Duplicate or missing tag_id: ${tag.tag_id}`);
    if (!Number.isInteger(tag.version) || tag.version < 1) throw new Error(`Invalid tag version: ${tag.tag_id}`);
    tagIds.add(tag.tag_id);
    for (const id of [...(tag.expression?.all || []), ...(tag.expression?.any || []), ...(tag.expression?.not || [])]) {
      if (!tagIds.has(id)) throw new Error(`Tag ${tag.tag_id} references unknown or later tag ${id}`);
    }
  }
  const strategyIds = new Set();
  for (const strategy of registry.strategies) {
    if (!strategy.strategy_id || strategyIds.has(strategy.strategy_id)) {
      throw new Error(`Duplicate or missing strategy_id: ${strategy.strategy_id}`);
    }
    if (!Number.isInteger(strategy.version) || strategy.version < 1) {
      throw new Error(`Invalid strategy version: ${strategy.strategy_id}`);
    }
    strategyIds.add(strategy.strategy_id);
    for (const id of [...(strategy.expression?.all || []), ...(strategy.expression?.any || []), ...(strategy.expression?.not || [])]) {
      if (!tagIds.has(id)) throw new Error(`Strategy ${strategy.strategy_id} references unknown tag ${id}`);
    }
  }
  return true;
}

function registryFingerprint(registry) {
  validateRegistry(registry);
  return crypto.createHash('sha256').update(JSON.stringify(registry)).digest('hex').slice(0, 16);
}

function evaluateStock(stock, registry) {
  const matched = new Set();
  for (const tag of registry.tags.filter(item => item.enabled !== false)) {
    const isMatch = tag.rule
      ? evaluateRule(stock, tag.rule)
      : expressionMatches(tag.expression, matched);
    if (isMatch) matched.add(tag.tag_id);
  }

  const strategyMatches = [];
  for (const strategy of registry.strategies.filter(item => item.enabled !== false)) {
    const isMatch = strategy.legacy_selector
      ? legacyStrategyMatches(stock, strategy.legacy_selector)
      : expressionMatches(strategy.expression, matched);
    if (isMatch) strategyMatches.push(strategy.strategy_id);
  }

  return {
    stock_code: String(stock.stock_code || ''),
    tag_ids: [...matched],
    strategy_ids: strategyMatches,
  };
}

function classification(definition, members, generatedAt, kind) {
  return {
    [`${kind}_id`]: definition[`${kind}_id`],
    family_id: definition.family_id,
    version: definition.version,
    label: definition.label,
    category: definition.category || null,
    fixed_display: definition.fixed_display !== false,
    enabled: definition.enabled !== false,
    calculation_status: 'completed',
    count: members.length,
    members,
    expression: definition.expression || null,
    rule: definition.rule || null,
    evaluation_target: definition.evaluation_target || null,
    generated_at: generatedAt,
  };
}

function buildSnapshot(payload, registry, options = {}) {
  validateRegistry(registry);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const evaluationMode = options.evaluationMode || 'live_snapshot';
  const stocks = Array.isArray(payload?.stocks) ? payload.stocks : [];
  const evaluations = stocks.map(stock => evaluateStock(stock, registry));
  const byCode = new Map(evaluations.map(item => [item.stock_code, item]));

  for (const stock of stocks) {
    const evaluation = byCode.get(String(stock.stock_code || ''));
    stock.atomic_tags = evaluation?.tag_ids || [];
    stock.registered_strategy_matches = evaluation?.strategy_ids || [];
  }

  const tagClassifications = {};
  for (const tag of registry.tags.filter(item => item.enabled !== false)) {
    const members = evaluations.filter(item => item.tag_ids.includes(tag.tag_id)).map(item => item.stock_code);
    tagClassifications[tag.tag_id] = classification(tag, members, generatedAt, 'tag');
  }

  const strategyClassifications = {};
  for (const strategy of registry.strategies.filter(item => item.enabled !== false)) {
    const members = evaluations.filter(item => item.strategy_ids.includes(strategy.strategy_id)).map(item => item.stock_code);
    strategyClassifications[strategy.strategy_id] = classification(strategy, members, generatedAt, 'strategy');
  }

  return {
    schema_version: 2,
    registry_id: registry.registry_id,
    registry_fingerprint: registryFingerprint(registry),
    forecast_date: payload.forecast_date || options.forecastDate || null,
    base_trade_date: payload.base_trade_date || null,
    evaluation_mode: evaluationMode,
    data_as_of: options.dataAsOf || payload.base_trade_date || null,
    generated_at: generatedAt,
    tag_registry: registry.tags.map(({ rule, expression, ...item }) => ({ ...item, rule, expression })),
    strategy_registry: registry.strategies.map(({ expression, legacy_selector, ...item }) => ({ ...item, expression, legacy_selector })),
    tag_classifications: tagClassifications,
    strategy_classifications: strategyClassifications,
    stocks,
  };
}

function loadRegistry(root = path.resolve(__dirname, '..')) {
  return readJson(path.join(root, 'config', 'strategy-tag-registry.json'));
}

module.exports = {
  getPath,
  firstDefined,
  finiteNumber,
  evaluateRule,
  expressionMatches,
  legacyStrategyMatches,
  validateRegistry,
  registryFingerprint,
  evaluateStock,
  buildSnapshot,
  loadRegistry,
};
