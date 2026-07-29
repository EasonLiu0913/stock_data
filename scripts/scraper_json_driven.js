const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const NAVIGATION_TIMEOUT_MS = 45000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000;
const NO_DATA_TEXT = '無此券商分點交易資料';
const CSV_HEADER = 'BrokerName,BrokerID,BranchName,BranchID,Type,StockName,Amount,BuyAmount,SellAmount';

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function atomicWrite(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(temporaryPath, content, 'utf8');
    fs.renameSync(temporaryPath, filePath);
}

function readJsonIfExists(filePath, fallback) {
    if (!fs.existsSync(filePath)) return fallback;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.warn(`Unable to read existing status file; starting with an empty retry queue: ${error.message}`);
        return fallback;
    }
}

function hasCsvDataRows(filePath) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
    const lines = fs.readFileSync(filePath, 'utf8')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter(line => line.trim() !== '');
    return lines.length > 1 && lines[0] === CSV_HEADER;
}

function retryKey(brokerId, branchId) {
    return `${brokerId}:${branchId}`;
}

function normalizePendingRetries(status) {
    const entries = Array.isArray(status?.pendingRetries)
        ? status.pendingRetries
        : Array.isArray(status?.failures)
            ? status.failures
            : [];
    const map = new Map();
    for (const item of entries) {
        if (!item?.brokerId || !item?.branchId) continue;
        map.set(retryKey(item.brokerId, item.branchId), { ...item });
    }
    return map;
}

function buildRetryItem(task, previous, reason, error, attemptsThisRun) {
    const now = new Date().toISOString();
    return {
        brokerId: task.brokerId,
        brokerName: task.brokerName,
        branchId: task.branchId,
        branchName: task.branchName,
        filename: task.filename,
        url: task.url,
        reason,
        error,
        attempts: Number(previous?.attempts || 0) + attemptsThisRun,
        firstSeenAt: previous?.firstSeenAt || now,
        lastAttemptAt: now
    };
}

async function createPage(context) {
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    return page;
}

async function run() {
    const branchesMap = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../config/broker_branches.json'), 'utf8')
    );
    const namesMap = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../config/broker_names.json'), 'utf8')
    );

    const args = process.argv.slice(2);
    const forceDownload = args.includes('--force');
    const argDate = args.find(arg => /^\d{8}$/.test(arg));
    if (!argDate) throw new Error('請指定日期，格式為 YYYYMMDD，例如 20260727');

    const targetY = argDate.slice(0, 4);
    const targetM = argDate.slice(4, 6);
    const targetD = argDate.slice(6, 8);
    const dateStr = argDate;
    const urlDate = `${targetY}-${parseInt(targetM, 10)}-${parseInt(targetD, 10)}`;
    const outputDir = path.join(__dirname, '../data_fubon_brokers_trade', dateStr);
    const statusPath = path.join(outputDir, '_crawl-status.json');
    fs.mkdirSync(outputDir, { recursive: true });

    const previousStatus = readJsonIfExists(statusPath, {});
    const pendingRetries = normalizePendingRetries(previousStatus);
    const startedAt = previousStatus.startedAt || new Date().toISOString();
    const baseUrl = 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm';
    const tasks = [];

    for (const [brokerId, branches] of Object.entries(branchesMap)) {
        const brokerName = namesMap[brokerId] || brokerId;
        for (const branchId of branches) {
            const branchName = namesMap[branchId] || branchId;
            const filename = `${brokerName}_${branchName}_${dateStr}.csv`;
            tasks.push({
                brokerId,
                brokerName,
                branchId,
                branchName,
                filename,
                filePath: path.join(outputDir, filename),
                url: `${baseUrl}?a=${brokerId}&b=${branchId}&c=B&e=${urlDate}&f=${urlDate}`
            });
        }
    }

    // Pending items are always retried first on later scheduled runs.
    tasks.sort((left, right) => {
        const leftPending = pendingRetries.has(retryKey(left.brokerId, left.branchId)) ? 0 : 1;
        const rightPending = pendingRetries.has(retryKey(right.brokerId, right.branchId)) ? 0 : 1;
        return leftPending - rightPending;
    });

    console.log(`Target date: ${targetY}-${targetM}-${targetD}`);
    console.log(`Force download: ${forceDownload}`);
    console.log(`Loaded pending retry queue: ${pendingRetries.size}`);
    console.log(`Navigation timeout: ${NAVIGATION_TIMEOUT_MS}ms; retries per run: ${MAX_RETRIES}`);

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    let page = await createPage(context);

    let visitedCount = 0;
    let skippedExistingCount = 0;
    let downloadedCount = 0;
    let retriedFromQueueCount = 0;

    function checkpoint() {
        const pendingList = [...pendingRetries.values()];
        const completedCount = tasks.filter(task => hasCsvDataRows(task.filePath)).length;
        atomicWrite(statusPath, `${JSON.stringify({
            schemaVersion: 2,
            date: dateStr,
            startedAt,
            updatedAt: new Date().toISOString(),
            complete: pendingList.length === 0 && completedCount === tasks.length,
            expectedCount: tasks.length,
            completedCount,
            visitedCount,
            skippedExistingCount,
            downloadedCount,
            retriedFromQueueCount,
            pendingRetryCount: pendingList.length,
            pendingRetries: pendingList,
            failedCount: pendingList.length,
            failures: pendingList
        }, null, 2)}\n`);
    }

    try {
        console.log(`Found ${tasks.length} broker branches to process.`);

        for (let index = 0; index < tasks.length; index += 1) {
            const task = tasks[index];
            const key = retryKey(task.brokerId, task.branchId);
            const previousPending = pendingRetries.get(key);
            const validExisting = hasCsvDataRows(task.filePath);
            visitedCount += 1;

            console.log(`[${index + 1}/${tasks.length}] ${task.brokerName}/${task.branchName}`);

            if (!forceDownload && validExisting && !previousPending) {
                skippedExistingCount += 1;
                console.log('    ✓ Existing CSV contains data rows, skipping.');
                checkpoint();
                continue;
            }

            if (previousPending) {
                retriedFromQueueCount += 1;
                console.log(`    ↻ Retrying queued item: ${previousPending.reason || previousPending.error}`);
            } else if (fs.existsSync(task.filePath) && !validExisting) {
                console.log('    ↻ Existing CSV is header-only or invalid; treating it as pending.');
            }

            let succeeded = false;
            let lastError = null;
            let lastReason = 'request_error';
            let attemptsThisRun = 0;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
                attemptsThisRun = attempt;
                try {
                    console.log(`    Attempt ${attempt}/${MAX_RETRIES}: ${task.url}`);
                    await page.goto(task.url, {
                        waitUntil: 'domcontentloaded',
                        timeout: NAVIGATION_TIMEOUT_MS
                    });

                    const result = await page.evaluate((noDataText) => {
                        const bodyText = document.body?.innerText || '';
                        const stockLinks = Array.from(document.querySelectorAll('a[href*="Link2Stk"]'));
                        const data = [];
                        if (stockLinks.length > 0) {
                            const tds = Array.from(document.querySelectorAll('td'));
                            const sellHeader = tds.find(td => td.innerText.trim() === '賣超');
                            stockLinks.forEach(link => {
                                const row = link.closest('tr');
                                if (!row) return;
                                let type = 'Buy';
                                if (sellHeader && (sellHeader.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                                    type = 'Sell';
                                }
                                const cells = Array.from(row.querySelectorAll('td'));
                                data.push({
                                    name: link.innerText.trim(),
                                    amount: cells.length >= 4 ? cells[3].innerText.trim().replace(/,/g, '') : '0',
                                    type,
                                    buyAmt: cells.length >= 4 ? cells[1].innerText.trim().replace(/,/g, '') : '0',
                                    sellAmt: cells.length >= 4 ? cells[2].innerText.trim().replace(/,/g, '') : '0'
                                });
                            });
                        }
                        return { data, explicitNoData: bodyText.includes(noDataText), bodyPreview: bodyText.slice(0, 500) };
                    }, NO_DATA_TEXT);

                    if (result.data.length === 0) {
                        const error = new Error(
                            result.explicitNoData
                                ? NO_DATA_TEXT
                                : `No stock rows and no explicit no-data message. Page preview: ${result.bodyPreview}`
                        );
                        error.reason = result.explicitNoData ? 'no_data_yet' : 'ambiguous_empty_page';
                        throw error;
                    }

                    const csvRows = result.data.map(item =>
                        `${task.brokerName},${task.brokerId},${task.branchName},${task.branchId},${item.type},${item.name},"${item.amount}","${item.buyAmt}","${item.sellAmt}"`
                    ).join('\n');
                    atomicWrite(task.filePath, `${CSV_HEADER}\n${csvRows}\n`);

                    if (!hasCsvDataRows(task.filePath)) {
                        throw new Error('CSV validation failed after writing data rows');
                    }

                    downloadedCount += 1;
                    succeeded = true;
                    pendingRetries.delete(key);
                    console.log(`    ✓ Saved ${task.filename}; rows=${result.data.length}; removed from retry queue.`);
                    break;
                } catch (error) {
                    lastError = error;
                    lastReason = error.reason || 'request_error';
                    console.error(`    ✗ Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
                    if (attempt < MAX_RETRIES) {
                        try { await page.close(); } catch { /* ignore */ }
                        page = await createPage(context);
                        const delay = RETRY_BASE_DELAY_MS * attempt;
                        console.log(`    Retrying after ${delay}ms with a fresh page...`);
                        await wait(delay);
                    }
                }
            }

            if (!succeeded) {
                // Do not preserve a misleading header-only CSV as a successful result.
                if (fs.existsSync(task.filePath) && !hasCsvDataRows(task.filePath)) {
                    fs.unlinkSync(task.filePath);
                }
                const retryItem = buildRetryItem(
                    task,
                    previousPending,
                    lastReason,
                    lastError?.message || 'Unknown error',
                    attemptsThisRun
                );
                pendingRetries.set(key, retryItem);
                console.error(`    ⚠ Added to pending retry queue after ${MAX_RETRIES} attempts.`);
            }

            checkpoint();
            if (index < tasks.length - 1) {
                await wait(Math.floor(Math.random() * 7001) + 1000);
            }
        }

        checkpoint();
        console.log(
            `Completed crawl: expected=${tasks.length}, downloaded=${downloadedCount}, ` +
            `skipped=${skippedExistingCount}, pendingRetries=${pendingRetries.size}`
        );
        if (pendingRetries.size > 0) process.exitCode = 2;
    } catch (error) {
        console.error('Fatal crawler error:', error);
        checkpoint();
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    run().catch(error => {
        console.error('Unable to start crawler:', error);
        process.exitCode = 1;
    });
}

module.exports = {
    CSV_HEADER,
    NO_DATA_TEXT,
    buildRetryItem,
    hasCsvDataRows,
    normalizePendingRetries,
    retryKey,
    run
};
