const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const NAVIGATION_TIMEOUT_MS = 45000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000;

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function atomicWrite(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(temporaryPath, content, 'utf8');
    fs.renameSync(temporaryPath, filePath);
}

function writeStatus(outputDir, payload) {
    atomicWrite(
        path.join(outputDir, '_crawl-status.json'),
        `${JSON.stringify(payload, null, 2)}\n`
    );
}

async function createPage(context) {
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    return page;
}

(async () => {
    const branchesMap = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../config/broker_branches.json'), 'utf8')
    );
    const namesMap = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../config/broker_names.json'), 'utf8')
    );

    const args = process.argv.slice(2);
    const forceDownload = args.includes('--force');
    const argDate = args.find(arg => /^\d{8}$/.test(arg));
    if (!argDate) {
        throw new Error('請指定日期，格式為 YYYYMMDD，例如 20260727');
    }

    const targetY = argDate.slice(0, 4);
    const targetM = argDate.slice(4, 6);
    const targetD = argDate.slice(6, 8);
    const dateStr = argDate;
    const urlDate = `${targetY}-${parseInt(targetM, 10)}-${parseInt(targetD, 10)}`;
    const baseOutputDir = path.join(__dirname, '../data_fubon_brokers_trade');
    const outputDir = path.join(baseOutputDir, dateStr);
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`Target date: ${targetY}-${targetM}-${targetD}`);
    console.log(`Force download: ${forceDownload}`);
    console.log(`Navigation timeout: ${NAVIGATION_TIMEOUT_MS}ms; retries: ${MAX_RETRIES}`);

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    let page = await createPage(context);

    const brokerIds = Object.keys(branchesMap);
    const expectedCount = brokerIds.reduce(
        (sum, brokerId) => sum + branchesMap[brokerId].length,
        0
    );
    const startedAt = new Date().toISOString();
    const failures = [];
    let visitedCount = 0;
    let skippedExistingCount = 0;
    let downloadedCount = 0;

    function checkpoint() {
        writeStatus(outputDir, {
            schemaVersion: 1,
            date: dateStr,
            startedAt,
            updatedAt: new Date().toISOString(),
            complete: failures.length === 0 && visitedCount === expectedCount,
            expectedCount,
            visitedCount,
            skippedExistingCount,
            downloadedCount,
            failedCount: failures.length,
            failures
        });
    }

    try {
        const baseUrl = 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm';
        console.log(`Found ${brokerIds.length} brokers and ${expectedCount} branches to process.`);

        for (let i = 0; i < brokerIds.length; i++) {
            const brokerId = brokerIds[i];
            const brokerName = namesMap[brokerId] || brokerId;
            const branches = branchesMap[brokerId];

            console.log(
                `[${i + 1}/${brokerIds.length}] Processing Broker: ${brokerName} (${brokerId}) - ${branches.length} branches`
            );

            for (let j = 0; j < branches.length; j++) {
                const branchId = branches[j];
                const branchName = namesMap[branchId] || branchId;
                const filename = `${brokerName}_${branchName}_${dateStr}.csv`;
                const filePath = path.join(outputDir, filename);
                const url = `${baseUrl}?a=${brokerId}&b=${branchId}&c=B&e=${urlDate}&f=${urlDate}`;
                visitedCount += 1;

                console.log(
                    `  -> [${j + 1}/${branches.length}] Branch: ${branchName} (${branchId})`
                );

                if (!forceDownload && fs.existsSync(filePath)) {
                    skippedExistingCount += 1;
                    console.log('    ✓ Already downloaded, skipping...');
                    checkpoint();
                    continue;
                }

                let succeeded = false;
                let lastError = null;

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
                    try {
                        console.log(`    Attempt ${attempt}/${MAX_RETRIES}: ${url}`);
                        await page.goto(url, {
                            waitUntil: 'domcontentloaded',
                            timeout: NAVIGATION_TIMEOUT_MS
                        });

                        try {
                            await page.waitForFunction(() => {
                                return document.body.innerText.includes('買超') ||
                                    document.body.innerText.includes('賣超');
                            }, { timeout: 5000 });
                        } catch {
                            console.log('    Warning: buy/sell text was not found within 5 seconds.');
                        }

                        const data = await page.evaluate(() => {
                            const results = [];
                            const stockLinks = Array.from(
                                document.querySelectorAll('a[href*="Link2Stk"]')
                            );
                            if (stockLinks.length === 0) return [];

                            const tds = Array.from(document.querySelectorAll('td'));
                            const sellHeader = tds.find(td => td.innerText.trim() === '賣超');

                            stockLinks.forEach(link => {
                                const row = link.closest('tr');
                                if (!row) return;

                                let type = 'Buy';
                                if (
                                    sellHeader &&
                                    (sellHeader.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)
                                ) {
                                    type = 'Sell';
                                }

                                const cells = Array.from(row.querySelectorAll('td'));
                                const buyAmt = cells.length >= 4
                                    ? cells[1].innerText.trim().replace(/,/g, '')
                                    : '0';
                                const sellAmt = cells.length >= 4
                                    ? cells[2].innerText.trim().replace(/,/g, '')
                                    : '0';
                                const netAmt = cells.length >= 4
                                    ? cells[3].innerText.trim().replace(/,/g, '')
                                    : '0';

                                results.push({
                                    name: link.innerText.trim(),
                                    amount: netAmt,
                                    type,
                                    buyAmt,
                                    sellAmt
                                });
                            });

                            return results;
                        });

                        const csvRows = data.map(item =>
                            `${brokerName},${brokerId},${branchName},${branchId},${item.type},${item.name},"${item.amount}","${item.buyAmt}","${item.sellAmt}"`
                        ).join('\n');
                        const header = 'BrokerName,BrokerID,BranchName,BranchID,Type,StockName,Amount,BuyAmount,SellAmount\n';
                        atomicWrite(filePath, header + csvRows);

                        downloadedCount += 1;
                        succeeded = true;
                        console.log(`    ✓ Saved ${filename}; rows=${data.length}`);
                        break;
                    } catch (error) {
                        lastError = error;
                        console.error(
                            `    ✗ Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`
                        );

                        if (attempt < MAX_RETRIES) {
                            try {
                                await page.close();
                            } catch {
                                // Ignore close failures; a new page will be created below.
                            }
                            page = await createPage(context);
                            const delay = RETRY_BASE_DELAY_MS * attempt;
                            console.log(`    Retrying after ${delay}ms with a fresh page...`);
                            await wait(delay);
                        }
                    }
                }

                if (!succeeded) {
                    failures.push({
                        brokerId,
                        brokerName,
                        branchId,
                        branchName,
                        filename,
                        url,
                        error: lastError?.message || 'Unknown error'
                    });
                    console.error(
                        `    ⚠ Failed after ${MAX_RETRIES} attempts; continuing with the next branch.`
                    );
                }

                checkpoint();

                if (j < branches.length - 1 || i < brokerIds.length - 1) {
                    const delay = Math.floor(Math.random() * 7001) + 1000;
                    await wait(delay);
                }
            }
        }

        checkpoint();
        console.log(
            `Completed crawl: expected=${expectedCount}, visited=${visitedCount}, ` +
            `downloaded=${downloadedCount}, skipped=${skippedExistingCount}, failed=${failures.length}`
        );

        if (failures.length > 0) {
            process.exitCode = 2;
        }
    } catch (error) {
        failures.push({ fatal: true, error: error.stack || error.message });
        checkpoint();
        console.error('Fatal crawler error:', error);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error('Unable to start crawler:', error);
    process.exitCode = 1;
});
