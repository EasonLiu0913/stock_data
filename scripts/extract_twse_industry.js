const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const NAVIGATION_COMMIT_TIMEOUT_MS = 30000;
const SELECTOR_TIMEOUT_MS = 90000;
const MAX_NAVIGATION_ATTEMPTS = 3;
const MIN_STOCK_RECORDS = 900;
const MIN_MAIN_RECORDS = 1000;
const MIN_TABLE_ROWS_FLOOR = 1000;
const TAIL_CATEGORY = '受益證券-不動產投資信託';
const TAIL_DIAGNOSTIC_POLL_MS = 1000;
const TAIL_DIAGNOSTIC_WINDOW_MS = 180000;
const TEST_TAIL_RECORDS_THRESHOLD = 6;
const MAX_DROP_RATIO = 0.10;
const REQUIRED_STOCK_CODES = ['1101', '2317', '2330', '2882'];

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function inspectTailState(page) {
    return page.evaluate(tailCategory => {
        const table = document.querySelector('table.h4');
        if (!table) {
            return {
                rows: 0,
                readyState: document.readyState,
                tailCategorySeen: false,
                tailRecords: 0,
                bodyLength: document.body ? document.body.innerText.length : 0
            };
        }

        const rows = Array.from(table.querySelectorAll('tr'));
        let tailCategorySeen = false;
        let tailRecords = 0;
        let inTailCategory = false;

        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length === 0) continue;

            const isCategoryRow = cells.length === 1 ||
                (cells[0].hasAttribute('colspan') && parseInt(cells[0].getAttribute('colspan'), 10) > 1);

            if (isCategoryRow) {
                const text = cells[0].innerText.trim();
                inTailCategory = text === tailCategory;
                if (inTailCategory) tailCategorySeen = true;
                continue;
            }

            if (inTailCategory && cells.length >= 5) {
                const codeNameRaw = cells[0].innerText.trim();
                if (codeNameRaw) tailRecords += 1;
            }
        }

        return {
            rows: rows.length,
            readyState: document.readyState,
            tailCategorySeen,
            tailRecords,
            bodyLength: document.body ? document.body.innerText.length : 0
        };
    }, TAIL_CATEGORY);
}

async function waitForTableReadiness(page, minimumRows) {
    await page.waitForFunction(
        requiredRows => document.querySelectorAll('table.h4 tr').length >= requiredRows,
        minimumRows,
        { timeout: SELECTOR_TIMEOUT_MS }
    );

    let state = await inspectTailState(page);
    console.log(
        `TWSE table reached readiness threshold: rows=${state.rows}, requiredRows=${minimumRows}, ` +
        `readyState=${state.readyState}, tailCategorySeen=${state.tailCategorySeen}, tailRecords=${state.tailRecords}`
    );

    console.log(
        `Starting TWSE tail-category experiment: category="${TAIL_CATEGORY}", ` +
        `testThreshold=${TEST_TAIL_RECORDS_THRESHOLD}, window=${TAIL_DIAGNOSTIC_WINDOW_MS}ms, ` +
        `poll=${TAIL_DIAGNOSTIC_POLL_MS}ms`
    );

    const deadline = Date.now() + TAIL_DIAGNOSTIC_WINDOW_MS;
    while (Date.now() < deadline) {
        console.log(
            `TWSE tail diagnostic: rows=${state.rows}, readyState=${state.readyState}, ` +
            `tailCategorySeen=${state.tailCategorySeen}, tailRecords=${state.tailRecords}, ` +
            `bodyLength=${state.bodyLength}`
        );

        if (state.tailCategorySeen && state.tailRecords >= TEST_TAIL_RECORDS_THRESHOLD) {
            console.log(
                `✅ TWSE experimental tail threshold observed: tailRecords=${state.tailRecords}, ` +
                `rows=${state.rows}, readyState=${state.readyState}`
            );
            return state;
        }

        await wait(TAIL_DIAGNOSTIC_POLL_MS);
        state = await inspectTailState(page);
    }

    throw new Error(
        `TWSE experimental tail threshold was not observed within ${TAIL_DIAGNOSTIC_WINDOW_MS}ms: ` +
        `category=${TAIL_CATEGORY}, tailRecords=${state.tailRecords}, rows=${state.rows}, ` +
        `readyState=${state.readyState}`
    );
}

async function gotoWithRetry(page, url, minimumRows) {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_NAVIGATION_ATTEMPTS; attempt++) {
        try {
            console.log(`Navigating to ${url} (attempt ${attempt}/${MAX_NAVIGATION_ATTEMPTS})...`);
            const response = await page.goto(url, {
                waitUntil: 'commit',
                timeout: NAVIGATION_COMMIT_TIMEOUT_MS
            });
            logNavigationResponse(response);

            await page.waitForSelector('table.h4', {
                state: 'attached',
                timeout: SELECTOR_TIMEOUT_MS
            });

            const readyState = await waitForTableReadiness(page, minimumRows);
            console.log(
                `Navigation table ready. currentUrl=${page.url()}, readyState=${readyState.readyState}, ` +
                `rows=${readyState.rows}, requiredRows=${minimumRows}, ` +
                `tailCategorySeen=${readyState.tailCategorySeen}, tailRecords=${readyState.tailRecords}`
            );
            return;
        } catch (error) {
            lastError = error;
            const rowCount = await page.locator('table.h4 tr').count().catch(() => 0);
            console.warn(`⚠️ Navigation attempt ${attempt} failed: ${error.message}`);
            console.warn(`   currentUrl=${page.url()}, rows=${rowCount}, requiredRows=${minimumRows}`);

            try {
                const debug = await inspectTailState(page);
                console.warn(`   pageState=${JSON.stringify(debug)}`);
            } catch (_) {
                // Best effort only.
            }

            if (attempt < MAX_NAVIGATION_ATTEMPTS) {
                try {
                    await page.evaluate(() => window.stop());
                } catch (_) {
                    // Best effort only.
                }
                await wait(attempt * 5000);
            }
        }
    }

    throw lastError;
}

function getHeaderValue(headers, name) {
    const key = Object.keys(headers).find(header => header.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : '';
}

function formatDebugHeaders(headers) {
    const selected = {
        location: getHeaderValue(headers, 'location'),
        contentType: getHeaderValue(headers, 'content-type'),
        xCache: getHeaderValue(headers, 'x-cache'),
        xRequestId: getHeaderValue(headers, 'x-request-id'),
        server: getHeaderValue(headers, 'server')
    };
    return Object.entries(selected)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
}

function logNavigationResponse(response) {
    if (!response) {
        console.warn('⚠️ Navigation did not return a response object');
        return;
    }

    const status = response.status();
    const headers = response.headers();
    const detail = formatDebugHeaders(headers);
    console.log(`Navigation response: status=${status}, url=${response.url()}${detail ? `, ${detail}` : ''}`);
}

function countCsvRecords(filePath) {
    if (!fs.existsSync(filePath)) return 0;
    const lines = fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .filter(line => line.trim().length > 0);
    return Math.max(0, lines.length - 1);
}

function validateSnapshot(data, allStocksForMainList, mainFile) {
    const stockRecords = data['股票'];
    if (!Array.isArray(stockRecords)) {
        throw new Error('TWSE industry snapshot rejected: missing 股票 category');
    }

    if (stockRecords.length < MIN_STOCK_RECORDS) {
        throw new Error(`TWSE industry snapshot rejected: 股票 records=${stockRecords.length}, minimum=${MIN_STOCK_RECORDS}`);
    }

    if (allStocksForMainList.length < MIN_MAIN_RECORDS) {
        throw new Error(`TWSE industry snapshot rejected: consolidated records=${allStocksForMainList.length}, minimum=${MIN_MAIN_RECORDS}`);
    }

    const stockCodes = new Set(stockRecords.map(record => String(record.code)));
    const missingCodes = REQUIRED_STOCK_CODES.filter(code => !stockCodes.has(code));
    if (missingCodes.length > 0) {
        throw new Error(`TWSE industry snapshot rejected: required stock codes missing: ${missingCodes.join(', ')}`);
    }

    const previousCount = countCsvRecords(mainFile);
    if (previousCount > 0) {
        const minimumAllowed = Math.floor(previousCount * (1 - MAX_DROP_RATIO));
        if (allStocksForMainList.length < minimumAllowed) {
            const dropRatio = ((previousCount - allStocksForMainList.length) / previousCount) * 100;
            throw new Error(
                `TWSE industry snapshot rejected: previous=${previousCount}, new=${allStocksForMainList.length}, ` +
                `drop=${dropRatio.toFixed(2)}% exceeds ${(MAX_DROP_RATIO * 100).toFixed(0)}% guardrail`
            );
        }
    }

    console.log(
        `✅ Snapshot validation passed: stocks=${stockRecords.length}, consolidated=${allStocksForMainList.length}, ` +
        `previous=${previousCount || 'none'}`
    );
}

function writeFileAtomic(filePath, content) {
    const tempFile = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tempFile, content, 'utf8');
    fs.renameSync(tempFile, filePath);
}

(async () => {
    const url = 'https://isin.twse.com.tw/isin/C_public.jsp?strMode=2';
    const outputDir = path.join(__dirname, '../data_twse');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const mainFile = path.join(outputDir, 'twse_industry.csv');
    const previousCount = countCsvRecords(mainFile);
    const minimumRowsBeforeExtract = Math.max(
        MIN_TABLE_ROWS_FLOOR,
        previousCount > 0 ? Math.floor(previousCount * (1 - MAX_DROP_RATIO)) : 0
    );
    console.log(
        `TWSE readiness threshold: previous consolidated=${previousCount || 'none'}, ` +
        `minimum table rows=${minimumRowsBeforeExtract}`
    );

    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        locale: 'zh-TW',
        timezoneId: 'Asia/Taipei',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
            'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
        }
    });
    const page = await context.newPage();
    page.on('response', response => {
        const status = response.status();
        if (status >= 300 && status < 400) {
            console.warn(`↪️ Redirect response: status=${status}, url=${response.url()}, ${formatDebugHeaders(response.headers()) || 'headers=(none)'}`);
        } else if (status >= 400) {
            console.warn(`⚠️ HTTP response: status=${status}, url=${response.url()}, ${formatDebugHeaders(response.headers()) || 'headers=(none)'}`);
        }
    });

    try {
        await gotoWithRetry(page, url, minimumRowsBeforeExtract);

        console.log('Extracting data...');
        const data = await page.evaluate(() => {
            const table = document.querySelector('table.h4');
            if (!table) return {};

            const rows = Array.from(table.querySelectorAll('tr'));
            const result = {};
            let currentCategory = null;

            for (const row of rows) {
                const cells = row.querySelectorAll('td');

                if (cells.length === 1 || (cells.length > 0 && cells[0].hasAttribute('colspan') && parseInt(cells[0].getAttribute('colspan')) > 1)) {
                    const text = cells[0].innerText.trim();
                    if (text && text !== '有價證券代號及名稱' && !text.includes('最近更新日期') && !text.includes('掛牌日以正式公告為準')) {
                        currentCategory = text;
                        if (!result[currentCategory]) {
                            result[currentCategory] = [];
                        }
                    }
                    continue;
                }

                if (currentCategory && cells.length >= 5) {
                    const codeNameRaw = cells[0].innerText.trim();
                    let code = '';
                    let name = '';
                    const parts = codeNameRaw.split(/\s+/);

                    if (parts.length >= 2) {
                        code = parts[0];
                        name = parts.slice(1).join(' ');
                    } else if (codeNameRaw.length > 4) {
                        const splitFull = codeNameRaw.split('\u3000');
                        if (splitFull.length >= 2) {
                            code = splitFull[0];
                            name = splitFull.slice(1).join(' ');
                        } else {
                            code = codeNameRaw.substring(0, 4);
                            name = codeNameRaw.substring(5).trim();
                        }
                    }

                    const industry = cells[4].innerText.trim();
                    if (code && name) {
                        result[currentCategory].push({ code, name, industry });
                    }
                }
            }
            return result;
        });

        if (!data || Object.keys(data).length === 0) {
            throw new Error('No TWSE industry data extracted');
        }

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
        const pendingFiles = [];

        for (const [category, records] of Object.entries(data)) {
            const mappedName = categoryMap[category] || category.replace(/\s+/g, '_');
            const filename = `twse_industry_${mappedName}.csv`;
            const filePath = path.join(outputDir, filename);
            const headers = ['Code', 'Name', 'Industry'];
            const csvRows = records.map(row => `${row.code},${row.name},${row.industry}`);
            const csvContent = [headers.join(','), ...csvRows].join('\n');

            pendingFiles.push({ filePath, filename, category, records, csvContent });

            if (category !== '上市認購(售)權證' && category !== 'ETN') {
                allStocksForMainList.push(...records);
            }
        }

        validateSnapshot(data, allStocksForMainList, mainFile);

        // No production file is touched until the entire snapshot passes validation.
        for (const pending of pendingFiles) {
            console.log(`Saving ${pending.records.length} records to ${pending.filename} (${pending.category})...`);
            writeFileAtomic(pending.filePath, pending.csvContent);
        }

        const mainHeaders = ['Code', 'Name', 'Industry'];
        const mainCsvRows = allStocksForMainList.map(row => `${row.code},${row.name},${row.industry}`);
        const mainCsvContent = [mainHeaders.join(','), ...mainCsvRows].join('\n');
        console.log(`Saving ${allStocksForMainList.length} total records to twse_industry.csv (Expected: Stocks, ETFs, etc.)...`);
        writeFileAtomic(mainFile, mainCsvContent);

        console.log('✅ Done.');
    } catch (error) {
        console.error('❌ Error during extraction:', error);
        process.exitCode = 1;
    } finally {
        await context.close();
        await browser.close();
    }
})();