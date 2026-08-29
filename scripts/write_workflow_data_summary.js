#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function getArg(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : '';
}

function render(result) {
  const icon = result.complete ? '🟢' : '🔴';
  const value = (v) => v === null || v === undefined || v === '' ? '無法判定' : String(v);
  const lines = [
    `## ${icon} 資料擷取完整性`,
    `- Workflow：${value(result.workflow)}`,
    `- 預期擷取日期：${value(result.expected_date)}`,
    `- 實際資料日期：${value(result.actual_date)}`,
  ];
  if (result.expected_count !== null && result.expected_count !== undefined) lines.push(`- 預期筆數：${result.expected_count}`);
  if (result.success_count !== null && result.success_count !== undefined) lines.push(`- 成功筆數：${result.success_count}`);
  if (result.missing_count !== null && result.missing_count !== undefined) lines.push(`- 缺少筆數：${result.missing_count}`);
  lines.push(`- 擷取結果：**${result.label || result.status || '未知'}**`);
  lines.push(`- 原因：${result.reason || '未提供'}`);
  lines.push(result.complete
    ? '- 狀態：**綠燈；已完整確認資料。**'
    : '- 狀態：**紅燈；資料未完整確認，不視為成功。**');
  return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
  const inputPath = getArg(argv, '--input');
  if (!inputPath) throw new Error('--input is required');
  const result = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const text = render(result);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text, 'utf8');
  else process.stdout.write(text);
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Failed to write workflow data summary: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { render, main };
