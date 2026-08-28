#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const MIN_ROWS = 1000;
const SENTINELS = ['2330', '2317', '2454'];

function compact(value) {
  return String(value || '').replaceAll('-', '').replaceAll('/', '');
}

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replaceAll(',', '').trim());
  return Number.isFinite(n) ? n : null;
}

function normalizedFields(fields) {
  return (Array.isArray(fields) ? fields : []).map((value) => String(value ?? '').replace(/\s+/g, '').trim());
}

function findIndex(fields, candidates, fallback = -1) {
  for (const candidate of candidates) {
    const index = fields.indexOf(String(candidate).replace(/\s+/g, ''));
    if (index >= 0) return index;
  }
  return fallback;
}

function validateDealerPayload(payload, expectedDate, options = {}) {
  const minRows = Number(options.minRows ?? MIN_ROWS);
  const sentinels = options.sentinels ?? SENTINELS;
  const errors = [];
  const expected = compact(expectedDate);

  if (!payload || typeof payload !== 'object') errors.push('payload is not an object');
  if (payload?.stat !== 'OK') errors.push(`stat is not OK: ${payload?.stat ?? '(missing)'}`);
  if (!/^20\d{6}$/.test(String(payload?.date || ''))) errors.push(`invalid payload date: ${payload?.date ?? '(missing)'}`);
  if (expected && String(payload?.date || '') !== expected) errors.push(`date mismatch: expected ${expected}, got ${payload?.date ?? '(missing)'}`);
  if (!Array.isArray(payload?.fields)) errors.push('fields is not an array');
  if (!Array.isArray(payload?.data)) errors.push('data is not an array');

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  if (rows.length < minRows) errors.push(`row count too small: ${rows.length} < ${minRows}`);

  const fields = normalizedFields(payload?.fields);
  const codeIndex = findIndex(fields, ['證券代號', '股票代號', '證券代碼', '股票代碼'], 0);
  const netIndex = findIndex(fields, ['自營商買賣超股數', '買賣超股數'], 10);
  if (codeIndex < 0) errors.push('cannot resolve security-code column');
  if (netIndex < 0) errors.push('cannot resolve dealer net-shares column');

  const codes = new Set();
  let usableRows = 0;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const code = String(row[codeIndex] ?? '').trim();
    if (code) codes.add(code);
    if (code && numeric(row[netIndex]) !== null) usableRows += 1;
  }

  for (const code of sentinels) {
    if (!codes.has(code)) errors.push(`missing sentinel ${code}`);
  }

  const usableRatio = rows.length ? usableRows / rows.length : 0;
  if (usableRatio < 0.8) errors.push(`numeric net-shares coverage too low: ${(usableRatio * 100).toFixed(2)}%`);

  return {
    valid: errors.length === 0,
    errors,
    row_count: rows.length,
    usable_row_count: usableRows,
    usable_ratio: Number(usableRatio.toFixed(4)),
    sentinels: Object.fromEntries(sentinels.map((code) => [code, codes.has(code)])),
    date: payload?.date ?? null,
  };
}

function validateFile(file, expectedDate) {
  if (!fs.existsSync(file)) {
    return { valid: false, errors: [`file missing: ${file}`], row_count: 0, usable_row_count: 0, usable_ratio: 0, sentinels: {}, date: null };
  }
  if (fs.statSync(file).size <= 0) {
    return { valid: false, errors: [`file empty: ${file}`], row_count: 0, usable_row_count: 0, usable_ratio: 0, sentinels: {}, date: null };
  }
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { valid: false, errors: [`invalid JSON: ${error.message}`], row_count: 0, usable_row_count: 0, usable_ratio: 0, sentinels: {}, date: null };
  }
  return validateDealerPayload(payload, expectedDate);
}

if (require.main === module) {
  const file = process.argv[2];
  const expectedDate = process.argv[3] || '';
  if (!file) {
    console.error('Usage: node scripts/validate_twse_dealers.js FILE [YYYYMMDD]');
    process.exit(2);
  }
  const result = validateFile(file, expectedDate);
  console.log(JSON.stringify({ file, expected_date: expectedDate || null, ...result }, null, 2));
  if (!result.valid) process.exit(1);
}

module.exports = { validateDealerPayload, validateFile, MIN_ROWS, SENTINELS };
