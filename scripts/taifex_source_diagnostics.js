#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  TAIFEX_DAILY_FUTURES_URL,
  fetchJson,
} = require('./official_market_constraints');

async function buildDiagnostics() {
  const result = await fetchJson(TAIFEX_DAILY_FUTURES_URL, { timeoutMs: 60000, retries: 3 });
  if (!result.ok) throw new Error(result.error || 'TAIFEX fetch failed');
  const rows = Array.isArray(result.data) ? result.data : [];
  const contracts = [...new Set(rows.map((row) => String(row.Contract || '').trim()))];
  const txLike = rows.filter((row) => /TX/i.test(String(row.Contract || '')));
  return {
    generated_at: new Date().toISOString(),
    endpoint: TAIFEX_DAILY_FUTURES_URL,
    row_count: rows.length,
    raw_dates: [...new Set(rows.map((row) => row.Date))].slice(-20),
    tx_like_count: txLike.length,
    tx_like_contracts: [...new Set(txLike.map((row) => row.Contract))].slice(0, 30),
    tx_like_dates: [...new Set(txLike.map((row) => row.Date))].slice(-20),
    tx_like_sessions: [...new Set(txLike.map((row) => row.TradingSession))],
    contracts_starting_t: contracts.filter((value) => /^T/i.test(value)).slice(0, 80),
    tx_like_sample: txLike.slice(0, 12),
  };
}

async function main(argv = process.argv.slice(2)) {
  const outputIndex = argv.indexOf('--output');
  const outputArg = outputIndex >= 0 ? argv[outputIndex + 1] : '';
  const diagnostics = await buildDiagnostics();
  if (outputArg) {
    const output = path.resolve(ROOT, outputArg);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(diagnostics, null, 2));
  return diagnostics;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { buildDiagnostics, main };
