#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_FINAL_OUTPUT_DIR = path.join(ROOT_DIR, 'data_fubon_broker_details');
const DEFAULT_CRAWLER = path.join(__dirname, 'crawl_fubon_broker_details_resumable.js');
const INTERNAL_VALUE_FLAGS = new Set(['--final-output-dir', '--work-root', '--crawler']);
const DATE_FLAGS = new Set(['--date', '--start', '--end', '--max-dates', '--output-dir']);

function getArg(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

function normalizeDate(value) {
  const match = String(value || '').match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
  if (!match) throw new Error('--date 必須使用 YYYYMMDD 或 YYYY-MM-DD');
  const isoDate = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate) {
    throw new Error(`日期不存在：${value}`);
  }
  return isoDate;
}

function outputFilename(isoDate) {
  return `fubon_${isoDate.replaceAll('-', '')}_券商分點進出明細.json`;
}

function validateCompletePayload(payload, isoDate) {
  const errors = [];
  const successCount = Object.keys(payload?.stocks || {}).length;
  const unavailableCount = Array.isArray(payload?.unavailableStocks) ? payload.unavailableStocks.length : 0;
  if (payload?.complete !== true) errors.push('complete 不是 true');
  if (payload?.date !== isoDate) errors.push(`date 不符：${payload?.date}`);
  if (Number(payload?.failedStockCount || 0) !== 0) errors.push('failedStockCount 不是 0');
  if (Array.isArray(payload?.failedStocks) && payload.failedStocks.length > 0) errors.push('failedStocks 仍有資料');
  if (Number(payload?.successfulStockCount) !== successCount) errors.push('successfulStockCount 不符');
  if (Number(payload?.unavailableStockCount) !== unavailableCount) errors.push('unavailableStockCount 不符');
  if (Number(payload?.stockUniverse?.expectedStockCount) !== successCount + unavailableCount) {
    errors.push('股票母體未完整交代');
  }
  return errors;
}

function publishAtomically(sourceFile, destinationFile, isoDate) {
  const payload = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const errors = validateCompletePayload(payload, isoDate);
  if (errors.length) throw new Error(`拒絕發布未完成檔案：${errors.join('；')}`);
  fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
  const temporary = `${destinationFile}.tmp-${process.pid}`;
  fs.copyFileSync(sourceFile, temporary);
  fs.renameSync(temporary, destinationFile);
  return destinationFile;
}

function passThroughArgs(args) {
  const output = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (INTERNAL_VALUE_FLAGS.has(arg) || DATE_FLAGS.has(arg)) {
      index += 1;
      continue;
    }
    output.push(arg);
  }
  return output;
}

function run(command, args) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: 'inherit'
  });
  return result.status ?? 1;
}

function main(argv = process.argv.slice(2)) {
  const isoDate = normalizeDate(getArg(argv, '--date'));
  const finalOutputDir = path.resolve(getArg(argv, '--final-output-dir') || DEFAULT_FINAL_OUTPUT_DIR);
  const workRoot = path.resolve(getArg(argv, '--work-root') || path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'fubon-broker-details'));
  const crawler = path.resolve(getArg(argv, '--crawler') || DEFAULT_CRAWLER);
  const workDir = path.join(workRoot, isoDate.replaceAll('-', ''));
  const filename = outputFilename(isoDate);
  const sourceFile = path.join(workDir, filename);
  const destinationFile = path.join(finalOutputDir, filename);
  const crawlerArgs = [
    ...passThroughArgs(argv),
    '--date', isoDate,
    '--output-dir', workDir
  ];

  if (!argv.includes('--force') && fs.existsSync(destinationFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(destinationFile, 'utf8'));
      if (validateCompletePayload(existing, isoDate).length === 0) {
        console.log(`⏭️  ${isoDate} 正式檔已完整，跳過重新下載`);
        return 0;
      }
    } catch {
      // Invalid JSON is treated as an incomplete official file.
    }
    fs.rmSync(destinationFile, { force: true });
    console.warn(`🧹 ${isoDate} 移除本機正式資料夾中的未完成檔案`);
  }

  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  console.log(`🧪 ${isoDate} 將先抓到臨時目錄：${workDir}`);
  const crawlStatus = run(crawler, crawlerArgs);
  if (crawlStatus !== 0) {
    fs.rmSync(workDir, { recursive: true, force: true });
    console.error(`❌ ${isoDate} 未完整完成，不發布正式檔案（crawler exit ${crawlStatus}）`);
    return crawlStatus;
  }

  const verifyStatus = run(crawler, ['--date', isoDate, '--output-dir', workDir, '--check-only']);
  if (verifyStatus !== 0 || !fs.existsSync(sourceFile)) {
    fs.rmSync(workDir, { recursive: true, force: true });
    console.error(`❌ ${isoDate} 驗證失敗，不發布正式檔案（verify exit ${verifyStatus}）`);
    return verifyStatus || 2;
  }

  publishAtomically(sourceFile, destinationFile, isoDate);
  fs.rmSync(workDir, { recursive: true, force: true });
  console.log(`✅ ${isoDate} 完整驗證後已發布：${destinationFile}`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`❌ ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  normalizeDate,
  outputFilename,
  passThroughArgs,
  publishAtomically,
  validateCompletePayload
};
