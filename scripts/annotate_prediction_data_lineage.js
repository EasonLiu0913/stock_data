#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, payload) {
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function compactDate(value) {
  const compact = String(value || '').replace(/[^\d]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : null;
}

function isoDate(value) {
  const compact = compactDate(value);
  return compact ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}` : null;
}

function dateFromPath(file) {
  const match = String(file || '').match(/(20\d{6})/);
  return match ? isoDate(match[1]) : null;
}

function relative(file) {
  return file ? path.relative(ROOT, file).replaceAll(path.sep, '/') : null;
}

function listFiles(dir, pattern) {
  try {
    return fs.readdirSync(dir).filter((file) => pattern.test(file)).sort();
  } catch {
    return [];
  }
}

function stockHasPriceObservation(file, code, baseIso) {
  const payload = readJson(file, null);
  const stock = payload?.[code];
  if (!stock || typeof stock !== 'object') return false;
  return Object.keys(stock).some((key) => key.replaceAll('/', '-') === baseIso);
}

function resolvePriceSource(code, baseCompact, baseIso) {
  const dir = path.join(ROOT, 'data_fubon');
  const exact = path.join(dir, `fubon_${baseCompact}_sma.json`);
  if (fs.existsSync(exact) && stockHasPriceObservation(exact, code, baseIso)) return exact;
  const files = listFiles(dir, /^fubon_20\d{6}_sma\.json$/)
    .filter((file) => (file.match(/(20\d{6})/)?.[1] || '') <= baseCompact)
    .reverse();
  return files.map((file) => path.join(dir, file)).find((file) => stockHasPriceObservation(file, code, baseIso)) || null;
}

function resolveInstitutionalSource(code, baseCompact) {
  const normalized = path.join(ROOT, 'data_normalized', 'institutional_investors', `${baseCompact}.json`);
  const normalizedPayload = readJson(normalized, null);
  if (normalizedPayload?.stocks?.[code]) return normalized;

  const dir = path.join(ROOT, 'data_twse_institutional_investors');
  const files = listFiles(dir, /^20\d{6}_twse_institutional_investors\.json$/)
    .filter((file) => file.slice(0, 8) <= baseCompact);
  return files.length ? path.join(dir, files.at(-1)) : null;
}

function resolveMarginSource(baseCompact) {
  const dir = path.join(ROOT, 'data_twse_margin_balance');
  const files = listFiles(dir, /^20\d{6}_twse_margin_balance\.csv$/)
    .filter((file) => file.slice(0, 8) <= baseCompact);
  return files.length ? path.join(dir, files.at(-1)) : null;
}

function resolveBrokerSource(code, baseCompact) {
  const normalized = path.join(ROOT, 'data_normalized', 'broker_details', `${baseCompact}.json`);
  const normalizedPayload = readJson(normalized, null);
  if (normalizedPayload?.stocks?.[code]) return normalized;

  const dir = path.join(ROOT, 'data_fubon_broker_details');
  const batch = path.join(dir, `fubon_${baseCompact}_券商分點進出明細.json`);
  if (fs.existsSync(batch)) return batch;

  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates = listFiles(dir, new RegExp(`${baseCompact}.*${escaped}|${escaped}.*${baseCompact}`));
  return candidates.length ? path.join(dir, candidates.at(-1)) : null;
}

function resolveMarketIndexSource(predictionDir, baseCompact) {
  const marketSnapshot = readJson(path.join(predictionDir, 'market-snapshot.json'), null);
  const declared = marketSnapshot?.data?.source_file;
  if (declared) return path.join(ROOT, declared);
  const mi = path.join(ROOT, 'data_twse_mi_index', `${baseCompact}_twse_mi_index.json`);
  if (fs.existsSync(mi)) return mi;
  const fallback = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
  return fs.existsSync(fallback) ? fallback : null;
}

function resolveMarketRiskSource(payload, baseCompact) {
  const declared = payload?.market_risk?.source_file;
  if (declared) return path.join(ROOT, declared);
  const exact = path.join(ROOT, 'data_market_risk', baseCompact, 'market_risk_snapshot.json');
  return fs.existsSync(exact) ? exact : null;
}

function record(name, sourceFile, sourceDate, maxObservationDate, rule = 'twse_prior_day') {
  return {
    name,
    source_date: sourceDate || dateFromPath(sourceFile),
    source_file: sourceFile ? relative(sourceFile) : null,
    max_observation_date: maxObservationDate || sourceDate || dateFromPath(sourceFile),
    leakage_rule: rule,
    status: sourceFile && fs.existsSync(sourceFile) ? 'available' : 'missing',
  };
}

function contextRecords(forecastCompact) {
  const latestFile = path.join(ROOT, 'data_prediction_context', forecastCompact, 'latest.json');
  const latest = readJson(latestFile, null);
  if (!latest) return [];
  const records = [record(
    'prediction_market_context_manifest',
    latest.manifest_file ? path.join(ROOT, latest.manifest_file) : latestFile,
    dateFromPath(latest.manifest_file || latestFile),
    dateFromPath(latest.manifest_file || latestFile),
    'preopen_context_timestamp'
  )];
  if (latest.external_market_file) records.push(record(
    'external_market_context',
    path.join(ROOT, latest.external_market_file),
    dateFromPath(latest.external_market_file),
    dateFromPath(latest.external_market_file),
    'preopen_context_timestamp'
  ));
  if (latest.night_futures_file) records.push(record(
    'night_futures_context',
    path.join(ROOT, latest.night_futures_file),
    dateFromPath(latest.night_futures_file),
    dateFromPath(latest.night_futures_file),
    'preopen_context_timestamp'
  ));
  return records;
}

function marketEnvironmentRecord(forecastCompact) {
  const file = path.join(ROOT, 'data_market_environment', forecastCompact, 'market_environment.json');
  if (!fs.existsSync(file)) return [];
  const payload = readJson(file, {});
  return [{
    name: 'market_environment_snapshot',
    source_date: isoDate(forecastCompact),
    source_file: relative(file),
    max_observation_date: isoDate(payload?.data_freshness?.twse_date || payload?.base_trade_date || null),
    leakage_rule: 'derived_snapshot',
    status: 'available',
    snapshot_hash: payload.snapshot_hash || null,
  }];
}

function validateLineage(inputs, forecastIso, baseIso) {
  const violations = [];
  for (const input of inputs) {
    const observed = input.max_observation_date;
    if (!observed) continue;
    if (input.leakage_rule === 'twse_prior_day' && observed >= forecastIso) {
      violations.push(`${input.name}: max_observation_date ${observed} must be before forecast_date ${forecastIso}`);
    }
    if (input.leakage_rule === 'twse_prior_day' && observed > baseIso) {
      violations.push(`${input.name}: max_observation_date ${observed} exceeds base_trade_date ${baseIso}`);
    }
  }
  return {
    policy: 'TWSE realized inputs must be no later than base_trade_date and strictly earlier than forecast_date. Pre-open external/night context is validated by its immutable snapshot timestamp policy.',
    forecast_date: forecastIso,
    base_trade_date: baseIso,
    passed: violations.length === 0,
    violations,
  };
}

function annotatePredictionDataLineage({ rootDir = 'data_predictions', date, strict = true } = {}) {
  const forecastCompact = compactDate(date);
  if (!forecastCompact) throw new Error(`Invalid prediction lineage date: ${date}`);
  const predictionDir = path.join(ROOT, rootDir, forecastCompact);
  if (!fs.existsSync(predictionDir)) throw new Error(`Missing prediction directory: ${relative(predictionDir)}`);

  const stockFiles = listFiles(predictionDir, /^\d{4,6}\.json$/);
  let annotated = 0;
  let violationCount = 0;
  const examples = [];

  for (const filename of stockFiles) {
    const file = path.join(predictionDir, filename);
    const payload = readJson(file, null);
    if (!payload) continue;
    const code = String(payload.stock_code || filename.replace(/\.json$/, ''));
    const forecastIso = isoDate(payload.forecast_date || forecastCompact);
    const baseIso = isoDate(payload.base_trade_date);
    if (!forecastIso || !baseIso) throw new Error(`Missing forecast/base date in ${relative(file)}`);
    const baseCompact = compactDate(baseIso);

    const priceFile = resolvePriceSource(code, baseCompact, baseIso);
    const institutionalFile = resolveInstitutionalSource(code, baseCompact);
    const marginFile = resolveMarginSource(baseCompact);
    const brokerFile = resolveBrokerSource(code, baseCompact);
    const marketIndexFile = resolveMarketIndexSource(predictionDir, baseCompact);
    const marketRiskFile = resolveMarketRiskSource(payload, baseCompact);

    const inputs = [
      record('stock_price_technical', priceFile, baseIso, baseIso),
      record('institutional_investors', institutionalFile, dateFromPath(institutionalFile), dateFromPath(institutionalFile)),
      record('margin_balance', marginFile, dateFromPath(marginFile), dateFromPath(marginFile)),
      record('broker_branch_flow', brokerFile, dateFromPath(brokerFile), dateFromPath(brokerFile)),
      record('twse_market_index', marketIndexFile, baseIso, baseIso),
      record('market_risk_snapshot', marketRiskFile, dateFromPath(marketRiskFile), dateFromPath(marketRiskFile)),
      ...marketEnvironmentRecord(forecastCompact),
      ...contextRecords(forecastCompact),
    ];

    const leakageCheck = validateLineage(inputs, forecastIso, baseIso);
    if (!leakageCheck.passed) {
      violationCount += leakageCheck.violations.length;
      if (examples.length < 10) examples.push({ stock_code: code, violations: leakageCheck.violations });
    }

    payload.data_lineage = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      information_cutoff: payload.information_cutoff || `${baseIso}T15:30:00+08:00`,
      forecast_date: forecastIso,
      base_trade_date: baseIso,
      leakage_check: leakageCheck,
      inputs,
    };
    writeJson(file, payload);
    annotated += 1;
  }

  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    root_dir: rootDir,
    forecast_date: isoDate(forecastCompact),
    annotated_stocks: annotated,
    violation_count: violationCount,
    passed: violationCount === 0,
    violation_examples: examples,
  };
  writeJson(path.join(predictionDir, 'data-lineage-report.json'), report);

  if (strict && violationCount > 0) {
    throw new Error(`Prediction data leakage guard failed: ${violationCount} violation(s); see ${relative(path.join(predictionDir, 'data-lineage-report.json'))}`);
  }
  return report;
}

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key.slice(2), next);
      i += 1;
    } else args.set(key.slice(2), true);
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const report = annotatePredictionDataLineage({
    rootDir: String(args.get('root-dir') || 'data_predictions'),
    date: args.get('date') || process.env.FORECAST_TARGET_DATE,
    strict: args.get('strict') !== 'false',
  });
  console.log(JSON.stringify(report, null, 2));
}

module.exports = {
  annotatePredictionDataLineage,
  validateLineage,
};
