'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeIsoDate, resolveForecastDates } = require('./resolve_forecast_dates');

const ROOT = path.resolve(__dirname, '..');
function compactDate(value) {
  const iso = normalizeIsoDate(value);
  if (iso) return iso.replaceAll('-', '');
  const compact = String(value || '').replace(/[^\d]/g, '');
  if (/^\d{8}$/.test(compact)) return compact;
  return '';
}

const DATE = compactDate(process.env.FORECAST_BASE_DATE) || resolveForecastDates().base_trade_date_compact;
const institutionalPath = path.join(ROOT, 'data_twse_institutional_investors', `${DATE}_twse_institutional_investors.json`);
const brokerPath = path.join(ROOT, 'data_fubon_broker_details', `fubon_${DATE}_券商分點進出明細.json`);
const normalizedInstitutionalPath = path.join(ROOT, 'data_normalized', 'institutional_investors', `${DATE}.json`);
const normalizedBrokerPath = path.join(ROOT, 'data_normalized', 'broker_details', `${DATE}.json`);
const reportPath = path.join(ROOT, '.forecast-input-validation.json');

function readAndVerify(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length === 0) throw new Error(`empty file: ${path.relative(ROOT, file)}`);
  let data;
  try { data = JSON.parse(buffer.toString('utf8')); }
  catch (error) { throw new Error(`invalid JSON: ${path.relative(ROOT, file)}: ${error.message}`); }
  return {
    data,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

function number(value) {
  const parsed = Number(String(value ?? '').replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInstitutional(source) {
  if (!Array.isArray(source.fields) || !Array.isArray(source.data)) {
    throw new Error('institutional schema mismatch: expected fields[] and data[]');
  }
  const output = {};
  for (const row of source.data) {
    if (!Array.isArray(row)) continue;
    const code = String(row[0] ?? '').trim();
    if (!code) continue;
    const foreignCash = number(row[4]);
    const foreignDealer = number(row[7]);
    const trust = number(row[10]);
    const dealer = number(row[11]);
    const total = number(row[18]);
    output[code] = {
      stock_code: code,
      stock_name: String(row[1] ?? '').trim(),
      foreign: (foreignCash ?? 0) + (foreignDealer ?? 0),
      trust,
      dealer,
      total
    };
  }
  if (Object.keys(output).length < 100) throw new Error(`institutional parsed count too low: ${Object.keys(output).length}`);
  return output;
}

function normalizeBroker(source) {
  if (!source.stocks || typeof source.stocks !== 'object') {
    throw new Error('broker schema mismatch: expected stocks object');
  }
  const output = {};
  for (const [code, item] of Object.entries(source.stocks)) {
    const netLots = number(item?.totals?.net);
    if (netLots === null) continue;
    output[code] = {
      stock_code: code,
      stock_name: item.stockName ?? '',
      net: netLots * 1000,
      source_unit: source.unit ?? '張',
      normalized_unit: '股'
    };
  }
  if (Object.keys(output).length < 100) throw new Error(`broker parsed count too low: ${Object.keys(output).length}`);
  return output;
}

const institutional = readAndVerify(institutionalPath);
const broker = readAndVerify(brokerPath);
const parsedInstitutional = normalizeInstitutional(institutional.data);
const parsedBroker = normalizeBroker(broker.data);

for (const code of ['1101', '1102', '3231']) {
  if (!parsedInstitutional[code]) throw new Error(`institutional assertion failed: ${code}`);
  if (!parsedBroker[code]) throw new Error(`broker assertion failed: ${code}`);
}

fs.mkdirSync(path.dirname(normalizedInstitutionalPath), { recursive: true });
fs.mkdirSync(path.dirname(normalizedBrokerPath), { recursive: true });
fs.writeFileSync(normalizedInstitutionalPath, `${JSON.stringify({
  schemaVersion: 1,
  generated_at: new Date().toISOString(),
  source_file: path.relative(ROOT, institutionalPath),
  source_sha256: institutional.sha256,
  date: DATE,
  unit: '股',
  stocks: parsedInstitutional
}, null, 2)}\n`, 'utf8');
fs.writeFileSync(normalizedBrokerPath, `${JSON.stringify({
  schemaVersion: 1,
  generated_at: new Date().toISOString(),
  source_file: path.relative(ROOT, brokerPath),
  source_sha256: broker.sha256,
  date: DATE,
  source_unit: broker.data.unit ?? '張',
  normalized_unit: '股',
  stocks: parsedBroker
}, null, 2)}\n`, 'utf8');

const report = {
  checked_at: new Date().toISOString(),
  base_date: DATE,
  source_files_mutated: false,
  source_commit: process.env.GITHUB_SHA ?? null,
  files: {
    institutional: {
      path: path.relative(ROOT, institutionalPath),
      normalized_path: path.relative(ROOT, normalizedInstitutionalPath),
      bytes: institutional.bytes,
      sha256: institutional.sha256,
      source_records: institutional.data.data.length,
      parsed_records: Object.keys(parsedInstitutional).length
    },
    broker: {
      path: path.relative(ROOT, brokerPath),
      normalized_path: path.relative(ROOT, normalizedBrokerPath),
      bytes: broker.bytes,
      sha256: broker.sha256,
      expected_records: broker.data.stockUniverse?.expectedStockCount ?? null,
      source_records: Object.keys(broker.data.stocks).length,
      parsed_records: Object.keys(parsedBroker).length
    }
  },
  assertions: ['1101', '1102', '3231']
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
