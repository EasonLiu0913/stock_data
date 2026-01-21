const { chromium } = require('playwright');

(async () => {
    const stockNumber = '1101';  // 測試股票代號
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // 監聽 console 訊息
    page.on('console', msg => {
        console.log('瀏覽器 Console:', msg.text());
    });

    console.log(`🔍 測試股票: ${stockNumber}`);
    console.log(`📍 URL: https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl.djhtm?a=${stockNumber}&b=2\n`);

    try {
        const url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl.djhtm?a=${stockNumber}&b=2`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        const institutionalData = await page.evaluate(() => {
            try {
                // 找所有 table.t01
                const allT01Tables = document.querySelectorAll('table.t01');
                console.log(`找到 ${allT01Tables.length} 個 table.t01`);

                // 檢查每個 table.t01
                allT01Tables.forEach((table, idx) => {
                    const rows = table.querySelectorAll('tbody tr');
                    console.log(`table.t01[${idx}] 有 ${rows.length} 行`);
                    if (rows.length > 0) {
                        console.log(`  第一行: ${rows[0].innerText.substring(0, 50)}`);
                    }
                });

                // 嘗試找到包含資料的表格 - 改為找行數最多的那個
                let targetTable = null;
                let maxRows = 0;

                allT01Tables.forEach((table) => {
                    const rows = table.querySelectorAll('tbody tr');
                    if (rows.length > maxRows) {
                        maxRows = rows.length;
                        targetTable = table;
                    }
                });

                console.log(`選擇了有 ${maxRows} 行的表格`);

                if (!targetTable) {
                    return { error: '找不到目標表格' };
                }

                const tbody = targetTable.querySelector('tbody');
                if (!tbody) {
                    return { error: '找不到 tbody' };
                }

                const rows = Array.from(tbody.querySelectorAll('tr'));
                console.log(`表格共有 ${rows.length} 行`);

                // 顯示所有行來找標題
                for (let i = 0; i < Math.min(20, rows.length); i++) {
                    const rowText = rows[i].innerText.trim();
                    console.log(`第 ${i} 行: ${rowText}`);
                }

                // 找到標題行（包含「日期」和「外資」「投信」「自營商」的那一行）
                // 注意：不能只找「外資」「投信」「自營商」，因為第1行也包含這些詞（外資持股、投信持股等）
                let headerIndex = -1;
                for (let i = 0; i < rows.length; i++) {
                    const rowText = rows[i].innerText;
                    // 必須同時包含「日期」和「外資」，這樣才能確保是資料表的標題行
                    if (rowText.includes('日期') && rowText.includes('外資') && rowText.includes('投信') && rowText.includes('自營商')) {
                        headerIndex = i;
                        console.log(`找到標題行在第 ${i} 行: ${rowText}`);
                        break;
                    }
                }

                if (headerIndex === -1) {
                    return {
                        error: '找不到標題行',
                        totalRows: rows.length
                    };
                }

                // 初始化資料陣列
                const foreignInvestors = [];  // 外資
                const investmentTrust = [];   // 投信
                const dealers = [];           // 自營商
                const dailyTotal = [];        // 單日合計

                // 從標題行的下一行開始，取10行資料
                const parseNumber = (text) => {
                    const cleaned = text.trim().replace(/,/g, '');
                    const num = parseInt(cleaned, 10);
                    return isNaN(num) ? 0 : num;
                };

                for (let i = headerIndex + 1; i < Math.min(headerIndex + 11, rows.length); i++) {
                    const row = rows[i];
                    const rowText = row.innerText.trim();
                    console.log(`資料第 ${i - headerIndex} 天 (row ${i}): ${rowText}`);

                    // 使用更寬鬆的分割方式
                    const values = rowText.split(/\s+/).filter(v => v.length > 0);
                    console.log(`  分割後有 ${values.length} 個值:`, values.join(', '));

                    // 只要有至少 4 個值就嘗試提取
                    if (values.length >= 4) {
                        const foreign = values[1] ? parseNumber(values[1]) : 0;
                        const trust = values[2] ? parseNumber(values[2]) : 0;
                        const dealer = values[3] ? parseNumber(values[3]) : 0;
                        const total = values[4] ? parseNumber(values[4]) : 0;

                        foreignInvestors.push(foreign);
                        investmentTrust.push(trust);
                        dealers.push(dealer);
                        dailyTotal.push(total);

                        console.log(`  提取: 外資=${foreign}, 投信=${trust}, 自營商=${dealer}, 合計=${total}`);
                    } else {
                        console.log(`  ⚠️ 該行資料不足 (${values.length} 個值)，跳過`);
                    }
                }

                return {
                    success: true,
                    headerIndex: headerIndex,
                    totalRows: rows.length,
                    ForeignInvestors: foreignInvestors,
                    InvestmentTrust: investmentTrust,
                    Dealers: dealers,
                    DailyTotal: dailyTotal
                };
            } catch (e) {
                return { error: e.message, stack: e.stack };
            }
        });

        console.log('\n=== 提取結果 ===');
        if (institutionalData.error) {
            console.log('❌ 錯誤:', institutionalData.error);
            if (institutionalData.totalRows) {
                console.log('表格總行數:', institutionalData.totalRows);
            }
        } else {
            console.log('✅ 成功提取資料！\n');
            console.log(`標題行位置: 第 ${institutionalData.headerIndex} 行`);
            console.log(`表格總行數: ${institutionalData.totalRows}`);
            console.log(`提取了 ${institutionalData.ForeignInvestors.length} 天的資料\n`);

            console.log('外資 (ForeignInvestors):', institutionalData.ForeignInvestors);

            console.log('\n=== 驗證數字 ===');
            const expectedForeign = [-4056, -14856, 26089, -3642, 3452, -13508, -15257, 25106, -4113, -2845];
            const match = JSON.stringify(institutionalData.ForeignInvestors) === JSON.stringify(expectedForeign);
            console.log('外資數字是否符合預期:', match ? '✅ 是' : '❌ 否');
            if (!match) {
                console.log('預期:', expectedForeign);
                console.log('實際:', institutionalData.ForeignInvestors);
            }
        }

        // 等待 5 秒讓我們可以看到瀏覽器
        await page.waitForTimeout(5000);

    } catch (error) {
        console.error('❌ 錯誤:', error.message);
    } finally {
        await browser.close();
    }
})();
