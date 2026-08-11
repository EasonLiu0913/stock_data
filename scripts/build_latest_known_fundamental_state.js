#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolveFundamentalStateAt } = require('./fundamental_state_resolver');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_fundamental_state');

function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out.set(key, true);
    else { out.set(key, next); i += 1; }
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const stockIds = String(args.get('stock-ids') || '2330,2317,2454,2059').split(',').map(v => v.trim()).filter(Boolean);
  const cutoff = String(args.get('cutoff') || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const date = cutoff.slice(0, 10).replace(/-/g, '');
  const dir = path.join(OUTPUT_ROOT, date);
  fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  for (const stockId of stockIds) {
    const state = resolveFundamentalStateAt(stockId, cutoff);
    fs.writeFileSync(path.join(dir, `${stockId}.json`), `${JSON.stringify(state, null, 2)}\n`);
    rows.push({
      stock_id: stockId,
      available_event_count: state.available_event_count,
      financial_period: state.availability_summary.financial_period,
      financial_event_type: state.availability_summary.financial_event_type,
      financial_confidence: state.availability_summary.financial_confidence,
      monthly_period: state.availability_summary.monthly_period,
      monthly_confidence: state.availability_summary.monthly_confidence,
    });
  }
  const summary = {
    schema_version: 1,
    dataset: 'latest_known_fundamental_state_build_summary',
    generated_at: new Date().toISOString(),
    shadow_mode: true,
    production_integration: false,
    cutoff,
    stock_count: rows.length,
    rows,
  };
  fs.writeFileSync(path.join(dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { main };
