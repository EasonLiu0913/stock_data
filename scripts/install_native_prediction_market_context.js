#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function filePath(relative) {
  return path.join(ROOT, relative);
}

function read(relative) {
  return fs.readFileSync(filePath(relative), 'utf8');
}

function write(relative, content) {
  fs.writeFileSync(filePath(relative), content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function replaceExact(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Expected source block not found: ${label}`);
  return content.replace(before, after);
}

function patchResolver() {
  const relative = 'scripts/resolve_forecast_dates.js';
  let content = read(relative);
  const removed = [
    "const MARKET_CONTEXT_PRELOAD = path.join(__dirname, 'prediction_market_context_preload.js');",
    '    const preloadOption = `--require=${MARKET_CONTEXT_PRELOAD}`;',
    "    const existingNodeOptions = String(process.env.NODE_OPTIONS || '').trim();",
    "      `NODE_OPTIONS=${[existingNodeOptions, preloadOption].filter(Boolean).join(' ')}`,
",
  ];
  for (const line of removed) {
    if (!content.includes(line)) throw new Error(`Resolver migration source missing: ${line.trim()}`);
    content = content.replace(line, '');
  }
  write(relative, content.replace(/\n{3,}/g, '\n\n'));
}

function patchEnvironmentLibrary() {
  const relative = 'scripts/market_environment_lib.js';
  let content = read(relative);
  const oldLatest = `function latestDatedFileInDirectories(rootDir, maxDate, filename) {
  const dates = listDateDirectories(rootDir, maxDate).reverse();
  for (const date of dates) {
    const file = path.join(rootDir, date, filename);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return { date, file, payload: readJson(file) };
  }
  return null;
}`;
  const newLatest = `function predictionContextExternalSource(rootDir, maxDate, filename) {
  const contextFile = process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE || '';
  if (path.basename(rootDir) !== 'data_external_market'
    || filename !== 'external_market_indicators.json'
    || !contextFile
    || !fs.existsSync(contextFile)) return null;
  return {
    date: String(process.env.FORECAST_BASE_DATE || maxDate || ''),
    file: contextFile,
    payload: readJson(contextFile, null),
    prediction_context: true,
  };
}

function latestDatedFileInDirectories(rootDir, maxDate, filename) {
  const predictionContext = predictionContextExternalSource(rootDir, maxDate, filename);
  if (predictionContext) return predictionContext;
  const dates = listDateDirectories(rootDir, maxDate).reverse();
  for (const date of dates) {
    const file = path.join(rootDir, date, filename);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return { date, file, payload: readJson(file) };
  }
  return null;
}`;
  content = replaceExact(content, oldLatest, newLatest, 'market environment latest external source');

  const oldValidation = `function primaryExternalValidation(external, expectedDate = null) {
  const indicators = Array.isArray(external?.indicators) ? external.indicators : [];
  const byId = new Map(indicators.map((item) => [item.id, item]));
  const primary = PRIMARY_IDS.map((id) => byId.get(id)).filter(Boolean);
  const dates = primary.map((item) => String(item.market_date || ''));
  const uniqueDates = [...new Set(dates.filter((date) => /^20\\d{6}$/.test(date)))];
  const actualDate = uniqueDates.length === 1 ? uniqueDates[0] : null;
  const collectionDate = String(external?.collection_date || actualDate || '');
  const errors = Array.isArray(external?.errors) ? external.errors : [];
  const complete = primary.length === PRIMARY_IDS.length && uniqueDates.length === 1 && errors.length === 0;
  const exact = complete && (!expectedDate || actualDate === expectedDate) && collectionDate === actualDate;
  return {
    complete,
    exact,
    expected_date: expectedDate,
    actual_date: actualDate,
    collection_date: collectionDate || null,
    primary_indicator_agreement: \\`${primary.length}/${PRIMARY_IDS.length}\\`,
    primary_market_dates: Object.fromEntries(PRIMARY_IDS.map((id) => [id, byId.get(id)?.market_date || null])),
    error_count: errors.length,
    errors,
  };
}`.replaceAll('\\`', '`');
  const newValidation = `function primaryExternalValidation(external, expectedDate = null) {
  const indicators = Array.isArray(external?.indicators) ? external.indicators : [];
  const byId = new Map(indicators.map((item) => [item.id, item]));
  const primary = PRIMARY_IDS.map((id) => byId.get(id)).filter(Boolean);
  const dates = primary.map((item) => String(item.market_date || ''));
  const uniqueDates = [...new Set(dates.filter((date) => /^20\\d{6}$/.test(date)))];
  const actualDate = uniqueDates.length === 1 ? uniqueDates[0] : null;
  const collectionDate = String(external?.collection_date || actualDate || '');
  const errors = Array.isArray(external?.errors) ? external.errors : [];
  const primaryValuesUsable = primary.length === PRIMARY_IDS.length
    && primary.every((item) => Number.isFinite(Number(item.close ?? item.last_price)));
  if (external?.snapshot_type === 'prediction_intraday' && primaryValuesUsable) {
    const contextDate = expectedDate || collectionDate || actualDate || null;
    return {
      complete: true,
      exact: true,
      expected_date: expectedDate,
      actual_date: contextDate,
      collection_date: contextDate,
      primary_indicator_agreement: \\`${primary.length}/${PRIMARY_IDS.length}\\`,
      primary_market_dates: Object.fromEntries(PRIMARY_IDS.map((id) => [id, byId.get(id)?.market_date || null])),
      error_count: errors.length,
      errors,
      intraday_context_override: true,
      primary_ready: external.primary_ready === true,
    };
  }
  const complete = primary.length === PRIMARY_IDS.length && uniqueDates.length === 1 && errors.length === 0;
  const exact = complete && (!expectedDate || actualDate === expectedDate) && collectionDate === actualDate;
  return {
    complete,
    exact,
    expected_date: expectedDate,
    actual_date: actualDate,
    collection_date: collectionDate || null,
    primary_indicator_agreement: \\`${primary.length}/${PRIMARY_IDS.length}\\`,
    primary_market_dates: Object.fromEntries(PRIMARY_IDS.map((id) => [id, byId.get(id)?.market_date || null])),
    error_count: errors.length,
    errors,
  };
}`.replaceAll('\\`', '`');
  content = replaceExact(content, oldValidation, newValidation, 'market environment intraday validation');
  write(relative, content);
}

function patchEnvironmentGenerator() {
  const relative = 'scripts/generate_market_environment.js';
  let content = read(relative);
  const importMarker = "const { classifyPredictedEnvironment } = require('./classify_market_environment');";
  content = replaceExact(
    content,
    importMarker,
    `${importMarker}\nconst { rebindPredictionMarketEnvironment } = require('./rebind_prediction_market_environment');`,
    'market environment rebind import',
  );
  const oldWrite = `  if (!dryRun) {
    atomicWriteJson(outputFile, payload);
    refreshEnvironmentIndexes(generatedAt);
  }`;
  const newWrite = `  if (!dryRun) {
    atomicWriteJson(outputFile, payload);
    refreshEnvironmentIndexes(generatedAt);
    if (process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE) {
      rebindPredictionMarketEnvironment(forecastDate);
    }
  }`;
  content = replaceExact(content, oldWrite, newWrite, 'market environment native context rebind');
  write(relative, content);
}

function patchRiskGenerator() {
  const relative = 'scripts/generate_market_risk_snapshot.js';
  let content = read(relative);
  const importMarker = "const crypto = require('node:crypto');";
  content = replaceExact(
    content,
    importMarker,
    `${importMarker}\nconst { rebindPredictionMarketRisk } = require('./rebind_prediction_market_risk');`,
    'market risk rebind import',
  );
  const oldLatest = `function latestFileAtOrBefore(rootDir, date, fileName) {
  if (!fs.existsSync(rootDir)) return null;
  const dirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\\d{8}$/.test(entry.name) && entry.name <= date)
    .map((entry) => entry.name)
    .sort();
  const latest = dirs.at(-1);
  return latest ? path.join(rootDir, latest, fileName) : null;
}`;
  const newLatest = `function latestFileAtOrBefore(rootDir, date, fileName) {
  const contextFile = process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE || '';
  if (path.basename(rootDir) === 'data_external_market'
    && fileName === 'external_market_indicators.json'
    && contextFile
    && fs.existsSync(contextFile)) return contextFile;
  if (!fs.existsSync(rootDir)) return null;
  const dirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\\d{8}$/.test(entry.name) && entry.name <= date)
    .map((entry) => entry.name)
    .sort();
  const latest = dirs.at(-1);
  return latest ? path.join(rootDir, latest, fileName) : null;
}`;
  content = replaceExact(content, oldLatest, newLatest, 'market risk external context source');
  const oldWrite = `  fs.writeFileSync(path.join(outputDir, 'market_risk_snapshot.json'), \\`${JSON.stringify(payload, null, 2)}\\n\\`, 'utf8');`.replaceAll('\\`', '`');
  const newWrite = `${oldWrite}\n  if (process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE && process.env.FORECAST_TARGET_DATE) {\n    rebindPredictionMarketRisk(targetDate);\n  }`;
  content = replaceExact(content, oldWrite, newWrite, 'market risk native context rebind');
  write(relative, content);
}

function patchTests() {
  const testRelative = 'tests/prediction_market_context.test.js';
  let testContent = read(testRelative);
  testContent = testContent.replace("    const preload = path.join(ROOT, 'scripts', 'prediction_market_context_preload.js');\n", '');
  testContent = testContent.replace("        NODE_OPTIONS: `--require=${preload}`,\n", '');
  write(testRelative, testContent);

  const workflowRelative = '.github/workflows/test-official-market-constraints-integration.yml';
  let workflow = read(workflowRelative);
  workflow = workflow.replace("      - scripts/prediction_market_context_preload.js\n", '');
  workflow = workflow.replace("      - scripts/rebind_prediction_market_risk.js\n", "      - scripts/rebind_prediction_market_risk.js\n      - scripts/generate_market_risk_snapshot.js\n");
  workflow = workflow.replace("          node --check scripts/prediction_market_context_preload.js\n", '');
  workflow = workflow.replace("          node --check scripts/rebind_prediction_market_risk.js\n", "          node --check scripts/rebind_prediction_market_risk.js\n          node --check scripts/generate_market_risk_snapshot.js\n");
  write(workflowRelative, workflow);
}

function cleanup() {
  for (const relative of [
    'scripts/prediction_market_context_preload.js',
    'scripts/run_prediction_market_environment.js',
  ]) {
    fs.rmSync(filePath(relative), { force: true });
  }
}

function main() {
  patchResolver();
  patchEnvironmentLibrary();
  patchEnvironmentGenerator();
  patchRiskGenerator();
  patchTests();
  cleanup();
  fs.rmSync(__filename, { force: true });
  console.log(JSON.stringify({ migrated: true, mode: 'native_prediction_market_context' }));
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
