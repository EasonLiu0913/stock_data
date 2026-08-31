'use strict';

const fs = require('node:fs');
const path = require('node:path');

function normalizeCompactDate(value) {
  const compact = String(value || '').replace(/[^\d]/g, '');
  if (!/^20\d{6}$/.test(compact)) throw new Error(`Invalid date: ${value}`);
  const date = new Date(`${compact.slice(0,4)}-${compact.slice(4,6)}-${compact.slice(6,8)}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10).replaceAll('-', '') !== compact) throw new Error(`Invalid calendar date: ${value}`);
  return compact;
}

function loadNonTradingDays(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dates = new Set();
  for (const entries of Object.values(payload || {})) {
    if (!Array.isArray(entries)) continue;
    for (const value of entries) dates.add(normalizeCompactDate(value));
  }
  return dates;
}

function previousOrSameTradingDate(baseDate, nonTradingDays) {
  let compact = normalizeCompactDate(baseDate);
  for (;;) {
    const iso = `${compact.slice(0,4)}-${compact.slice(4,6)}-${compact.slice(6,8)}`;
    const date = new Date(`${iso}T00:00:00Z`);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6 && !nonTradingDays.has(compact)) return compact;
    date.setUTCDate(date.getUTCDate() - 1);
    compact = date.toISOString().slice(0,10).replaceAll('-', '');
  }
}

function main() {
  const args = process.argv.slice(2);
  const valueAfter = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : null;
  };
  const baseDate = valueAfter('--base-date');
  const holidaysFile = valueAfter('--holidays-file') || path.join(__dirname, '../data_history_sma/non_trading_days.json');
  const result = previousOrSameTradingDate(baseDate, loadNonTradingDays(holidaysFile));
  process.stdout.write(`${result}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { loadNonTradingDays, normalizeCompactDate, previousOrSameTradingDate };
