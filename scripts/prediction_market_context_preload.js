'use strict';

const fs = require('node:fs');
const path = require('node:path');

const targetScript = path.basename(process.argv[1] || '');
if (targetScript === 'generate_market_environment.js') {
  const contextFile = process.env.PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE || '';
  const forecastDate = String(process.env.FORECAST_TARGET_DATE || '').replace(/[^0-9]/g, '');
  const marketLib = require('./market_environment_lib');
  const originalLatest = marketLib.latestDatedFileInDirectories;

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
