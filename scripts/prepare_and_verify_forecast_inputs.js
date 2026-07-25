'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATE = process.env.FORECAST_BASE_DATE || '20260724';
const institutionalPath = path.join(ROOT, 'data_twse_institutional_investors', `${DATE}_twse_institutional_investors.json`);
const brokerPath = path.join(ROOT, 'data_fubon_broker_details', `fubon_${DATE}_券商分點進出明細.json`);
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
const normalizedInstitutional = normalizeInstitutional(institutional.data);
const normalizedBroker = normalizeBroker(broker.data);

for (const code of ['1101', '1102', '3231']) {
  if (!normalizedInstitutional[code]) throw new Error(`institutional assertion failed: ${code}`);
  if (!normalizedBroker[code]) throw new Error(`broker assertion failed: ${code}`);
}

fs.writeFileSync(institutionalPath, JSON.stringify(normalizedInstitutional));
fs.writeFileSync(brokerPath, JSON.stringify(normalizedBroker));

const report = {
  checked_at: new Date().toISOString(),
  base_date: DATE,
  cache_used: false,
  source_commit: process.env.GITHUB_SHA ?? null,
  files: {
    institutional: {
      path: path.relative(ROOT, institutionalPath),
      bytes: institutional.bytes,
      sha256: institutional.sha256,
      source_records: institutional.data.data.length,
      parsed_records: Object.keys(normalizedInstitutional).length
    },
    broker: {
      path: path.relative(ROOT, brokerPath),
      bytes: broker.bytes,
      sha256: broker.sha256,
      expected_records: broker.data.stockUniverse?.expectedStockCount ?? null,
      source_records: Object.keys(broker.data.stocks).length,
      parsed_records: Object.keys(normalizedBroker).length
    }
  },
  assertions: ['1101', '1102', '3231']
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
