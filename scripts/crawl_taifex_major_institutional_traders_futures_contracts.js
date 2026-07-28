const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE_URL = 'https://www.taifex.com.tw/cht/3/futContractsDate';
const TABLE_SELECTOR = 'table.table_f.table-sticky-3.w-1000';
const OUTPUT_DIR = path.join(__dirname, '../data_taifex_major_institutional_traders_futures_contracts');
const OUTPUT_SUFFIX = 'taifex_major_institutional_traders_futures_contracts';
const NON_TRADING_DAYS_FILE = path.join(__dirname, '../data_history_sma/non_trading_days.json');
const DEFAULT_DELAY_MS = 3000;
const args = process.argv.slice(2);

function getArg(flag) {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function normalizeDate(value) {
    if (!value) return '';
    const normalized = String(value).replace(/[^\d]/g, '');
    if (!/^\d{8}$/.test(normalized)) {
        throw new Error(`Invalid date: ${value}. Expected YYYYMMDD, YYYY-MM-DD, or YYYY/MM/DD.`);
    }
    return normalized;
}

function formatDate(dateCompact) {
    return `${dateCompact.slice(0, 4)}/${dateCompact.slice(4, 6)}/${dateCompact.slice(6, 8)}`;
}

function compactDateToUtc(dateCompact) {
    const year = Number(dateCompact.slice(0, 4));
    const month = Number(dateCompact.slice(4, 6));
    const day = Number(dateCompact.slice(6, 8));
    const value = new Date(Date.UTC(year, month - 1, day));

    if (
        value.getUTCFullYear() !== year
        || value.getUTCMonth() !== month - 1
        || value.getUTCDate() !== day
    ) {
        throw new Error(`Invalid calendar date: ${dateCompact}`);
    }

    return value;
}

function utcDateToCompact(value) {
    return value.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseDelayMs(value) {
    if (value == null || value === '') return DEFAULT_DELAY_MS;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 60000) {
        throw new Error(`Invalid --delay-ms value: ${value}. Expected an integer from 1000 to 60000.`);
    }
    return parsed;
}

function buildDateQueryPayload(dateCompact) {
    return {
        queryType: '1',
        goDay: '',
        doQuery: '1',
        dateaddcnt: '',
        queryDate: formatDate(dateCompact),
        commodityId: '',
        button: '送出查詢'
    };
}

function parseNumber(value) {
    const normalized = String(value ?? '')
        .replace(/,/g, '')
        .replace(/[−–—]/g, '-')
        .replace(/\s+/g, '')
        .trim();

    if (!normalized || normalized === '-') return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseSequence(value) {
    const parsed = parseNumber(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function loadNonTradingDays() {
    let payload;
    try {
        payload = JSON.parse(fs.readFileSync(NON_TRADING_DAYS_FILE, 'utf8'));
    } catch (error) {
        throw new Error(`Unable to read non-trading-day list ${NON_TRADING_DAYS_FILE}: ${error.message}`);
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`Invalid non-trading-day list: expected an object keyed by year in ${NON_TRADING_DAYS_FILE}.`);
    }

    const dates = new Set();
    for (const [year, entries] of Object.entries(payload)) {
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
            const normalized = normalizeDate(entry);
            compactDateToUtc(normalized);
            if (!normalized.startsWith(String(year))) {
                throw new Error(`Non-trading date ${entry} is stored under the wrong year key ${year}.`);
            }
            dates.add(normalized);
        }
    }

    return dates;
}

function isWeekend(dateCompact) {
    const day = compactDateToUtc(dateCompact).getUTCDay();
    return day === 0 || day === 6;
}

function buildTradingDateRange(startDate, endDate, nonTradingDays) {
    const start = compactDateToUtc(startDate);
    const end = compactDateToUtc(endDate);

    if (start > end) {
        throw new Error(`Start date ${startDate} must not be later than end date ${endDate}.`);
    }

    const tradingDates = [];
    const skippedDates = [];

    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const dateCompact = utcDateToCompact(cursor);
        if (isWeekend(dateCompact)) {
            skippedDates.push({ date: dateCompact, reason: 'weekend' });
            continue;
        }
        if (nonTradingDays.has(dateCompact)) {
            skippedDates.push({ date: dateCompact, reason: 'configured-non-trading-day' });
            continue;
        }
        tradingDates.push(dateCompact);
    }

    return { tradingDates, skippedDates };
}

function resolveRunPlan() {
    const date = normalizeDate(getArg('--date'));
    const startDate = normalizeDate(getArg('--start-date'));
    const endDate = normalizeDate(getArg('--end-date'));
    const delayMs = parseDelayMs(getArg('--delay-ms'));
    const hasRangeInput = Boolean(startDate || endDate);

    if (date && hasRangeInput) {
        throw new Error('Use either --date or --start-date/--end-date, not both.');
    }
    if (hasRangeInput && (!startDate || !endDate)) {
        throw new Error('Range mode requires both --start-date and --end-date.');
    }

    if (startDate && endDate) {
        const nonTradingDays = loadNonTradingDays();
        const { tradingDates, skippedDates } = buildTradingDateRange(startDate, endDate, nonTradingDays);
        if (tradingDates.length === 0) {
            throw new Error(`No trading dates remain between ${startDate} and ${endDate} after weekend and non-trading-day filtering.`);
        }
        return {
            mode: 'range',
            dates: tradingDates,
            skippedDates,
            delayMs,
            startDate,
            endDate
        };
    }

    return {
        mode: date ? 'single-date' : 'latest',
        dates: [date],
        skippedDates: [],
        delayMs,
        startDate: null,
        endDate: null
    };
}

function refreshFilesJson() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(file => new RegExp(`^\\d{8}_${OUTPUT_SUFFIX}\\.json$`).test(file))
        .sort();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), `${JSON.stringify(files, null, 2)}\n`, 'utf8');
}

function buildStructuredRows(tableRows) {
    const rows = [];

    for (const rawRow of tableRows) {
        const cells = rawRow.map(value => String(value ?? '').replace(/\s+/g, ' ').trim());
        if (cells.length < 15) continue;

        const investorType = cells[2];
        if (!['自營商', '投信', '外資', '外資及陸資'].includes(investorType)) continue;

        const sequence = parseSequence(cells[0]);
        const productName = sequence !== null
            ? cells[1]
            : (cells[1] && cells[1] !== cells[0] ? cells[1] : cells[0]);
        const numericValues = cells.slice(3, 15).map(parseNumber);

        if (numericValues.some(value => value === null)) {
            throw new Error(`Failed to parse numeric cells for ${productName} / ${investorType}: ${JSON.stringify(cells)}`);
        }

        const [
            tradingLongContracts,
            tradingLongAmount,
            tradingShortContracts,
            tradingShortAmount,
            tradingNetContracts,
            tradingNetAmount,
            openInterestLongContracts,
            openInterestLongAmount,
            openInterestShortContracts,
            openInterestShortAmount,
            openInterestNetContracts,
            openInterestNetAmount
        ] = numericValues;

        rows.push({
            rowType: sequence === null ? 'subtotal' : 'contract',
            sequence,
            productName,
            investorType,
            trading: {
                long: {
                    contracts: tradingLongContracts,
                    amountThousandTwd: tradingLongAmount
                },
                short: {
                    contracts: tradingShortContracts,
                    amountThousandTwd: tradingShortAmount
                },
                net: {
                    contracts: tradingNetContracts,
                    amountThousandTwd: tradingNetAmount
                }
            },
            openInterest: {
                long: {
                    contracts: openInterestLongContracts,
                    amountThousandTwd: openInterestLongAmount
                },
                short: {
                    contracts: openInterestShortContracts,
                    amountThousandTwd: openInterestShortAmount
                },
                net: {
                    contracts: openInterestNetContracts,
                    amountThousandTwd: openInterestNetAmount
                }
            },
            rawCells: cells.slice(0, 15)
        });
    }

    return rows;
}

function validateRows(rows) {
    if (rows.length < 9) {
        throw new Error(`Parsed only ${rows.length} data rows; expected a full institutional futures contract table.`);
    }

    const formulaErrors = [];
    for (const row of rows) {
        const tradingExpected = row.trading.long.contracts - row.trading.short.contracts;
        const openInterestExpected = row.openInterest.long.contracts - row.openInterest.short.contracts;

        if (tradingExpected !== row.trading.net.contracts) {
            formulaErrors.push(`${row.productName}/${row.investorType} trading net ${row.trading.net.contracts} != ${tradingExpected}`);
        }
        if (openInterestExpected !== row.openInterest.net.contracts) {
            formulaErrors.push(`${row.productName}/${row.investorType} open-interest net ${row.openInterest.net.contracts} != ${openInterestExpected}`);
        }
    }

    if (formulaErrors.length > 0) {
        throw new Error(`Table column validation failed:\n${formulaErrors.slice(0, 10).join('\n')}`);
    }

    const taiwanFuturesForeign = rows.find(row =>
        row.productName === '臺股期貨' && /^外資/.test(row.investorType)
    );

    if (!taiwanFuturesForeign) {
        throw new Error('Missing 臺股期貨 / 外資 row; the page structure may have changed.');
    }

    return {
        formulaErrorCount: 0,
        taiwanStockIndexFuturesForeignOpenInterest: {
            longContracts: taiwanFuturesForeign.openInterest.long.contracts,
            shortContracts: taiwanFuturesForeign.openInterest.short.contracts,
            netContracts: taiwanFuturesForeign.openInterest.net.contracts
        }
    };
}

function comparablePayload(payload) {
    const clone = JSON.parse(JSON.stringify(payload));
    delete clone.fetchedAt;
    return clone;
}

async function submitDateQuery(page, expectedDate) {
    const fields = buildDateQueryPayload(expectedDate);

    await Promise.all([
        page.waitForNavigation({
            waitUntil: 'domcontentloaded',
            timeout: 60000
        }),
        page.evaluate(({ action, fields }) => {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = action;
            form.acceptCharset = 'UTF-8';

            for (const [name, value] of Object.entries(fields)) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                input.value = value;
                form.appendChild(input);
            }

            document.body.appendChild(form);
            form.submit();
        }, {
            action: PAGE_URL,
            fields
        })
    ]);
}

async function loadPage(page, expectedDate) {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await page.goto(PAGE_URL, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            if (!response || !response.ok()) {
                throw new Error(`TAIFEX returned HTTP ${response ? response.status() : 'no response'} for initial GET`);
            }

            if (expectedDate) {
                await submitDateQuery(page, expectedDate);
                console.log(`Submitted TAIFEX POST query for ${formatDate(expectedDate)}`);
            }

            await page.waitForSelector(TABLE_SELECTOR, { timeout: 30000 });
            return;
        } catch (error) {
            lastError = error;
            if (attempt < 3) {
                console.warn(`TAIFEX page load attempt ${attempt} failed: ${error.message}`);
                await sleep(5000);
            }
        }
    }

    throw lastError;
}

async function extractTable(page) {
    const candidates = page.locator(TABLE_SELECTOR);
    const count = await candidates.count();
    let table = null;

    for (let index = 0; index < count; index++) {
        const candidate = candidates.nth(index);
        const text = await candidate.innerText();
        if (text.includes('商品') && text.includes('身份別') && text.includes('未平倉餘額')) {
            table = candidate;
            break;
        }
    }

    if (!table) {
        throw new Error(`Could not find the expected TAIFEX table using selector ${TABLE_SELECTOR}.`);
    }

    return table.evaluate(element => {
        function normalizedText(node) {
            return String(node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
        }

        function expandRows(rowElements) {
            const grid = [];

            rowElements.forEach((rowElement, rowIndex) => {
                if (!grid[rowIndex]) grid[rowIndex] = [];
                let columnIndex = 0;

                Array.from(rowElement.children)
                    .filter(cell => ['TD', 'TH'].includes(cell.tagName))
                    .forEach(cell => {
                        while (grid[rowIndex][columnIndex] !== undefined) columnIndex++;

                        const rowspan = Math.max(1, Number(cell.getAttribute('rowspan') || 1));
                        const colspan = Math.max(1, Number(cell.getAttribute('colspan') || 1));
                        const value = normalizedText(cell);

                        for (let rowOffset = 0; rowOffset < rowspan; rowOffset++) {
                            const targetRow = rowIndex + rowOffset;
                            if (!grid[targetRow]) grid[targetRow] = [];
                            for (let columnOffset = 0; columnOffset < colspan; columnOffset++) {
                                grid[targetRow][columnIndex + columnOffset] = value;
                            }
                        }

                        columnIndex += colspan;
                    });
            });

            const maximumColumns = Math.max(0, ...grid.map(row => row.length));
            return grid.map(row => Array.from({ length: maximumColumns }, (_, index) => row[index] ?? ''));
        }

        let metadataElement = element.previousElementSibling;
        while (metadataElement && !(metadataElement.matches('p.clearfix') && /日期\s*\d{4}\/\d{2}\/\d{2}/.test(normalizedText(metadataElement)))) {
            metadataElement = metadataElement.previousElementSibling;
        }

        if (!metadataElement) {
            const previousMetadata = Array.from(document.querySelectorAll('p.clearfix'))
                .filter(node =>
                    (node.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
                    && /日期\s*\d{4}\/\d{2}\/\d{2}/.test(normalizedText(node))
                );
            metadataElement = previousMetadata[previousMetadata.length - 1] || null;
        }

        const headerRows = expandRows(Array.from(element.querySelectorAll('thead tr')));
        const bodyRows = expandRows(Array.from(element.querySelectorAll('tbody tr')));

        return {
            pageTitle: document.title,
            className: element.className,
            metadataText: normalizedText(metadataElement),
            headerRows,
            bodyRows
        };
    });
}

function writePayload(payload) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const outputFile = `${payload.dateCompact}_${OUTPUT_SUFFIX}.json`;
    const outputPath = path.join(OUTPUT_DIR, outputFile);
    let changed = true;

    if (fs.existsSync(outputPath)) {
        const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        if (JSON.stringify(comparablePayload(existing)) === JSON.stringify(comparablePayload(payload))) {
            changed = false;
        }
    }

    if (changed) {
        fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        console.log(`Saved ${outputFile}`);
    } else {
        console.log(`No data changes for ${outputFile}`);
    }

    return { outputFile, changed };
}

async function crawlOneDate(page, expectedDate) {
    await loadPage(page, expectedDate);
    const extracted = await extractTable(page);
    const dateMatch = extracted.metadataText.match(/日期\s*(\d{4})\/(\d{2})\/(\d{2})/);

    if (!dateMatch) {
        throw new Error(`Unable to read the data date from metadata: ${extracted.metadataText || '(empty)'}`);
    }

    const payloadDate = `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`;
    if (expectedDate && payloadDate !== expectedDate) {
        throw new Error(`TAIFEX page date is ${payloadDate}, but target date is ${expectedDate}. The POST query may have been ignored; no file was written.`);
    }

    const rows = buildStructuredRows(extracted.bodyRows);
    const validation = validateRows(rows);
    const productNames = [...new Set(rows.filter(row => row.rowType === 'contract').map(row => row.productName))];

    const payload = {
        schemaVersion: 1,
        source: {
            name: '臺灣期貨交易所－三大法人－區分各期貨契約－依日期',
            url: PAGE_URL,
            pageTitle: extracted.pageTitle,
            requestMethod: expectedDate ? 'POST' : 'GET',
            queryDate: expectedDate ? formatDate(expectedDate) : null
        },
        date: formatDate(payloadDate),
        dateCompact: payloadDate,
        fetchedAt: new Date().toISOString(),
        unit: {
            contracts: '口數',
            contractAmount: '千元'
        },
        table: {
            selector: TABLE_SELECTOR,
            className: extracted.className,
            metadataText: extracted.metadataText,
            columns: [
                '序號',
                '商品名稱',
                '身份別',
                '交易多方口數',
                '交易多方契約金額千元',
                '交易空方口數',
                '交易空方契約金額千元',
                '交易多空淨額口數',
                '交易多空淨額契約金額千元',
                '未平倉多方口數',
                '未平倉多方契約金額千元',
                '未平倉空方口數',
                '未平倉空方契約金額千元',
                '未平倉多空淨額口數',
                '未平倉多空淨額契約金額千元'
            ],
            headerRows: extracted.headerRows
        },
        summary: {
            rowCount: rows.length,
            contractProductCount: productNames.length,
            contractProducts: productNames,
            formulaErrorCount: validation.formulaErrorCount,
            taiwanStockIndexFuturesForeignOpenInterest: validation.taiwanStockIndexFuturesForeignOpenInterest
        },
        rows
    };

    const writeResult = writePayload(payload);
    const taiwanFutures = validation.taiwanStockIndexFuturesForeignOpenInterest;
    console.log(`Date: ${payloadDate}`);
    console.log(`Rows: ${rows.length}`);
    console.log(`Products: ${productNames.length}`);
    console.log(`臺股期貨外資未平倉淨額: ${taiwanFutures.longContracts} - ${taiwanFutures.shortContracts} = ${taiwanFutures.netContracts}`);

    return {
        date: payloadDate,
        changed: writeResult.changed,
        outputFile: writeResult.outputFile
    };
}

(async () => {
    let browser;

    try {
        const plan = resolveRunPlan();
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            locale: 'zh-TW',
            timezoneId: 'Asia/Taipei',
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            extraHTTPHeaders: {
                'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8'
            }
        });
        const page = await context.newPage();

        if (plan.mode === 'range') {
            console.log(`Range: ${plan.startDate} - ${plan.endDate}`);
            console.log(`Trading dates to crawl: ${plan.dates.length}`);
            console.log(`Skipped dates: ${plan.skippedDates.length}`);
            for (const skipped of plan.skippedDates) {
                console.log(`Skip ${skipped.date}: ${skipped.reason}`);
            }
        }

        const successes = [];
        const failures = [];

        for (let index = 0; index < plan.dates.length; index++) {
            const targetDate = plan.dates[index];
            const label = targetDate || 'latest';
            console.log(`\n[${index + 1}/${plan.dates.length}] Crawl ${label}`);

            try {
                successes.push(await crawlOneDate(page, targetDate));
            } catch (error) {
                failures.push({ date: label, message: error.message });
                console.error(`Failed ${label}: ${error.message}`);
            }

            if (index < plan.dates.length - 1) {
                console.log(`Delay ${plan.delayMs} ms before next request`);
                await sleep(plan.delayMs);
            }
        }

        refreshFilesJson();
        const changedCount = successes.filter(item => item.changed).length;
        console.log(`\nCompleted: ${successes.length}/${plan.dates.length}`);
        console.log(`Files changed: ${changedCount}`);
        console.log(`Failures: ${failures.length}`);

        if (failures.length > 0) {
            const details = failures.map(item => `${item.date}: ${item.message}`).join('\n');
            throw new Error(`Failed to complete all requested dates:\n${details}`);
        }
    } catch (error) {
        console.error(`Failed to crawl TAIFEX futures contracts institutional trader data: ${error.message}`);
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
    }
})();
