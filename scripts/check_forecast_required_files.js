#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function normalizeCompactDate(value) {
  const compact = String(value || '').replaceAll('-', '').trim();
  if (!/^20\d{6}$/.test(compact)) {
    throw new Error(`FORECAST_BASE_DATE 格式錯誤或未設定：${value || '(empty)'}`);
  }
  return compact;
}

function requiredFiles(baseDate) {
  return [
    ['股票清單', 'data_twse/twse_industry_Stock.json'],
    ['休市日設定', 'data_history_sma/non_trading_days.json'],
    ['Dashboard 索引', 'public/index.html'],
    ['新聞別名設定', 'config/stock_news_aliases.json'],
    ['基準日個股價格與技術指標', `data_fubon/fubon_${baseDate}_sma.json`],
    ['基準日三大法人', `data_twse_institutional_investors/${baseDate}_twse_institutional_investors.json`],
    ['基準日融資融券', `data_twse_margin_balance/${baseDate}_twse_margin_balance.csv`],
    ['基準日券商分點', `data_fubon_broker_details/fubon_${baseDate}_券商分點進出明細.json`],
    ['基準日大盤指數', `data_twse_mi_index/${baseDate}_twse_mi_index.json`],
    ['基準日市場新聞', `data_market_news/${baseDate}/market_news.json`],
    ['基準日外部市場指標', `data_external_market/${baseDate}/external_market_indicators.json`]
  ].map(([label, relativePath]) => ({ label, relativePath }));
}

function inspectRequiredFiles(root, baseDate) {
  return requiredFiles(baseDate).flatMap((file) => {
    const absolutePath = path.join(root, file.relativePath);
    try {
      const stat = fs.statSync(absolutePath);
      if (!stat.isFile()) return [{ ...file, reason: '不是一般檔案' }];
      if (stat.size === 0) return [{ ...file, reason: '檔案是空的' }];
      return [];
    } catch (error) {
      if (error.code === 'ENOENT') return [{ ...file, reason: '檔案不存在' }];
      return [{ ...file, reason: `無法讀取：${error.message}` }];
    }
  });
}

function escapeWorkflowCommand(value) {
  return String(value)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

function writeStepSummary(baseDate, problems) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  const lines = [
    '## 預測必要檔案檢查失敗',
    '',
    `基準交易日：\`${baseDate}\``,
    '',
    ...problems.map((file) => `- **${file.label}**：\`${file.relativePath}\`（${file.reason}）`),
    ''
  ];
  fs.appendFileSync(summaryFile, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const baseDate = normalizeCompactDate(process.env.FORECAST_BASE_DATE);
  const problems = inspectRequiredFiles(ROOT, baseDate);

  if (problems.length === 0) {
    console.log(`必要檔案檢查通過：基準交易日 ${baseDate}，共 ${requiredFiles(baseDate).length} 個檔案。`);
    return;
  }

  const details = problems
    .map((file) => `${file.label}: ${file.relativePath} (${file.reason})`)
    .join('\n');
  console.error(`必要檔案檢查失敗，缺少或無法使用 ${problems.length} 個檔案：`);
  for (const file of problems) {
    console.error(`- ${file.label}: ${file.relativePath} (${file.reason})`);
  }
  console.error(`::error title=預測必要檔案檢查失敗::${escapeWorkflowCommand(details)}`);
  writeStepSummary(baseDate, problems);
  process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`必要檔案檢查無法執行：${error.message}`);
    console.error(`::error title=預測必要檔案檢查無法執行::${escapeWorkflowCommand(error.message)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  inspectRequiredFiles,
  normalizeCompactDate,
  requiredFiles
};
