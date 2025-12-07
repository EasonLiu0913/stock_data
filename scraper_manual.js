const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const url = 'https://www.wantgoo.com/stock/major-investors/net-buy-sell-rank?market=Listed&orderByDays=15';

    console.log(`Navigating to ${url}...`);
    const browser = await chromium.launch({
        headless: false,  // Run in headed mode so you can see what's happening
        slowMo: 1000      // Slow down actions to mimic human behavior
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Load cookies if they exist
    const cookiesPath = path.join(__dirname, 'cookies.json');
    if (fs.existsSync(cookiesPath)) {
        console.log('Loading cookies from cookies.json...');
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        await context.addCookies(cookies);
    } else {
        console.log('⚠️  No cookies.json found.');
    }

    const page = await context.newPage();

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        console.log('Page loaded. Please wait for the data to load in the browser...');
        console.log('Press Ctrl+C when you see the data is fully loaded.');

        // Wait for user to confirm data is loaded
        await page.waitForTimeout(60000); // Wait up to 60 seconds

        console.log('Extracting data from table#netBuyRank...');

        // Extract data from table#netBuyRank
        const result = await page.evaluate(() => {
            const table = document.querySelector('table#netBuyRank');
            const debug = {
                tableFound: !!table,
                totalTables: document.querySelectorAll('table').length,
                totalRows: 0,
                validRows: 0
            };

            if (!table) {
                return { data: [], debug };
            }

            const rows = Array.from(table.querySelectorAll('tbody tr'));
            debug.totalRows = rows.length;

            // Filter out empty rows
            const validRows = rows.filter(tr => {
                const cells = Array.from(tr.querySelectorAll('td'));
                const hasContent = cells.some(td => td.innerText.trim() !== '');
                return hasContent && cells.length > 0;
            });

            debug.validRows = validRows.length;

            // Extract top 10 rows
            const data = validRows.slice(0, 10).map(tr => {
                const cols = Array.from(tr.querySelectorAll('td'));
                return cols.map(td => td.innerText.trim());
            });

            return { data, debug };
        });

        console.log('Debug info:', result.debug);
        const data = result.data;

        if (data.length > 0) {
            console.log(`Extracted ${data.length} rows.`);

            // Define columns
            const headers = ['Rank', 'Stock', 'NetBuy_Today', 'NetBuy_15Days', 'Price', 'Change', 'Volume'];

            // Convert to CSV
            const csvContent = [
                headers.join(','),
                ...data.map(row => {
                    const cleanRow = row.slice(0, 7).map(cell => {
                        if (cell.includes(',')) return `"${cell}"`;
                        return cell;
                    });
                    return cleanRow.join(',');
                })
            ].join('\n');

            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const filename = `stock_data_${dateStr}.csv`;
            const filePath = path.join(__dirname, filename);

            fs.writeFileSync(filePath, csvContent, 'utf8');
            console.log(`✅ Successfully saved top 10 stocks to ${filename}`);
            console.log('\nPreview:');
            console.log(csvContent);
        } else {
            console.log('❌ No data extracted.');
            console.log('The AJAX endpoint is returning 400 errors.');
            console.log('This means the website is blocking automated data requests.');
        }

    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        console.log('\nClosing browser in 5 seconds...');
        await page.waitForTimeout(5000);
        await browser.close();
    }
})();
