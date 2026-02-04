const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 重爬三大法人失敗的股票
 * 
 * 使用方式:
 *   node scripts/retry_institutional_failed.js
 *   node scripts/retry_institutional_failed.js --date 20260204
 * 
 * 讀取: data_fubon/fubon_YYYYMMDD_institutional_failedList.json
 * 更新: data_fubon/fubon_YYYYMMDD_institutional.json
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

 console.log(`\n🔄 三大法人失敗股票重爬`);
 console.log(`📅 目標日期: ${targetDateStr}\n`);

 // 檔案路徑
 const failedListPath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_institutional_failedList.json`);
 const institutionalDataPath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_institutional.json`);
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

 // 讀取現有資料
 let institutionalData = {};
 if (fs.existsSync(institutionalDataPath)) {
  try {
   institutionalData = JSON.parse(fs.readFileSync(institutionalDataPath, 'utf8'));
  } catch (e) {
   console.log(`⚠️ 無法讀取現有三大法人資料`);
  }
 }

 // 計算日期參數
 const year = parseInt(targetDateStr.substring(0, 4));
 const month = parseInt(targetDateStr.substring(4, 6)) - 1;
 const day = parseInt(targetDateStr.substring(6, 8));
 const endDateObj = new Date(year, month, day);
 const startDateObj = new Date(year, month - 1, day);

 const toParamDate = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
 const startDateParam = toParamDate(startDateObj);
 const endDateParam = toParamDate(endDateObj);

 console.log(`📆 爬取區間: ${startDateParam} ~ ${endDateParam}\n`);

 // 啟動瀏覽器
 const browser = await chromium.launch({ headless: true });

 let successCount = 0;
 let failCount = 0;
 const stillFailedList = [];
 const queue = [...failedList];
 const total = failedList.length;
 let processedCount = 0;

 // 處理單一股票
 async function processStock(page, failedItem) {
  processedCount++;
  const currentIdx = processedCount;
  const stockNumber = failedItem.stock;

  try {
   const url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl.djhtm?a=${stockNumber}&c=${startDateParam}&d=${endDateParam}`;
   await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

   const data = await page.evaluate((endDate) => {
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

       let zeroCount = 0;
       for (const value of [foreignVal, investmentTrustVal, dealersVal]) {
        if (value === 0) zeroCount++;
       }

       if (i === 0 && dk !== endDateRoc) {
        return { error: '目標日期資料有誤 (非預期日期)', skipReason: 'NOT_EXPECTED_DATE' };
       }

       if (dk === endDateRoc && zeroCount >= 2) {
        return { error: '目標日期資料尚未更新 (值為0)', skipReason: 'DATA_ZERO' };
       }

       foreignInvestors[dk] = foreignVal;
       investmentTrust[dk] = investmentTrustVal;
       dealers[dk] = dealersVal;
       dailyTotal[dk] = dailyTotalVal;
      }
     }
     return { success: true, ForeignInvestors: foreignInvestors, InvestmentTrust: investmentTrust, Dealers: dealers, DailyTotal: dailyTotal };
    } catch (e) { return { error: e.message }; }
   }, endDateParam);

   if (data.error) {
    console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: ${data.error}`);
    failCount++;
    stillFailedList.push({ stock: stockNumber, error: data.error });
   } else {
    console.log(`  ✅ [${currentIdx}/${total}] ${stockNumber}: OK`);
    institutionalData[stockNumber] = {
     StockName: stockInfoMap.get(stockNumber) || '',
     ForeignInvestors: data.ForeignInvestors,
     InvestmentTrust: data.InvestmentTrust,
     Dealers: data.Dealers,
     DailyTotal: data.DailyTotal
    };
    successCount++;
   }

  } catch (error) {
   console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: 錯誤 - ${error.message}`);
   failCount++;
   stillFailedList.push({ stock: stockNumber, error: error.message });
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

 // 儲存更新後的資料
 fs.writeFileSync(institutionalDataPath, JSON.stringify(institutionalData, null, 2), 'utf8');
 console.log(`💾 已更新: ${institutionalDataPath}`);

 // 更新失敗清單
 if (stillFailedList.length > 0) {
  fs.writeFileSync(failedListPath, JSON.stringify(stillFailedList, null, 2), 'utf8');
  console.log(`📋 仍有 ${stillFailedList.length} 個失敗，已更新失敗清單`);
 } else {
  fs.unlinkSync(failedListPath);
  console.log(`🗑️  所有股票都成功了，已刪除失敗清單`);
 }

})();
