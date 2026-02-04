const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// --- 設定區 ---
const MAX_CONCURRENCY = 3; // 重爬時使用較低的並發數

(async () => {
 // 解析命令列參數
 const args = process.argv.slice(2);
 const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
 };

 let targetDateStr = getArg('--date');

 // 若未指定日期，預設使用今天 (台北時間)
 if (!targetDateStr) {
  const now = new Date();
  const taipeiDateString = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour12: false });
  const taipeiTime = new Date(taipeiDateString);
  const year = taipeiTime.getFullYear();
  const month = String(taipeiTime.getMonth() + 1).padStart(2, '0');
  const day = String(taipeiTime.getDate()).padStart(2, '0');
  targetDateStr = `${year}${month}${day}`;
  console.log(`📅 未指定日期，使用今天: ${targetDateStr}`);
 }

 console.log(`\n🔄 重爬失敗股票資料 - 日期: ${targetDateStr}\n`);

 // 檔案路徑
 const failedListPath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_stock_data_failedList.json`);
 const stockDataPath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_stock_data.json`);
 const twseIndustryCsvPath = path.join(__dirname, '../data_twse/twse_industry.csv');

 // 檢查失敗清單檔案是否存在
 if (!fs.existsSync(failedListPath)) {
  console.log(`✅ 找不到失敗清單檔案: ${failedListPath}`);
  console.log('   可能沒有失敗的股票，無需重爬。');
  return;
 }

 // 讀取失敗清單
 let failedList = [];
 try {
  failedList = JSON.parse(fs.readFileSync(failedListPath, 'utf8'));
 } catch (e) {
  console.error(`❌ 讀取失敗清單失敗: ${e.message}`);
  process.exit(1);
 }

 if (failedList.length === 0) {
  console.log('✅ 失敗清單為空，無需重爬。');
  return;
 }

 console.log(`📋 發現 ${failedList.length} 個失敗的股票需要重爬\n`);

 // 讀取股票名稱對照表
 const stockInfoMap = new Map();
 if (fs.existsSync(twseIndustryCsvPath)) {
  const csvContent = fs.readFileSync(twseIndustryCsvPath, 'utf8');
  const lines = csvContent.split('\n');
  for (let i = 1; i < lines.length; i++) {
   const line = lines[i].trim();
   if (!line) continue;
   const parts = line.split(',');
   if (parts.length >= 2) {
    const stockCode = parts[0].replace(/"/g, '').trim();
    const stockName = parts[1].replace(/"/g, '').trim();
    if (stockCode && /^\d+/.test(stockCode)) {
     stockInfoMap.set(stockCode, stockName);
    }
   }
  }
 }

 // 讀取現有股票資料
 let existingData = {};
 if (fs.existsSync(stockDataPath)) {
  try {
   existingData = JSON.parse(fs.readFileSync(stockDataPath, 'utf8'));
   console.log(`📁 讀取現有資料: ${stockDataPath}`);
  } catch (e) {
   console.log(`⚠️ 讀取現有資料失敗，將建立新檔案`);
  }
 }

 // 計算日期範圍 (用於機構投資人資料)
 const year = parseInt(targetDateStr.substring(0, 4));
 const month = parseInt(targetDateStr.substring(4, 6)) - 1;
 const day = parseInt(targetDateStr.substring(6, 8));
 const endDateObj = new Date(year, month, day);
 const startDateObj = new Date(year, month - 1, day);

 const toParamDate = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
 const startDateParam = toParamDate(startDateObj);
 const endDateParam = toParamDate(endDateObj);

 // 啟動瀏覽器
 const browser = await chromium.launch({ headless: true });

 const result = { ...existingData };
 let successCount = 0;
 let failCount = 0;
 const stillFailedList = [];
 const queue = [...failedList];
 const total = failedList.length;
 let processedCount = 0;

 // 處理單一股票的函數
 async function processStock(page, failedItem) {
  processedCount++;
  const currentIdx = processedCount;
  const stockNumber = failedItem.stock;
  const url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stockNumber}.djhtm`;

  try {
   await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
   await page.waitForTimeout(1500); // 稍微多等一下

   // 處理 iframe
   let targetFrame = page;
   try {
    const iframeElement = await page.$('#SysJustIFRAMEDIV iframe');
    if (iframeElement) {
     const frameContent = await iframeElement.contentFrame();
     if (frameContent) {
      targetFrame = frameContent;
      await targetFrame.waitForSelector('#SysJustWebGraphDIV', { timeout: 15000 });
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
    stillFailedList.push({ stock: stockNumber, url: url, error: data.error });
   } else {
    console.log(`  ✅ [${currentIdx}/${total}] ${stockNumber}: SMA OK`);
    result[stockNumber] = {
     StockName: stockInfoMap.get(stockNumber) || '',
     ...data.data
    };

    // --- 提取機構投資人資料 ---
    try {
     const institutionalUrl = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl.djhtm?a=${stockNumber}&c=${startDateParam}&d=${endDateParam}`;
     await page.goto(institutionalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

     const institutionalData = await page.evaluate((endDate) => {
      try {
       const [year, month, day] = endDate.split('-').map(Number);
       const rocYear = year - 1911;
       const endDateRoc = `${rocYear}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;

       const allT01Tables = document.querySelectorAll('table.t01');
       let targetTable = null;
       const allT0Cells = document.querySelectorAll('td.t0');
       for (const t0Cell of allT0Cells) {
        const t01 = t0Cell.querySelector('table.t01');
        if (t01 && t01.querySelectorAll('tbody tr').length > 5) { targetTable = t01; break; }
       }
       if (!targetTable && allT01Tables.length > 0) targetTable = allT01Tables[0];
       if (!targetTable) return { error: '找不到目標表格' };

       const rows = Array.from(targetTable.querySelectorAll('tbody tr'));
       let headerIndex = -1;
       for (let i = 0; i < rows.length; i++) {
        if (rows[i].innerText.includes('日期') && rows[i].innerText.includes('外資')) { headerIndex = i; break; }
       }
       if (headerIndex === -1) return { error: '找不到標題行' };

       const foreignInvestors = {};
       const investmentTrust = {};
       const dealers = {};
       const dailyTotal = {};

       const dataRows = rows.slice(headerIndex + 1, headerIndex + 1 + 30);
       for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const values = row.innerText.trim().split(/\s+/);
        if (values.length >= 5 && values[0].match(/^\d+\/\d+\/\d+$/)) {
         const parseNum = (t) => { const n = parseInt(t.replace(/,/g, ''), 10); return isNaN(n) ? 0 : n; };
         const dk = values[0];
         const foreignVal = parseNum(values[1]);
         const investmentTrustVal = parseNum(values[2]);
         const dealersVal = parseNum(values[3]);
         const dailyTotalVal = parseNum(values[4]);

         // 計算三大法人有幾個為 0
         let zeroCount = 0;
         for (const value of [foreignVal, investmentTrustVal, dealersVal]) {
          if (value === 0) zeroCount++;
         }

         // 檢查：如果 i === 0 且 dk !== endDateRoc，代表資料尚未更新，跳過此股票
         if (i === 0 && dk !== endDateRoc) {
          return { error: '目標日期外資資料有誤 (非預期日期)', skipReason: 'NOT_EXPECTED_DATE' };
         }

         // 檢查：如果是目標日期且三大法人其中兩個為 0，代表資料尚未更新，跳過此股票
         if (dk === endDateRoc && zeroCount >= 2) return { error: '目標日期外資資料尚未更新 (值為0)', skipReason: 'FOREIGN_ZERO' };

         foreignInvestors[dk] = foreignVal;
         investmentTrust[dk] = investmentTrustVal;
         dealers[dk] = dealersVal;
         dailyTotal[dk] = dailyTotalVal;
        }
       }
       return { success: true, ForeignInvestors: foreignInvestors, InvestmentTrust: investmentTrust, Dealers: dealers, DailyTotal: dailyTotal };
      } catch (e) { return { error: e.message }; }
     }, endDateParam);

     if (institutionalData.error) {
      console.log(`  ⚠️  ${stockNumber}: 機構資料失敗 - ${institutionalData.error}`);
     } else {
      result[stockNumber] = {
       ...result[stockNumber],
       ForeignInvestors: institutionalData.ForeignInvestors,
       InvestmentTrust: institutionalData.InvestmentTrust,
       Dealers: institutionalData.Dealers,
       DailyTotal: institutionalData.DailyTotal
      };
     }
    } catch (instError) {
     console.log(`  ⚠️  ${stockNumber}: 機構資料錯誤 - ${instError.message}`);
    }
    successCount++;
   }

  } catch (error) {
   console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: 錯誤 - ${error.message}`);
   failCount++;
   stillFailedList.push({ stock: stockNumber, url: url, error: error.message });
  }

  // 隨機延遲
  const delay = Math.floor(Math.random() * 501) + 500;
  await page.waitForTimeout(delay);
 }

 // Worker Pool 實作
 const workers = [];
 for (let i = 0; i < MAX_CONCURRENCY; i++) {
  workers.push((async () => {
   const page = await browser.newPage();
   await page.waitForTimeout(i * 600); // 錯開啟動

   while (queue.length > 0) {
    const failedItem = queue.shift();
    if (failedItem) {
     await processStock(page, failedItem);
    }
   }
   await page.close();
  })());
 }

 await Promise.all(workers);
 await browser.close();

 // 輸出統計資訊
 console.log('\n\n=== 重爬完成 ===');
 console.log(`✅ 成功: ${successCount} 個`);
 console.log(`❌ 仍失敗: ${failCount} 個`);
 console.log(`📊 總計: ${total} 個股票\n`);

 // 儲存更新後的資料
 fs.writeFileSync(stockDataPath, JSON.stringify(result, null, 2), 'utf8');
 console.log(`💾 已更新資料到: ${stockDataPath}`);

 // 更新失敗清單
 if (stillFailedList.length > 0) {
  fs.writeFileSync(failedListPath, JSON.stringify(stillFailedList, null, 2), 'utf8');
  console.log(`📋 仍有 ${stillFailedList.length} 個失敗，已更新失敗清單: ${failedListPath}`);
 } else {
  // 刪除失敗清單檔案
  fs.unlinkSync(failedListPath);
  console.log(`🗑️  所有股票都成功了，已刪除失敗清單: ${failedListPath}`);
 }

})();
