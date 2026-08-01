'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INDEX = path.join(ROOT, 'public', 'index.html');
const ENTRY = "            { file: 'oversold-rebound-dashboard.html', title: '跌深反彈歷史研究 Dashboard', description: '查詢個股歷史跌深事件、反彈成功率、成功與失敗特徵差異及資料覆蓋率。' },";

function injectDashboardEntry(source) {
  if (source.includes("file: 'oversold-rebound-dashboard.html'")) return source;
  const marker = '        const tools = [\n';
  if (!source.includes(marker)) throw new Error('找不到 public/index.html 的 tools 清單');
  return source.replace(marker, `${marker}${ENTRY}\n`);
}

function updateIndex(file = DEFAULT_INDEX) {
  const source = fs.readFileSync(file, 'utf8');
  const updated = injectDashboardEntry(source);
  if (updated !== source) fs.writeFileSync(file, updated, 'utf8');
  return updated !== source;
}

if (require.main === module) {
  try {
    const changed = updateIndex(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INDEX);
    console.log(changed ? 'Added oversold rebound dashboard to public index' : 'Dashboard entry already exists');
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = { ENTRY, injectDashboardEntry, updateIndex };
