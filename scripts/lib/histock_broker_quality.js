'use strict';

const QUALITY_VERSION = 'histock-broker-row-quality-v2';
const NET_TOLERANCE = 1;

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateBrokerRecord(record) {
  const reasons = [];
  if (!record || typeof record !== 'object') return { valid: false, reasons: ['record_not_object'] };
  if (typeof record.broker !== 'string' || !record.broker.trim()) reasons.push('broker_missing');
  if (!finiteNumber(record.buy)) reasons.push('buy_not_finite');
  if (!finiteNumber(record.sell)) reasons.push('sell_not_finite');
  if (!finiteNumber(record.net)) reasons.push('net_not_finite');
  if (!finiteNumber(record.avg_price)) reasons.push('avg_price_not_finite');
  if (finiteNumber(record.buy) && record.buy < 0) reasons.push('buy_negative');
  if (finiteNumber(record.sell) && record.sell < 0) reasons.push('sell_negative');
  if (finiteNumber(record.avg_price) && record.avg_price <= 0) reasons.push('avg_price_non_positive');
  if (finiteNumber(record.buy) && finiteNumber(record.sell) && finiteNumber(record.net)) {
    const expected = record.buy - record.sell;
    if (Math.abs(expected - record.net) > NET_TOLERANCE) reasons.push('net_mismatch');
  }
  return { valid: reasons.length === 0, reasons };
}

function inspectRecords(records) {
  if (!Array.isArray(records)) {
    return { valid: false, valid_records: [], rejected_records: [{ index: null, record: records, reasons: ['records_not_array'] }], counts: { total: 0, valid: 0, rejected: 1 } };
  }
  const validRecords = [];
  const rejectedRecords = [];
  records.forEach((record, index) => {
    const check = validateBrokerRecord(record);
    if (check.valid) validRecords.push(record);
    else rejectedRecords.push({ index, record, reasons: check.reasons });
  });
  return {
    valid: records.length > 0 && rejectedRecords.length === 0,
    valid_records: validRecords,
    rejected_records: rejectedRecords,
    counts: { total: records.length, valid: validRecords.length, rejected: rejectedRecords.length },
  };
}

function validateDailyPayload(payload, { stock, date } = {}) {
  const reasons = [];
  if (!payload || typeof payload !== 'object') return { valid: false, reasons: ['payload_not_object'], record_quality: inspectRecords(null) };
  if (payload.source !== 'histock') reasons.push('source_not_histock');
  if (payload.research_only !== true) reasons.push('research_only_not_true');
  if (stock && payload.stock !== stock) reasons.push('stock_mismatch');
  if (date && payload.date !== date) reasons.push('date_mismatch');
  const quality = inspectRecords(payload.records);
  if (!quality.valid) reasons.push('record_quality_failed');
  return { valid: reasons.length === 0, reasons, record_quality: quality, quality_version: QUALITY_VERSION };
}

module.exports = {
  QUALITY_VERSION,
  NET_TOLERANCE,
  validateBrokerRecord,
  inspectRecords,
  validateDailyPayload,
};
