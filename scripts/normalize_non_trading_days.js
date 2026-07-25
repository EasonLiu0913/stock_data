'use strict';

const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '..', 'data_history_sma', 'non_trading_days.json');
const source = JSON.parse(fs.readFileSync(file, 'utf8'));
const values = [];

function walk(value) {
  if (Array.isArray(value)) {
    value.forEach(walk);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (/^20\d{2}[-/]\d{2}[-/]\d{2}$/.test(key)) values.push(key);
      walk(child);
    }
    return;
  }
  if (typeof value === 'string' && /^20\d{2}[-/]\d{2}[-/]\d{2}$/.test(value)) values.push(value);
}

walk(source);
fs.writeFileSync(file, JSON.stringify([...new Set(values)], null, 2));
