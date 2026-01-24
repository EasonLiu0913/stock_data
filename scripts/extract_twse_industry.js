const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    // URL for "Stock" mode (strMode=2)
    const url = 'https://isin.twse.com.tw/isin/C_public.jsp?strMode=2';

    // Output directory
    const outputDir = path.join(__dirname, '../data_twse');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Launching browser...`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Wait for the table to appear
        await page.waitForSelector('table.h4');

        console.log('Extracting data...');
        const data = await page.evaluate(() => {
            const table = document.querySelector('table.h4');
            if (!table) return {};

            const rows = Array.from(table.querySelectorAll('tr'));
            const result = {};
            let currentCategory = null;

            for (const row of rows) {
                const cells = row.querySelectorAll('td');

                // Check for category headers (single cell spanning columns or just one cell)
                // The structure usually has a single cell row for headers
                if (cells.length === 1 || (cells.length > 0 && cells[0].hasAttribute('colspan') && parseInt(cells[0].getAttribute('colspan')) > 1)) {
                    const text = cells[0].innerText.trim();
                    // Filter out non-category headers
                    if (text && text !== '有價證券代號及名稱' && !text.includes('最近更新日期') && !text.includes('掛牌日以正式公告為準')) {
                        currentCategory = text;
                        if (!result[currentCategory]) {
                            result[currentCategory] = [];
                        }
                    }
                    continue;
                }

                // Extract data if we have a current category
                if (currentCategory && cells.length >= 5) {
                    // Column 0: Code and Name (e.g. "1101　台泥")
                    const codeNameRaw = cells[0].innerText.trim();

                    // Logic to split Code and Name
                    // Usually separated by space or full-width space
                    let code = '';
                    let name = '';

                    // Simple regex to split by whitespace
                    const parts = codeNameRaw.split(/\s+/);

                    if (parts.length >= 2) {
                        code = parts[0];
                        name = parts.slice(1).join(' ');
                    } else if (codeNameRaw.length > 4) {
                        // Fallback: Assume first 4 chars are code (risky for 6 digit codes but common for TWSE)
                        // Actually, some ETFs are 5 digits. Let's try to find the first space manually.
                        // Or just take the first part of split if length 1? No, then name is missing.

                        // Try full width space split specifically
                        const splitFull = codeNameRaw.split('\u3000');
                        if (splitFull.length >= 2) {
                            code = splitFull[0];
                            name = splitFull.slice(1).join(' ');
                        } else {
                            // Last resort fallback
                            code = codeNameRaw.substring(0, 4);
                            name = codeNameRaw.substring(5).trim();
                        }
                    }

                    // Column 4: Industry (e.g. "水泥工業")
                    const industry = cells[4].innerText.trim();

                    if (code && name) {
                        result[currentCategory].push({ code, name, industry });
                    }
                }
            }
            return result;
        });

        // Save CSVs
        const categoryMap = {
            '股票': 'Stock',
            '上市認購(售)權證': 'Warrants',
            'ETF': 'ETF',
            'ETN': 'ETN',
            '特別股': 'PreferredStock',
            '創新板': 'InnovationBoard',
            '臺灣存託憑證(TDR)': 'TDR',
            '受益證券-不動產投資信託': 'REITs'
        };

        const allStocksForMainList = [];

        for (const [category, records] of Object.entries(data)) {
            const mappedName = categoryMap[category] || category.replace(/\s+/g, '_');
            const filename = `twse_industry_${mappedName}.csv`;
            const filePath = path.join(outputDir, filename);

            console.log(`Saving ${records.length} records to ${filename} (${category})...`);

            const headers = ['Code', 'Name', 'Industry'];
            const csvRows = records.map(row => `${row.code},${row.name},${row.industry}`);
            const csvContent = [headers.join(','), ...csvRows].join('\n');

            fs.writeFileSync(filePath, csvContent, 'utf8');

            // Add to main consolidated list if it's a desired category
            // We want Stock, ETF, TDR, PreferredStock, InnovationBoard, REITs
            // Exclude Warrants (too many, short lived)
            if (category !== '上市認購(售)權證' && category !== 'ETN') {
                // ETN might be useful? User asked for 00919 (ETF).
                // Let's include everything except Warrants for now, or follow specific list.
                // Plan said: Stock, ETF, InnovationBoard, PreferredStock, TDR.
                // ETN is usually excluded from "Stock" analysis but maybe useful.
                // Let's include ETN as well? 
                // Decision: Include all except Warrants.
                allStocksForMainList.push(...records);
            }
        }

        // Save consolidated twse_industry.csv
        const mainFile = path.join(outputDir, 'twse_industry.csv');
        console.log(`Saving ${allStocksForMainList.length} total records to twse_industry.csv (Expected: Stocks, ETFs, etc.)...`);
        const mainHeaders = ['Code', 'Name', 'Industry'];
        const mainCsvRows = allStocksForMainList.map(row => `${row.code},${row.name},${row.industry}`);
        const mainCsvContent = [mainHeaders.join(','), ...mainCsvRows].join('\n');
        fs.writeFileSync(mainFile, mainCsvContent, 'utf8');

        console.log('✅ Done.');

    } catch (error) {
        console.error('❌ Error during extraction:', error);
    } finally {
        await browser.close();
    }
})();
