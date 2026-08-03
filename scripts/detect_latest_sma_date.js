'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const DEFAULT_PROBE_STOCKS = [
  '2330',
  '2317',
  '2454',
  '2303',
  '2881',
  '1301',
  '0050',
  '1101',
];

function normalizeDateText(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return null;

  const normalized = text.replace(/\//g, '');
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6));
  const day = Number(normalized.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized;
}

function selectLatestMarketDate(observations, today) {
  const validDates = observations
    .map(item => normalizeDateText(item.dateText))
    .filter(date => date && (!today || date <= today));

  if (validDates.length === 0) {
    throw new Error('No valid SMA market date was detected from probe stocks');
  }

  return validDates.sort().at(-1);
}

async function readDateText(page) {
  try {
    const directText = await page
      .locator('.opsBtmTitleK')
      .first()
      .textContent({ timeout: 5000 });
    if (normalizeDateText(directText)) return directText.trim();
  } catch (error) {
    // Continue with iframe fallback.
  }

  try {
    const iframeElement = await page.$('#SysJustIFRAMEDIV iframe');
    if (!iframeElement) return null;
    const frame = await iframeElement.contentFrame();
    if (!frame) return null;
    const frameText = await frame
      .locator('.opsBtmTitleK')
      .first()
      .textContent({ timeout: 5000 });
    return normalizeDateText(frameText) ? frameText.trim() : null;
  } catch (error) {
    return null;
  }
}

async function detectLatestMarketDate({ probeStocks = DEFAULT_PROBE_STOCKS } = {}) {
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now).replace(/-/g, '');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const observations = [];

  try {
    for (const stockCode of probeStocks) {
      const url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stockCode}.djhtm`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const dateText = await readDateText(page);
        if (!dateText) {
          console.error(`⚠️ 日期探測 ${stockCode}: 無法取得有效日期`);
          continue;
        }

        const normalized = normalizeDateText(dateText);
        if (normalized > today) {
          console.error(`⚠️ 日期探測 ${stockCode}: 忽略未來日期 ${dateText}`);
          continue;
        }

        observations.push({ stockCode, dateText });
        console.error(`🔎 日期探測 ${stockCode}: ${dateText}`);

        // Once Taipei today is observed, no later legitimate market date can exist.
        if (normalized === today) break;
      } catch (error) {
        console.error(`⚠️ 日期探測 ${stockCode} 失敗: ${error.message}`);
      }
    }
  } finally {
    await page.close();
    await browser.close();
  }

  const selected = selectLatestMarketDate(observations, today);
  console.error(
    `✅ 自動選擇最新 SMA 日期: ${selected}（候選：${observations
      .map(item => `${item.stockCode}=${item.dateText}`)
      .join(', ')}）`
  );
  return selected;
}

function runSelfTest() {
  assert.equal(
    selectLatestMarketDate(
      [
        { stockCode: '00410A', dateText: '2026/07/31' },
        { stockCode: '2330', dateText: '2026/08/03' },
      ],
      '20260803'
    ),
    '20260803'
  );

  assert.equal(
    selectLatestMarketDate(
      [
        { stockCode: '2330', dateText: 'invalid' },
        { stockCode: '2317', dateText: '2026/07/31' },
        { stockCode: '2454', dateText: '2026/08/04' },
      ],
      '20260803'
    ),
    '20260731'
  );

  assert.throws(
    () => selectLatestMarketDate([{ stockCode: '2330', dateText: '' }], '20260803'),
    /No valid SMA market date/
  );

  console.log('detect_latest_sma_date self-test passed');
}

async function main() {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
    return;
  }

  const selected = await detectLatestMarketDate();
  process.stdout.write(`${selected}\n`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`❌ SMA 最新交易日偵測失敗: ${error.stack || error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_PROBE_STOCKS,
  normalizeDateText,
  selectLatestMarketDate,
  detectLatestMarketDate,
};
