const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const DEBUG_LIMIT = false; // Set to true to scrape only first few brokers/branches for testing
const MAX_BROKERS = 2;    // Only scrape first N brokers if DEBUG_LIMIT is true
const MAX_BRANCHES = 2;   // Only scrape first N branches per broker if DEBUG_LIMIT is true
const DELAY_MS = 1000;    // Delay between requests to avoid rate limiting

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // Output setup
    const outputDir = path.join(__dirname, 'data_fubon_brokers');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    // Allow user to specify a target date via command line argument (format: YYYYMMDD)
    const argDate = process.argv[2]; // e.g., node scraper_broker_branch.js 20251205
    let targetY = null, targetM = null, targetD = null;
    if (argDate && /^\d{8}$/.test(argDate)) {
        targetY = argDate.slice(0, 4);
        targetM = argDate.slice(4, 6);
        targetD = argDate.slice(6, 8);
    }
    const dateStr = argDate && /^\d{8}$/.test(argDate) ? argDate : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const outputFile = path.join(outputDir, `broker_data_${dateStr}.csv`);
    // Helper to set date dropdowns if a target date is provided
    async function setDateDropdowns(page) {
        if (!targetY) return;
        await page.selectOption('select[name="Y1"]', targetY);
        await page.selectOption('select[name="M1"]', targetM);
        await page.selectOption('select[name="D1"]', targetD);
        // Some pages also have a second set of dropdowns (Y2, M2, D2) for range queries
        await page.selectOption('select[name="Y2"]', targetY);
        await page.selectOption('select[name="M2"]', targetM);
        await page.selectOption('select[name="D2"]', targetD);
    }

    // Initialize CSV with header if it doesn't exist
    if (!fs.existsSync(outputFile)) {
        fs.writeFileSync(outputFile, 'BrokerName,BrokerID,BranchName,BranchID,Type,StockName,Amount,BuyAmount,SellAmount\n', 'utf8');
    }

    try {
        const baseUrl = 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm';
        console.log(`Navigating to ${baseUrl}...`);
        await page.goto(`${baseUrl}?a=1480&b=1480`, { waitUntil: 'domcontentloaded' });

        // 1. Get All Brokers
        let brokers = await page.evaluate(() => {
            const sel = document.querySelector('select[name="sel_Broker"]');
            if (!sel) return [];
            return Array.from(sel.options).map(opt => ({
                name: opt.text,
                id: opt.value
            })).filter(b => b.id); // Filter out empty or invalid
        });

        console.log(`Found ${brokers.length} brokers.`);

        let brokerCount = 0;
        for (const broker of brokers) {
            if (DEBUG_LIMIT && brokerCount >= MAX_BROKERS) break;
            brokerCount++;

            console.log(`[${brokerCount}/${brokers.length}] Processing Broker: ${broker.name} (${broker.id})`);

            // Navigate to broker page to load its branches
            // Note: We need to go to ?a=BROKER_ID&b=BROKER_ID to ensure branches load for this broker
            // (Usually b=BROKER_ID works as a default if we don't know a branch yet, or we can just use the broker ID as branch ID initially)
            await page.goto(`${baseUrl}?a=${broker.id}&b=${broker.id}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(DELAY_MS);

            // 2. Get Branches for this Broker
            const branches = await page.evaluate(() => {
                const sel = document.querySelector('select[name="sel_BrokerBranch"]');
                if (!sel) return [];
                return Array.from(sel.options).map(opt => ({
                    name: opt.text,
                    id: opt.value
                })).filter(b => b.id);
            });

            console.log(`  Found ${branches.length} branches for ${broker.name}.`);

            let branchCount = 0;
            for (const branch of branches) {
                if (DEBUG_LIMIT && branchCount >= MAX_BRANCHES) break;
                branchCount++;

                console.log(`  -> [${branchCount}/${branches.length}] Scraping Branch: ${branch.name} (${branch.id})`);

                // Navigate to specific branch
                await page.goto(`${baseUrl}?a=${broker.id}&b=${branch.id}`, { waitUntil: 'domcontentloaded' });

                // Enable console logging from page
                page.on('console', msg => console.log('PAGE LOG:', msg.text()));

                // 3. Extract Data
                // Wait for "買超" or "賣超" text to appear
                try {
                    await page.waitForFunction(() => {
                        return document.body.innerText.includes('買超') || document.body.innerText.includes('賣超');
                    }, { timeout: 5000 });
                } catch (e) {
                    // console.log('  Warning: "買超"/"賣超" text not found after wait.');
                }

                const data = await page.evaluate(() => {
                    const results = [];

                    // Find all links with Link2Stk
                    const stockLinks = Array.from(document.querySelectorAll('a[href*="Link2Stk"]'));

                    if (stockLinks.length === 0) {
                        return [];
                    }

                    const tds = Array.from(document.querySelectorAll('td'));
                    const buyHeader = tds.find(td => td.innerText.trim() === '買超');
                    const sellHeader = tds.find(td => td.innerText.trim() === '賣超');


                    stockLinks.forEach(link => {
                        const row = link.closest('tr');
                        if (!row) return;

                        let type = 'Buy'; // Default
                        if (sellHeader) {
                            // If row follows sellHeader, it's Sell.
                            if (sellHeader.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) {
                                type = 'Sell';
                            }
                        }

                        const name = link.innerText.trim();

                        // Columns: [Stock], [Buy], [Sell], [Net]
                        const cells = Array.from(row.querySelectorAll('td'));
                        // Cell 0 is Stock (contains link)
                        // Cell 1 is Buy Amount
                        // Cell 2 is Sell Amount
                        // Cell 3 is Net Amount

                        let buyAmt = '0';
                        let sellAmt = '0';
                        let netAmt = '0';

                        if (cells.length >= 4) {
                            buyAmt = cells[1].innerText.trim().replace(/,/g, '');
                            sellAmt = cells[2].innerText.trim().replace(/,/g, '');
                            netAmt = cells[3].innerText.trim().replace(/,/g, '');
                        }

                        // User requested "Buy" and "Sell" data.
                        // We can save all of it, or just the relevant one.
                        // The CSV header is: BrokerName,BrokerID,BranchName,BranchID,Type,StockName,Amount
                        // "Amount" usually refers to the Net Amount for ranking.
                        // But having Buy/Sell breakdown is useful.
                        // Let's save Net Amount as "Amount", and maybe add Buy/Sell columns if needed?
                        // The current CSV schema is fixed. Let's stick to Net Amount for "Amount".

                        results.push({ name, amount: netAmt, type, buyAmt, sellAmt });
                    });

                    return results;
                });

                console.log(`  -> Extracted ${data.length} rows.`);

                // 4. Save Data
                const csvRows = data.map(d =>
                    `${broker.name},${broker.id},${branch.name},${branch.id},${d.type},${d.name},"${d.amount}"`
                ).join('\n');

                if (csvRows) {
                    fs.appendFileSync(outputFile, csvRows + '\n', 'utf8');
                }

                await page.waitForTimeout(DELAY_MS);
            }
        }

        console.log(`✅ Scraper finished. Data saved to ${outputFile}`);

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await browser.close();
    }
})();
