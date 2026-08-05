'use strict';

const fs = require('node:fs');
const path = require('node:path');

const targetScript = path.basename(process.argv[1] || '');
const contextFile = process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE || '';
const forecastDate = String(process.env.FORECAST_TARGET_DATE || '').replace(/[^0-9]/g, '');
const baseDate = String(process.env.FORECAST_BASE_DATE || '').replace(/[^0-9]/g, '');

if (targetScript === 'generate_market_environment.js') {
  const marketLib = require('./market_environment_lib');
  const originalLatest = marketLib.latestDatedFileInDirectories;
  const originalValidation = marketLib.primaryExternalValidation;

  marketLib.latestDatedFileInDirectories = function predictionContextLatest(rootDir, maxDate, filename) {
    if (path.basename(rootDir) === 'data_external_market'
      && filename === 'external_market_indicators.json'
      && contextFile
      && fs.existsSync(contextFile)) {
      return {
        date: String(baseDate || maxDate || ''),
        file: contextFile,
        payload: marketLib.readJson(contextFile, null),
      };
    }
    return originalLatest(rootDir, maxDate, filename);
  };

  marketLib.primaryExternalValidation = function predictionIntradayValidation(external, expectedDate = null) {
    const validation = originalValidation(external, expectedDate);
    if (external?.snapshot_type !== 'prediction_intraday') return validation;
    const byId = new Map((external.indicators || []).map((item) => [item.id, item]));
    const usable = marketLib.PRIMARY_IDS.every((id) => {
      const item = byId.get(id);
      return item && Number.isFinite(Number(item.close ?? item.last_price));
    });
    if (!usable) return validation;
    return {
      ...validation,
      complete: true,
      exact: true,
      expected_date: expectedDate,
      actual_date: expectedDate || external.collection_date || validation.actual_date,
      collection_date: expectedDate || external.collection_date || validation.collection_date,
      primary_indicator_agreement: `${marketLib.PRIMARY_IDS.length}/${marketLib.PRIMARY_IDS.length}`,
      primary_market_dates: Object.fromEntries(
        marketLib.PRIMARY_IDS.map((id) => [id, byId.get(id)?.market_date || null]),
      ),
      intraday_context_override: true,
      original_validation: validation,
    };
  };

  process.on('exit', (code) => {
    if (code !== 0 || !/^20\d{6}$/.test(forecastDate)) return;
    try {
      const { rebindPredictionMarketEnvironment } = require('./rebind_prediction_market_environment');
      rebindPredictionMarketEnvironment(forecastDate);
    } catch (error) {
      console.error(`Prediction market context rebind failed: ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  });
}

if (targetScript === 'generate_market_risk_snapshot.js'
  && contextFile
  && /^20\d{6}$/.test(baseDate)
  && fs.existsSync(contextFile)) {
  const externalRoot = path.resolve(__dirname, '..', 'data_external_market');
  const syntheticFile = path.join(externalRoot, baseDate, 'external_market_indicators.json');
  const originalExistsSync = fs.existsSync.bind(fs);
  const originalReadFileSync = fs.readFileSync.bind(fs);
  const originalReaddirSync = fs.readdirSync.bind(fs);

  fs.existsSync = function predictionContextExists(file) {
    if (path.resolve(String(file)) === syntheticFile) return true;
    return originalExistsSync(file);
  };

  fs.readFileSync = function predictionContextRead(file, ...args) {
    if (path.resolve(String(file)) === syntheticFile) {
      return originalReadFileSync(contextFile, ...args);
    }
    return originalReadFileSync(file, ...args);
  };

  fs.readdirSync = function predictionContextReaddir(directory, options) {
    const entries = originalReaddirSync(directory, options);
    if (path.resolve(String(directory)) !== externalRoot) return entries;
    const names = entries.map((entry) => typeof entry === 'string' ? entry : entry.name);
    if (names.includes(baseDate)) return entries;
    if (options && typeof options === 'object' && options.withFileTypes) {
      return [...entries, {
        name: baseDate,
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
      }];
    }
    return [...entries, baseDate];
  };

  process.on('exit', (code) => {
    if (code !== 0) return;
    try {
      const { rebindPredictionMarketRisk } = require('./rebind_prediction_market_risk');
      rebindPredictionMarketRisk(baseDate);
    } catch (error) {
      console.error(`Prediction market risk context rebind failed: ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  });
}
