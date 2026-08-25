'use strict';

const REQUIRED_FIELDS = ['ForeignInvestors', 'InvestmentTrust', 'Dealers', 'DailyTotal'];

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

module.exports = {
  REQUIRED_FIELDS,
  hasInstitutionalRows,
  hasTargetDate,
  toRocDate,
};
