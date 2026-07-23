#!/usr/bin/env node

/**
 * 下載富邦 MoneyDJ「券商分點-進出明細」。
 *
 * 股票範圍：
 *   取 data_fubon/fubon_YYYYMMDD_上市主力買超1日排行.csv 內的股票。
 *
 * 常用指令：
 *   node scripts/crawl_fubon_broker_details.js
 *   node scripts/crawl_fubon_broker_details.js --date 20260722
 *   node scripts/crawl_fubon_broker_details.js --start 2026-01-01 --end yesterday
 *   node scripts/crawl_fubon_broker_details.js --start 2026-01-01 --end yesterday --max-dates 5
 *   node scripts/crawl_fubon_broker_details.js --date 20260722 --check-only
 *
 * 測試／除錯：
 *   node scripts/crawl_fubon_broker_details.js --date 20260722 --stocks 2634,3481
 *   node scripts/crawl_fubon_broker_details.js --start 2026-01-01 --end yesterday --dry-run
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT_DIR = path.join(__dirname, '..');
const RANKING_DIR = path.join(ROOT_DIR, 'data_fubon');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'data_fubon_broker_details');
const NON_TRADING_DAYS_FILE = path.join(
    ROOT_DIR,
    'data_history_sma',
    'non_trading_days.json'
);
const SOURCE_BASE_URL = 'https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco.djhtm';
const CSV_HEADERS = [
    'Date',
    'Ranking',
    'StockCode',
    'StockName',
    'Side',
    'Position',
    'BrokerName',
    'BrokerID',
    'BranchID',
    'Buy',
    'Sell',
    'Net',
    'SharePercent'
];

function parseArgs(argv) {
    const options = {
        date: '',
        start: '',
        end: '',
        concurrency: 4,
        retries: 3,
        maxDates: 0,
        minDelayMs: 800,
        maxDelayMs: 2500,
        dateMinDelayMs: 5000,
        dateMaxDelayMs: 15000,
        backoffBaseMs: 5000,
        force: false,
        allowMissingRanking: false,
        checkOnly: false,
        dryRun: false,
        stocks: [],
        outputDir: DEFAULT_OUTPUT_DIR
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];

        if (arg === '--date') options.date = next, index += 1;
        else if (arg === '--start') options.start = next, index += 1;
        else if (arg === '--end') options.end = next, index += 1;
        else if (arg === '--concurrency') options.concurrency = Number(next), index += 1;
        else if (arg === '--retries') options.retries = Number(next), index += 1;
        else if (arg === '--max-dates') options.maxDates = Number(next), index += 1;
        else if (arg === '--min-delay-ms') options.minDelayMs = Number(next), index += 1;
        else if (arg === '--max-delay-ms') options.maxDelayMs = Number(next), index += 1;
        else if (arg === '--date-min-delay-ms') options.dateMinDelayMs = Number(next), index += 1;
        else if (arg === '--date-max-delay-ms') options.dateMaxDelayMs = Number(next), index += 1;
        else if (arg === '--backoff-base-ms') options.backoffBaseMs = Number(next), index += 1;
        else if (arg === '--stocks') {
            options.stocks = next.split(',').map(value => value.trim()).filter(Boolean);
            index += 1;
        } else if (arg === '--output-dir') {
            options.outputDir = path.resolve(next);
            index += 1;
        } else if (arg === '--force') options.force = true;
        else if (arg === '--allow-missing-ranking') options.allowMissingRanking = true;
        else if (arg === '--check-only') options.checkOnly = true;
        else if (arg === '--dry-run') options.dryRun = true;
        else if (arg === '--help' || arg === '-h') options.help = true;
        else throw new Error(`未知參數：${arg}`);
    }

    if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 10) {
        throw new Error('--concurrency 必須是 1 到 10 的整數');
    }
    if (!Number.isInteger(options.retries) || options.retries < 1 || options.retries > 10) {
        throw new Error('--retries 必須是 1 到 10 的整數');
    }
    if (!Number.isInteger(options.maxDates) || options.maxDates < 0) {
        throw new Error('--max-dates 必須是大於或等於 0 的整數');
    }
    for (const [name, value] of [
        ['--min-delay-ms', options.minDelayMs],
        ['--max-delay-ms', options.maxDelayMs],
        ['--date-min-delay-ms', options.dateMinDelayMs],
        ['--date-max-delay-ms', options.dateMaxDelayMs],
        ['--backoff-base-ms', options.backoffBaseMs]
    ]) {
        if (!Number.isInteger(value) || value < 0 || value > 300000) {
            throw new Error(`${name} 必須是 0 到 300000 的整數`);
        }
    }
    if (options.minDelayMs > options.maxDelayMs) {
        throw new Error('--min-delay-ms 不能大於 --max-delay-ms');
    }
    if (options.dateMinDelayMs > options.dateMaxDelayMs) {
        throw new Error('--date-min-delay-ms 不能大於 --date-max-delay-ms');
    }
    if (options.date && (options.start || options.end)) {
        throw new Error('--date 不能和 --start／--end 同時使用');
    }
    return options;
}

function printHelp() {
    console.log(`
富邦券商分點進出明細爬蟲

用法：
  node scripts/crawl_fubon_broker_details.js [options]

選項：
  --date YYYYMMDD          下載單日；未指定日期時使用台北今日
  --start YYYY-MM-DD       區間起日
  --end YYYY-MM-DD         區間迄日，可使用 yesterday
  --max-dates N            本次最多處理 N 個未完成交易日；0 表示不限
  --concurrency N          同時開啟頁數，預設 4，最大 10
  --retries N              每檔股票重試次數，預設 3
  --min-delay-ms N         每次請求後最短等待，預設 800ms
  --max-delay-ms N         每次請求後最長等待，預設 2500ms
  --date-min-delay-ms N    每個交易日之間最短等待，預設 5000ms
  --date-max-delay-ms N    每個交易日之間最長等待，預設 15000ms
  --backoff-base-ms N      失敗退避基準，預設 5000ms
  --force                  即使已有完整檔案仍重新下載
  --allow-missing-ranking  區間下載時略過缺少排行的日期
  --check-only             只檢查既有輸出，不連線
  --dry-run                只列出日期與股票數，不連線
  --stocks CODE1,CODE2     僅抓指定股票，供測試使用
  --output-dir PATH        自訂輸出資料夾
  --help                   顯示說明
`);
}

function taipeiDate(offsetDays = 0) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(new Date()).map(part => [part.type, part.value])
    );
    const utcDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
    utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
    return utcDate.toISOString().slice(0, 10);
}

function normalizeDate(value) {
    if (!value) return '';
    if (value === 'today') return taipeiDate(0);
    if (value === 'yesterday') return taipeiDate(-1);

    const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    const dashed = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const match = compact || dashed;
    if (!match) throw new Error(`日期格式錯誤：${value}`);

    const isoDate = `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate) {
        throw new Error(`日期不存在：${value}`);
    }
    return isoDate;
}

function compactDate(isoDate) {
    return isoDate.replaceAll('-', '');
}

function displayDate(isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    return `${year}/${month}/${day}`;
}

function randomInteger(min, max) {
    if (max <= min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wait(milliseconds) {
    if (milliseconds <= 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function formatDelay(milliseconds) {
    return `${(milliseconds / 1000).toFixed(milliseconds % 1000 === 0 ? 0 : 1)} 秒`;
}

function dateRange(start, end) {
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    if (startDate > endDate) throw new Error(`起日 ${start} 晚於迄日 ${end}`);

    const result = [];
    for (const cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        result.push(cursor.toISOString().slice(0, 10));
    }
    return result;
}

function loadNonTradingDays() {
    const data = JSON.parse(fs.readFileSync(NON_TRADING_DAYS_FILE, 'utf8'));
    return new Set(
        Object.values(data)
            .flat()
            .map(value => value.replaceAll('/', '-'))
    );
}

function isWeekend(isoDate) {
    const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
    return day === 0 || day === 6;
}

function outputPaths(outputDir, isoDate) {
    const date = compactDate(isoDate);
    return {
        csv: path.join(outputDir, `fubon_${date}_券商分點進出明細.csv`),
        summary: path.join(outputDir, `fubon_${date}_券商分點進出明細_summary.json`)
    };
}

function rankingPath(isoDate) {
    return path.join(
        RANKING_DIR,
        `fubon_${compactDate(isoDate)}_上市主力買超1日排行.csv`
    );
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (quoted && char === '"' && next === '"') {
            field += '"';
            index += 1;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (char === ',' && !quoted) {
            row.push(field);
            field = '';
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && next === '\n') index += 1;
            row.push(field);
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }

    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

function loadRankingStocks(isoDate) {
    const filePath = rankingPath(isoDate);
    if (!fs.existsSync(filePath)) {
        throw new Error(`找不到主力買超排行：${path.relative(ROOT_DIR, filePath)}`);
    }

    const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
    const headers = rows[0] || [];
    const rankIndex = headers.indexOf('Rank');
    const stockIndex = headers.indexOf('Stock');
    if (rankIndex < 0 || stockIndex < 0) {
        throw new Error(`排行欄位不完整：${path.relative(ROOT_DIR, filePath)}`);
    }

    const stocks = rows.slice(1).map(row => {
        const stockText = (row[stockIndex] || '').trim();
        const match = stockText.match(/^([0-9A-Z]+)\s*(.*)$/i);
        if (!match) throw new Error(`無法解析股票欄位：${stockText}`);
        return {
            ranking: Number(row[rankIndex]),
            code: match[1].toUpperCase(),
            name: match[2].trim()
        };
    });

    const uniqueStocks = [];
    const seen = new Set();
    for (const stock of stocks) {
        if (!stock.code || !Number.isFinite(stock.ranking) || seen.has(stock.code)) continue;
        seen.add(stock.code);
        uniqueStocks.push(stock);
    }
    if (uniqueStocks.length === 0) throw new Error(`排行內沒有股票：${filePath}`);
    return uniqueStocks;
}

function readSummary(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function existingDateIsComplete(paths, expectedCount = null) {
    if (!fs.existsSync(paths.csv)) return false;
    const summary = readSummary(paths.summary);
    if (!summary || summary.complete !== true || summary.failedStocks?.length !== 0) return false;
    if (expectedCount !== null && summary.expectedStockCount !== expectedCount) return false;
    return summary.successfulStockCount === summary.expectedStockCount;
}

function toNumber(text) {
    const normalized = String(text || '').replaceAll(',', '').replace('%', '').trim();
    if (normalized === '' || normalized === '--') return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

function extractId(href, key) {
    if (!href) return '';
    try {
        return new URL(href, SOURCE_BASE_URL).searchParams.get(key) || '';
    } catch {
        return '';
    }
}

async function extractBrokerDetails(page, stock, isoDate) {
    const sourceUrl = `${SOURCE_BASE_URL}?a=${encodeURIComponent(stock.code)}&e=${displayDate(isoDate).replaceAll('/', '-')}&f=${displayDate(isoDate).replaceAll('/', '-')}`;
    const response = await page.goto(sourceUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });
    const status = response?.status();
    if (status === 403 || status === 429 || (status && status >= 500)) {
        throw new Error(`HTTP ${status}`);
    }
    if (status && status >= 400) {
        throw new Error(`HTTP ${status}`);
    }

    const pageData = await page.evaluate(() => {
        const table = document.querySelector('#oMainTable');
        if (!table) return { error: '找不到分點明細表格' };

        const text = table.innerText;
        if (!text.includes('券商分點-進出明細')) {
            return { error: '頁面不是券商分點進出明細' };
        }

        const dateMatch = text.match(/(?:最後更新日|資料日期)：\s*(\d{4}\/\d{1,2}\/\d{1,2})/);
        const titleMatch = text.match(/^(.+?)\(([^)]+)\)主力進出比較圖/m);
        const rows = Array.from(table.querySelectorAll('tr'));
        const details = [];

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll(':scope > td'));
            if (cells.length !== 10) continue;

            const buyLink = cells[0].querySelector('a');
            const sellLink = cells[5].querySelector('a');
            if (!buyLink || !sellLink) continue;

            details.push({
                buy: {
                    brokerName: buyLink.innerText.trim(),
                    href: buyLink.getAttribute('href') || '',
                    buy: cells[1].innerText.trim(),
                    sell: cells[2].innerText.trim(),
                    net: cells[3].innerText.trim(),
                    sharePercent: cells[4].innerText.trim()
                },
                sell: {
                    brokerName: sellLink.innerText.trim(),
                    href: sellLink.getAttribute('href') || '',
                    buy: cells[6].innerText.trim(),
                    sell: cells[7].innerText.trim(),
                    net: cells[8].innerText.trim(),
                    sharePercent: cells[9].innerText.trim()
                }
            });
        }

        const footerRows = rows.filter(row => row.innerText.includes('合計買超張數'));
        let totalNetBuy = '';
        let totalNetSell = '';
        if (footerRows[0]) {
            const cells = Array.from(footerRows[0].querySelectorAll(':scope > td'));
            totalNetBuy = cells[1]?.innerText.trim() || '';
            totalNetSell = cells[3]?.innerText.trim() || '';
        }

        return {
            pageDate: dateMatch?.[1] || '',
            stockName: titleMatch?.[1]?.trim() || '',
            stockCode: titleMatch?.[2]?.trim() || '',
            details,
            totalNetBuy,
            totalNetSell
        };
    });

    if (pageData.error) throw new Error(pageData.error);
    const normalizedPageDate = pageData.pageDate
        ? pageData.pageDate.split('/').map((part, index) => index === 0 ? part : part.padStart(2, '0')).join('-')
        : '';
    if (normalizedPageDate !== isoDate) {
        throw new Error(`頁面日期不符：預期 ${isoDate}，實際 ${normalizedPageDate || '未知'}`);
    }
    if (
        pageData.stockCode &&
        pageData.stockCode.toUpperCase() !== stock.code.toUpperCase()
    ) {
        throw new Error(`股票代碼不符：預期 ${stock.code}，實際 ${pageData.stockCode || '未知'}`);
    }
    if (pageData.details.length === 0 || pageData.details.length > 15) {
        throw new Error(`分點列數異常：${pageData.details.length}`);
    }

    const rows = [];
    pageData.details.forEach((pair, index) => {
        for (const [side, detail] of [['Buy', pair.buy], ['Sell', pair.sell]]) {
            rows.push({
                Date: compactDate(isoDate),
                Ranking: stock.ranking,
                StockCode: stock.code,
                StockName: stock.name || pageData.stockName,
                Side: side,
                Position: index + 1,
                BrokerName: detail.brokerName,
                BrokerID: extractId(detail.href, 'BHID'),
                BranchID: extractId(detail.href, 'b'),
                Buy: toNumber(detail.buy),
                Sell: toNumber(detail.sell),
                Net: toNumber(detail.net),
                SharePercent: toNumber(detail.sharePercent)
            });
        }
    });

    return {
        stock: {
            ranking: stock.ranking,
            code: stock.code,
            name: stock.name || pageData.stockName
        },
        sourceUrl,
        pageDate: normalizedPageDate,
        detailPairs: pageData.details.length,
        totalNetBuy: toNumber(pageData.totalNetBuy),
        totalNetSell: toNumber(pageData.totalNetSell),
        rows
    };
}

async function crawlWithRetry(page, stock, isoDate, options) {
    let lastError;
    for (let attempt = 1; attempt <= options.retries; attempt += 1) {
        try {
            return await extractBrokerDetails(page, stock, isoDate);
        } catch (error) {
            lastError = error;
            if (attempt < options.retries) {
                const exponentialDelay = Math.min(
                    options.backoffBaseMs * (3 ** (attempt - 1)),
                    300000
                );
                const jitter = randomInteger(
                    Math.floor(exponentialDelay * 0.8),
                    Math.ceil(exponentialDelay * 1.2)
                );
                console.warn(
                    `[${isoDate}] ${stock.code} 第 ${attempt}/${options.retries} 次失敗（${error.message}），退避 ${formatDelay(jitter)}`
                );
                await wait(jitter);
            }
        } finally {
            const requestDelay = randomInteger(options.minDelayMs, options.maxDelayMs);
            await wait(requestDelay);
        }
    }
    throw lastError;
}

async function crawlStocks(context, stocks, isoDate, options) {
    const results = new Array(stocks.length);
    const failures = [];
    let nextIndex = 0;

    async function worker(workerIndex) {
        const page = await context.newPage();
        try {
            while (true) {
                const index = nextIndex;
                nextIndex += 1;
                if (index >= stocks.length) return;

                const stock = stocks[index];
                console.log(
                    `[${isoDate}] [${index + 1}/${stocks.length}] Worker ${workerIndex}: ${stock.code} ${stock.name}`
                );
                try {
                    results[index] = await crawlWithRetry(
                        page,
                        stock,
                        isoDate,
                        options
                    );
                    console.log(
                        `[${isoDate}] ${stock.code} OK (${results[index].detailPairs}x2)`
                    );
                } catch (error) {
                    failures.push({
                        ranking: stock.ranking,
                        code: stock.code,
                        name: stock.name,
                        error: error.message
                    });
                    console.log(`[${isoDate}] ${stock.code} FAILED: ${error.message}`);
                }
            }
        } finally {
            await page.close();
        }
    }

    const workerCount = Math.min(options.concurrency, stocks.length);
    await Promise.all(
        Array.from({ length: workerCount }, (_, index) => worker(index + 1))
    );
    return {
        results: results.filter(Boolean),
        failures: failures.sort((a, b) => a.ranking - b.ranking)
    };
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
}

function writeAtomically(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(temporaryPath, content, 'utf8');
    fs.renameSync(temporaryPath, filePath);
}

function saveDateResult(paths, isoDate, stocks, results, failures) {
    const rows = results
        .flatMap(result => result.rows)
        .sort((a, b) =>
            a.Ranking - b.Ranking ||
            (a.Side === b.Side ? 0 : a.Side === 'Buy' ? -1 : 1) ||
            a.Position - b.Position
        );
    const csv = [
        CSV_HEADERS.join(','),
        ...rows.map(row => CSV_HEADERS.map(header => csvEscape(row[header])).join(','))
    ].join('\n') + '\n';

    const summaries = results
        .map(result => ({
            ranking: result.stock.ranking,
            code: result.stock.code,
            name: result.stock.name,
            pageDate: result.pageDate,
            detailPairs: result.detailPairs,
            totalNetBuy: result.totalNetBuy,
            totalNetSell: result.totalNetSell,
            sourceUrl: result.sourceUrl
        }))
        .sort((a, b) => a.ranking - b.ranking);
    const complete = results.length === stocks.length && failures.length === 0;
    const summary = {
        date: isoDate,
        rankingFile: path.relative(ROOT_DIR, rankingPath(isoDate)),
        expectedStockCount: stocks.length,
        successfulStockCount: results.length,
        failedStockCount: failures.length,
        rowCount: rows.length,
        complete,
        generatedAt: new Date().toISOString(),
        stocks: summaries,
        failedStocks: failures
    };

    writeAtomically(paths.csv, csv);
    writeAtomically(paths.summary, `${JSON.stringify(summary, null, 2)}\n`);
    return summary;
}

function checkDateOutput(paths, isoDate, expectedStocks) {
    const errors = [];
    if (!fs.existsSync(paths.csv)) errors.push(`缺少 CSV：${paths.csv}`);
    if (!fs.existsSync(paths.summary)) errors.push(`缺少摘要：${paths.summary}`);
    if (errors.length > 0) return errors;

    const summary = readSummary(paths.summary);
    if (!summary) return [`摘要 JSON 無法解析：${paths.summary}`];
    if (summary.date !== isoDate) errors.push(`摘要日期錯誤：${summary.date}`);
    if (summary.complete !== true) errors.push('摘要標記為未完成');
    if (summary.failedStockCount !== 0 || summary.failedStocks?.length !== 0) {
        errors.push(`仍有 ${summary.failedStockCount ?? summary.failedStocks?.length} 檔失敗`);
    }
    if (summary.expectedStockCount !== expectedStocks.length) {
        errors.push(
            `預期股票數錯誤：摘要 ${summary.expectedStockCount}，排行 ${expectedStocks.length}`
        );
    }
    if (summary.successfulStockCount !== expectedStocks.length) {
        errors.push(
            `成功股票數錯誤：${summary.successfulStockCount}/${expectedStocks.length}`
        );
    }
    if (!Array.isArray(summary.stocks) || summary.stocks.length !== expectedStocks.length) {
        errors.push(`摘要股票明細數錯誤：${summary.stocks?.length ?? 0}/${expectedStocks.length}`);
    } else {
        const summaryCodes = new Set();
        for (const stock of summary.stocks) {
            if (summaryCodes.has(stock.code)) errors.push(`摘要股票重複：${stock.code}`);
            summaryCodes.add(stock.code);
            if (stock.pageDate !== isoDate) {
                errors.push(`摘要頁面日期錯誤：${stock.code} ${stock.pageDate}`);
            }
            if (!Number.isInteger(stock.detailPairs) || stock.detailPairs < 1 || stock.detailPairs > 15) {
                errors.push(`摘要分點列數錯誤：${stock.code} ${stock.detailPairs}`);
            }
            if (!Number.isFinite(stock.totalNetBuy) || !Number.isFinite(stock.totalNetSell)) {
                errors.push(`摘要頁尾合計缺失：${stock.code}`);
            }
        }
    }

    const csvRows = parseCsv(fs.readFileSync(paths.csv, 'utf8'));
    const headers = csvRows[0] || [];
    const indexes = Object.fromEntries(CSV_HEADERS.map(header => [header, headers.indexOf(header)]));
    for (const [header, index] of Object.entries(indexes)) {
        if (index < 0) errors.push(`CSV 缺少欄位：${header}`);
    }
    if (errors.length > 0) return errors;

    const records = csvRows.slice(1);
    if (summary.rowCount !== records.length) {
        errors.push(`CSV 列數錯誤：摘要 ${summary.rowCount}，實際 ${records.length}`);
    }

    const expectedCodes = new Set(expectedStocks.map(stock => stock.code));
    const foundCodes = new Set();
    const keys = new Set();
    const sideCounts = new Map();
    for (const row of records) {
        const code = row[indexes.StockCode];
        const side = row[indexes.Side];
        const position = Number(row[indexes.Position]);
        const date = row[indexes.Date];
        if (date !== compactDate(isoDate)) errors.push(`CSV 內日期錯誤：${date}`);
        if (!expectedCodes.has(code)) errors.push(`CSV 含排行外股票：${code}`);
        if (!['Buy', 'Sell'].includes(side)) errors.push(`Side 錯誤：${side}`);
        if (!Number.isInteger(position) || position < 1 || position > 15) {
            errors.push(`Position 錯誤：${code} ${side} ${position}`);
        }
        const key = `${code}:${side}:${position}`;
        if (keys.has(key)) errors.push(`重複資料：${key}`);
        keys.add(key);
        foundCodes.add(code);
        sideCounts.set(`${code}:${side}`, (sideCounts.get(`${code}:${side}`) || 0) + 1);
        if (!row[indexes.BrokerName]) errors.push(`BrokerName 空白：${key}`);
        for (const header of ['Buy', 'Sell', 'Net', 'SharePercent']) {
            if (!Number.isFinite(Number(row[indexes[header]]))) {
                errors.push(`${header} 不是數字：${key}`);
            }
        }
    }
    for (const code of expectedCodes) {
        if (!foundCodes.has(code)) errors.push(`CSV 缺少股票：${code}`);
        const buyCount = sideCounts.get(`${code}:Buy`) || 0;
        const sellCount = sideCounts.get(`${code}:Sell`) || 0;
        if (buyCount !== sellCount || buyCount < 1 || buyCount > 15) {
            errors.push(`買賣分點列數不一致：${code} Buy=${buyCount} Sell=${sellCount}`);
        }
    }

    return [...new Set(errors)];
}

function resolveDates(options) {
    if (options.date) return [normalizeDate(options.date)];
    if (options.start || options.end) {
        const start = normalizeDate(options.start || '2026-01-01');
        const end = normalizeDate(options.end || 'yesterday');
        return dateRange(start, end);
    }
    return [taipeiDate(0)];
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const nonTradingDays = loadNonTradingDays();
    const requestedDates = resolveDates(options);
    const tradingDates = requestedDates.filter(
        date => !isWeekend(date) && !nonTradingDays.has(date)
    );
    const skippedNonTrading = requestedDates.filter(
        date => isWeekend(date) || nonTradingDays.has(date)
    );

    console.log(`📅 要求日期：${requestedDates[0]} ～ ${requestedDates.at(-1)}`);
    console.log(`🏦 交易日：${tradingDates.length}；略過非交易日：${skippedNonTrading.length}`);
    console.log(`📁 輸出：${options.outputDir}`);
    console.log(
        `🛡️ 節流：請求後 ${options.minDelayMs}-${options.maxDelayMs}ms；日期間 ${options.dateMinDelayMs}-${options.dateMaxDelayMs}ms；併行 ${options.concurrency}`
    );

    const dateJobs = [];
    const missingRankings = [];
    for (const isoDate of tradingDates) {
        let stocks;
        try {
            stocks = options.stocks.length > 0
                ? options.stocks.map((code, index) => ({
                    ranking: index + 1,
                    code: code.toUpperCase(),
                    name: ''
                }))
                : loadRankingStocks(isoDate);
        } catch (error) {
            missingRankings.push({ date: isoDate, error: error.message });
            continue;
        }

        const paths = outputPaths(options.outputDir, isoDate);
        if (!options.force && !options.checkOnly && existingDateIsComplete(paths, stocks.length)) {
            console.log(`⏭️  ${isoDate} 已完整，跳過`);
            continue;
        }
        dateJobs.push({ isoDate, stocks, paths });
    }

    if (missingRankings.length > 0) {
        console.error('\n⚠️ 缺少排行的交易日：');
        missingRankings.forEach(item => console.error(`  ${item.date}: ${item.error}`));
    }

    const selectedJobs = options.maxDates > 0
        ? dateJobs.slice(0, options.maxDates)
        : dateJobs;
    if (options.maxDates > 0 && dateJobs.length > selectedJobs.length) {
        console.log(`📦 本次依 --max-dates 僅處理前 ${selectedJobs.length}/${dateJobs.length} 天`);
    }

    if (options.dryRun) {
        selectedJobs.forEach(job =>
            console.log(`DRY RUN ${job.isoDate}: ${job.stocks.length} 檔股票`)
        );
        if (missingRankings.length > 0 && !options.allowMissingRanking) process.exitCode = 2;
        return;
    }

    if (options.checkOnly) {
        let failed = missingRankings.length > 0 && !options.allowMissingRanking;
        for (const job of selectedJobs) {
            const errors = checkDateOutput(job.paths, job.isoDate, job.stocks);
            if (errors.length === 0) {
                console.log(`✅ ${job.isoDate} 檢查通過（${job.stocks.length} 檔）`);
            } else {
                failed = true;
                console.error(`❌ ${job.isoDate} 檢查失敗：`);
                errors.forEach(error => console.error(`   - ${error}`));
            }
        }
        if (failed) process.exitCode = 2;
        return;
    }

    if (selectedJobs.length === 0) {
        console.log('沒有需要下載的日期。');
        if (missingRankings.length > 0 && !options.allowMissingRanking) process.exitCode = 2;
        return;
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36'
    });

    let failed = missingRankings.length > 0 && !options.allowMissingRanking;
    try {
        for (let jobIndex = 0; jobIndex < selectedJobs.length; jobIndex += 1) {
            const job = selectedJobs[jobIndex];
            console.log(`\n🚀 ${job.isoDate}：開始下載 ${job.stocks.length} 檔股票`);
            const { results, failures } = await crawlStocks(
                context,
                job.stocks,
                job.isoDate,
                options
            );
            const summary = saveDateResult(
                job.paths,
                job.isoDate,
                job.stocks,
                results,
                failures
            );
            const checkErrors = checkDateOutput(job.paths, job.isoDate, job.stocks);
            if (checkErrors.length > 0) {
                failed = true;
                console.error(`❌ ${job.isoDate} 未完成：`);
                checkErrors.forEach(error => console.error(`   - ${error}`));
            } else {
                console.log(
                    `✅ ${job.isoDate} 完成：${summary.successfulStockCount} 檔、${summary.rowCount} 列`
                );
            }

            if (jobIndex < selectedJobs.length - 1) {
                const dateDelay = randomInteger(
                    options.dateMinDelayMs,
                    options.dateMaxDelayMs
                );
                console.log(`⏳ 下一個交易日前隨機等待 ${formatDelay(dateDelay)}`);
                await wait(dateDelay);
            }
        }
    } finally {
        await context.close();
        await browser.close();
    }

    if (failed) process.exitCode = 2;
}

main().catch(error => {
    console.error(`❌ ${error.stack || error.message}`);
    process.exitCode = 1;
});
