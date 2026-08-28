#!/usr/bin/env node
'use strict';

const https = require('node:https');

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function requestJson(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'stock_data-finmind-broker-probe/1.0',
      },
      timeout: 30000,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          return reject(new Error(`FinMind returned non-JSON HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`FinMind HTTP ${res.statusCode}: ${JSON.stringify(body).slice(0, 500)}`));
        }
        resolve(body);
      });
    });
    req.on('timeout', () => req.destroy(new Error('FinMind request timed out')));
    req.on('error', reject);
  });
}

async function main() {
  const stock = getArg('--stock', '2449');
  const date = getArg('--date', '2026-05-15');
  const token = process.env.FINMIND_API_TOKEN;
  if (!token) throw new Error('FINMIND_API_TOKEN is not available to this job');

  const params = new URLSearchParams({ data_id: stock, date });
  const url = `https://api.finmindtrade.com/api/v4/taiwan_stock_trading_daily_report?${params}`;
  const payload = await requestJson(url, token);
  const rows = Array.isArray(payload.data) ? payload.data : [];

  console.log(`FinMind broker-history probe: ${stock} ${date}`);
  console.log(`status: ${payload.status ?? '(missing)'}`);
  console.log(`rows: ${rows.length}`);

  if (!rows.length) {
    console.log(`message: ${payload.msg || payload.message || '(none)'}`);
    process.exitCode = 2;
    return;
  }

  const required = ['date', 'stock_id', 'securities_trader_id', 'securities_trader', 'price', 'buy', 'sell'];
  const missing = required.filter((key) => !(key in rows[0]));
  if (missing.length) throw new Error(`Missing expected fields: ${missing.join(', ')}`);

  const totals = rows.reduce((acc, row) => {
    acc.buy += Number(row.buy) || 0;
    acc.sell += Number(row.sell) || 0;
    return acc;
  }, { buy: 0, sell: 0 });

  const traders = new Set(rows.map((row) => `${row.securities_trader_id || ''}|${row.securities_trader || ''}`));
  console.log(`unique traders: ${traders.size}`);
  console.log(`total buy shares: ${totals.buy}`);
  console.log(`total sell shares: ${totals.sell}`);
  console.log(`net shares: ${totals.buy - totals.sell}`);
  console.log(`sample keys: ${Object.keys(rows[0]).sort().join(', ')}`);
  console.log(`sample row (redacted to non-sensitive market data): ${JSON.stringify(rows[0])}`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});
