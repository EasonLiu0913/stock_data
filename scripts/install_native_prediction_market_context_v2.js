#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const resolveFile = (relative) => path.join(ROOT, relative);
const read = (relative) => fs.readFileSync(resolveFile(relative), 'utf8');
const write = (relative, content) => fs.writeFileSync(resolveFile(relative), content.endsWith('\n') ? content : `${content}\n`, 'utf8');

function replaceText(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Expected source text not found: ${label}`);
  return content.replace(before, after);
}

function replacePattern(content, pattern, replacement, label) {
  if (!pattern.test(content)) throw new Error(`Expected source pattern not found: ${label}`);
  return content.replace(pattern, replacement);
}

function patchResolver() {
  const relative = 'scripts/resolve_forecast_dates.js';
  const removableFragments = [
    "const MARKET_CONTEXT_PRELOAD = path.join(__dirname, 'prediction_market_context_preload.js');",
    '    const preloadOption = `--require=${MARKET_CONTEXT_PRELOAD}`;',
    "    const existingNodeOptions = String(process.env.NODE_OPTIONS || '').trim();",
    "      `NODE_OPTIONS=${[existingNodeOptions, preloadOption].filter(Boolean).join(' ')}`,
  ];
  let content = read(relative);
  for (const fragment of removableFragments) {
    content = replaceText(content, fragment, '', `resolver ${fragment.trim()}`);
  }
  write(relative, content.replace(/\n{3,}/g, '\n\n'));
}

function patchEnvironmentLibrary() {
  const relative = 'scripts/market_environment_lib.js';
  let content = read(relative);
  const latestReplacement = [
    'function predictionContextExternalSource(rootDir, maxDate, filename) {',
    "  const contextFile = process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE || '';",
    "  if (path.basename(rootDir) !== 'data_external_market'",
    "    || filename !== 'external_market_indicators.json'",
    '    || !contextFile',
    '    || !fs.existsSync(contextFile)) return null;',
    '  return {',
    "    date: String(process.env.FORECAST_BASE_DATE || maxDate || ''),",
    '    file: contextFile,',
    '    payload: readJson(contextFile, null),',
    '    prediction_context: true,',
    '  };',
    '}',
    '',
    'function latestDatedFileInDirectories(rootDir, maxDate, filename) {',
    '  const predictionContext = predictionContextExternalSource(rootDir, maxDate, filename);',
    '  if (predictionContext) return predictionContext;',
    '  const dates = listDateDirectories(rootDir, maxDate).reverse();',
    '  for (const date of dates) {',
    '    const file = path.join(rootDir, date, filename);',
    '    if (fs.existsSync(file) && fs.statSync(file).size > 0) return { date, file, payload: readJson(file) };',
    '  }',
    '  return null;',
    '}',
    '',
    'function listFlatDateFiles',
  ].join('\n');
  content = replacePattern(
    content,
    /function latestDatedFileInDirectories\(rootDir, maxDate, filename\) \{[\s\S]*?\n\}\n\nfunction listFlatDateFiles/,
    latestReplacement,
    'native external context source',
  );

  const validationReplacement = [
    'function primaryExternalValidation(external, expectedDate = null) {',
    '  const indicators = Array.isArray(external?.indicators) ? external.indicators : [];',
    '  const byId = new Map(indicators.map((item) => [item.id, item]));',
    '  const primary = PRIMARY_IDS.map((id) => byId.get(id)).filter(Boolean);',
    "  const dates = primary.map((item) => String(item.market_date || ''));",
    '  const uniqueDates = [...new Set(dates.filter((date) => /^20\\d{6}$/.test(date)))];',
    '  const actualDate = uniqueDates.length === 1 ? uniqueDates[0] : null;',
    "  const collectionDate = String(external?.collection_date || actualDate || '');",
    '  const errors = Array.isArray(external?.errors) ? external.errors : [];',
    '  const primaryValuesUsable = primary.length === PRIMARY_IDS.length',
    '    && primary.every((item) => Number.isFinite(Number(item.close ?? item.last_price)));',
    "  if (external?.snapshot_type === 'prediction_intraday' && primaryValuesUsable) {",
    '    const contextDate = expectedDate || collectionDate || actualDate || null;',
    '    return {',
    '      complete: true,',
    '      exact: true,',
    '      expected_date: expectedDate,',
    '      actual_date: contextDate,',
    '      collection_date: contextDate,',
    '      primary_indicator_agreement: `${primary.length}/${PRIMARY_IDS.length}`,',
    '      primary_market_dates: Object.fromEntries(PRIMARY_IDS.map((id) => [id, byId.get(id)?.market_date || null])),',
    '      error_count: errors.length,',
    '      errors,',
    '      intraday_context_override: true,',
    '      primary_ready: external.primary_ready === true,',
    '    };',
    '  }',
    '  const complete = primary.length === PRIMARY_IDS.length && uniqueDates.length === 1 && errors.length === 0;',
    '  const exact = complete && (!expectedDate || actualDate === expectedDate) && collectionDate === actualDate;',
    '  return {',
    '    complete,',
    '    exact,',
    '    expected_date: expectedDate,',
    '    actual_date: actualDate,',
    '    collection_date: collectionDate || null,',
    '    primary_indicator_agreement: `${primary.length}/${PRIMARY_IDS.length}`,',
    '    primary_market_dates: Object.fromEntries(PRIMARY_IDS.map((id) => [id, byId.get(id)?.market_date || null])),',
    '    error_count: errors.length,',
    '    errors,',
    '  };',
    '}',
    '',
    'function indicatorById',
  ].join('\n');
  content = replacePattern(
    content,
    /function primaryExternalValidation\(external, expectedDate = null\) \{[\s\S]*?\n\}\n\nfunction indicatorById/,
    validationReplacement,
    'intraday external validation',
  );
  write(relative, content);
}

function patchEnvironmentGenerator() {
  const relative = 'scripts/generate_market_environment.js';
  let content = read(relative);
  const importMarker = "const { classifyPredictedEnvironment } = require('./classify_market_environment');";
  content = replaceText(
    content,
    importMarker,
    `${importMarker}\nconst { rebindPredictionMarketEnvironment } = require('./rebind_prediction_market_environment');`,
    'environment rebind import',
  );
  content = replaceText(
    content,
    '  if (!dryRun) {\n    atomicWriteJson(outputFile, payload);\n    refreshEnvironmentIndexes(generatedAt);\n  }',
    '  if (!dryRun) {\n    atomicWriteJson(outputFile, payload);\n    refreshEnvironmentIndexes(generatedAt);\n    if (process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE) {\n      rebindPredictionMarketEnvironment(forecastDate);\n    }\n  }',
    'environment native rebind call',
  );
  write(relative, content);
}

function patchRiskGenerator() {
  const relative = 'scripts/generate_market_risk_snapshot.js';
  let content = read(relative);
  const importMarker = "const crypto = require('node:crypto');";
  content = replaceText(
    content,
    importMarker,
    `${importMarker}\nconst { rebindPredictionMarketRisk } = require('./rebind_prediction_market_risk');`,
    'risk rebind import',
  );
  const latestReplacement = [
    'function latestFileAtOrBefore(rootDir, date, fileName) {',
    "  const contextFile = process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE || '';",
    "  if (path.basename(rootDir) === 'data_external_market'",
    "    && fileName === 'external_market_indicators.json'",
    '    && contextFile',
    '    && fs.existsSync(contextFile)) return contextFile;',
    '  if (!fs.existsSync(rootDir)) return null;',
    '  const dirs = fs.readdirSync(rootDir, { withFileTypes: true })',
    '    .filter((entry) => entry.isDirectory() && /^\\d{8}$/.test(entry.name) && entry.name <= date)',
    '    .map((entry) => entry.name)',
    '    .sort();',
    '  const latest = dirs.at(-1);',
    '  return latest ? path.join(rootDir, latest, fileName) : null;',
    '}',
    '',
    'function main',
  ].join('\n');
  content = replacePattern(
    content,
    /function latestFileAtOrBefore\(rootDir, date, fileName\) \{[\s\S]*?\n\}\n\nfunction main/,
    latestReplacement,
    'risk native external context source',
  );
  const writeLine = "  fs.writeFileSync(path.join(outputDir, 'market_risk_snapshot.json'), `${JSON.stringify(payload, null, 2)}\\n`, 'utf8');";
  content = replaceText(
    content,
    writeLine,
    `${writeLine}\n  if (process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE && process.env.FORECAST_TARGET_DATE) {\n    rebindPredictionMarketRisk(targetDate);\n  }`,
    'risk native rebind call',
  );
  write(relative, content);
}

function patchTests() {
  const relative = 'tests/prediction_market_context.test.js';
  let content = read(relative);
  content = content.replace("    const preload = path.join(ROOT, 'scripts', 'prediction_market_context_preload.js');\n", '');
  content = content.replace("        NODE_OPTIONS: `--require=${preload}`,\n", '');
  write(relative, content);
}

function cleanup() {
  for (const relative of [
    'scripts/prediction_market_context_preload.js',
    'scripts/run_prediction_market_environment.js',
    'scripts/install_native_prediction_market_context.js',
    'scripts/install_native_prediction_market_context_v2.js',
  ]) fs.rmSync(resolveFile(relative), { force: true });
}

function main() {
  patchResolver();
  patchEnvironmentLibrary();
  patchEnvironmentGenerator();
  patchRiskGenerator();
  patchTests();
  cleanup();
  console.log(JSON.stringify({ migrated: true, mode: 'native_prediction_market_context_v2' }));
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
