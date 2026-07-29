const fs = require('fs');

const indexPath = 'public/index.html';
const entry = "            { file: 'three-day-breakout-institutional-report.html', title: '三日漲幅 10% 前法人與券商布局分析', description: '找出所有連續三個交易日漲幅達 10% 的股票，回看起漲前法人、券商分點、量能與均線共同特徵。' },\n";

let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes("file: 'three-day-breakout-institutional-report.html'")) {
  const marker = '        const tools = [\n';
  if (!html.includes(marker)) throw new Error('Cannot find tools array in public/index.html');
  html = html.replace(marker, marker + entry);
  fs.writeFileSync(indexPath, html);
  console.log('Added breakout report to public/index.html');
} else {
  console.log('Breakout report already exists in public/index.html');
}
