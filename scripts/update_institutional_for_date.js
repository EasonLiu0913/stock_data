const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 更新特定日期的三大法人資料
 * 用法: node update_institutional_for_date.js 20260203
 * 
 * 這個腳本會:
 * 1. 讀取指定日期的 stock_data.json
 * 2. 重新爬取該日期的三大法人資料
 * 3. 更新 stock_data.json 中對應日期的資料
 */

// Configuration
const MAX_CONCURRENCY = 5;
const OUTPUT_DIR = path.join(__dirname, '../data_fubon');
const CSV_FILE = path.join(__dirname, '../data_twse/twse_industry.csv');

(async () => {
 // 參數解析
 const args = process.argv.slice(2);
 const targetDate = args[0]; // e.g., 20260203

 if (!targetDate || !/^\d{8}$/.test(targetDate)) {
  console.error('❌ 請提供正確的日期格式 (YYYYMMDD)');
  console.log('用法: node update_institutional_for_date.js 20260203');
  process.exit(1);
 }

 // 解析日期
 const year = parseInt(targetDate.substring(0, 4));
 const month = parseInt(targetDate.substring(4, 6));
 const day = parseInt(targetDate.substring(6, 8));

 // 轉換為民國年 (ROC)
 const rocYear = year - 1911;
 const rocDateKey = `${rocYear}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;

 // 轉換為 URL 參數格式 (YYYY-M-D)
 const urlDateParam = `${year}-${month}-${day}`;

 console.log(`📅 目標日期: ${targetDate} (民國: ${rocDateKey})`);
 console.log(`🔗 URL 參數: ${urlDateParam}`);

 // 確認 stock_data.json 檔案存在
 const stockDataFile = path.join(OUTPUT_DIR, `fubon_${targetDate}_stock_data.json`);
 if (!fs.existsSync(stockDataFile)) {
  console.error(`❌ 找不到檔案: ${stockDataFile}`);
  process.exit(1);
 }

 // 讀取現有資料
 let stockData;
 try {
  stockData = JSON.parse(fs.readFileSync(stockDataFile, 'utf8'));
 } catch (e) {
  console.error(`❌ 無法讀取 JSON 檔案: ${e.message}`);
  process.exit(1);
 }

 const stockCodes = Object.keys(stockData);
 console.log(`📊 需更新 ${stockCodes.length} 支股票`);

 // 啟動瀏覽器
 const browser = await chromium.launch({ headless: true });

 console.log(`🚀 開始並行爬取 (${MAX_CONCURRENCY} workers)...`);

 // Worker Pool Implementation
 const queue = stockCodes.map((code, idx) => ({
  code,
  stockName: stockData[code]?.StockName || code,
  originalIndex: idx
 }));
 const totalStocks = stockCodes.length;
 let updatedCount = 0;
 let errorCount = 0;

 async function processStock(page, task) {
  const { code, stockName, originalIndex } = task;
  const currentProgress = originalIndex + 1;

  try {
   const institutionalUrl = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl.djhtm?a=${code}&c=${urlDateParam}&d=${urlDateParam}`;

   await page.goto(institutionalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

   const newData = await page.evaluate((targetRocDate) => {
    try {
     const allT01Tables = document.querySelectorAll('table.t01');
     let targetTable = null;

     const allT0Cells = document.querySelectorAll('td.t0');
     for (const t0Cell of allT0Cells) {
      const t01 = t0Cell.querySelector('table.t01');
      if (t01) {
       const rows = t01.querySelectorAll('tbody tr');
       if (rows.length > 5) {
        targetTable = t01;
        break;
       }
      }
     }

     if (!targetTable && allT01Tables.length > 0) {
      targetTable = allT01Tables[0];
     }

     if (!targetTable) return { error: 'Table not found' };

     const tbody = targetTable.querySelector('tbody');
     if (!tbody) return { error: 'Tbody not found' };

     const rows = Array.from(tbody.querySelectorAll('tr'));

     // Find header row
     let headerIndex = -1;
     for (let i = 0; i < rows.length; i++) {
      const rowText = rows[i].innerText;
      if (rowText.includes('日期') && rowText.includes('外資') && rowText.includes('投信')) {
       headerIndex = i;
       break;
      }
     }

     if (headerIndex === -1) return { error: 'Header row not found' };

     // Process rows after header to find the target date
     for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const rowText = row.innerText.trim();
      const values = rowText.split(/\s+/);

      if (values.length >= 5) {
       const parseNumber = (text) => {
        const cleaned = text.trim().replace(/,/g, '');
        const num = parseInt(cleaned, 10);
        return isNaN(num) ? 0 : num;
       };

       const dateKey = values[0];

       // Check if this matches target date
       if (dateKey.match(/^\d+\/\d+\/\d+$/)) {
        let [y, m, d] = dateKey.split('/').map(Number);
        const formattedDate = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;

        if (formattedDate === targetRocDate) {
         return {
          success: true,
          date: formattedDate,
          ForeignInvestors: parseNumber(values[1]),
          InvestmentTrust: parseNumber(values[2]),
          Dealers: parseNumber(values[3]),
          DailyTotal: parseNumber(values[4])
         };
        }
       }
      }
     }

     return { error: `Date ${targetRocDate} not found in table` };

    } catch (e) {
     return { error: e.message };
    }
   }, rocDateKey);

   if (newData.error) {
    console.log(`  ⚠️ [${code}] ${newData.error}`);
    errorCount++;
   } else {
    // 更新 stockData
    if (!stockData[code]) {
     stockData[code] = { StockName: stockName };
    }

    // 更新各項指標的特定日期
    const fields = ['ForeignInvestors', 'InvestmentTrust', 'Dealers', 'DailyTotal'];
    fields.forEach(field => {
     if (!stockData[code][field]) {
      stockData[code][field] = {};
     }
     stockData[code][field][rocDateKey] = newData[field];
    });

    updatedCount++;
    if (updatedCount % 50 === 0 || updatedCount === totalStocks) {
     console.log(`  ✅ 已更新 ${updatedCount}/${totalStocks} 支股票...`);
    }
   }

  } catch (error) {
   console.error(`  ❌ [${code}] Error: ${error.message}`);
   errorCount++;
  }
 }

 // Worker Function
 const workers = [];
 for (let i = 0; i < MAX_CONCURRENCY; i++) {
  workers.push((async () => {
   const context = await browser.newContext();
   const page = await context.newPage();

   // Stagger start
   await page.waitForTimeout(i * 300);

   while (queue.length > 0) {
    const task = queue.shift();
    if (task) {
     await processStock(page, task);

     // Random delay
     const delay = Math.floor(Math.random() * 300) + 200;
     await page.waitForTimeout(delay);
    }
   }
   await context.close();
  })());
 }

 await Promise.all(workers);
 await browser.close();

 // 儲存更新後的資料
 fs.writeFileSync(stockDataFile, JSON.stringify(stockData, null, 2), 'utf8');

 console.log(`\n✅ 完成！`);
 console.log(`   📝 更新: ${updatedCount} 支股票`);
 console.log(`   ⚠️ 錯誤: ${errorCount} 支股票`);
 console.log(`   💾 已儲存至: ${stockDataFile}`);
})();
