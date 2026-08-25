'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}

function readJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const date = String(args.get('date') || '');
  if (!/^20\d{6}$/.test(date)) throw new Error(`日期格式錯誤: ${date}`);
  const repoRoot = path.resolve(__dirname, '..');
  const statusFile = path.join(repoRoot, 'data_fubon', `fubon_${date}_institutional_status.json`);
  const status = readJson(statusFile);
  if (!status) throw new Error(`找不到 status: ${statusFile}`);
  const before = readJson(args.get('before'));
  const beforeValid = Number(before?.valid_count);
  const valid = Number(status.valid_count) || 0;
  const universe = Number(status.universe_count) || 0;
  const missing = Number(status.missing_count) || 0;
  const recovered = Number.isFinite(beforeValid) ? Math.max(0, valid - beforeValid) : null;
  const reasons = Object.entries(status.reason_counts || {}).filter(([, count]) => Number(count) > 0);
  const anomalies = Array.isArray(status.anomaly_flags) ? status.anomaly_flags : [];
  const sentinels = Object.entries(status.sentinels || {});

  const lines = [
    '## 三大法人資料完整度',
    '',
    `- 目標日期：${date}`,
    `- 狀態：${status.status}`,
    `- 股票母體：${universe}`,
    `- 目前有效：${valid}`,
    `- 剩餘缺漏：${missing}`,
    `- 完成率：${Number(status.completion_rate || 0).toFixed(2)}%`,
  ];
  if (recovered !== null) {
    lines.push(`- 本輪開始前：${beforeValid}`);
    lines.push(`- 本輪成功補回：${recovered}`);
  }
  lines.push('');
  lines.push('### 缺漏原因');
  if (reasons.length === 0) lines.push('- 無');
  else for (const [reason, count] of reasons) lines.push(`- ${reason}：${count}`);
  lines.push('');
  lines.push('### 健康檢查');
  lines.push(`- 異常旗標：${anomalies.length ? anomalies.join('、') : '無'}`);
  for (const [code, item] of sentinels) lines.push(`- ${code} ${item.name || ''}：${item.available ? '✅' : '❌'}`);
  if (status.reference) {
    lines.push(`- 基準日：${status.reference.date}（有效 ${status.reference.valid_count}）`);
    lines.push(`- 相對基準覆蓋率：${status.reference.coverage_percent ?? '-'}%`);
  }
  lines.push('');

  const text = `${lines.join('\n')}\n`;
  const output = process.env.GITHUB_STEP_SUMMARY;
  if (output) fs.appendFileSync(output, text, 'utf8');
  else process.stdout.write(text);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(`Institutional summary failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main };
