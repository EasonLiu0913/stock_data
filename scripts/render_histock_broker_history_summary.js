#!/usr/bin/env node

const fs = require('fs');

const analysisPath = process.argv[2];
if (!analysisPath) {
  console.error('Usage: node scripts/render_histock_broker_history_summary.js <analysis.json>');
  process.exit(1);
}

if (!fs.existsSync(analysisPath)) {
  console.log('> analysis.json was not generated, so rolling broker tables are unavailable.');
  process.exit(0);
}

const a = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const latest = Array.isArray(a.rolling) ? a.rolling.at(-1) : null;

console.log(`- Parsed trading days: ${a.counts?.parsed_trading_days ?? 'N/A'}`);
console.log(`- Skipped weekdays: ${a.counts?.skipped ?? 'N/A'}`);
console.log(`- Failed dates: ${a.counts?.failed ?? 'N/A'}`);
console.log(`- Latest parsed date: ${latest?.date || 'N/A'}`);

if (!latest || !Array.isArray(latest.windows)) {
  console.log('\n> No rolling-window data available.');
  process.exit(0);
}

function printSide(title, rows, side) {
  console.log(`\n### ${title}`);
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('- No qualifying brokers');
    return;
  }
  console.log('| Broker | Net lots | Direction days | Appearances | Ratio |');
  console.log('|---|---:|---:|---:|---:|');
  for (const x of rows.slice(0, 8)) {
    const days = side === 'sell' ? x.sell_days : x.buy_days;
    const ratio = side === 'sell' ? x.sell_ratio : x.buy_ratio;
    console.log(`| ${x.broker} | ${fmt(x.total_net)} | ${days} | ${x.appearances} | ${(Number(ratio || 0) * 100).toFixed(0)}% |`);
  }
}

for (const windowSize of [5, 10, 20]) {
  const w = latest.windows.find((x) => Number(x.window) === windowSize);
  console.log(`\n## Latest ${windowSize}d broker persistence`);
  if (!w) {
    console.log('- No data for this window');
    continue;
  }
  console.log(`- Window: ${w.from || 'N/A'} → ${w.to || 'N/A'}`);
  console.log(`- Available parsed trading days: ${w.available_trading_days ?? 'N/A'}`);
  printSide(`Persistent sellers (${windowSize}d)`, w.persistent_sellers, 'sell');
  printSide(`Persistent buyers (${windowSize}d)`, w.persistent_buyers, 'buy');
}
