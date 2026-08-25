const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const {
 filterInstitutionalDataToUniverse,
 hasTargetDate,
 readEligibleStockUniverse,
 toRocDate,
} = require('./lib/institutional_data_common');
const { getTradingDayStatus } = require('./lib/twse_trading_day');

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
 const now = new Date();
 const taipeiDateString = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour12: false });
 const taipeiTime = new Date(taipeiDateString);
 const taipeiHour = taipeiTime.getHours();
 const formatDate = (date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
 const todayStr = formatDate(taipeiTime);
 const yesterdayTaipei = new Date(taipeiTime);
 yesterdayTaipei.setDate(yesterdayTaipei.getDate() - 1);
 const yesterdayStr = formatDate(yesterdayTaipei);
 const args = process.argv.slice(2);
 const getArg = (flag) => { const idx = args.indexOf(flag); return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null; };
 let targetDateStr = getArg('--date');
 const argStart = getArg('--start');
 const argEnd = getArg('--end');
 if (!targetDateStr) targetDateStr = taipeiHour < 14 ? yesterdayStr : todayStr;

 console.log(`\n🏦 三大法人買賣超資料爬取`);
 console.log(`📅 目標日期: ${targetDateStr}\n`);
 const tradingDay = getTradingDayStatus(targetDateStr);
 if (!tradingDay.isTradingDay) { console.log(`📅 目標日期為非交易日（${tradingDay.reason}），跳過爬取。`); return; }
 if (tradingDay.warning) console.warn(`⚠️ ${tradingDay.warning}`);

 const twseIndustryCsvPath = path.join(__dirname, '../data_twse/twse_industry.csv');
 const outputFilePath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_institutional.json`);
 let stockInfoMap;
 try {
  console.log(`📁 讀取股票清單: ${twseIndustryCsvPath}`);
  stockInfoMap = readEligibleStockUniverse(twseIndustryCsvPath);
 } catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
 }
 const stockNumbers = Array.from(stockInfoMap.keys()).sort();
 console.log(`📊 共 ${stockNumbers.length} 個法人 eligible 股票代碼（四位數上市股票）\n`);

 const year = parseInt(targetDateStr.substring(0, 4));
 const month = parseInt(targetDateStr.substring(4, 6)) - 1;
 const day = parseInt(targetDateStr.substring(6, 8));
 const defaultEndDateObj = new Date(year, month, day);
 const defaultStartDateObj = new Date(year, month - 1, day);
 const toParamDate = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
 const formatInputParam = (str) => { if (!str) return null; const p = str.split('-'); return p.length === 3 ? `${parseInt(p[0])}-${parseInt(p[1])}-${parseInt(p[2])}` : str; };
 const startDateParam = formatInputParam(argStart) || toParamDate(defaultStartDateObj);
 const endDateParam = formatInputParam(argEnd) || toParamDate(defaultEndDateObj);
 const targetRocDate = toRocDate(targetDateStr);
 console.log(`📆 爬取區間: ${startDateParam} ~ ${endDateParam}\n`);

 let existingData = {};
 if (fs.existsSync(outputFilePath)) {
  try {
   existingData = filterInstitutionalDataToUniverse(JSON.parse(fs.readFileSync(outputFilePath, 'utf8')), stockInfoMap);
   console.log(`📋 發現現有 eligible 有效資料，已有 ${Object.keys(existingData).length} 個股票\n`);
  } catch {
   console.log(`⚠️ 讀取現有資料失敗，將重新建立\n`);
  }
 }
 const stockNumbersToProcess = stockNumbers.filter(stock => !hasTargetDate(existingData[stock], targetRocDate));
 const skippedCount = stockNumbers.length - stockNumbersToProcess.length;
 if (skippedCount > 0) console.log(`⏭️  跳過 ${skippedCount} 個目標日期資料完整的股票\n`);
 if (stockNumbersToProcess.length === 0) { console.log('✅ 所有 eligible 股票的目標日期資料都完整，無需處理！'); return; }
 console.log(`🚀 開始處理 ${stockNumbersToProcess.length} 個股票 (並發數: ${MAX_CONCURRENCY})...\n`);

 const browser = await chromium.launch({ headless: true });
 const result = { ...existingData };
 let successCount = 0; let failCount = 0; const failedStocks = []; const queue = [...stockNumbersToProcess]; const total = stockNumbersToProcess.length; let processedCount = 0;
 async function processStock(page, stockNumber) {
  processedCount++; const currentIdx = processedCount;
  try {
   const institutionalUrl = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl.djhtm?a=${stockNumber}&c=${startDateParam}&d=${endDateParam}`;
   await page.goto(institutionalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
   const institutionalData = await page.evaluate((endDate) => {
    try {
     const [year, month, day] = endDate.split('-').map(Number); const rocYear = year - 1911; const endDateRoc = `${rocYear}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
     const allT01Tables = document.querySelectorAll('table.t01'); let targetTable = null; const allT0Cells = document.querySelectorAll('td.t0');
     for (const t0Cell of allT0Cells) { const t01 = t0Cell.querySelector('table.t01'); if (t01 && t01.querySelectorAll('tbody tr').length > 5) { targetTable = t01; break; } }
     if (!targetTable && allT01Tables.length > 0) targetTable = allT01Tables[0];
     if (!targetTable) return { error: '找不到目標表格', skipReason: 'PARSE_ERROR' };
     const rows = Array.from(targetTable.querySelectorAll('tbody tr')); let headerIndex = -1;
     for (let i = 0; i < rows.length; i++) { if (rows[i].innerText.includes('日期') && rows[i].innerText.includes('外資')) { headerIndex = i; break; } }
     if (headerIndex === -1) return { error: '找不到標題行', skipReason: 'PARSE_ERROR' };
     const foreignInvestors = {}; const investmentTrust = {}; const dealers = {}; const dailyTotal = {};
     const dataRows = rows.slice(headerIndex + 1, headerIndex + 1 + 30);
     for (let i = 0; i < dataRows.length; i++) {
      const values = dataRows[i].innerText.trim().split(/\s+/);
      if (values.length >= 5 && values[0].match(/^\d+\/\d+\/\d+$/)) {
       const parseNum = (t) => { const n = parseInt(t.replace(/,/g, ''), 10); return isNaN(n) ? 0 : n; };
       const dk = values[0];
       if (i === 0 && dk !== endDateRoc) return { error: '目標日期資料有誤 (非預期日期)', skipReason: 'NOT_EXPECTED_DATE' };
       if (dk === endDateRoc && (values[1] === '--' || values[2] === '--' || values[3] === '--' || values[4] === '--')) return { error: '目標日期資料尚未更新 (值為 "--")', skipReason: 'DATA_MISSING' };
       foreignInvestors[dk] = parseNum(values[1]); investmentTrust[dk] = parseNum(values[2]); dealers[dk] = parseNum(values[3]); dailyTotal[dk] = parseNum(values[4]);
      }
     }
     if (Object.keys(foreignInvestors).length === 0) return { error: '目標日期無法人資料', skipReason: 'EMPTY_DATA' };
     return { success: true, ForeignInvestors: foreignInvestors, InvestmentTrust: investmentTrust, Dealers: dealers, DailyTotal: dailyTotal };
    } catch (e) { return { error: e.message, skipReason: 'PARSE_ERROR' }; }
   }, endDateParam);
   if (institutionalData.error) {
    console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: ${institutionalData.error}`); failCount++;
    failedStocks.push({ stock: stockNumber, error: institutionalData.error, reason: institutionalData.skipReason || 'OTHER_ERROR' });
   } else {
    console.log(`  ✅ [${currentIdx}/${total}] ${stockNumber}: OK`);
    result[stockNumber] = { StockName: stockInfoMap.get(stockNumber) || '', ForeignInvestors: institutionalData.ForeignInvestors, InvestmentTrust: institutionalData.InvestmentTrust, Dealers: institutionalData.Dealers, DailyTotal: institutionalData.DailyTotal }; successCount++;
   }
  } catch (error) {
   console.log(`  ❌ [${currentIdx}/${total}] ${stockNumber}: 錯誤 - ${error.message}`); failCount++;
   failedStocks.push({ stock: stockNumber, error: error.message, reason: 'REQUEST_ERROR' });
  }
  const delay = Math.floor(Math.random() * 301) + 300; await page.waitForTimeout(delay);
 }
 const workers = [];
 for (let i = 0; i < MAX_CONCURRENCY; i++) workers.push((async () => { const page = await browser.newPage(); await page.waitForTimeout(i * 500); while (queue.length > 0) { const stockNumber = queue.shift(); if (stockNumber) await processStock(page, stockNumber); } await page.close(); })());
 await Promise.all(workers); await browser.close();
 console.log('\n\n=== 處理完成 ==='); console.log(`✅ 成功: ${successCount} 個`); console.log(`❌ 失敗: ${failCount} 個`); console.log(`⏭️  跳過: ${skippedCount} 個（目標日期資料完整）`); console.log(`📊 總計: ${stockNumbers.length} 個 eligible 股票\n`);
 if (successCount > 0) {
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2), 'utf8'); console.log(`💾 結果已儲存到: ${outputFilePath}`);
  if (failedStocks.length > 0) { const failedListFile = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_institutional_failedList.json`); fs.writeFileSync(failedListFile, JSON.stringify(failedStocks, null, 2), 'utf8'); console.log(`📋 失敗清單已儲存到: ${failedListFile}`); }
 } else {
  console.log('\n⚠️ 沒有任何股票成功取得資料，跳過寫檔（可能為資料尚未發布）');
  if (fs.existsSync(outputFilePath) && Object.keys(result).length === 0) { fs.unlinkSync(outputFilePath); console.log(`🗑️ 已刪除既有空資料檔: ${outputFilePath}`); }
 }
})();
