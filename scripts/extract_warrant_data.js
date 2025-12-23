const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        const url = 'https://www.twse.com.tw/zh/products/securities/warrant/rank/securities.html';
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle' });

        // Wait for the table to load
        // The user mentioned div#reports, but inspection showed .rwd-table. We'll try both.
        try {
            await page.waitForSelector('div#reports table, div.rwd-table table', { timeout: 10000 });
        } catch (e) {
            console.log('Timeout waiting for table selector, proceeding to inspect page...');
        }

        const result = await page.evaluate(() => {
            // 1. Find the Title (Filename)
            let title = '';

            // Strategy 1: Look for h2 (User request)
            const h2 = document.querySelector('h2');
            if (h2) {
                console.log('Found h2:', h2.innerText);
                title = h2.innerText.trim();
            }

            // Strategy 2: Look for specific class or structure if h2 fails
            if (!title) {
                // Based on common TWSE structure, title might be in .title or just a div
                const titleEl = document.querySelector('.title') || document.querySelector('.h1') || document.querySelector('h1');
                if (titleEl) {
                    console.log('Found title element:', titleEl.innerText);
                    title = titleEl.innerText.trim();
                }
            }

            // Strategy 3: Search for text content
            if (!title) {
                const bodyText = document.body.innerText;
                // Look for the pattern "XXX年...發行之標的證券排行"
                const match = bodyText.match(/(\d{3}年.+?發行之標的證券排行)/);
                if (match) {
                    console.log('Found title in text:', match[1]);
                    title = match[1];
                }
            }

            console.log('Final extracted title:', title);
            // 2. Find the Table Data
            // User said div#reports
            let table = document.querySelector('div#reports table');
            if (!table) {
                table = document.querySelector('div.rwd-table table');
            }

            if (!table) {
                // Try finding any table
                table = document.querySelector('table');
            }

            if (!table) return { error: 'Table not found', rawTitle: title };

            const rows = Array.from(table.querySelectorAll('tr'));
            const data = rows.map(row => {
                const cells = Array.from(row.querySelectorAll('th, td'));
                return cells.map(cell => {
                    let text = cell.innerText.trim();
                    // Handle commas in numbers
                    if (text.includes(',')) text = `"${text}"`;
                    return text;
                }).join(',');
            });

            return { rawTitle: title, csv: data.join('\n') };
        });

        if (result.error) {
            console.error(`Error: ${result.error}`);
        } else if (result.csv) {
            const dirPath = path.join(__dirname, '../data_twse');
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath);
            }

            let filename;
            if (result.rawTitle) {
                // Try to parse the specific format: "114年12月01日 ~ 114年12月05日 發行之標的證券排行"
                // We want: "20251205發行之標的證券排行"
                // Regex looks for the second date part (after ~)
                const match = result.rawTitle.match(/~\s*(\d{3})年(\d{2})月(\d{2})日\s*(.*)/);
                if (match) {
                    const yearROC = parseInt(match[1], 10);
                    const yearAD = yearROC + 1911;
                    const month = match[2];
                    const day = match[3];
                    const suffix = match[4];
                    filename = `${yearAD}${month}${day}${suffix}.csv`;
                } else {
                    // Fallback
                    filename = result.rawTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') + '.csv';
                }
            } else {
                filename = `twse_warrant_${new Date().toISOString().slice(0, 10)}.csv`;
            }

            const filePath = path.join(dirPath, filename);

            fs.writeFileSync(filePath, result.csv, 'utf8');
            console.log(`✅ Successfully saved data to ${filePath}`);
        } else {
            console.log('❌ No data extracted.');
        }

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await browser.close();
    }
})();
