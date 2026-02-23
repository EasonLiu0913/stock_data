const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// --- 設定區 ---
const MAX_CONCURRENCY = 5; // 最大並發數

/**
 * SMA 技術指標資料爬取腳本
 * 
 * 使用方式:
 *   node scripts/crawl_sma_data.js
 *   node scripts/crawl_sma_data.js --date 20260204
 * 
 * 輸出檔案:
 *   data_fubon/fubon_YYYYMMDD_sma.json
 */

(async () => {
 // 取得台北時間 (UTC+8)
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

 let targetDateStr = null;

 // 解析命令列參數
 const args = process.argv.slice(2);
 const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
 };
 const argDate = getArg('--date');

 if (argDate) {
  targetDateStr = argDate;
  console.log(`📅 使用指定日期: ${targetDateStr}`);
 }

 console.log(
  `📅 系統原始時間 (UTC/Local): ${now.toISOString()}\n` +
  `🌏 台北時間 (UTC+8): ${taipeiDateString} (Hour: ${taipeiHour})\n` +
  `📅 交易日期判斷: 今天=${todayStr}, 昨天=${yesterdayStr}\n`
 );

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

 // 讀取 TWSE 產業分類 CSV 檔案
 const twseIndustryCsvPath = path.join(__dirname, '../data_twse/twse_industry.csv');
 const stockInfoMap = new Map();

 if (fs.existsSync(twseIndustryCsvPath)) {
  console.log(`📁 讀取股票清單: ${twseIndustryCsvPath}`);
  const csvContent = fs.readFileSync(twseIndustryCsvPath, 'utf8');
  const lines = csvContent.split('\n');
  for (let i = 1; i < lines.length; i++) {
   const line = lines[i].trim();
   if (!line) continue;
   const parts = parseCSVLine(line);
   if (parts.length >= 2) {
    const stockCode = parts[0];
    const stockName = parts[1];
    if (stockCode && /^\d+/.test(stockCode)) {
     stockInfoMap.set(stockCode, stockName);
    }
   }
  }
 } else {
  console.error(`❌ 找不到股票清單檔案: ${twseIndustryCsvPath}`);
  process.exit(1);
 }

 let stockNumbers = Array.from(stockInfoMap.keys()).sort();
 console.log(`📊 從 CSV 中提取到 ${stockNumbers.length} 個股票代碼\n`);

 if (stockNumbers.length === 0) {
  console.error('❌ 沒有股票代碼，無法執行。');
  process.exit(1);
 }

 // 啟動瀏覽器
 const browser = await chromium.launch({ headless: true });

 // --- 偵測市場日期 ---
 if (!targetDateStr) {
  console.log('🕵️‍♂️ 正在偵測最新的市場日期 (從前幾檔股票中提取)...');
  const probePage = await browser.newPage();
  try {
   const probeLimit = Math.min(stockNumbers.length, 3);
   for (let i = 0; i < probeLimit; i++) {
    const stockCode = stockNumbers[i];
    const probeUrl = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stockCode}.djhtm`;
    try {
     await probePage.goto(probeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
     try { await probePage.waitForSelector('.opsBtmTitleK', { timeout: 5000 }); } catch (e) { }

     const dateText = await probePage.evaluate(() => {
      const el = document.querySelector('.opsBtmTitleK');
      return el ? el.innerText.trim() : null;
     });

     if (dateText && /^\d{4}\/\d{2}\/\d{2}$/.test(dateText)) {
      targetDateStr = dateText.replace(/\//g, '');
      console.log(`✅ 偵測到日期: ${dateText} (將以此作為檔名日期)`);
      break;
     }
    } catch (e) {
     console.log(`   ⚠️ 無法從 ${stockCode} 獲取日期: ${e.message}`);
    }
   }
  } finally {
   await probePage.close();
  }

  if (!targetDateStr) {
   targetDateStr = taipeiHour < 14 ? yesterdayStr : todayStr;
   console.warn(`⚠️ 無法自動偵測日期，回退到時間判斷: ${targetDateStr}`);
  }
 }

 console.log(`\n📈 SMA 技術指標資料爬取`);
 console.log(`📁 目標檔案: fubon_${targetDateStr}_sma.json\n`);

 // 週末判斷：若目標日期為週六或週日，直接結束
 const tgtYear = parseInt(targetDateStr.substring(0, 4));
 const tgtMonth = parseInt(targetDateStr.substring(4, 6)) - 1;
 const tgtDay = parseInt(targetDateStr.substring(6, 8));
 const tgtDayOfWeek = new Date(tgtYear, tgtMonth, tgtDay).getDay();
 if (tgtDayOfWeek === 0 || tgtDayOfWeek === 6) {
  console.log('📅 目標日期為週末（非交易日），跳過爬取。');
  await browser.close();
  return;
 }

 // --- 準備資料 ---
 const outputFilePath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_sma.json`);
 let existingData = {};

 if (fs.existsSync(outputFilePath)) {
  try {
   existingData = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
   const existingCount = Object.keys(existingData).filter(key =>
    existingData[key] && Object.keys(existingData[key]).length > 1
   ).length;
   console.log(`📋 發現現有資料檔案，已有 ${existingCount} 個股票的資料\n`);
  } catch (e) {
   console.log(`⚠️ 讀取現有資料檔案失敗，將重新建立\n`);
  }
 }

 // 篩選待處理股票 (跳過已有 SMA 資料的)
 const stockNumbersToProcess = stockNumbers.filter(stock => {
  if (!existingData[stock]) return true;
  const keys = Object.keys(existingData[stock]);
  // 檢查是否有日期格式的 key (SMA 資料)
  const smaKeys = keys.filter(k => k !== 'StockName' && /^\d{4}\/\d{2}\/\d{2}$/.test(k));
  return smaKeys.length === 0;
 });

 const skippedCount = stockNumbers.length - stockNumbersToProcess.length;
 if (skippedCount > 0) console.log(`⏭️ 跳過 ${skippedCount} 個已有資料的股票\n`);

 console.log(`🚀 開始處理 ${stockNumbersToProcess.length} 個股票 (並發數: ${MAX_CONCURRENCY})...\n`);

 if (stockNumbersToProcess.length === 0) {
  console.log('✅ 所有股票都已有資料，無需處理！');
  if (Object.keys(existingData).length > 0) {
   fs.writeFileSync(outputFilePath, JSON.stringify(existingData, null, 2), 'utf8');
   console.log(`💾 已更新資料到: ${outputFilePath}`);
  }
  await browser.close();
  return;
 }

 // --- Worker Pool 實作 ---
 const result = { ...existingData };
 let successCount = 0;
 let failCount = 0;
 const failedStocks = [];
 const queue = [...stockNumbersToProcess];
 const total = stockNumbersToProcess.length;
 let processedCount = 0;

 // 處理單一股票的函數
 async function processStock(page, stockNumber) {
  processedCount++;
  const currentIdx = processedCount;
  const url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stockNumber}.djhtm`;

  try {
   await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
   await page.waitForTimeout(1000); // 等待圖表載入

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
   const data = await targetFrame.evaluate(() => {
    const sysJustWebGraphDIV = document.querySelector('#SysJustWebGraphDIV');
    if (!sysJustWebGraphDIV) return { error: '找不到 #SysJustWebGraphDIV' };

    let fgTxt = sysJustWebGraphDIV.querySelector('div.op.FgTxt') || sysJustWebGraphDIV.querySelector('div[class*="FgTxt"]');
    if (!fgTxt) return { error: '找不到 div.FgTxt' };

    let fg0 = fgTxt.querySelector('#fg0') || fgTxt.querySelector('div[id*="fg0"]');
    if (!fg0) {
     const allDivs = Array.from(fgTxt.querySelectorAll('div'));
     fg0 = allDivs.find(div => div.innerText && div.innerText.includes('SMA5'));
    }
    if (!fg0) return { error: '找不到 div#fg0 或包含 SMA5 的元素' };

    let targetDiv = fg0.querySelector('div.box > div');
    if (!targetDiv) {
     const allDivs = Array.from(fg0.querySelectorAll('div'));
     targetDiv = allDivs.find(div => div.innerText && div.innerText.includes('SMA5')) || fg0;
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
    const dateKey = dateElement ? dateElement.innerText.trim() : 'Unknown';
    const dataObj = {};

    if (spanTexts.length % 2 === 0 && spanTexts.length > 0) {
     for (let i = 0; i < spanTexts.length; i += 2) {
      dataObj[spanTexts[i]] = removeCommas(spanTexts[i + 1]);
     }
    } else if (spanTexts.length > 0) {
     const divText = targetDiv.innerText.trim();
     const pattern = /(SMA\d+)\s*([\d,]+\.?\d*)/g;
     let match;
     while ((match = pattern.exec(divText)) !== null) {
      dataObj[match[1]] = removeCommas(match[2]);
     }
    }

    return { success: true, date: dateKey, data: { [dateKey]: dataObj } };
   });

   if (data.error) {
    console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: ${data.error}`);
    failCount++;
    failedStocks.push({ stock: stockNumber, url: url, error: data.error });
   } else {
    console.log(`  ✅ [${currentIdx}/${total}] ${stockNumber}: SMA OK`);
    result[stockNumber] = {
     StockName: stockInfoMap.get(stockNumber) || '',
     ...data.data
    };
    successCount++;
   }

  } catch (error) {
   console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: 錯誤 - ${error.message}`);
   failCount++;
   failedStocks.push({ stock: stockNumber, url: url, error: error.message });
  }

  // 隨機延遲
  const delay = Math.floor(Math.random() * 301) + 300;
  await page.waitForTimeout(delay);
 }

 // Worker 函數
 const workers = [];
 for (let i = 0; i < MAX_CONCURRENCY; i++) {
  workers.push((async () => {
   const page = await browser.newPage();
   await page.waitForTimeout(i * 500);

   while (queue.length > 0) {
    const stockNumber = queue.shift();
    if (stockNumber) {
     await processStock(page, stockNumber);
    }
   }
   await page.close();
  })());
 }

 await Promise.all(workers);
 await browser.close();

 // 輸出統計資訊
 console.log('\n\n=== 處理完成 ===');
 console.log(`✅ 成功: ${successCount} 個`);
 console.log(`❌ 失敗: ${failCount} 個`);
 console.log(`⏭️ 跳過: ${skippedCount} 個（已有資料）`);
 console.log(`📊 總計: ${stockNumbers.length} 個股票\n`);

 if (failedStocks && failedStocks.length > 0) {
  console.log('=== 失敗清單 ===');
  failedStocks.forEach((item, index) => {
   console.log(`${index + 1}. ${item.stock} - ${item.error}`);
  });
  console.log('');

  const failedListFile = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_sma_failedList.json`);
  fs.writeFileSync(failedListFile, JSON.stringify(failedStocks, null, 2), 'utf8');
  console.log(`📋 失敗清單已儲存到: ${failedListFile}\n`);
 }

 if (successCount > 0) {
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`💾 結果已儲存到: ${outputFilePath}`);
 } else {
  console.log('\n⚠️ 沒有任何股票成功取得資料，跳過寫檔（可能為非交易日）');
 }

})();
