const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    // URL for "Stock" mode (strMode=2)
    const url = 'https://isin.twse.com.tw/isin/C_public.jsp?strMode=2';

    // Output directory and file
    const outputDir = path.join(__dirname, '../data_twse');
    const outputFile = path.join(outputDir, 'twse_industry.csv');

    // Create output directory if it doesn't exist
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
            if (!table) return [];

            const rows = Array.from(table.querySelectorAll('tr'));
            const results = [];
            let isStockSection = false;

            for (const row of rows) {
                const cells = row.querySelectorAll('td');

                // Check for category headers (single cell spanning columns)
                if (cells.length === 1) {
                    const text = cells[0].innerText.trim();
                    if (text === '股票') {
                        isStockSection = true;
                        continue;
                    }
                    // Close section if we hit the next category (e.g., '上市認購(售)權證')
                    // Actually, '股票' is the first main category we want. 
                    // Anything appearing after another header means we are done with '股票'.
                    if (isStockSection && text !== '股票') {
                        isStockSection = false;
                        // We can verify if we should break here, but setting flag to false is safer to skip others
                    }
                    continue;
                }

                // Extract data if we are in the Stock section
                if (isStockSection && cells.length >= 5) { // Ensure enough columns
                    // Column 0: Code and Name (e.g. "1101　台泥")
                    // Note: The space might be a full-width space \u3000
                    const codeNameRaw = cells[0].innerText.trim();
                    const parts = codeNameRaw.split(/\s+/); // Split by any whitespace

                    let code = '';
                    let name = '';

                    if (parts.length >= 2) {
                        code = parts[0];
                        name = parts.slice(1).join(' '); // Join rest in case of extra spaces
                    } else {
                        // If split didn't work as expected, might be special char
                        // Try exact full-width space split if regex \s+ failed or just handle normally
                        code = codeNameRaw.substring(0, 4); // simplistic fallback, usually 4 digits
                        name = codeNameRaw.substring(5).trim(); // simplistic

                        // Better approach if regex worked:
                        if (codeNameRaw.includes('\u3000')) {
                            const split = codeNameRaw.split('\u3000');
                            code = split[0];
                            name = split[1];
                        }
                    }

                    // Column 4: Industry (e.g. "水泥工業")
                    const industry = cells[4].innerText.trim();

                    if (code && name && industry) {
                        results.push({ code, name, industry });
                    }
                }
            }
            return results;
        });

        console.log(`Extracted ${data.length} records.`);

        if (data.length > 0) {
            // Convert to CSV
            const headers = ['Code', 'Name', 'Industry'];
            const csvRows = data.map(row => {
                return `${row.code},${row.name},${row.industry}`;
            });

            const csvContent = [headers.join(','), ...csvRows].join('\n');

            fs.writeFileSync(outputFile, csvContent, 'utf8');
            console.log(`✅ Successfully saved data to ${outputFile}`);
        } else {
            console.warn('⚠️ No data found. Please check selectors or page structure.');
        }

    } catch (error) {
        console.error('❌ Error during extraction:', error);
    } finally {
        await browser.close();
    }
})();
