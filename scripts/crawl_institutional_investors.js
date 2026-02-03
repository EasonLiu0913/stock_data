const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '../data_institutional');
const CSV_FILE = path.join(__dirname, '../data_twse/twse_industry.csv');

(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Argument Parsing
    const args = process.argv.slice(2);
    const getArg = (flag) => {
        const idx = args.indexOf(flag);
        return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
    };

    const argStart = getArg('--start');
    const argEnd = getArg('--end');

    // Positional arguments for sharding: node script.js [startIndex] [limit]
    // Filter out flags and their values to find positional args
    const positionalArgs = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            i++; // Skip next val
        } else {
            positionalArgs.push(args[i]);
        }
    }

    const startIndex = positionalArgs[0] ? parseInt(positionalArgs[0]) : 0;
    const limit = positionalArgs[1] ? parseInt(positionalArgs[1]) : Infinity;

    // Date Logic
    // Get Taipei Time
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

    // Default End Date: If < 14:00, use Yesterday, else Today
    const targetDateStr = taipeiHour < 14 ? yesterdayStr : todayStr;

    // Helper: Parse YYYYMMDD to Date
    const parseYYYYMMDD = (str) => {
        const y = parseInt(str.substring(0, 4));
        const m = parseInt(str.substring(4, 6)) - 1;
        const d = parseInt(str.substring(6, 8));
        return new Date(y, m, d);
    };


    const defaultEndDateObj = parseYYYYMMDD(targetDateStr);
    // Default start date requested by user: 2025-11-02
    // If we want a fixed default:
    const defaultStartDateObj = new Date(2025, 10, 2); // Month is 0-indexed (10 = November)

    // Helper: Format Date to URL Param (YYYY-M-D)
    const toParamDate = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const formatInputParam = (str) => {
        if (!str) return null;
        const p = str.split('-');
        return (p.length === 3) ? `${parseInt(p[0])}-${parseInt(p[1])}-${parseInt(p[2])}` : str;
    };

    const startDateParam = formatInputParam(argStart) || toParamDate(defaultStartDateObj);
    const endDateParam = formatInputParam(argEnd) || toParamDate(defaultEndDateObj);

    console.log(`📅 Date Range: ${startDateParam} ~ ${endDateParam}`);
    console.log(`🔢 Batch: Start Index ${startIndex}, Limit ${limit}`);

    // Read CSV
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`CSV file not found: ${CSV_FILE}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(CSV_FILE, 'utf8');
    const lines = fileContent.trim().split('\n');
    const stocks = [];

    // Skip header (index 1 to length)
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 1) {
            stocks.push({
                code: parts[0].trim(),
                name: parts[1] ? parts[1].trim() : ''
            });
        }
    }

    // Apply Sharding
    const stocksToProcess = stocks.slice(startIndex, startIndex + limit);
    console.log(`📊 Processing ${stocksToProcess.length} stocks (Total in CSV: ${stocks.length})`);

    const browser = await chromium.launch({ headless: true });

    // 今天日期 (用於判斷是否需要更新)
    const todayFormatted = `${taipeiTime.getFullYear()}/${String(taipeiTime.getMonth() + 1).padStart(2, '0')}/${String(taipeiTime.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < stocksToProcess.length; i++) {
        const stock = stocksToProcess[i];
        const currentProgress = startIndex + i + 1;
        const totalStocks = stocks.length;

        const outputFile = path.join(OUTPUT_DIR, `${stock.code}.json`);
        let existingData = {};
        let latestDateInFile = null;

        if (fs.existsSync(outputFile)) {
            try {
                existingData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
                // 找到檔案中最新的日期 (格式: YYYY/MM/DD)
                const dates = Object.keys(existingData).sort((a, b) => b.localeCompare(a));
                if (dates.length > 0) {
                    latestDateInFile = dates[0];
                }
            } catch (e) {
                console.error(`  Warning: Could not read existing file for ${stock.code}`);
            }
        }

        // 規則3: 如果檔案已有今天的資料，跳過
        if (latestDateInFile === todayFormatted) {
            console.log(`[${currentProgress}/${totalStocks}] [${stock.code}] Data up-to-date (${todayFormatted}). Skipping.`);
            continue;
        }

        // 決定日期範圍
        let effectiveStartDate, effectiveEndDate;

        if (argStart && argEnd) {
            // 如果有手動指定日期，使用手動指定的
            effectiveStartDate = startDateParam;
            effectiveEndDate = endDateParam;
            console.log(`\n[${currentProgress}/${totalStocks}] [${stock.code} ${stock.name}] Crawling (Manual: ${effectiveStartDate} ~ ${effectiveEndDate})...`);
        } else if (latestDateInFile) {
            // 規則2: 有檔案，從最新資料日期爬到今天
            // 將 YYYY/MM/DD 轉成 URL 參數格式 YYYY-M-D
            const [y, m, d] = latestDateInFile.split('/').map(Number);
            effectiveStartDate = `${y}-${m}-${d}`;
            effectiveEndDate = toParamDate(parseYYYYMMDD(targetDateStr));
            console.log(`\n[${currentProgress}/${totalStocks}] [${stock.code} ${stock.name}] Updating (${effectiveStartDate} ~ ${effectiveEndDate})...`);
        } else {
            // 規則1: 沒有檔案，從預設起始日到今天
            effectiveStartDate = toParamDate(defaultStartDateObj);
            effectiveEndDate = toParamDate(parseYYYYMMDD(targetDateStr));
            console.log(`\n[${currentProgress}/${totalStocks}] [${stock.code} ${stock.name}] New file (${effectiveStartDate} ~ ${effectiveEndDate})...`);
        }

        const page = await browser.newPage();

        try {
            const institutionalUrl = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl.djhtm?a=${stock.code}&c=${effectiveStartDate}&d=${effectiveEndDate}`;
            // console.log(`  URL: ${institutionalUrl}`);

            await page.goto(institutionalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Basic wait
            // await page.waitForTimeout(1000); 

            const newData = await page.evaluate(() => {
                try {
                    // Try to find the table
                    // Logic from test_extract_stock_data.js
                    const allT01Tables = document.querySelectorAll('table.t01');
                    let targetTable = null;

                    // Strategy 1: Find inside td.t0
                    const allT0Cells = document.querySelectorAll('td.t0');
                    for (const t0Cell of allT0Cells) {
                        const t01 = t0Cell.querySelector('table.t01');
                        if (t01) {
                            const rows = t01.querySelectorAll('tbody tr');
                            if (rows.length > 5) { // Arbitrary check for data table
                                targetTable = t01;
                                break;
                            }
                        }
                    }

                    // Strategy 2: First .t01 table if no better match
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

                    const result = {};
                    // Process rows after header
                    for (let i = headerIndex + 1; i < rows.length; i++) {
                        const row = rows[i];
                        const rowText = row.innerText.trim();
                        // Split by whitespace
                        const values = rowText.split(/\s+/);

                        // Expected: Date, Foreign, Trust, Dealers, Total, ...
                        if (values.length >= 5) {
                            const parseNumber = (text) => {
                                const cleaned = text.trim().replace(/,/g, '');
                                const num = parseInt(cleaned, 10);
                                return isNaN(num) ? 0 : num;
                            };

                            const dateKey = values[0]; // e.g., 114/01/22 or 2025/01/22 (Fubon usually uses YYY/MM/DD or YYYY/MM/DD)
                            // Fubon site often uses ROC year (e.g. 114/01/22) in some places, but let's check.
                            // Actually test_extract_stock_data.js regex was /^\d+\/\d+\/\d+$/

                            // Check if it looks like a date
                            if (dateKey.match(/^\d+\/\d+\/\d+$/)) {
                                // Convert ROC year to AD if needed? 
                                // Usually user wants uniform YYYY/MM/DD.
                                // If 114/01/22 -> 2025/01/22.
                                let [y, m, d] = dateKey.split('/').map(Number);
                                if (y < 1911) y += 1911;
                                const formattedDate = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;

                                result[formattedDate] = {
                                    ForeignInvestors: parseNumber(values[1]),
                                    InvestmentTrust: parseNumber(values[2]),
                                    Dealers: parseNumber(values[3]),
                                    DailyTotal: parseNumber(values[4])
                                };
                            }
                        }
                    }
                    return { success: true, data: result };

                } catch (e) {
                    return { error: e.message };
                }
            });

            if (newData.error) {
                console.error(`  ❌ Error extracting: ${newData.error}`);
            } else {
                const count = Object.keys(newData.data).length;
                console.log(`  ✅ Extracted ${count} days of data.`);

                // Merge Data
                // Format: { "YYYY/MM/DD": { ... } }
                // We want to merge deeply? No, per day is fine.
                const mergedData = { ...existingData };

                for (const [date, dailyData] of Object.entries(newData.data)) {
                    mergedData[date] = dailyData;
                }

                // Sort keys descending (latest date first)
                const sortedData = {};
                Object.keys(mergedData).sort((a, b) => {
                    return b.localeCompare(a);
                }).forEach(key => {
                    sortedData[key] = mergedData[key];
                });

                fs.writeFileSync(outputFile, JSON.stringify(sortedData, null, 2), 'utf8');
                // console.log(`  💾 Saved to ${outputFile}`);
            }

        } catch (error) {
            console.error(`  ❌ Error crawling: ${error.message}`);
        } finally {
            await page.close();
        }

        // Delay to be polite
        await new Promise(r => setTimeout(r, 1000));
    }

    await browser.close();
    console.log('\nDone.');
})();
