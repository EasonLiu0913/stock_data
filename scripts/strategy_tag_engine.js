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
    // undefined means the field does not exist and may use a legacy fallback.
    // null is an explicit "unable to calculate" result and must stop fallback.
    if (value !== undefined && value !== '') return value;
  }
  return null;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateRuleState(stock, rule = {}) {
  const actual = firstDefined(stock, rule);
  if (actual === null) return null;
  const expected = rule.value;
  switch (rule.operator) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'lt': return finiteNumber(actual) !== null ? finiteNumber(actual) < Number(expected) : null;
    case 'lte': return finiteNumber(actual) !== null ? finiteNumber(actual) <= Number(expected) : null;
    case 'gt': return finiteNumber(actual) !== null ? finiteNumber(actual) > Number(expected) : null;
    case 'gte': return finiteNumber(actual) !== null ? finiteNumber(actual) >= Number(expected) : null;
    case 'in': return Array.isArray(expected) ? expected.includes(actual) : null;
    case 'contains': return Array.isArray(actual) ? actual.includes(expected) : null;
    case 'truthy': return Boolean(actual);
    case 'falsy': return !actual;
    default: throw new Error(`Unsupported tag operator: ${rule.operator}`);
  }
}

function evaluateRule(stock, rule = {}) {
  return evaluateRuleState(stock, rule) === true;
}

function triStateAnd(values) {
  if (values.some(value => value === false)) return false;
  if (values.every(value => value === true)) return true;
  return null;
}

function triStateAny(values) {
  if (!values.length) return true;
  if (values.some(value => value === true)) return true;
  if (values.every(value => value === false)) return false;
  return null;
}

function expressionState(expression = {}, states = new Map()) {
  const all = Array.isArray(expression.all) ? expression.all : [];
  const any = Array.isArray(expression.any) ? expression.any : [];
  const not = Array.isArray(expression.not) ? expression.not : [];
  const allState = all.length ? triStateAnd(all.map(id => states.get(id) ?? null)) : true;
  const anyState = triStateAny(any.map(id => states.get(id) ?? null));
  const notState = not.length
    ? triStateAnd(not.map(id => {
      const value = states.get(id);
      return value === null || value === undefined ? null : !value;
    }))
    : true;
  return triStateAnd([allState, anyState, notState]);
}

function expressionMatches(expression = {}, matchedIds = new Set()) {
  const states = new Map();
  for (const id of [
    ...(expression.all || []),
    ...(expression.any || []),
    ...(expression.not || []),
  ]) states.set(id, matchedIds.has(id));
  return expressionState(expression, states) === true;
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
  const tagStates = new Map();
  for (const tag of registry.tags.filter(item => item.enabled !== false)) {
    const state = tag.rule
      ? evaluateRuleState(stock, tag.rule)
      : expressionState(tag.expression, tagStates);
    tagStates.set(tag.tag_id, state);
  }

  const strategyStates = new Map();
  for (const strategy of registry.strategies.filter(item => item.enabled !== false)) {
    const state = strategy.legacy_selector
      ? legacyStrategyMatches(stock, strategy.legacy_selector)
      : expressionState(strategy.expression, tagStates);
    strategyStates.set(strategy.strategy_id, state);
  }

  return {
    stock_code: String(stock.stock_code || ''),
    tag_ids: [...tagStates].filter(([, state]) => state === true).map(([id]) => id),
    unavailable_tag_ids: [...tagStates].filter(([, state]) => state === null).map(([id]) => id),
    strategy_ids: [...strategyStates].filter(([, state]) => state === true).map(([id]) => id),
    unavailable_strategy_ids: [...strategyStates].filter(([, state]) => state === null).map(([id]) => id),
    tag_states: Object.fromEntries(tagStates),
    strategy_states: Object.fromEntries(strategyStates),
  };
}

function classification(definition, evaluations, stateKey, generatedAt, kind) {
  const id = definition[`${kind}_id`];
  const available = evaluations.filter(item => item[stateKey]?.[id] !== null && item[stateKey]?.[id] !== undefined);
  const members = available.filter(item => item[stateKey][id] === true).map(item => item.stock_code);
  const unavailableCount = evaluations.length - available.length;
  const calculationStatus = available.length === 0
    ? 'unable_to_calculate'
    : unavailableCount > 0 ? 'partial' : 'completed';
  return {
    [`${kind}_id`]: id,
    family_id: definition.family_id,
    version: definition.version,
    label: definition.label,
    category: definition.category || null,
    fixed_display: definition.fixed_display !== false,
    enabled: definition.enabled !== false,
    calculation_status: calculationStatus,
    calculation_message: calculationStatus === 'unable_to_calculate'
      ? '缺少所需資料，無法計算。'
      : calculationStatus === 'partial'
        ? `部分股票資料不足；可計算 ${available.length}／${evaluations.length} 檔。`
        : members.length ? `已完成計算，共 ${members.length} 檔。` : '已完成計算，當日 0 檔。',
    count: calculationStatus === 'unable_to_calculate' ? null : members.length,
    members,
    total_stock_count: evaluations.length,
    available_stock_count: available.length,
    unavailable_stock_count: unavailableCount,
    coverage_pct: evaluations.length ? Math.round((available.length / evaluations.length) * 10000) / 100 : null,
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
    stock.unavailable_atomic_tags = evaluation?.unavailable_tag_ids || [];
    stock.registered_strategy_matches = evaluation?.strategy_ids || [];
    stock.unavailable_registered_strategies = evaluation?.unavailable_strategy_ids || [];
  }

  const tagClassifications = {};
  for (const tag of registry.tags.filter(item => item.enabled !== false)) {
    tagClassifications[tag.tag_id] = classification(tag, evaluations, 'tag_states', generatedAt, 'tag');
  }

  const strategyClassifications = {};
  for (const strategy of registry.strategies.filter(item => item.enabled !== false)) {
    strategyClassifications[strategy.strategy_id] = classification(
      strategy,
      evaluations,
      'strategy_states',
      generatedAt,
      'strategy',
    );
  }

  return {
    schema_version: 3,
    registry_id: registry.registry_id,
    registry_fingerprint: registryFingerprint(registry),
    forecast_date: payload.forecast_date || options.forecastDate || null,
    base_trade_date: payload.base_trade_date || null,
    evaluation_mode: evaluationMode,
    data_as_of: options.dataAsOf || payload.base_trade_date || null,
    generated_at: generatedAt,
    source_metadata: payload.strategy_tag_source_metadata || null,
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
  evaluateRuleState,
  evaluateRule,
  triStateAnd,
  triStateAny,
  expressionState,
  expressionMatches,
  legacyStrategyMatches,
  validateRegistry,
  registryFingerprint,
  evaluateStock,
  buildSnapshot,
  loadRegistry,
};
