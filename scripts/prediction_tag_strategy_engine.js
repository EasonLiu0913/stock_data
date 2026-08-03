#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  readJson,
  atomicWriteJson,
  round,
} = require('./market_environment_lib');
const {
  loadLiquidityContext,
  summarizeStocks,
} = require('./apply_formal_market_strategy_tags');

const DEFAULT_REGISTRY_FILE = path.join(ROOT, 'config', 'prediction-tag-strategy-registry.json');
const MARGIN_DIRECTORY = path.join(ROOT, 'data_twse_margin_balance');

function compactDate(value) {
  const compact = String(value || '').replaceAll('-', '').replaceAll('/', '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(number) ? number : null;
}

function getPath(object, dottedPath) {
  return String(dottedPath || '').split('.').filter(Boolean)
    .reduce((value, key) => value === null || value === undefined ? undefined : value[key], object);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function loadMarginBalances(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (rows.length < 2) return new Map();
  const headers = rows[0].map(value => String(value).trim());
  const codeIndex = headers.findIndex(value => ['股票代號', '證券代號', '代號'].includes(value));
  const balanceIndex = headers.findIndex(value => value === '融資今日餘額');
  if (codeIndex < 0 || balanceIndex < 0) return new Map();
  const output = new Map();
  for (const row of rows.slice(1)) {
    const code = String(row[codeIndex] || '').trim();
    const balance = finiteNumber(row[balanceIndex]);
    if (!/^\d{4,6}[A-Z]?$/.test(code) || balance === null) continue;
    output.set(code, balance);
  }
  return output;
}

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return round((current - previous) / previous * 100, 4);
}

function loadMarginContext(baseTradeDate, options = {}) {
  const cutoff = compactDate(baseTradeDate);
  const directory = path.resolve(options.marginDirectory || MARGIN_DIRECTORY);
  if (!cutoff || !fs.existsSync(directory)) {
    return {
      available: false,
      calculation_status: 'unable_to_calculate',
      reason: !cutoff ? 'missing_base_trade_date' : 'missing_margin_directory',
      dates: [],
      by_code: new Map(),
    };
  }
  const files = fs.readdirSync(directory)
    .filter(name => /^(20\d{6})_twse_margin_balance\.csv$/.test(name))
    .map(name => ({ name, date: name.slice(0, 8) }))
    .filter(item => item.date <= cutoff)
    .sort((left, right) => left.date.localeCompare(right.date));
  const currentFile = files.at(-1);
  if (!currentFile || currentFile.date !== cutoff) {
    return {
      available: false,
      calculation_status: 'unable_to_calculate',
      reason: currentFile ? 'latest_margin_date_does_not_match_base_date' : 'missing_margin_files',
      dates: files.slice(-6).map(item => item.date),
      latest_available_date: currentFile?.date || null,
      expected_date: cutoff,
      by_code: new Map(),
    };
  }

  const selected = files.slice(-6);
  const maps = selected.map(item => ({
    date: item.date,
    balances: loadMarginBalances(path.join(directory, item.name)),
  }));
  const current = maps.at(-1);
  const previous = maps.at(-2) || null;
  const fiveDaysAgo = maps.length >= 6 ? maps[0] : null;
  const codes = new Set(current.balances.keys());
  const byCode = new Map();
  for (const code of codes) {
    const currentBalance = current.balances.get(code);
    const previousBalance = previous?.balances.get(code);
    const fiveDayBalance = fiveDaysAgo?.balances.get(code);
    byCode.set(code, {
      current_date: current.date,
      current_balance: currentBalance,
      previous_date: previous?.date || null,
      previous_balance: previousBalance ?? null,
      five_day_base_date: fiveDaysAgo?.date || null,
      five_day_base_balance: fiveDayBalance ?? null,
      change_1d: Number.isFinite(previousBalance) ? currentBalance - previousBalance : null,
      change_1d_pct: percentChange(currentBalance, previousBalance),
      change_5d: Number.isFinite(fiveDayBalance) ? currentBalance - fiveDayBalance : null,
      change_5d_pct: percentChange(currentBalance, fiveDayBalance),
    });
  }
  return {
    available: true,
    calculation_status: maps.length >= 6 ? 'completed' : 'partial',
    reason: maps.length >= 6 ? 'completed' : 'insufficient_five_day_history',
    dates: maps.map(item => item.date),
    current_date: current.date,
    by_code: byCode,
  };
}

function loadRegistry(file = DEFAULT_REGISTRY_FILE) {
  const registry = readJson(path.resolve(file), null);
  if (!registry || !Array.isArray(registry.tags) || !Array.isArray(registry.strategies)) {
    throw new Error(`Invalid tag strategy registry: ${file}`);
  }
  const tagIds = new Set();
  for (const tag of registry.tags) {
    if (!tag.tag_id || tagIds.has(tag.tag_id)) throw new Error(`Duplicate or missing tag_id: ${tag.tag_id}`);
    tagIds.add(tag.tag_id);
  }
  const strategyIds = new Set();
  for (const strategy of registry.strategies) {
    if (!strategy.strategy_id || strategyIds.has(strategy.strategy_id)) {
      throw new Error(`Duplicate or missing strategy_id: ${strategy.strategy_id}`);
    }
    strategyIds.add(strategy.strategy_id);
    for (const tagId of [
      ...(strategy.expression?.all || []),
      ...(strategy.expression?.any || []),
      ...(strategy.expression?.not || []),
    ]) {
      if (!tagIds.has(tagId)) throw new Error(`Strategy ${strategy.strategy_id} references unknown tag ${tagId}`);
    }
  }
  return registry;
}

function result(status, matched, metadata = {}) {
  return { status, matched, ...metadata };
}

function formalStrategyMembership(stock, strategyId) {
  return Boolean(
    stock?.formal_market_strategies?.[strategyId]
    || stock?.formal_market_strategy?.strategy_id === strategyId
  );
}

function dispositionState(stock) {
  return Boolean(
    stock?.is_disposition_stock === true
    || stock?.disposition_stock === true
    || stock?.market_constraints?.disposition?.active === true
    || stock?.official_market_constraints?.disposition?.active === true
    || stock?.disposition?.active === true
  );
}

function evaluateTag(stock, definition, context) {
  const parameters = definition.parameters || {};
  const code = String(stock?.stock_code || '');
  if (definition.rule_id === 'formal_strategy_membership') {
    const matched = formalStrategyMembership(stock, parameters.strategy_id);
    return result(matched ? 'matched' : 'not_matched', matched, {
      metrics: { strategy_id: parameters.strategy_id },
    });
  }
  if (definition.rule_id === 'feature_lte' || definition.rule_id === 'feature_gte') {
    const value = finiteNumber(getPath(stock, parameters.path));
    if (value === null) return result('unavailable', false, { reason: 'missing_feature', metrics: { path: parameters.path, value: null } });
    const threshold = Number(parameters.threshold);
    const matched = definition.rule_id === 'feature_lte' ? value <= threshold : value >= threshold;
    return result(matched ? 'matched' : 'not_matched', matched, {
      metrics: { path: parameters.path, value, threshold },
    });
  }
  if (definition.rule_id === 'reversal_signal_present') {
    const tags = Array.isArray(stock?.reversal_signals?.tags) ? stock.reversal_signals.tags : [];
    const flags = [
      stock?.reversal_signals?.crossed_sma20,
      stock?.reversal_signals?.crossed_sma60,
      stock?.reversal_signals?.macd_bullish_cross,
      stock?.reversal_signals?.macd_histogram_positive_turn,
      stock?.reversal_signals?.kd_bullish_cross,
      stock?.reversal_signals?.kd_oversold_turn,
    ];
    const matched = tags.length > 0 || flags.some(Boolean);
    return result(matched ? 'matched' : 'not_matched', matched, { metrics: { tags } });
  }
  if (definition.rule_id === 'industry_in') {
    const industry = String(stock?.industry || '');
    const matched = (parameters.industries || []).includes(industry);
    return result(matched ? 'matched' : 'not_matched', matched, { metrics: { industry } });
  }
  if (definition.rule_id === 'liquidity_qualified') {
    if (!context.liquidity?.available) return result('unavailable', false, { reason: context.liquidity?.reason || 'liquidity_unavailable' });
    const item = context.liquidity.by_code?.get(code) || null;
    if (!item) return result('unavailable', false, { reason: 'stock_liquidity_unavailable' });
    return result(item.pass ? 'matched' : 'not_matched', Boolean(item.pass), { metrics: item });
  }
  if (definition.rule_id === 'disposition_stock') {
    const matched = dispositionState(stock);
    return result(matched ? 'matched' : 'not_matched', matched, { metrics: { disposition_stock: matched } });
  }
  if (definition.rule_id === 'margin_change_lte') {
    if (!context.margin?.available) return result('unavailable', false, { reason: context.margin?.reason || 'margin_unavailable' });
    const item = context.margin.by_code?.get(code) || null;
    if (!item) return result('unavailable', false, { reason: 'stock_margin_unavailable' });
    const window = Number(parameters.window) === 5 ? 5 : 1;
    const value = window === 5 ? item.change_5d_pct : item.change_1d_pct;
    if (!Number.isFinite(value)) return result('unavailable', false, { reason: `margin_${window}d_change_unavailable`, metrics: item });
    const matched = value <= Number(parameters.threshold_pct ?? 0);
    return result(matched ? 'matched' : 'not_matched', matched, { metrics: { ...item, selected_change_pct: value } });
  }
  if (definition.rule_id === 'margin_significant_exit') {
    if (!context.margin?.available) return result('unavailable', false, { reason: context.margin?.reason || 'margin_unavailable' });
    const item = context.margin.by_code?.get(code) || null;
    if (!item) return result('unavailable', false, { reason: 'stock_margin_unavailable' });
    const fiveThreshold = Number(parameters.five_day_threshold_pct ?? -5);
    const oneThreshold = Number(parameters.one_day_threshold_pct ?? -3);
    const hasFiveDay = Number.isFinite(item.change_5d_pct);
    const hasOneDay = Number.isFinite(item.change_1d_pct);
    if (!hasFiveDay && !hasOneDay) return result('unavailable', false, { reason: 'margin_change_unavailable', metrics: item });
    const matched = (hasFiveDay && item.change_5d_pct <= fiveThreshold)
      || (hasOneDay && item.change_1d_pct <= oneThreshold);
    return result(matched ? 'matched' : 'not_matched', matched, {
      metrics: { ...item, five_day_threshold_pct: fiveThreshold, one_day_threshold_pct: oneThreshold },
    });
  }
  return result('unavailable', false, { reason: `unknown_rule:${definition.rule_id}` });
}

function evaluateExpression(expression, evaluations) {
  const allIds = expression?.all || [];
  const anyIds = expression?.any || [];
  const notIds = expression?.not || [];
  const all = allIds.map(id => [id, evaluations[id]]);
  const any = anyIds.map(id => [id, evaluations[id]]);
  const excluded = notIds.map(id => [id, evaluations[id]]);

  const failedAll = all.filter(([, item]) => item?.status === 'not_matched').map(([id]) => id);
  const unavailableAll = all.filter(([, item]) => !item || item.status === 'unavailable').map(([id]) => id);
  const matchedAny = any.filter(([, item]) => item?.matched).map(([id]) => id);
  const unavailableAny = any.filter(([, item]) => !item || item.status === 'unavailable').map(([id]) => id);
  const matchedNot = excluded.filter(([, item]) => item?.matched).map(([id]) => id);
  const unavailableNot = excluded.filter(([, item]) => !item || item.status === 'unavailable').map(([id]) => id);

  if (failedAll.length || matchedNot.length || (anyIds.length && !matchedAny.length && !unavailableAny.length)) {
    return result('not_matched', false, {
      failed_all: failedAll,
      failed_any: anyIds.length && !matchedAny.length ? anyIds : [],
      excluded_by: matchedNot,
      unavailable_tags: [...unavailableAll, ...unavailableAny, ...unavailableNot],
    });
  }
  if (unavailableAll.length || unavailableNot.length || (anyIds.length && !matchedAny.length && unavailableAny.length)) {
    return result('unavailable', false, {
      failed_all: [],
      failed_any: [],
      excluded_by: [],
      unavailable_tags: [...unavailableAll, ...unavailableAny, ...unavailableNot],
    });
  }
  return result('matched', true, {
    matched_all: allIds,
    matched_any: matchedAny,
    excluded_by: [],
    unavailable_tags: [],
  });
}

function summarizeClassification(definition, stockEvaluations, generatedAt) {
  const entries = [...stockEvaluations.entries()];
  const members = entries.filter(([, item]) => item.matched).map(([code]) => code);
  const unavailableMembers = entries.filter(([, item]) => item.status === 'unavailable').map(([code]) => code);
  const calculationStatus = entries.length && unavailableMembers.length === entries.length
    ? 'unable_to_calculate'
    : unavailableMembers.length ? 'partial' : 'completed';
  return {
    id: definition.tag_id || definition.strategy_id,
    family_id: definition.family_id,
    version: definition.version,
    label: definition.label,
    category: definition.category || 'strategy',
    fixed_display: definition.fixed_display === true,
    enabled: definition.enabled !== false,
    calculation_status: calculationStatus,
    count: calculationStatus === 'unable_to_calculate' ? null : members.length,
    members: calculationStatus === 'unable_to_calculate' ? [] : members,
    unavailable_count: unavailableMembers.length,
    unavailable_members: unavailableMembers,
    generated_at: generatedAt,
  };
}

function registryView(registry) {
  const tags = registry.tags.filter(item => item.enabled !== false).map(item => ({
    tag_id: item.tag_id,
    family_id: item.family_id,
    version: item.version,
    label: item.label,
    category: item.category,
    fixed_display: item.fixed_display === true,
    rule_id: item.rule_id,
    parameters: item.parameters || {},
  }));
  const strategies = registry.strategies.filter(item => item.enabled !== false).map(item => ({
    strategy_id: item.strategy_id,
    family_id: item.family_id,
    version: item.version,
    label: item.label,
    description: item.description || '',
    expression: item.expression || { all: [], any: [], not: [] },
    evaluation_target: item.evaluation_target || null,
    fixed_display: item.fixed_display === true,
    effective_from: item.effective_from || null,
    source_mode: item.source_mode || 'tag_expression',
  }));
  return {
    schema_version: registry.schema_version,
    registry_id: registry.registry_id,
    display_policy: registry.display_policy || {},
    tags,
    strategies,
  };
}

function buildTagStrategySnapshot(summary, options = {}) {
  if (!Array.isArray(summary?.stocks)) throw new Error('summary.stocks is required');
  const registry = options.registry || loadRegistry(options.registryFile);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const context = options.context || {
    margin: loadMarginContext(summary.base_trade_date, options),
    liquidity: loadLiquidityContext(summary.stocks, summary.base_trade_date),
  };
  const enabledTags = registry.tags.filter(item => item.enabled !== false);
  const enabledStrategies = registry.strategies.filter(item => item.enabled !== false);
  const tagEvaluations = new Map(enabledTags.map(item => [item.tag_id, new Map()]));
  const strategyEvaluations = new Map(enabledStrategies.map(item => [item.strategy_id, new Map()]));

  for (const stock of summary.stocks) {
    const code = String(stock.stock_code);
    const evaluations = {};
    for (const definition of enabledTags) {
      const evaluation = evaluateTag(stock, definition, context);
      evaluations[definition.tag_id] = evaluation;
      tagEvaluations.get(definition.tag_id).set(code, evaluation);
    }
    const matchedTags = enabledTags.filter(item => evaluations[item.tag_id].matched).map(item => item.tag_id);
    const strategyDetails = {};
    for (const definition of enabledStrategies) {
      const evaluation = evaluateExpression(definition.expression, evaluations);
      strategyDetails[definition.strategy_id] = evaluation;
      strategyEvaluations.get(definition.strategy_id).set(code, evaluation);
    }
    const matchedStrategies = enabledStrategies
      .filter(item => strategyDetails[item.strategy_id].matched)
      .map(item => item.strategy_id);

    stock.prediction_tags = matchedTags;
    stock.prediction_tag_metrics = Object.fromEntries(
      enabledTags
        .filter(item => evaluations[item.tag_id].matched || evaluations[item.tag_id].status === 'unavailable')
        .map(item => [item.tag_id, evaluations[item.tag_id]]),
    );
    stock.prediction_strategies = matchedStrategies;
    stock.prediction_strategy_details = strategyDetails;

    const strategyTags = Array.isArray(stock.strategy_tags) ? stock.strategy_tags : [];
    const expressionLabels = new Set(enabledStrategies.filter(item => item.source_mode !== 'legacy_bridge').map(item => item.label));
    stock.strategy_tags = strategyTags.filter(label => !expressionLabels.has(label));
    for (const definition of enabledStrategies) {
      if (definition.source_mode !== 'legacy_bridge' && strategyDetails[definition.strategy_id].matched) {
        stock.strategy_tags.unshift(definition.label);
      }
    }
    stock.strategy_tags = [...new Set(stock.strategy_tags)];
  }

  const tagClassifications = Object.fromEntries(enabledTags.map(definition => [
    definition.tag_id,
    summarizeClassification(definition, tagEvaluations.get(definition.tag_id), generatedAt),
  ]));
  const strategyClassifications = Object.fromEntries(enabledStrategies.map(definition => [
    definition.strategy_id,
    {
      ...summarizeClassification(definition, strategyEvaluations.get(definition.strategy_id), generatedAt),
      description: definition.description || '',
      expression: definition.expression,
      evaluation_target: definition.evaluation_target || null,
      source_mode: definition.source_mode || 'tag_expression',
    },
  ]));

  return {
    schema_version: 1,
    generated_at: generatedAt,
    forecast_date: summary.forecast_date,
    base_trade_date: summary.base_trade_date,
    evaluation_mode: options.evaluationMode || 'live_snapshot',
    data_as_of: compactDate(summary.base_trade_date),
    registry: registryView(registry),
    tag_classifications: tagClassifications,
    strategy_classifications: strategyClassifications,
    data_status: {
      margin: {
        calculation_status: context.margin?.calculation_status || 'unable_to_calculate',
        reason: context.margin?.reason || null,
        dates: context.margin?.dates || [],
      },
      liquidity: {
        calculation_status: context.liquidity?.available ? 'completed' : 'unable_to_calculate',
        reason: context.liquidity?.reason || null,
      },
    },
  };
}

function upsertStrategyGroups(summary, groupSummary, snapshot) {
  if (!Array.isArray(groupSummary.groups)) groupSummary.groups = [];
  const registryById = new Map(snapshot.registry.strategies.map(item => [item.strategy_id, item]));
  const newStrategyIds = new Set(snapshot.registry.strategies
    .filter(item => item.source_mode !== 'legacy_bridge')
    .map(item => item.strategy_id));
  groupSummary.groups = groupSummary.groups.filter(group => !newStrategyIds.has(group?.strategy_id));
  for (const [strategyId, classification] of Object.entries(snapshot.strategy_classifications)) {
    const definition = registryById.get(strategyId);
    if (!definition || definition.source_mode === 'legacy_bridge') continue;
    const members = new Set(classification.members || []);
    const stocks = summary.stocks.filter(stock => members.has(String(stock.stock_code)));
    const aggregate = classification.calculation_status === 'unable_to_calculate'
      ? { ...summarizeStocks([]), count: null }
      : summarizeStocks(stocks);
    groupSummary.groups.push({
      group: definition.label,
      ...aggregate,
      strategy_id: strategyId,
      strategy_family_id: definition.family_id,
      strategy_version: definition.version,
      registered_strategy: true,
      fixed_display: definition.fixed_display,
      calculation_status: classification.calculation_status,
      status_label: classification.calculation_status === 'unable_to_calculate'
        ? '無法計算'
        : classification.count === 0 ? '已完成計算，當日 0 筆' : '已完成計算',
      evaluation_target: definition.evaluation_target,
      expression: definition.expression,
      members: classification.members,
      unavailable_count: classification.unavailable_count,
    });
  }
  groupSummary.groups.sort((left, right) => Number(right.count || 0) - Number(left.count || 0)
    || String(left.group).localeCompare(String(right.group), 'zh-Hant'));
}

function applyTagStrategySnapshot({
  rootDir = 'data_predictions',
  date,
  registryFile = DEFAULT_REGISTRY_FILE,
  dryRun = false,
  evaluationMode = 'live_snapshot',
} = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const predictionDir = path.join(ROOT, rootDir, compact);
  const summaryFile = path.join(predictionDir, 'summary.json');
  const groupSummaryFile = path.join(predictionDir, 'group-summary.json');
  const snapshotFile = path.join(predictionDir, 'tag-strategy-snapshot.json');
  const summary = readJson(summaryFile, null);
  if (!Array.isArray(summary?.stocks)) {
    return { skipped: true, reason: 'missing_summary', date: compact, root_dir: rootDir };
  }
  const groupSummary = readJson(groupSummaryFile, {
    generated_at: summary.generated_at,
    forecast_date: summary.forecast_date,
    base_trade_date: summary.base_trade_date,
    groups: [],
  });
  const registry = loadRegistry(registryFile);
  const snapshot = buildTagStrategySnapshot(summary, { registry, evaluationMode });
  summary.tag_strategy_registry = snapshot.registry;
  summary.tag_classifications = snapshot.tag_classifications;
  summary.strategy_classifications = snapshot.strategy_classifications;
  summary.tag_strategy_snapshot = {
    schema_version: snapshot.schema_version,
    generated_at: snapshot.generated_at,
    evaluation_mode: snapshot.evaluation_mode,
    data_as_of: snapshot.data_as_of,
    source_file: `${rootDir}/${compact}/tag-strategy-snapshot.json`,
  };
  upsertStrategyGroups(summary, groupSummary, snapshot);
  groupSummary.generated_at = snapshot.generated_at;
  groupSummary.tag_strategy_registry = snapshot.registry;
  groupSummary.tag_classifications = snapshot.tag_classifications;
  groupSummary.strategy_classifications = snapshot.strategy_classifications;

  if (!dryRun) {
    atomicWriteJson(summaryFile, summary);
    atomicWriteJson(groupSummaryFile, groupSummary);
    atomicWriteJson(snapshotFile, snapshot);
  }
  return {
    skipped: false,
    date: compact,
    root_dir: rootDir,
    evaluation_mode: evaluationMode,
    tag_counts: Object.fromEntries(Object.entries(snapshot.tag_classifications).map(([id, item]) => [id, item.count])),
    strategy_counts: Object.fromEntries(Object.entries(snapshot.strategy_classifications).map(([id, item]) => [id, item.count])),
    snapshot_file: path.relative(ROOT, snapshotFile).replaceAll(path.sep, '/'),
    dry_run: dryRun,
  };
}

function parseArgs(argv) {
  const options = { date: '', rootDir: 'data_predictions', registryFile: DEFAULT_REGISTRY_FILE, dryRun: false, evaluationMode: 'live_snapshot' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--root') options.rootDir = argv[++index] || '';
    else if (arg === '--registry') options.registryFile = argv[++index] || '';
    else if (arg === '--mode') options.evaluationMode = argv[++index] || '';
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const output = applyTagStrategySnapshot(parseArgs(argv));
  console.log(JSON.stringify(output, null, 2));
  return output;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_REGISTRY_FILE,
  compactDate,
  finiteNumber,
  getPath,
  parseCsv,
  loadMarginBalances,
  percentChange,
  loadMarginContext,
  loadRegistry,
  formalStrategyMembership,
  dispositionState,
  evaluateTag,
  evaluateExpression,
  summarizeClassification,
  registryView,
  buildTagStrategySnapshot,
  upsertStrategyGroups,
  applyTagStrategySnapshot,
  main,
};
