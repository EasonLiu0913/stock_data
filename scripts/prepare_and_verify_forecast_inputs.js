'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeIsoDate, resolveForecastDates } = require('./resolve_forecast_dates');
const {
  BROKER_BRANCH_DETAIL_LIMIT,
  normalizeInstitutionalSource,
  normalizeBrokerSource,
  validateNormalized
} = require('./backfill_normalized_data');

const ROOT = path.resolve(__dirname, '..');

function compactDate(value) {
  const iso = normalizeIsoDate(value);
  if (iso) return iso.replaceAll('-', '');
  const compact = String(value || '').replace(/[^\d]/g, '');
  return /^\d{8}$/.test(compact) ? compact : '';
}

function readAndVerify(file) {
  const buffer = fs.readFileSync(file);
  if (!buffer.length) throw new Error(`empty file: ${path.relative(ROOT, file)}`);
  let data;
  try {
    data = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`invalid JSON: ${path.relative(ROOT, file)}: ${error.message}`);
  }
  return {
    data,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

function writeNormalized(file, payload, type, date) {
  const errors = validateNormalized(type, payload, date);
  if (errors.length) throw new Error(`${type} normalized validation failed: ${errors.join('; ')}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main() {
  const date = compactDate(process.env.FORECAST_BASE_DATE)
    || resolveForecastDates().base_trade_date_compact;
  const institutionalPath = path.join(
    ROOT,
    'data_twse_institutional_investors',
    `${date}_twse_institutional_investors.json`
  );
  const brokerPath = path.join(
    ROOT,
    'data_fubon_broker_details',
    `fubon_${date}_券商分點進出明細.json`
  );
  const normalizedInstitutionalPath = path.join(
    ROOT,
    'data_normalized',
    'institutional_investors',
    `${date}.json`
  );
  const normalizedBrokerPath = path.join(
    ROOT,
    'data_normalized',
    'broker_details',
    `${date}.json`
  );
  const reportPath = path.join(ROOT, '.forecast-input-validation.json');

  const institutional = readAndVerify(institutionalPath);
  const broker = readAndVerify(brokerPath);
  const parsedInstitutional = normalizeInstitutionalSource(institutional.data);
  const parsedBroker = normalizeBrokerSource(broker.data);
  const generatedAt = new Date().toISOString();

  const institutionalPayload = {
    schemaVersion: 1,
    generated_at: generatedAt,
    source_file: path.relative(ROOT, institutionalPath).replaceAll(path.sep, '/'),
    source_sha256: institutional.sha256,
    date,
    unit: '股',
    stocks: parsedInstitutional
  };
  const brokerPayload = {
    schemaVersion: 4,
    generated_at: generatedAt,
    source_file: path.relative(ROOT, brokerPath).replaceAll(path.sep, '/'),
    source_sha256: broker.sha256,
    date,
    source_unit: broker.data.unit ?? '張',
    normalized_unit: '股',
    branch_detail_limit: BROKER_BRANCH_DETAIL_LIMIT,
    concentration_scope: 'sum_of_source_ranked_branches',
    stocks: parsedBroker
  };

  writeNormalized(normalizedInstitutionalPath, institutionalPayload, 'institutional', date);
  writeNormalized(normalizedBrokerPath, brokerPayload, 'broker', date);

  const report = {
    checked_at: generatedAt,
    base_date: date,
    source_files_mutated: false,
    source_commit: process.env.GITHUB_SHA ?? null,
    files: {
      institutional: {
        path: path.relative(ROOT, institutionalPath),
        normalized_path: path.relative(ROOT, normalizedInstitutionalPath),
        bytes: institutional.bytes,
        sha256: institutional.sha256,
        source_records: institutional.data.data.length,
        parsed_records: Object.keys(parsedInstitutional).length,
        schema_version: institutionalPayload.schemaVersion
      },
      broker: {
        path: path.relative(ROOT, brokerPath),
        normalized_path: path.relative(ROOT, normalizedBrokerPath),
        bytes: broker.bytes,
        sha256: broker.sha256,
        expected_records: broker.data.stockUniverse?.expectedStockCount ?? null,
        source_records: Object.keys(broker.data.stocks).length,
        parsed_records: Object.keys(parsedBroker).length,
        schema_version: brokerPayload.schemaVersion
      }
    },
    assertions: ['1101', '1102', '3231']
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

if (require.main === module) main();

module.exports = { compactDate, readAndVerify, writeNormalized, main };
