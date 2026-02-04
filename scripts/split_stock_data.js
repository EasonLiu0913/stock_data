const fs = require('fs');
const path = require('path');

/**
 * 拆解 stock_data.json 為獨立的 SMA 和三大法人資料檔案
 * 
 * 使用方式:
 *   node scripts/split_stock_data.js
 * 
 * 輸入: data_fubon/fubon_YYYYMMDD_stock_data.json
 * 輸出:
 *   - data_fubon/fubon_YYYYMMDD_sma.json (SMA 資料)
 *   - data_fubon/fubon_YYYYMMDD_institutional.json (三大法人資料)
 */

const dataFubonDir = path.join(__dirname, '../data_fubon');

// 找出所有 stock_data.json 檔案
const stockDataFiles = fs.readdirSync(dataFubonDir)
 .filter(file => file.match(/^fubon_\d{8}_stock_data\.json$/))
 .sort();

console.log(`\n📂 掃描 data_fubon 資料夾`);
console.log(`📄 發現 ${stockDataFiles.length} 個 stock_data.json 檔案\n`);

if (stockDataFiles.length === 0) {
 console.log('❌ 沒有找到任何 stock_data.json 檔案');
 process.exit(0);
}

let totalSmaFiles = 0;
let totalInstitutionalFiles = 0;
let skippedFiles = 0;

for (const filename of stockDataFiles) {
 // 提取日期
 const match = filename.match(/^fubon_(\d{8})_stock_data\.json$/);
 if (!match) continue;

 const dateStr = match[1];
 const stockDataPath = path.join(dataFubonDir, filename);
 const smaOutputPath = path.join(dataFubonDir, `fubon_${dateStr}_sma.json`);
 const institutionalOutputPath = path.join(dataFubonDir, `fubon_${dateStr}_institutional.json`);

 console.log(`\n📅 處理日期: ${dateStr}`);
 console.log(`   來源: ${filename}`);

 // 檢查是否已存在拆解後的檔案
 const smaExists = fs.existsSync(smaOutputPath);
 const institutionalExists = fs.existsSync(institutionalOutputPath);

 if (smaExists && institutionalExists) {
  console.log(`   ⏭️  已存在拆解檔案，跳過`);
  skippedFiles++;
  continue;
 }

 // 讀取原始資料
 let stockData;
 try {
  stockData = JSON.parse(fs.readFileSync(stockDataPath, 'utf8'));
 } catch (e) {
  console.log(`   ❌ 讀取失敗: ${e.message}`);
  continue;
 }

 const stockCodes = Object.keys(stockData);
 console.log(`   📊 共 ${stockCodes.length} 個股票`);

 // 拆解資料
 const smaData = {};
 const institutionalData = {};

 let smaCount = 0;
 let institutionalCount = 0;

 for (const stockCode of stockCodes) {
  const data = stockData[stockCode];
  if (!data) continue;

  const stockName = data.StockName || '';

  // --- 提取 SMA 資料 ---
  // SMA 資料的 key 通常是日期格式 (如 "2026/02/04") 且 value 是包含 SMA5, SMA10 等的物件
  const smaEntry = { StockName: stockName };
  let hasSma = false;

  for (const key of Object.keys(data)) {
   // 跳過已知的非 SMA 欄位
   if (['StockName', 'ForeignInvestors', 'InvestmentTrust', 'Dealers', 'DailyTotal'].includes(key)) {
    continue;
   }

   // 日期格式的 key (如 "2026/02/04") 通常包含 SMA 資料
   if (key.match(/^\d{4}\/\d{2}\/\d{2}$/) && typeof data[key] === 'object') {
    smaEntry[key] = data[key];
    hasSma = true;
   }
  }

  if (hasSma) {
   smaData[stockCode] = smaEntry;
   smaCount++;
  }

  // --- 提取三大法人資料 ---
  if (data.ForeignInvestors || data.InvestmentTrust || data.Dealers || data.DailyTotal) {
   institutionalData[stockCode] = {
    StockName: stockName,
    ForeignInvestors: data.ForeignInvestors || {},
    InvestmentTrust: data.InvestmentTrust || {},
    Dealers: data.Dealers || {},
    DailyTotal: data.DailyTotal || {}
   };
   institutionalCount++;
  }
 }

 // 儲存 SMA 資料
 if (!smaExists && smaCount > 0) {
  fs.writeFileSync(smaOutputPath, JSON.stringify(smaData, null, 2), 'utf8');
  console.log(`   ✅ SMA 資料: ${smaCount} 個股票 → fubon_${dateStr}_sma.json`);
  totalSmaFiles++;
 } else if (smaExists) {
  console.log(`   ⏭️  SMA 檔案已存在`);
 } else {
  console.log(`   ⚠️  沒有 SMA 資料`);
 }

 // 儲存三大法人資料
 if (!institutionalExists && institutionalCount > 0) {
  fs.writeFileSync(institutionalOutputPath, JSON.stringify(institutionalData, null, 2), 'utf8');
  console.log(`   ✅ 三大法人資料: ${institutionalCount} 個股票 → fubon_${dateStr}_institutional.json`);
  totalInstitutionalFiles++;
 } else if (institutionalExists) {
  console.log(`   ⏭️  三大法人檔案已存在`);
 } else {
  console.log(`   ⚠️  沒有三大法人資料`);
 }
}

// 輸出統計
console.log('\n\n=== 拆解完成 ===');
console.log(`📄 處理檔案: ${stockDataFiles.length} 個`);
console.log(`✅ 新增 SMA 檔案: ${totalSmaFiles} 個`);
console.log(`✅ 新增三大法人檔案: ${totalInstitutionalFiles} 個`);
console.log(`⏭️  跳過 (已存在): ${skippedFiles} 個`);
console.log('');
