const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// --- 設定區 ---
const MAX_CONCURRENCY = 5; // 最大並發數

/**
 * 三大法人買賣超資料爬取腳本
 * 
 * 使用方式:
 *   node scripts/crawl_institutional_data.js --date 20260204
 *   node scripts/crawl_institutional_data.js --start 2026-1-1 --end 2026-2-4
 * 
 * 輸出檔案:
 *   data_fubon/fubon_YYYYMMDD_institutional.json
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

 // 解析命令列參數
 const args = process.argv.slice(2);
 const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
 };

 let targetDateStr = getArg('--date');
 const argStart = getArg('--start');
 const argEnd = getArg('--end');

 // 若未指定日期，根據時間判斷
 if (!targetDateStr) {
  targetDateStr = taipeiHour < 14 ? yesterdayStr : todayStr;
 }

 console.log(`\n🏦 三大法人買賣超資料爬取`);
 console.log(`📅 目標日期: ${targetDateStr}\n`);

 // 週末判斷：若目標日期為週六或週日，直接結束
 const targetYear = parseInt(targetDateStr.substring(0, 4));
 const targetMonth = parseInt(targetDateStr.substring(4, 6)) - 1;
 const targetDay = parseInt(targetDateStr.substring(6, 8));
 const targetDayOfWeek = new Date(targetYear, targetMonth, targetDay).getDay();
 if (targetDayOfWeek === 0 || targetDayOfWeek === 6) {
  console.log('📅 目標日期為週末（非交易日），跳過爬取。');
  return;
 }

 // 檔案路徑
 const twseIndustryCsvPath = path.join(__dirname, '../data_twse/twse_industry.csv');
 const outputFilePath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_institutional.json`);


 // 讀取股票清單
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
 console.log(`📊 共 ${stockNumbers.length} 個股票代碼\n`);

 // 計算日期範圍
 const year = parseInt(targetDateStr.substring(0, 4));
 const month = parseInt(targetDateStr.substring(4, 6)) - 1;
 const day = parseInt(targetDateStr.substring(6, 8));
 const defaultEndDateObj = new Date(year, month, day);
 const defaultStartDateObj = new Date(year, month - 1, day);

 const toParamDate = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
 const formatInputParam = (str) => {
  if (!str) return null;
  const p = str.split('-');
  return (p.length === 3) ? `${parseInt(p[0])}-${parseInt(p[1])}-${parseInt(p[2])}` : str;
 };
 const startDateParam = formatInputParam(argStart) || toParamDate(defaultStartDateObj);
 const endDateParam = formatInputParam(argEnd) || toParamDate(defaultEndDateObj);

 console.log(`📆 爬取區間: ${startDateParam} ~ ${endDateParam}\n`);

 // 讀取現有資料
 let existingData = {};
 if (fs.existsSync(outputFilePath)) {
  try {
   existingData = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
   existingData = Object.fromEntries(
    Object.entries(existingData).filter(([, data]) => hasInstitutionalRows(data))
   );
   const existingCount = Object.keys(existingData).length;
   console.log(`📋 發現現有有效資料，已有 ${existingCount} 個股票\n`);
  } catch (e) {
   console.log(`⚠️ 讀取現有資料失敗，將重新建立\n`);
  }
 }

 function hasInstitutionalRows(data) {
  if (!data || typeof data !== 'object') return false;
  return ['ForeignInvestors', 'InvestmentTrust', 'Dealers', 'DailyTotal']
   .some(key => data[key] && typeof data[key] === 'object' && Object.keys(data[key]).length > 0);
 }

 // 篩選待處理股票 (跳過已有完整資料的)
 const stockNumbersToProcess = stockNumbers.filter(stock => {
  if (!existingData[stock]) return true;
  const data = existingData[stock];
  // 檢查是否有 ForeignInvestors 資料
  return !data.ForeignInvestors || Object.keys(data.ForeignInvestors).length === 0;
 });

 const skippedCount = stockNumbers.length - stockNumbersToProcess.length;
 if (skippedCount > 0) console.log(`⏭️  跳過 ${skippedCount} 個已有資料的股票\n`);

 if (stockNumbersToProcess.length === 0) {
  console.log('✅ 所有股票都已有資料，無需處理！');
  return;
 }

 console.log(`🚀 開始處理 ${stockNumbersToProcess.length} 個股票 (並發數: ${MAX_CONCURRENCY})...\n`);

 // 啟動瀏覽器
 const browser = await chromium.launch({ headless: true });

 const result = { ...existingData };
 let successCount = 0;
 let failCount = 0;
 const failedStocks = [];
 const queue = [...stockNumbersToProcess];
 const total = stockNumbersToProcess.length;
 let processedCount = 0;

 // 處理單一股票
 async function processStock(page, stockNumber) {
  processedCount++;
  const currentIdx = processedCount;

  try {
   const institutionalUrl = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl.djhtm?a=${stockNumber}&c=${startDateParam}&d=${endDateParam}`;
   await page.goto(institutionalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

   const institutionalData = await page.evaluate((endDate) => {
    try {
     // 將 endDateParam (YYYY-M-D) 轉換為民國年格式 (YYY/MM/DD)
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

       // 檢查：如果 i === 0 且 dk !== endDateRoc，代表資料尚未更新，跳過此股票
       if (i === 0 && dk !== endDateRoc) {
        return { error: '目標日期資料有誤 (非預期日期)', skipReason: 'NOT_EXPECTED_DATE' };
       }

       // 檢查：如果是目標日期且 values[1]~values[4] 有任意欄位為 '--'，代表資料尚未更新
       if (dk === endDateRoc && (values[1] === '--' || values[2] === '--' || values[3] === '--' || values[4] === '--')) {
        return { error: '目標日期資料尚未更新 (值為 "--")', skipReason: 'DATA_MISSING' };
       }

       foreignInvestors[dk] = foreignVal;
       investmentTrust[dk] = investmentTrustVal;
       dealers[dk] = dealersVal;
       dailyTotal[dk] = dailyTotalVal;
      }
     }
     if (Object.keys(foreignInvestors).length === 0) {
      return { error: '目標日期無法人資料', skipReason: 'EMPTY_DATA' };
     }
     return { success: true, ForeignInvestors: foreignInvestors, InvestmentTrust: investmentTrust, Dealers: dealers, DailyTotal: dailyTotal };
    } catch (e) { return { error: e.message }; }
   }, endDateParam);

   if (institutionalData.error) {
    console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: ${institutionalData.error}`);
    failCount++;
    failedStocks.push({ stock: stockNumber, error: institutionalData.error });
   } else {
    console.log(`  ✅ [${currentIdx}/${total}] ${stockNumber}: OK`);
    result[stockNumber] = {
     StockName: stockInfoMap.get(stockNumber) || '',
     ForeignInvestors: institutionalData.ForeignInvestors,
     InvestmentTrust: institutionalData.InvestmentTrust,
     Dealers: institutionalData.Dealers,
     DailyTotal: institutionalData.DailyTotal
    };
    successCount++;
   }
  } catch (error) {
   console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: 錯誤 - ${error.message}`);
   failCount++;
   failedStocks.push({ stock: stockNumber, error: error.message });
  }

  // 隨機延遲
  const delay = Math.floor(Math.random() * 301) + 300;
  await page.waitForTimeout(delay);
 }

 // Worker Pool
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

 // 輸出統計
 console.log('\n\n=== 處理完成 ===');
 console.log(`✅ 成功: ${successCount} 個`);
 console.log(`❌ 失敗: ${failCount} 個`);
 console.log(`⏭️  跳過: ${skippedCount} 個（已有資料）`);
 console.log(`📊 總計: ${stockNumbers.length} 個股票\n`);

 // 儲存結果（僅在有成功資料時才寫檔，避免非交易日產生空檔案）
 if (successCount > 0) {
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`💾 結果已儲存到: ${outputFilePath}`);

  // 儲存失敗清單
  if (failedStocks.length > 0) {
   const failedListFile = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_institutional_failedList.json`);
   fs.writeFileSync(failedListFile, JSON.stringify(failedStocks, null, 2), 'utf8');
   console.log(`📋 失敗清單已儲存到: ${failedListFile}`);
  }
 } else {
  console.log('\n⚠️ 沒有任何股票成功取得資料，跳過寫檔（可能為非交易日）');
  if (fs.existsSync(outputFilePath) && Object.keys(result).length === 0) {
   fs.unlinkSync(outputFilePath);
   console.log(`🗑️ 已刪除既有空資料檔: ${outputFilePath}`);
  }
 }

})();
