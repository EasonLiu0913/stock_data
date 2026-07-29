#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const WELCOME_URL = 'https://bsr.twse.com.tw/bshtm/bsWelcome.aspx';
const MENU_URL = 'https://bsr.twse.com.tw/bshtm/bsMenu.aspx';
const DOWNLOAD_ORIGIN = 'https://bsr.twse.com.tw';
const DOWNLOAD_PATH = '/bshtm/bsContent.aspx';
const DEFAULT_TIMEOUT_MS = 300000;
const DEFAULT_OUTPUT_DIR = path.resolve(
  __dirname,
  '..',
  'data_twse_broker_trades',
  'raw',
);

function getArg(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : '';
}

function getPositionalStockCode(args) {
  const flagsWithValues = new Set([
    '--stock',
    '--output-dir',
    '--timeout-ms',
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (flagsWithValues.has(argument)) {
      index += 1;
      continue;
    }
    if (!argument.startsWith('-')) return argument;
  }
  return '';
}

function normalizeStockCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!/^[0-9A-Z]{4,6}$/.test(normalized)) {
    throw new Error(
      `Invalid stock code: ${value || '(empty)'}. Expected 4-6 letters or digits.`,
    );
  }
  return normalized;
}

function parsePositiveInteger(value, label, fallback) {
  if (value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return number;
}

function parseOfficialDataDate(value) {
  const match = String(value || '').match(
    /資料日期\s*[:：]\s*(20\d{2})[/-](\d{1,2})[/-](\d{1,2})/,
  );
  if (!match) {
    throw new Error('TWSE welcome page does not contain a recognizable data date');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error(`TWSE welcome page contains an invalid data date: ${match[0]}`);
  }
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('');
}

function buildOutputPath(outputDir, dataDate, stockCode) {
  return path.join(
    outputDir,
    `${dataDate}_${stockCode}_twse_broker_trades.csv`,
  );
}

function validateDownloadLink(href, stockCode) {
  let url;
  try {
    url = new URL(href, MENU_URL);
  } catch {
    throw new Error(`TWSE CSV link is invalid: ${href}`);
  }
  if (url.origin !== DOWNLOAD_ORIGIN || url.pathname !== DOWNLOAD_PATH) {
    throw new Error(`Unexpected TWSE CSV download URL: ${url.href}`);
  }
  if (normalizeStockCode(url.searchParams.get('StkNo')) !== stockCode) {
    throw new Error(
      `TWSE CSV link stock code does not match requested ${stockCode}`,
    );
  }
  const recordCount = Number(url.searchParams.get('RecCount'));
  if (!Number.isInteger(recordCount) || recordCount < 1) {
    throw new Error(`TWSE CSV link has invalid RecCount: ${recordCount}`);
  }
  return { url: url.href, recordCount };
}

function validateDownloadedFile(file) {
  const stats = fs.statSync(file);
  if (!stats.isFile() || stats.size < 16) {
    throw new Error('Downloaded TWSE CSV is empty or too small');
  }
  const fileHandle = fs.openSync(file, 'r');
  try {
    const preview = Buffer.alloc(Math.min(stats.size, 1024));
    fs.readSync(fileHandle, preview, 0, preview.length, 0);
    const text = preview.toString('latin1').trimStart().toLowerCase();
    if (
      text.startsWith('<!doctype html')
      || text.startsWith('<html')
      || text.includes('<body')
    ) {
      throw new Error('TWSE returned an HTML page instead of CSV data');
    }
  } finally {
    fs.closeSync(fileHandle);
  }
  return stats.size;
}

function usage() {
  return [
    'Usage:',
    '  npm run download:twse-broker-csv -- 2330',
    '  node scripts/download_twse_broker_csv.js --stock 2330',
    '',
    'Options:',
    '  --stock CODE        TWSE security code (4-6 letters or digits)',
    '  --output-dir DIR    Output directory',
    '  --timeout-ms MS     Time allowed for manual CAPTCHA entry (default: 300000)',
    '  --force             Replace an existing validated target file',
    '',
    'The browser fills the stock code. You must manually enter the CAPTCHA and',
    'click 查詢. The script then validates and clicks the official CSV link.',
  ].join('\n');
}

async function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }

  const stockCode = normalizeStockCode(
    getArg(args, '--stock') || getPositionalStockCode(args),
  );
  const timeoutMs = parsePositiveInteger(
    getArg(args, '--timeout-ms'),
    '--timeout-ms',
    DEFAULT_TIMEOUT_MS,
  );
  const outputDir = path.resolve(
    getArg(args, '--output-dir') || DEFAULT_OUTPUT_DIR,
  );
  const force = args.includes('--force');
  fs.mkdirSync(outputDir, { recursive: true });

  const { chromium } = require('playwright');
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
  } catch (error) {
    if (/executable.*doesn.*exist|browser.*not found/i.test(error.message)) {
      throw new Error(
        'Playwright Chromium is not installed. Run: npx playwright install chromium',
      );
    }
    throw error;
  }

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: 'zh-TW',
      timezoneId: 'Asia/Taipei',
    });
    const page = await context.newPage();
    page.on('dialog', async (dialog) => {
      console.warn(`⚠️ TWSE message: ${dialog.message()}`);
      await dialog.dismiss();
    });

    await page.goto(WELCOME_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    const dataDate = parseOfficialDataDate(
      await page.locator('body').innerText(),
    );
    const outputFile = buildOutputPath(outputDir, dataDate, stockCode);
    if (fs.existsSync(outputFile) && !force) {
      const size = validateDownloadedFile(outputFile);
      console.log(`⏭️ Valid file already exists (${size} bytes): ${outputFile}`);
      return;
    }

    await page.goto(MENU_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.locator('#RadioButton_Normal').check();
    await page.locator('#TextBox_Stkno').fill(stockCode);
    await page.locator('input[name="CaptchaControl1"]').click();

    console.log(`📅 TWSE data date: ${dataDate}`);
    console.log(`🔎 Stock code filled: ${stockCode}`);
    console.log('👤 Please enter the 5-character CAPTCHA in the browser and click 查詢.');
    console.log(
      `⏳ Waiting up to ${Math.round(timeoutMs / 1000)} seconds for the CSV link...`,
    );

    const downloadLink = page.locator('#HyperLink_DownloadCSV');
    await downloadLink.waitFor({ state: 'visible', timeout: timeoutMs });
    const link = validateDownloadLink(
      await downloadLink.getAttribute('href'),
      stockCode,
    );
    console.log(`✅ CSV link verified: ${link.recordCount} records`);

    const temporaryFile = `${outputFile}.part-${process.pid}`;
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await downloadLink.click();
    const download = await downloadPromise;
    const failure = await download.failure();
    if (failure) throw new Error(`TWSE CSV download failed: ${failure}`);

    try {
      await download.saveAs(temporaryFile);
      const size = validateDownloadedFile(temporaryFile);
      if (fs.existsSync(outputFile)) {
        if (!force) {
          throw new Error(`Target file already exists: ${outputFile}`);
        }
        fs.unlinkSync(outputFile);
      }
      fs.renameSync(temporaryFile, outputFile);
      console.log(`✅ Saved ${link.recordCount} TWSE broker records (${size} bytes)`);
      console.log(`📁 ${outputFile}`);
    } finally {
      if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Failed to download TWSE broker CSV: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_OUTPUT_DIR,
  MENU_URL,
  WELCOME_URL,
  buildOutputPath,
  main,
  normalizeStockCode,
  parseOfficialDataDate,
  validateDownloadLink,
  validateDownloadedFile,
};
