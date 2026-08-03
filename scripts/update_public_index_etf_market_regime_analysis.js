'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INDEX = path.join(ROOT, 'public', 'index.html');
// Keep the dashboard entry stable so repeated data refreshes remain idempotent.
const ENTRY = "            { file: 'etf-market-regime-analysis.html', title: '0050／0052／00631L 持有與市場情境比較', description: '自選日期區間，比較三檔 ETF 的持有報酬、風險與資產差異，並切換持續上漲、持續下跌、區間震盪、緩慢上漲與緩慢下跌情境。' },";

function injectEntry(source) {
  if (source.includes("file: 'etf-market-regime-analysis.html'")) return source;
  const marker = '        const tools = [\n';
  if (!source.includes(marker)) throw new Error('找不到 public/index.html 的 tools 清單');
  return source.replace(marker, `${marker}${ENTRY}\n`);
}

function updateIndex(file = DEFAULT_INDEX) {
  const source = fs.readFileSync(file, 'utf8');
  const updated = injectEntry(source);
  if (updated !== source) fs.writeFileSync(file, updated, 'utf8');
  return updated !== source;
}

if (require.main === module) {
  try {
    const changed = updateIndex(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INDEX);
    console.log(changed ? 'Added ETF market regime analysis to public index' : 'ETF market regime analysis entry already exists');
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = { ENTRY, injectEntry, updateIndex };
