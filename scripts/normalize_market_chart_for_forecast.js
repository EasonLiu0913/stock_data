'use strict';

const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '..', 'data_twse_market_chart', 'market_chart.json');
const source = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = Array.isArray(source) ? source : Array.isArray(source.data) ? source.data : [];

const normalized = rows
  .filter((row) => row && typeof row === 'object' && row.date && Number.isFinite(Number(row.close)))
  .map((row, index) => {
    const close = Number(row.close);
    const previousClose = index > 0 ? Number(rows[index - 1]?.close) : null;
    const changePercent = Number.isFinite(previousClose) && previousClose !== 0
      ? (close / previousClose - 1) * 100
      : null;
    return {
      ...row,
      date: String(row.date),
      previousClose: Number.isFinite(previousClose) ? previousClose : null,
      changePercent,
    };
  });

fs.writeFileSync(file, JSON.stringify(normalized, null, 2));
console.log(`normalized market rows: ${normalized.length}`);
