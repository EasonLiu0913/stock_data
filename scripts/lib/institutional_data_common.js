'use strict';

const fs = require('node:fs');

const REQUIRED_FIELDS = ['ForeignInvestors', 'InvestmentTrust', 'Dealers', 'DailyTotal'];
const ELIGIBLE_STOCK_CODE_PATTERN = /^\d{4}$/;

function toRocDate(dateStr) {
  const value = String(dateStr || '');
  if (!/^20\d{6}$/.test(value)) throw new Error(`日期格式錯誤: ${value}`);
  const year = Number(value.slice(0, 4)) - 1911;
  return `${year}/${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

function hasInstitutionalRows(row) {
  if (!row || typeof row !== 'object') return false;
  return REQUIRED_FIELDS.some((field) => {
    const values = row[field];
    return values && typeof values === 'object' && !Array.isArray(values) && Object.keys(values).length > 0;
  });
}

function hasTargetDate(row, rocDate) {
  if (!row || typeof row !== 'object') return false;
  return REQUIRED_FIELDS.every((field) => {
    const values = row[field];
    return values && typeof values === 'object' && !Array.isArray(values)
      && Object.prototype.hasOwnProperty.call(values, rocDate);
  });
}

function isEligibleInstitutionalStockCode(code) {
  return ELIGIBLE_STOCK_CODE_PATTERN.test(String(code || '').trim());
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of String(line || '')) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

function readEligibleStockUniverse(csvPath) {
  if (!fs.existsSync(csvPath)) throw new Error(`找不到股票清單: ${csvPath}`);
  const stockInfo = new Map();
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = parseCSVLine(line);
    const code = String(parts[0] || '').trim();
    const name = String(parts[1] || '').trim();
    if (isEligibleInstitutionalStockCode(code)) stockInfo.set(code, name);
  }
  return stockInfo;
}

function filterInstitutionalDataToUniverse(data, stockInfo) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const eligibleCodes = stockInfo instanceof Map ? new Set(stockInfo.keys()) : new Set(stockInfo || []);
  return Object.fromEntries(
    Object.entries(data).filter(([code, row]) => eligibleCodes.has(code) && hasInstitutionalRows(row))
  );
}

module.exports = {
  REQUIRED_FIELDS,
  ELIGIBLE_STOCK_CODE_PATTERN,
  filterInstitutionalDataToUniverse,
  hasInstitutionalRows,
  hasTargetDate,
  isEligibleInstitutionalStockCode,
  parseCSVLine,
  readEligibleStockUniverse,
  toRocDate,
};
