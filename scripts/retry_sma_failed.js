const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 重爬 SMA 失敗的股票
 * 
 * 使用方式:
 *   node scripts/retry_sma_failed.js
 *   node scripts/retry_sma_failed.js --date 20260204
 * 
 * 讀取: data_fubon/fubon_YYYYMMDD_sma_failedList.json
 * 更新: data_fubon/fubon_YYYYMMDD_sma.json
 */

const MAX_CONCURRENCY = 3;

(async () => {
 // 取得台北時間
 const now = new Date();
 const taipeiDateString = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour12: false });
 const taipeiTime = new Date(taipeiDateString);
 const taipeiHour = taipeiTime.getHours();

 const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
 };

 const todayStr = formatDate(taipeiTime);
 const yesterdayTaipei = new Date(taipeiTime);
 yesterdayTaipei.setDate(yesterdayTaipei.getDate() - 1);
 const yesterdayStr = formatDate(yesterdayTaipei);

 // 解析命令列參數
 const args = process.argv.slice(2);
 const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
 };

 let targetDateStr = getArg('--date');
 if (!targetDateStr) {
  targetDateStr = taipeiHour < 14 ? yesterdayStr : todayStr;
 }

 console.log(`\n🔄 SMA 失敗股票重爬`);
 console.log(`📅 目標日期: ${targetDateStr}\n`);
 const targetDateKey = `${targetDateStr.substring(0, 4)}/${targetDateStr.substring(4, 6)}/${targetDateStr.substring(6, 8)}`;

 const removeStaleUnknownEntries = (data) => {
  for (const stockData of Object.values(data)) {
   if (stockData && stockData[targetDateKey]) {
    delete stockData.Unknown;
   }
  }
 };

 // 檔案路徑
 const failedListPath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_sma_failedList.json`);
 const smaDataPath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_sma.json`);
 const twseIndustryCsvPath = path.join(__dirname, '../data_twse/twse_industry.csv');

 // 檢查失敗清單是否存在
 if (!fs.existsSync(failedListPath)) {
  console.log(`✅ 沒有失敗清單: ${failedListPath}`);
  console.log('   無需重爬！');
  return;
 }

 // 讀取失敗清單
 let failedList;
 try {
  failedList = JSON.parse(fs.readFileSync(failedListPath, 'utf8'));
 } catch (e) {
  console.error(`❌ 無法讀取失敗清單: ${e.message}`);
  process.exit(1);
 }

 if (failedList.length === 0) {
  console.log('✅ 失敗清單為空，無需重爬！');
  fs.unlinkSync(failedListPath);
  return;
 }

 console.log(`📋 待重爬股票: ${failedList.length} 個\n`);

 // 讀取股票名稱對照
 const stockInfoMap = new Map();
 function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
   const char = line[i];
   if (char === '"') { inQuotes = !inQuotes; }
   else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
   else { current += char; }
  }
  result.push(current.trim());
  return result;
 }

 if (fs.existsSync(twseIndustryCsvPath)) {
  const csvContent = fs.readFileSync(twseIndustryCsvPath, 'utf8');
  const lines = csvContent.split('\n');
  for (let i = 1; i < lines.length; i++) {
   const line = lines[i].trim();
   if (!line) continue;
   const parts = parseCSVLine(line);
   if (parts.length >= 2) {
    stockInfoMap.set(parts[0], parts[1]);
   }
  }
 }

 // 讀取現有 SMA 資料
 let smaData = {};
 if (fs.existsSync(smaDataPath)) {
  try {
   smaData = JSON.parse(fs.readFileSync(smaDataPath, 'utf8'));
   removeStaleUnknownEntries(smaData);
  } catch (e) {
   console.log(`⚠️ 無法讀取現有 SMA 資料`);
  }
 }

 // 啟動瀏覽器
 const browser = await chromium.launch({ headless: true });

 let successCount = 0;
 let failCount = 0;
 const stillFailedList = [];
 const queue = [...failedList];
 const total = failedList.length;
 let processedCount = 0;

 async function focusChart(context) {
  try {
   const graphEl = context.locator('#SysJustWebGraphDIV').first();
   if (await graphEl.count()) {
    await graphEl.click({ force: true, position: { x: 12, y: 12 } });
   } else {
    await context.locator('body').click({ force: true, position: { x: 12, y: 12 } });
   }
   if (typeof context.waitForTimeout === 'function') {
    await context.waitForTimeout(250);
   }
   return true;
  } catch (e) {
   return false;
  }
 }

 async function getChartDate(context) {
  try {
   const dateText = await context.locator('.opsBtmTitleK').first().textContent({ timeout: 2000 });
   return dateText ? dateText.trim() : '';
  } catch (e) {
   return '';
  }
 }

 async function moveChartToPreviousDay(context, currentDate, stockNumber) {
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt++) {
   try {
    await focusChart(context);
    const graphEl = context.locator('#SysJustWebGraphDIV').first();
    if (await graphEl.count()) {
     await graphEl.press('ArrowLeft');
    } else {
     await context.locator('body').press('ArrowLeft');
    }

    const changed = await context.waitForFunction(
     (selector, expectedDate) => {
      const el = document.querySelector(selector);
      return !!(el && el.textContent && el.textContent.trim() !== expectedDate);
     },
     '.opsBtmTitleK',
     currentDate,
     { timeout: 3500 }
    ).then(() => true).catch(() => false);

    const nextDate = await getChartDate(context);
    if (changed && nextDate && nextDate !== currentDate) {
     return nextDate;
    }

    console.log(`   ⚠️ [${stockNumber}] ArrowLeft attempt ${attempt}/${attempts} did not move date from ${currentDate}. Refocusing...`);
   } catch (e) {
    console.log(`   ⚠️ [${stockNumber}] ArrowLeft attempt ${attempt}/${attempts} failed: ${e.message}`);
   }
  }

  return await getChartDate(context);
 }

 async function extractSmaData(context) {
  return context.evaluate(() => {
   const sysJustWebGraphDIV = document.querySelector('#SysJustWebGraphDIV');
   if (!sysJustWebGraphDIV) return { error: '找不到 #SysJustWebGraphDIV' };

   let fgTxt = sysJustWebGraphDIV.querySelector('div.op.FgTxt') ||
    sysJustWebGraphDIV.querySelector('div.opsFgTxt') ||
    sysJustWebGraphDIV.querySelector('div[class*="FgTxt"]');
   if (!fgTxt) return { error: '找不到 div.FgTxt' };

   const hasSmaText = (text) => /SMA\d+/.test(text || '');
   let fg0 = fgTxt.querySelector('#fg0') || fgTxt.querySelector('div[id*="fg0"]');
   if (!fg0) {
    const allDivs = Array.from(fgTxt.querySelectorAll('div'));
    fg0 = allDivs.find(div => hasSmaText(div.innerText));
   }
   if (!fg0) return { error: '找不到 div#fg0' };

   let targetDiv = fg0.querySelector('div.box > div');
   if (!targetDiv) {
    const allDivs = Array.from(fg0.querySelectorAll('div'));
    targetDiv = allDivs.find(div => hasSmaText(div.innerText)) || fg0;
   }

   const spans = Array.from(targetDiv.querySelectorAll('span'));
   let spanTexts = spans.map(span => span.innerText.trim()).filter(text => text);

   if (spanTexts.length === 0) {
    const divText = targetDiv.innerText.trim();
    const pattern = /(SMA\d+)\s*([\d,]+\.?\d*)/g;
    let match;
    while ((match = pattern.exec(divText)) !== null) {
     spanTexts.push(match[1], match[2]);
    }
   }

   const removeCommas = (str) => (typeof str === 'string' ? str.replace(/,/g, '') : str);
   const dateElement = document.querySelector('.opsBtmTitleK');
   if (!dateElement) return { error: '找不到日期元素 .opsBtmTitleK' };

   const dateKey = dateElement.innerText.trim();
   if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateKey)) {
    return { error: `日期格式錯誤: ${dateKey || '(空白)'}` };
   }

   const dataObj = {};
   const priceLegend = Array.from(document.querySelectorAll('.notehead .opsLegendK'))
    .find(el => {
     const notehead = el.closest('.notehead');
     return el.innerText.trim() === '股價' || (notehead && notehead.innerText.includes('股價'));
    });

   if (priceLegend) {
    const priceContainer = priceLegend.closest('.notehead');
    const priceSpan = priceContainer ? priceContainer.querySelector('.opsTopTitleK span') : null;
    const priceText = priceSpan ? removeCommas(priceSpan.innerText.trim()) : '';
    if (/^\d+(\.\d+)?$/.test(priceText)) {
     dataObj.Price = priceText;
    }
   }

   const setNumericField = (fieldName, selector, extractor) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const rawText = extractor ? extractor(el) : el.innerText.trim();
    const value = removeCommas(rawText).match(/\d+(\.\d+)?/);
    if (value) {
     dataObj[fieldName] = value[0];
    }
   };

   setNumericField('Open', '.opsLegendK-o span', el => el.innerText.trim());
   setNumericField('High', '.opsLegendK-h span', el => el.innerText.trim());
   setNumericField('Low', '.opsLegendK-l span', el => el.innerText.trim());
   setNumericField('Volume', '.opsLegendK-v', el => el.innerText.trim());

   if (spanTexts.length % 2 === 0 && spanTexts.length > 0) {
    for (let i = 0; i < spanTexts.length; i += 2) {
     dataObj[spanTexts[i]] = removeCommas(spanTexts[i + 1]);
    }
   }

   const requiredFields = ['Price', 'Open', 'High', 'Low', 'Volume'];
   const missingFields = requiredFields.filter(field => !dataObj[field]);
   const hasSmaField = Object.keys(dataObj).some(field => field.startsWith('SMA') && dataObj[field]);
   if (!hasSmaField) {
    missingFields.push('SMA*');
   }
   if (missingFields.length > 0) {
    return { error: `缺少必要欄位: ${missingFields.join(', ')}` };
   }

   return { success: true, date: dateKey, data: { [dateKey]: dataObj } };
  });
 }

 async function moveToTargetDate(context, currentDate, stockNumber) {
  let date = currentDate;
  let moves = 0;
  const maxMoves = 60;

  while (date > targetDateKey && moves < maxMoves) {
   const nextDate = await moveChartToPreviousDay(context, date, stockNumber);
   if (!nextDate || nextDate === date) {
    return { error: `無法切換到目標日期: 目前 ${date}，預期 ${targetDateKey}` };
   }
   date = nextDate;
   moves++;
  }

  if (date < targetDateKey) {
   return { error: `日期早於目標日期: 取得 ${date}，預期 ${targetDateKey}` };
  }

  return extractSmaData(context);
 }

 // 處理單一股票
 async function processStock(page, failedItem) {
  processedCount++;
  const currentIdx = processedCount;
  const stockNumber = failedItem.stock;
  const url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stockNumber}.djhtm`;

  try {
   await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
   await page.waitForTimeout(1500);

   // 處理 iframe
   let targetFrame = page;
   try {
    const iframeElement = await page.$('#SysJustIFRAMEDIV iframe');
    if (iframeElement) {
     const frameContent = await iframeElement.contentFrame();
     if (frameContent) {
      targetFrame = frameContent;
      await targetFrame.waitForSelector('#SysJustWebGraphDIV', { timeout: 10000 });
     }
    } else {
     await page.waitForSelector('#SysJustWebGraphDIV', { timeout: 10000 });
    }
   } catch (e) {
    try { await page.waitForSelector('#SysJustWebGraphDIV', { timeout: 5000 }); } catch (e2) { }
   }

   // 提取 SMA 資料
   let data = await extractSmaData(targetFrame);

   if (!data.error && data.date > targetDateKey) {
    console.log(`  ↩️  [${currentIdx}/${total}] ${stockNumber}: 取得 ${data.date}，嘗試回切到 ${targetDateKey}`);
    data = await moveToTargetDate(targetFrame, data.date, stockNumber);
   }

   if (data.error) {
    console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: ${data.error}`);
    failCount++;
    stillFailedList.push({ stock: stockNumber, url: url, error: data.error });
   } else if (data.date !== targetDateKey) {
    const errorPrefix = data.date < targetDateKey ? '日期早於目標日期' : '日期不符';
    const errorMessage = `${errorPrefix}: 取得 ${data.date}，預期 ${targetDateKey}`;
    console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: ${errorMessage}`);
    failCount++;
    stillFailedList.push({ stock: stockNumber, url: url, error: errorMessage });
   } else {
    console.log(`  ✅ [${currentIdx}/${total}] ${stockNumber}: SMA OK`);
    const stockData = { ...(smaData[stockNumber] || {}) };
    delete stockData.Unknown;
    smaData[stockNumber] = {
     ...stockData,
     StockName: stockInfoMap.get(stockNumber) || '',
     ...data.data
    };
    successCount++;
   }

  } catch (error) {
   console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: 錯誤 - ${error.message}`);
   failCount++;
   stillFailedList.push({ stock: stockNumber, url: url, error: error.message });
  }

  const delay = Math.floor(Math.random() * 501) + 500;
  await page.waitForTimeout(delay);
 }

 // Worker Pool
 const workers = [];
 for (let i = 0; i < MAX_CONCURRENCY; i++) {
  workers.push((async () => {
   const page = await browser.newPage();
   await page.waitForTimeout(i * 500);

   while (queue.length > 0) {
    const item = queue.shift();
    if (item) {
     await processStock(page, item);
    }
   }
   await page.close();
  })());
 }

 await Promise.all(workers);
 await browser.close();

 // 輸出統計
 console.log('\n\n=== 重爬完成 ===');
 console.log(`✅ 成功: ${successCount} 個`);
 console.log(`❌ 仍失敗: ${failCount} 個\n`);

 // 儲存更新後的 SMA 資料
 fs.writeFileSync(smaDataPath, JSON.stringify(smaData, null, 2), 'utf8');
 console.log(`💾 已更新: ${smaDataPath}`);

 // 更新失敗清單
 if (stillFailedList.length > 0) {
  fs.writeFileSync(failedListPath, JSON.stringify(stillFailedList, null, 2), 'utf8');
  console.log(`📋 仍有 ${stillFailedList.length} 個失敗，已更新失敗清單`);
 } else {
  fs.unlinkSync(failedListPath);
  console.log(`🗑️  所有股票都成功了，已刪除失敗清單`);
 }

})();
