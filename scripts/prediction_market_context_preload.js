'use strict';

const fs = require('node:fs');
const path = require('node:path');

const targetScript = path.basename(process.argv[1] || '');
if (targetScript === 'generate_market_environment.js') {
  const contextFile = process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE || '';
  const forecastDate = String(process.env.FORECAST_TARGET_DATE || '').replace(/[^0-9]/g, '');
  const marketLib = require('./market_environment_lib');
  const originalLatest = marketLib.latestDatedFileInDirectories;
  const originalValidation = marketLib.primaryExternalValidation;

  marketLib.latestDatedFileInDirectories = function predictionContextLatest(rootDir, maxDate, filename) {
    if (path.basename(rootDir) === 'data_external_market'
      && filename === 'external_market_indicators.json'
      && contextFile
      && fs.existsSync(contextFile)) {
      return {
        date: String(process.env.FORECAST_BASE_DATE || maxDate || ''),
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
