const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    // 計算今天和前一天的日期（格式：YYYYMMDD）
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    };

    const todayStr = formatDate(today);
    const yesterdayStr = formatDate(yesterday);

    // 根據執行時間決定「交易日期」：
    // - 每天下午 14:00（含）之後，到隔天早上 08:59 之前，都算前一個交易日
    //   例如：1/19 14:00 ~ 1/20 08:59 → 使用 1/19 當作檔名日期
    // - 其他時間（09:00 ~ 13:59）可以視需要調整，目前邏輯也視為「昨天」
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // 簡化規則：如果現在時間 < 14:00，就用昨天；否則用今天
    const targetDateStr = currentHour < 14 ? yesterdayStr : todayStr;

    console.log(
        `📅 系統日期: 今天=${todayStr}, 昨天=${yesterdayStr}；目前時間=${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}，` +
        `本次擷取的「交易日期」將使用: ${targetDateStr}\n`
    );

    // 簡單的 CSV 解析函數
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    // 讀取 TWSE 產業分類 CSV 檔案
    const twseIndustryCsvPath = path.join(__dirname, '../data_twse/twse_industry.csv');
    const stockInfoMap = new Map(); // 儲存 { 股票代號: 股票名稱 }

    if (fs.existsSync(twseIndustryCsvPath)) {
        console.log(`📁 讀取股票清單: ${twseIndustryCsvPath}`);
        const csvContent = fs.readFileSync(twseIndustryCsvPath, 'utf8');
        const lines = csvContent.split('\n');

        // 第一行是標題 (Code,Name,Industry)，從第二行開始讀取
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = parseCSVLine(line);
            if (parts.length >= 2) {
                const stockCode = parts[0];
                const stockName = parts[1];

                // 只處理有效的股票代號
                if (stockCode && /^\d+/.test(stockCode)) {
                    stockInfoMap.set(stockCode, stockName);
                }
            }
        }
    } else {
        console.error(`❌ 找不到股票清單檔案: ${twseIndustryCsvPath}`);
        console.error('請先執行 scripts/extract_twse_industry.js 產生該檔案');
        process.exit(1);
    }

    // 轉換為陣列並排序
    let stockNumbers = Array.from(stockInfoMap.keys()).sort();
    console.log(`📊 從 CSV 中提取到 ${stockNumbers.length} 個股票代碼\n`);


    // 讀取現有的 JSON 檔案（如果存在），檢查哪些股票已經有資料
    // 檔名依「交易日期」決定（targetDateStr）
    const outputFilePath = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_stock_data.json`);
    let existingData = {};

    if (fs.existsSync(outputFilePath)) {
        try {
            const existingContent = fs.readFileSync(outputFilePath, 'utf8');
            existingData = JSON.parse(existingContent);
            const existingCount = Object.keys(existingData).filter(key =>
                existingData[key] && Object.keys(existingData[key]).length > 0
            ).length;
            console.log(`📋 發現現有資料檔案，已有 ${existingCount} 個股票的資料\n`);

            // 檢查並補充缺少的股票名稱
            let updatedCount = 0;
            for (const stockCode of Object.keys(existingData)) {
                if (existingData[stockCode] && !existingData[stockCode].StockName && stockInfoMap.has(stockCode)) {
                    existingData[stockCode] = {
                        StockName: stockInfoMap.get(stockCode),
                        ...existingData[stockCode]
                    };
                    updatedCount++;
                }
            }
            if (updatedCount > 0) {
                console.log(`✏️  補充了 ${updatedCount} 個股票的名稱\n`);
            }
        } catch (e) {
            console.log(`⚠️  讀取現有資料檔案失敗，將重新建立\n`);
        }
    }

    // 過濾掉已經有資料的股票
    const stockNumbersToProcess = stockNumbers.filter(stock => {
        const hasData = existingData[stock] && Object.keys(existingData[stock]).length > 0;
        return !hasData;
    });

    const skippedCount = stockNumbers.length - stockNumbersToProcess.length;
    if (skippedCount > 0) {
        console.log(`⏭️  跳過 ${skippedCount} 個已有資料的股票\n`);
    }

    console.log(`🚀 開始處理 ${stockNumbersToProcess.length} 個股票...\n`);

    // 如果沒有需要處理的股票，檢查是否有更新股票名稱，如果有則儲存
    if (stockNumbersToProcess.length === 0) {
        console.log('✅ 所有股票都已有資料，無需處理！');

        // 儲存更新後的資料（如果有補充股票名稱）
        if (Object.keys(existingData).length > 0) {
            fs.writeFileSync(outputFilePath, JSON.stringify(existingData, null, 2), 'utf8');
            console.log(`💾 已更新資料到: ${outputFilePath}`);
        }
        return;
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // 從現有資料開始
    const result = { ...existingData };

    // 統計變數（在 try 區塊外定義，以便在外部也能存取）
    let successCount = 0;
    let failCount = 0;
    const failedStocks = []; // 失敗清單

    try {
        const total = stockNumbersToProcess.length;
        let processed = 0;

        for (const stockNumber of stockNumbersToProcess) {
            processed++;
            const url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stockNumber}.djhtm`;
            console.log(`[${processed}/${total}] 正在處理: ${stockNumber} - ${url}...`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                // 等待頁面完全載入，特別是圖表部分
                await page.waitForTimeout(3000);

                // 檢查是否有 iframe，並嘗試切換到 iframe
                let targetFrame = page;
                try {
                    const iframeElement = await page.$('#SysJustIFRAMEDIV iframe');
                    if (iframeElement) {
                        const frameContent = await iframeElement.contentFrame();
                        if (frameContent) {
                            targetFrame = frameContent;
                            console.log(`  ℹ️ ${stockNumber}: 檢測到 iframe，切換到 iframe 內容`);
                            await targetFrame.waitForSelector('#SysJustWebGraphDIV', { timeout: 10000 });
                        }
                    } else {
                        // 沒有 iframe，直接等待主頁面的元素
                        await page.waitForSelector('#SysJustWebGraphDIV', { timeout: 10000 });
                    }
                } catch (e) {
                    // 如果 iframe 處理失敗，繼續使用主頁面
                    console.log(`  ⚠️ ${stockNumber}: iframe 處理失敗或元素未找到，嘗試主頁面`);
                    try {
                        await page.waitForSelector('#SysJustWebGraphDIV', { timeout: 5000 });
                    } catch (e2) {
                        console.log(`  ⚠️ ${stockNumber}: 主頁面也找不到元素`);
                    }
                }

                const data = await targetFrame.evaluate(() => {
                    // 方法1: 使用 ID 選擇器（最穩定）
                    const sysJustWebGraphDIV = document.querySelector('#SysJustWebGraphDIV');
                    if (!sysJustWebGraphDIV) {
                        return {
                            error: '找不到 #SysJustWebGraphDIV',
                            debug: '請檢查頁面是否完全載入'
                        };
                    }

                    // 找到 div.op.FgTxt 或 div[class*="FgTxt"]
                    let fgTxt = sysJustWebGraphDIV.querySelector('div.op.FgTxt');
                    if (!fgTxt) {
                        fgTxt = sysJustWebGraphDIV.querySelector('div[class*="FgTxt"]');
                    }
                    if (!fgTxt) {
                        return {
                            error: '找不到 div.FgTxt',
                            debug: {
                                sysJustWebGraphDIVExists: !!sysJustWebGraphDIV,
                                children: Array.from(sysJustWebGraphDIV.children).map(c => c.className || c.tagName)
                            }
                        };
                    }

                    // 找到 div#fg0
                    let fg0 = fgTxt.querySelector('#fg0');
                    if (!fg0) {
                        // 嘗試找第一個包含 "fg0" 的 div
                        fg0 = fgTxt.querySelector('div[id*="fg0"]');
                    }
                    if (!fg0) {
                        // 如果找不到 fg0，嘗試找第一個包含 SMA 的 div
                        const allDivs = Array.from(fgTxt.querySelectorAll('div'));
                        fg0 = allDivs.find(div => div.innerText && div.innerText.includes('SMA5'));
                        if (!fg0) {
                            return {
                                error: '找不到 div#fg0 或包含 SMA5 的元素',
                                debug: {
                                    fgTxtHTML: fgTxt.innerHTML.substring(0, 500)
                                }
                            };
                        }
                    }

                    // 找到 div.box > div 或直接找包含 SMA 的 div
                    let targetDiv = fg0.querySelector('div.box > div');
                    if (!targetDiv) {
                        // 嘗試找所有 div，找到包含 SMA5 的那個
                        const allDivs = Array.from(fg0.querySelectorAll('div'));
                        targetDiv = allDivs.find(div => div.innerText && div.innerText.includes('SMA5'));
                        if (!targetDiv) {
                            // 如果還是找不到，直接用 fg0
                            targetDiv = fg0;
                        }
                    }

                    // 提取所有 span 的文字
                    const spans = Array.from(targetDiv.querySelectorAll('span'));
                    let spanTexts = spans.map(span => span.innerText.trim()).filter(text => text);

                    // 如果沒有找到 span，嘗試從 div 的文字內容中解析
                    if (spanTexts.length === 0) {
                        const divText = targetDiv.innerText.trim();
                        // 解析格式：SMA5 1,461.00SMA20 1,377.50...
                        // 使用正則表達式提取
                        const pattern = /(SMA\d+)\s*([\d,]+\.?\d*)/g;
                        const matches = [];
                        let match;
                        while ((match = pattern.exec(divText)) !== null) {
                            matches.push(match[1], match[2]); // 鍵和值
                        }
                        spanTexts = matches;
                    }

                    // 移除千位符號的輔助函數
                    const removeCommas = (str) => {
                        if (typeof str !== 'string') return str;
                        return str.replace(/,/g, '');
                    };

                    // 組織成鍵值對格式
                    const dataObj = {};

                    // 如果資料是成對出現（標籤和值），則組織成物件
                    if (spanTexts.length % 2 === 0 && spanTexts.length > 0) {
                        for (let i = 0; i < spanTexts.length; i += 2) {
                            const key = spanTexts[i];
                            let value = spanTexts[i + 1];
                            if (key && value) {
                                // 移除千位符號
                                value = removeCommas(value);
                                dataObj[key] = value;
                            }
                        }
                    } else if (spanTexts.length > 0) {
                        // 如果不是成對，嘗試從文字中解析
                        const divText = targetDiv.innerText.trim();
                        const pattern = /(SMA\d+)\s*([\d,]+\.?\d*)/g;
                        let match;
                        while ((match = pattern.exec(divText)) !== null) {
                            const key = match[1];
                            let value = match[2];
                            // 移除千位符號
                            value = removeCommas(value);
                            dataObj[key] = value;
                        }

                        // 如果還是沒有資料，返回原始文字
                        if (Object.keys(dataObj).length === 0) {
                            dataObj._raw = spanTexts.map(removeCommas);
                            dataObj._rawText = divText;
                        }
                    }

                    return {
                        success: true,
                        spanCount: spans.length,
                        spanTexts: spanTexts,
                        data: dataObj
                    };
                });

                if (data.error) {
                    console.log(`  ❌ [${processed}/${total}] ${stockNumber}: ${data.error}`);
                    if (data.debug) {
                        console.log(`     除錯資訊:`, JSON.stringify(data.debug, null, 2));
                    }
                    result[stockNumber] = {};
                    failCount++;
                    failedStocks.push({
                        stock: stockNumber,
                        url: url,
                        error: data.error
                    });
                } else {
                    console.log(`  ✅ [${processed}/${total}] ${stockNumber}: 成功提取 SMA 資料`);
                    result[stockNumber] = {
                        StockName: stockInfoMap.get(stockNumber) || '',
                        ...data.data
                    };

                    // 第二步：爬取機構投資人資料
                    console.log(`  🔄 [${processed}/${total}] ${stockNumber}: 開始提取機構投資人資料...`);
                    const institutionalUrl = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl.djhtm?a=${stockNumber}&b=2`;

                    try {
                        await page.goto(institutionalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                        await page.waitForTimeout(3000);

                        const institutionalData = await page.evaluate(() => {
                            try {
                                // 找所有 table.t01
                                const allT01Tables = document.querySelectorAll('table.t01');

                                // 嘗試找到包含資料的表格
                                let targetTable = null;

                                // 先嘗試找 td.t0 下的 table.t01
                                const allT0Cells = document.querySelectorAll('td.t0');
                                for (const t0Cell of allT0Cells) {
                                    const t01 = t0Cell.querySelector('table.t01');
                                    if (t01) {
                                        const rows = t01.querySelectorAll('tbody tr');
                                        if (rows.length > 10) {
                                            targetTable = t01;
                                            break;
                                        }
                                    }
                                }

                                // 如果還沒找到，直接找第一個 table.t01
                                if (!targetTable && allT01Tables.length > 0) {
                                    targetTable = allT01Tables[0];
                                }

                                if (!targetTable) {
                                    return { error: '找不到目標表格' };
                                }

                                const tbody = targetTable.querySelector('tbody');
                                if (!tbody) {
                                    return { error: '找不到 tbody' };
                                }

                                const rows = Array.from(tbody.querySelectorAll('tr'));

                                // 找到標題行（包含「日期」和「外資」「投信」「自營商」的那一行）
                                // 注意：不能只找「外資」「投信」「自營商」，因為可能有其他行也包含這些詞（如：外資持股、投信持股等）
                                let headerIndex = -1;
                                for (let i = 0; i < rows.length; i++) {
                                    const rowText = rows[i].innerText;
                                    // 必須同時包含「日期」和「外資」，這樣才能確保是資料表的標題行
                                    if (rowText.includes('日期') && rowText.includes('外資') && rowText.includes('投信') && rowText.includes('自營商')) {
                                        headerIndex = i;
                                        break;
                                    }
                                }

                                if (headerIndex === -1) {
                                    return { error: '找不到標題行' };
                                }

                                // 初始化資料陣列
                                const foreignInvestors = [];  // 外資
                                const investmentTrust = [];   // 投信
                                const dealers = [];           // 自營商
                                const dailyTotal = [];        // 單日合計

                                // 從標題行的下一行開始，取10行資料
                                for (let i = headerIndex + 1; i < Math.min(headerIndex + 11, rows.length); i++) {
                                    const row = rows[i];
                                    const rowText = row.innerText.trim();
                                    const values = rowText.split(/\s+/);

                                    if (values.length >= 5) {
                                        // 提取數字，移除千位符號
                                        const parseNumber = (text) => {
                                            const cleaned = text.trim().replace(/,/g, '');
                                            const num = parseInt(cleaned, 10);
                                            return isNaN(num) ? 0 : num;
                                        };

                                        // values[0] 是日期
                                        foreignInvestors.push(parseNumber(values[1]));
                                        investmentTrust.push(parseNumber(values[2]));
                                        dealers.push(parseNumber(values[3]));
                                        dailyTotal.push(parseNumber(values[4]));
                                    }
                                }

                                return {
                                    success: true,
                                    ForeignInvestors: foreignInvestors,
                                    InvestmentTrust: investmentTrust,
                                    Dealers: dealers,
                                    DailyTotal: dailyTotal
                                };
                            } catch (e) {
                                return { error: e.message };
                            }
                        });

                        if (institutionalData.error) {
                            console.log(`  ⚠️  [${processed}/${total}] ${stockNumber}: 機構投資人資料提取失敗 - ${institutionalData.error}`);
                        } else {
                            console.log(`  ✅ [${processed}/${total}] ${stockNumber}: 成功提取機構投資人資料 (${institutionalData.ForeignInvestors.length} 天)`);
                            // 合併到現有資料
                            result[stockNumber] = {
                                ...result[stockNumber],
                                ForeignInvestors: institutionalData.ForeignInvestors,
                                InvestmentTrust: institutionalData.InvestmentTrust,
                                Dealers: institutionalData.Dealers,
                                DailyTotal: institutionalData.DailyTotal
                            };
                        }
                    } catch (error) {
                        console.log(`  ⚠️  [${processed}/${total}] ${stockNumber}: 機構投資人資料提取錯誤 - ${error.message}`);
                    }

                    successCount++;
                }

            } catch (error) {
                console.log(`  ❌ [${processed}/${total}] ${stockNumber}: 錯誤 - ${error.message}`);
                result[stockNumber] = {};
                failCount++;
                failedStocks.push({
                    stock: stockNumber,
                    url: url,
                    error: error.message
                });
            }

            // 等待 3 秒後再處理下一個股票（避免請求過快）
            if (processed < total) {
                console.log(`  ⏳ 等待 3 秒後繼續處理下一個股票...`);
                await page.waitForTimeout(3000);
            }
        }

    } catch (error) {
        console.error('整體錯誤:', error);
    } finally {
        await browser.close();
    }

    // 輸出統計資訊
    console.log('\n\n=== 處理完成 ===');
    console.log(`✅ 成功: ${successCount} 個`);
    console.log(`❌ 失敗: ${failCount} 個`);
    console.log(`⏭️  跳過: ${skippedCount} 個（已有資料）`);
    console.log(`📊 總計: ${stockNumbers.length} 個股票\n`);

    // 如果有失敗的股票，輸出失敗清單
    if (failedStocks && failedStocks.length > 0) {
        console.log('=== 失敗清單 ===');
        failedStocks.forEach((item, index) => {
            console.log(`${index + 1}. ${item.stock} - ${item.url}`);
            console.log(`   錯誤: ${item.error}`);
        });
        console.log('');

        // 儲存失敗清單到檔案（同樣使用交易日期作為檔名日期）
        const failedListFile = path.join(__dirname, `../data_fubon/fubon_${targetDateStr}_stock_data_failedList.json`);
        fs.writeFileSync(failedListFile, JSON.stringify(failedStocks, null, 2), 'utf8');
        console.log(`📋 失敗清單已儲存到: ${failedListFile}\n`);
    }

    // 儲存結果到檔案（使用日期作為檔名）
    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`💾 結果已儲存到: ${outputFilePath}`);

})();
