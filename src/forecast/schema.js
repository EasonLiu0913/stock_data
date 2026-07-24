'use strict';

const REQUIRED_FIELDS = [
  'methodology_version',
  'generated_at',
  'prediction_mode',
  'stock_code',
  'stock_name',
  'forecast_date',
  'base_trade_date',
  'information_cutoff',
  'market',
  'direction_score',
  'raw_direction_label',
  'final_direction_label',
  'data_completeness',
  'missing_data',
  'backtest_rule_id',
  'backtest_status',
];

function validateForecastPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Forecast payload must be a JSON object');
  }

  const missing = REQUIRED_FIELDS.filter((field) => !(field in data));
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  if (!Number.isFinite(data.direction_score)) {
    throw new TypeError('direction_score must be numeric');
  }

  if (!Number.isFinite(data.data_completeness)
    || data.data_completeness < 0
    || data.data_completeness > 100) {
    throw new RangeError('data_completeness must be between 0 and 100');
  }

  if (!Array.isArray(data.missing_data)) {
    throw new TypeError('missing_data must be an array');
  }

  return data;
}

module.exports = {
  REQUIRED_FIELDS,
  validateForecastPayload,
};
