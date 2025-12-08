const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const DELAY_MS = 10000; // 10 seconds delay as requested

(async () => {
    // Load JSON maps
    const branchesMap = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/broker_branches.json'), 'utf8'));
    const namesMap = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/broker_names.json'), 'utf8'));

    // Output setup
    // Configuration for optional date argument (YYYYMMDD) and --force flag
    const args = process.argv.slice(2);
    const forceDownload = args.includes('--force');
    const argDate = args.find(arg => /^\d{8}$/.test(arg)); // e.g., node scraper_json_driven.js 20251205 --force

    let targetY = null, targetM = null, targetD = null;
    if (argDate && /^\d{8}$/.test(argDate)) {
        targetY = argDate.slice(0, 4);
        targetM = argDate.slice(4, 6);
        targetD = argDate.slice(6, 8);
    }
    console.log(`Target date: ${targetY}-${targetM}-${targetD}`);
    console.log(`Force download: ${forceDownload}`);
    // Base output directory (date subfolder will be created later)
    const baseOutputDir = path.join(__dirname, '../data_fubon_brokers_trade');
    if (!fs.existsSync(baseOutputDir)) {
        fs.mkdirSync(baseOutputDir);
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        const baseUrl = 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm';

        // Initial navigation
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

        const brokerIds = Object.keys(branchesMap);
        console.log(`Found ${brokerIds.length} brokers to process.`);

        let totalProcessed = 0;

        for (let i = 0; i < brokerIds.length; i++) {
            const brokerId = brokerIds[i];
            const brokerName = namesMap[brokerId] || brokerId;
            const branches = branchesMap[brokerId];

            console.log(`[${i + 1}/${brokerIds.length}] Processing Broker: ${brokerName} (${brokerId}) - ${branches.length} branches`);

            for (let j = 0; j < branches.length; j++) {
                const branchId = branches[j];
                const branchName = namesMap[branchId] || branchId;
                totalProcessed++;

                console.log(`  -> [${j + 1}/${branches.length}] Branch: ${branchName} (${branchId})`);

                // Build URL with date parameters if provided
                let url = `${baseUrl}?a=${brokerId}&b=${branchId}`;
                let dateStr;
                let urlDate;
                if (targetY) {
                    // Convert to format YYYY-M-D (no leading zeros for month/day)
                    urlDate = `${targetY}-${parseInt(targetM)}-${parseInt(targetD)}`;
                    url += `&c=B&e=${urlDate}&f=${urlDate}`;
                    dateStr = `${targetY}${targetM}${targetD}`;
                } else {
                    // If no date specified, extract from page after loading
                    dateStr = 'UNKNOWN_DATE';
                    urlDate = 'default';
                }

                // Ensure per-date output folder exists
                const outputDir = path.join(baseOutputDir, dateStr);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir);
                }

                // Check if file already exists (resume from interruption)
                const filename = `${brokerName}_${branchName}_${dateStr}.csv`;
                const filePath = path.join(outputDir, filename);
                if (!forceDownload && fs.existsSync(filePath)) {
                    console.log(`    ✓ Already downloaded, skipping...`);
                    continue;
                }

                console.log(`    Using date: ${urlDate || 'default'}`);

                // Navigate to specific branch with date parameters
                await page.goto(url, { waitUntil: 'domcontentloaded' });


                // Extract Data
                try {
                    await page.waitForFunction(() => {
                        return document.body.innerText.includes('買超') || document.body.innerText.includes('賣超');
                    }, { timeout: 5000 });
                } catch (e) {
                    // console.log('  Warning: "買超"/"賣超" text not found after wait.');
                }

                const data = await page.evaluate(() => {
                    const results = [];
                    const stockLinks = Array.from(document.querySelectorAll('a[href*="Link2Stk"]'));

                    if (stockLinks.length === 0) return [];

                    const tds = Array.from(document.querySelectorAll('td'));
                    const buyHeader = tds.find(td => td.innerText.trim() === '買超');
                    const sellHeader = tds.find(td => td.innerText.trim() === '賣超');

                    stockLinks.forEach(link => {
                        const row = link.closest('tr');
                        if (!row) return;

                        let type = 'Buy';
                        if (sellHeader) {
                            if (sellHeader.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) {
                                type = 'Sell';
                            }
                        }

                        const name = link.innerText.trim();
                        const cells = Array.from(row.querySelectorAll('td'));

                        let buyAmt = '0';
                        let sellAmt = '0';
                        let netAmt = '0';

                        if (cells.length >= 4) {
                            buyAmt = cells[1].innerText.trim().replace(/,/g, '');
                            sellAmt = cells[2].innerText.trim().replace(/,/g, '');
                            netAmt = cells[3].innerText.trim().replace(/,/g, '');
                        }

                        results.push({ name, amount: netAmt, type, buyAmt, sellAmt });
                    });

                    return results;
                });

                console.log(`    Extracted ${data.length} rows. Date: ${dateStr}`);

                // Save to individual file
                const csvRows = data.map(d =>
                    `${brokerName},${brokerId},${branchName},${branchId},${d.type},${d.name},"${d.amount}","${d.buyAmt}","${d.sellAmt}"`
                ).join('\n');

                const header = 'BrokerName,BrokerID,BranchName,BranchID,Type,StockName,Amount,BuyAmount,SellAmount\n';

                fs.writeFileSync(filePath, header + csvRows, 'utf8');

                // Wait random time before next request (1-8 seconds)
                if (j < branches.length - 1 || i < brokerIds.length - 1) {
                    const delay = Math.floor(Math.random() * (8000 - 1000 + 1)) + 1000;
                    // console.log(`    Waiting ${delay}ms...`);
                    await page.waitForTimeout(delay);
                }
            }
        }


    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await browser.close();
    }
})();
