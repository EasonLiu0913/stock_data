#!/usr/bin/env node

/**
 * 逐日下載所有 TWSE 上市標的的富邦 MoneyDJ「券商分點-進出明細」。
 *
 * 股票母體來自 data_twse/twse_industry_*.csv，不依賴任何主力排行 CSV。
 * 每個交易日輸出一份 JSON，內含每檔股票的前 15 大買超與賣超券商。
 *
 * 常用指令：
 *   node scripts/crawl_fubon_broker_details.js
 *   node scripts/crawl_fubon_broker_details.js --date 20260722
 *   node scripts/crawl_fubon_broker_details.js --start 2026-01-01 --end yesterday --max-dates 5
 *   node scripts/crawl_fubon_broker_details.js --date 20260722 --check-only
 *
 * 測試：
 *   node scripts/crawl_fubon_broker_details.js --date 20260722 --stocks 2634,3481
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'data_fubon_broker_details');
const NON_TRADING_DAYS_FILE = path.join(
    ROOT_DIR,
    'data_history_sma',
    'non_trading_days.json'
);
const SOURCE_BASE_URL = 'https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco.djhtm';
const STOCK_LIST_CATEGORIES = [
    'Stock',
    'ETF',
    'ETN',
    'REITs',
    'TDR',
    'PreferredStock',
    'InnovationBoard'
];
const SCHEMA_VERSION = 2;

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
        checkpointSize: 100,
        force: false,
        checkOnly: false,
        dryRun: false,
        stocks: [],
        outputDir: DEFAULT_OUTPUT_DIR
    };

    const valueOptions = new Map([
        ['--date', 'date'],
        ['--start', 'start'],
        ['--end', 'end'],
        ['--concurrency', 'concurrency'],
        ['--retries', 'retries'],
        ['--max-dates', 'maxDates'],
        ['--min-delay-ms', 'minDelayMs'],
        ['--max-delay-ms', 'maxDelayMs'],
        ['--date-min-delay-ms', 'dateMinDelayMs'],
        ['--date-max-delay-ms', 'dateMaxDelayMs'],
        ['--backoff-base-ms', 'backoffBaseMs'],
        ['--checkpoint-size', 'checkpointSize'],
        ['--output-dir', 'outputDir']
    ]);
    const numericKeys = new Set([
        'concurrency',
        'retries',
        'maxDates',
        'minDelayMs',
        'maxDelayMs',
        'dateMinDelayMs',
        'dateMaxDelayMs',
        'backoffBaseMs',
        'checkpointSize'
    ]);

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (valueOptions.has(arg)) {
            const key = valueOptions.get(arg);
            const value = argv[index + 1];
            if (value === undefined) throw new Error(`${arg} 缺少值`);
            options[key] = numericKeys.has(key) ? Number(value) : value;
            index += 1;
        } else if (arg === '--stocks') {
            const value = argv[index + 1];
            if (value === undefined) throw new Error('--stocks 缺少值');
            options.stocks = value
                .split(',')
                .map(item => item.trim().toUpperCase())
                .filter(Boolean);
            index += 1;
        } else if (arg === '--force') options.force = true;
        else if (arg === '--check-only') options.checkOnly = true;
        else if (arg === '--dry-run') options.dryRun = true;
        else if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--allow-missing-ranking') {
            // 舊版相容：新版不使用排行，保留參數避免既有指令失敗。
        } else {
            throw new Error(`未知參數：${arg}`);
        }
    }

    if (options.outputDir !== DEFAULT_OUTPUT_DIR) {
        options.outputDir = path.resolve(options.outputDir);
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
    if (!Number.isInteger(options.checkpointSize) || options.checkpointSize < 1) {
        throw new Error('--checkpoint-size 必須是大於 0 的整數');
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
富邦全市場券商分點進出明細爬蟲

用法：
  node scripts/crawl_fubon_broker_details.js [options]

選項：
  --date YYYYMMDD          下載單日；未指定日期時使用台北今日
  --start YYYY-MM-DD       區間起日
  --end YYYY-MM-DD         區間迄日，可使用 yesterday
  --max-dates N            最多處理 N 個未完成交易日；0 表示不限
  --concurrency N          同時開啟頁數，預設 4，最大 10
  --retries N              每檔股票重試次數，預設 3
  --min-delay-ms N         每次請求後最短等待，預設 800ms
  --max-delay-ms N         每次請求後最長等待，預設 2500ms
  --date-min-delay-ms N    每個交易日之間最短等待，預設 5000ms
  --date-max-delay-ms N    每個交易日之間最長等待，預設 15000ms
  --backoff-base-ms N      失敗退避基準，預設 5000ms
  --checkpoint-size N      每 N 檔寫入一次進度，預設 100
  --force                  重新下載已有完整檔案
  --check-only             只檢查既有 JSON，不連線
  --dry-run                只列出日期與股票數，不連線
  --stocks CODE1,CODE2     僅抓指定股票，供測試使用
  --output-dir PATH        自訂輸出資料夾
  --help                   顯示說明

股票母體：
  Stock、ETF、ETN、REITs、TDR、PreferredStock、InnovationBoard。
  排除 Warrants，不讀取主力買超／賣超排行 CSV。
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
    const date = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

function normalizeDate(value) {
    if (!value) return '';
    if (value === 'today') return taipeiDate(0);
    if (value === 'yesterday') return taipeiDate(-1);

    const match = value.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
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

function requestDate(isoDate) {
    return isoDate.split('-').map(Number).join('-');
}

function dateRange(start, end) {
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    if (startDate > endDate) throw new Error(`起日 ${start} 晚於迄日 ${end}`);

    const dates = [];
    for (const date = new Date(startDate); date <= endDate; date.setUTCDate(date.getUTCDate() + 1)) {
        dates.push(date.toISOString().slice(0, 10));
    }
    return dates;
}

function resolveDates(options) {
    if (options.date) return [normalizeDate(options.date)];
    if (options.start || options.end) {
        return dateRange(
            normalizeDate(options.start || '2026-01-01'),
            normalizeDate(options.end || 'yesterday')
        );
    }
    return [taipeiDate(0)];
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

function loadStockUniverse(onlyCodes = []) {
    const stocks = new Map();
    const sourceFiles = [];

    for (const category of STOCK_LIST_CATEGORIES) {
        const filePath = path.join(ROOT_DIR, 'data_twse', `twse_industry_${category}.csv`);
        if (!fs.existsSync(filePath)) {
            throw new Error(`找不到股票清單：${path.relative(ROOT_DIR, filePath)}`);
        }
        sourceFiles.push(path.relative(ROOT_DIR, filePath));
        const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
        const headers = rows[0] || [];
        const codeIndex = headers.indexOf('Code');
        const nameIndex = headers.indexOf('Name');
        if (codeIndex < 0 || nameIndex < 0) {
            throw new Error(`股票清單欄位不完整：${filePath}`);
        }

        for (const row of rows.slice(1)) {
            const code = (row[codeIndex] || '').trim().toUpperCase();
            const name = (row[nameIndex] || '').trim();
            if (!code || stocks.has(code)) continue;
            stocks.set(code, { code, name, category });
        }
    }

    let result = [...stocks.values()].sort((a, b) =>
        a.code.localeCompare(b.code, 'en', { numeric: true })
    );
    if (onlyCodes.length > 0) {
        const requested = new Set(onlyCodes);
        result = result.filter(stock => requested.has(stock.code));
        for (const code of onlyCodes) {
            if (!stocks.has(code)) {
                result.push({ code, name: '', category: 'Manual' });
            }
        }
    }

    const universeHash = crypto
        .createHash('sha256')
        .update(result.map(stock => `${stock.code}|${stock.name}|${stock.category}`).join('\n'))
        .digest('hex');
    return { stocks: result, sourceFiles, universeHash };
}

function outputPath(outputDir, isoDate) {
    return path.join(
        outputDir,
        `fubon_${compactDate(isoDate)}_券商分點進出明細.json`
    );
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
    const digits = milliseconds % 1000 === 0 ? 0 : 1;
    return `${(milliseconds / 1000).toFixed(digits)} 秒`;
}

function toNumber(value) {
    const normalized = String(value || '').replaceAll(',', '').replace('%', '').trim();
    if (normalized === '' || normalized === '--') return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
}

function extractId(href, key) {
    if (!href) return '';
    try {
        return new URL(href, SOURCE_BASE_URL).searchParams.get(key) || '';
    } catch {
        return '';
    }
}

function normalizePageDate(value, fallbackYear) {
    if (!value) return '';
    const parts = value.split('/');
    if (parts.length === 2) parts.unshift(fallbackYear);
    return parts
        .map((part, index) => index === 0 ? part : part.padStart(2, '0'))
        .join('-');
}

async function extractBrokerDetails(page, stock, isoDate) {
    const date = requestDate(isoDate);
    const sourceUrl = `${SOURCE_BASE_URL}?a=${encodeURIComponent(stock.code)}&e=${date}&f=${date}`;
    const response = await page.goto(sourceUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });
    const httpStatus = response?.status();
    if (httpStatus && httpStatus >= 400) throw new Error(`HTTP ${httpStatus}`);

    const pageData = await page.evaluate(() => {
        const fallbackTables = Array.from(document.querySelectorAll('table.t01'))
            .filter(candidate => candidate.innerText.includes('券商分點-進出明細'))
            .sort(
                (left, right) =>
                    left.querySelectorAll('tr').length - right.querySelectorAll('tr').length
            );
        const table = document.querySelector('#oMainTable') || fallbackTables[0];
        if (!table) return { error: '找不到分點明細表格' };

        const text = table.innerText;
        if (!text.includes('券商分點-進出明細')) {
            return { error: '頁面不是券商分點進出明細' };
        }

        const dateMatch = text.match(
            /(?:最後更新日|資料日期)：\s*((?:\d{4}\/)?\d{1,2}\/\d{1,2})/
        );
        const titleMatch = text.match(/^(.+?)\(([^)]+)\)主力進出比較圖/m);
        const rows = Array.from(table.querySelectorAll('tr'));
        const pairs = [];

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll(':scope > td'));
            if (cells.length !== 10) continue;
            const buyLink = cells[0].querySelector('a');
            const sellLink = cells[5].querySelector('a');
            if (!buyLink || !sellLink) continue;

            pairs.push({
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

        const footer = rows.find(row => row.innerText.includes('合計買超張數'));
        const footerCells = footer ? Array.from(footer.querySelectorAll(':scope > td')) : [];
        return {
            pageDate: dateMatch?.[1] || '',
            stockName: titleMatch?.[1]?.trim() || '',
            stockCode: titleMatch?.[2]?.trim() || '',
            totalNetBuy: footerCells[1]?.innerText.trim() || '',
            totalNetSell: footerCells[3]?.innerText.trim() || '',
            pairs
        };
    });

    if (pageData.error) throw new Error(pageData.error);
    const pageDate = normalizePageDate(pageData.pageDate, isoDate.slice(0, 4));
    if (pageData.stockCode && pageData.stockCode.toUpperCase() !== stock.code) {
        throw new Error(`股票代碼不符：預期 ${stock.code}，實際 ${pageData.stockCode}`);
    }

    if (pageDate !== isoDate) {
        return {
            status: 'unavailable',
            code: stock.code,
            name: stock.name || pageData.stockName,
            category: stock.category,
            requestedDate: isoDate,
            pageDate: pageDate || null,
            reason: '該日期無分點資料',
            sourceUrl
        };
    }
    if (pageData.pairs.length === 0) {
        return {
            status: 'unavailable',
            code: stock.code,
            name: stock.name || pageData.stockName,
            category: stock.category,
            requestedDate: isoDate,
            pageDate,
            reason: '該日沒有可列出的買賣超分點',
            sourceUrl
        };
    }
    if (pageData.pairs.length > 15) {
        throw new Error(`分點列數異常：${pageData.pairs.length}`);
    }

    const buyBrokers = [];
    const sellBrokers = [];
    pageData.pairs.forEach((pair, index) => {
        buyBrokers.push({
            rank: index + 1,
            brokerName: pair.buy.brokerName,
            brokerId: extractId(pair.buy.href, 'BHID'),
            branchId: extractId(pair.buy.href, 'b'),
            buy: toNumber(pair.buy.buy),
            sell: toNumber(pair.buy.sell),
            netBuy: toNumber(pair.buy.net),
            sharePercent: toNumber(pair.buy.sharePercent)
        });
        sellBrokers.push({
            rank: index + 1,
            brokerName: pair.sell.brokerName,
            brokerId: extractId(pair.sell.href, 'BHID'),
            branchId: extractId(pair.sell.href, 'b'),
            buy: toNumber(pair.sell.buy),
            sell: toNumber(pair.sell.sell),
            netSell: toNumber(pair.sell.net),
            sharePercent: toNumber(pair.sell.sharePercent)
        });
    });

    const totalNetBuy = toNumber(pageData.totalNetBuy);
    const totalNetSell = toNumber(pageData.totalNetSell);
    if (!Number.isFinite(totalNetBuy) || !Number.isFinite(totalNetSell)) {
        throw new Error('缺少合計買超／賣超張數');
    }

    return {
        status: 'success',
        code: stock.code,
        data: {
            stockCode: stock.code,
            stockName: stock.name || pageData.stockName,
            category: stock.category,
            date: isoDate,
            unit: '張',
            buyBrokers,
            sellBrokers,
            totals: {
                netBuy: totalNetBuy,
                netSell: totalNetSell,
                net: totalNetBuy - totalNetSell
            },
            sourceUrl
        }
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
                const base = Math.min(options.backoffBaseMs * (3 ** (attempt - 1)), 300000);
                const delay = randomInteger(
                    Math.floor(base * 0.8),
                    Math.ceil(base * 1.2)
                );
                console.warn(
                    `[${isoDate}] ${stock.code} 第 ${attempt}/${options.retries} 次失敗（${error.message}），退避 ${formatDelay(delay)}`
                );
                await wait(delay);
            }
        } finally {
            await wait(randomInteger(options.minDelayMs, options.maxDelayMs));
        }
    }
    throw lastError;
}

async function crawlStocks(context, stocks, isoDate, options) {
    const results = new Array(stocks.length);
    let nextIndex = 0;

    async function worker(workerIndex) {
        const page = await context.newPage();
        try {
            while (true) {
                const index = nextIndex;
                nextIndex += 1;
                if (index >= stocks.length) return;

                const stock = stocks[index];
                if (index % 25 === 0 || stocks.length <= 20) {
                    console.log(
                        `[${isoDate}] [${index + 1}/${stocks.length}] Worker ${workerIndex}: ${stock.code} ${stock.name}`
                    );
                }
                try {
                    results[index] = await crawlWithRetry(page, stock, isoDate, options);
                } catch (error) {
                    results[index] = {
                        status: 'failed',
                        code: stock.code,
                        name: stock.name,
                        category: stock.category,
                        error: error.message
                    };
                    console.error(`[${isoDate}] ${stock.code} FAILED: ${error.message}`);
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
    return results.filter(Boolean);
}

function createEmptyPayload(isoDate, universe) {
    return {
        schemaVersion: SCHEMA_VERSION,
        date: isoDate,
        market: 'TWSE',
        unit: '張',
        source: 'Fubon MoneyDJ 券商分點-進出明細',
        stockUniverse: {
            sourceFiles: universe.sourceFiles,
            categories: STOCK_LIST_CATEGORIES,
            excludes: ['Warrants'],
            hash: universe.universeHash,
            expectedStockCount: universe.stocks.length
        },
        complete: false,
        generatedAt: null,
        successfulStockCount: 0,
        unavailableStockCount: 0,
        failedStockCount: 0,
        stocks: {},
        unavailableStocks: [],
        failedStocks: []
    };
}

function readPayload(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function existingPayloadCanResume(payload, isoDate, universe) {
    return Boolean(
        payload &&
        payload.schemaVersion === SCHEMA_VERSION &&
        payload.date === isoDate &&
        payload.stockUniverse?.hash === universe.universeHash
    );
}

function completedCodes(payload) {
    return new Set([
        ...Object.keys(payload.stocks || {}),
        ...(payload.unavailableStocks || []).map(stock => stock.code)
    ]);
}

function mergeResults(payload, results, universe) {
    const unavailableByCode = new Map(
        (payload.unavailableStocks || []).map(stock => [stock.code, stock])
    );
    const failedByCode = new Map(
        (payload.failedStocks || []).map(stock => [stock.code, stock])
    );

    for (const result of results) {
        failedByCode.delete(result.code);
        if (result.status === 'success') {
            payload.stocks[result.code] = result.data;
            unavailableByCode.delete(result.code);
        } else if (result.status === 'unavailable') {
            unavailableByCode.set(result.code, result);
            delete payload.stocks[result.code];
        } else {
            failedByCode.set(result.code, {
                code: result.code,
                name: result.name,
                category: result.category,
                error: result.error
            });
        }
    }

    payload.unavailableStocks = [...unavailableByCode.values()].sort((a, b) =>
        a.code.localeCompare(b.code, 'en', { numeric: true })
    );
    payload.failedStocks = [...failedByCode.values()].sort((a, b) =>
        a.code.localeCompare(b.code, 'en', { numeric: true })
    );
    payload.successfulStockCount = Object.keys(payload.stocks).length;
    payload.unavailableStockCount = payload.unavailableStocks.length;
    payload.failedStockCount = payload.failedStocks.length;
    const accountedFor =
        payload.successfulStockCount +
        payload.unavailableStockCount;
    payload.complete =
        accountedFor === universe.stocks.length &&
        payload.failedStockCount === 0;
    payload.generatedAt = new Date().toISOString();
    return payload;
}

function writeAtomically(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, filePath);
}

function validatePayload(payload, isoDate, universe) {
    const errors = [];
    if (!payload) return ['JSON 不存在或無法解析'];
    if (payload.schemaVersion !== SCHEMA_VERSION) {
        errors.push(`schemaVersion 錯誤：${payload.schemaVersion}`);
    }
    if (payload.date !== isoDate) errors.push(`日期錯誤：${payload.date}`);
    if (payload.stockUniverse?.hash !== universe.universeHash) {
        errors.push('股票母體 hash 不符，股票清單可能已更新');
    }
    if (payload.stockUniverse?.expectedStockCount !== universe.stocks.length) {
        errors.push(
            `股票母體數量錯誤：JSON=${payload.stockUniverse?.expectedStockCount}，目前=${universe.stocks.length}`
        );
    }
    if (payload.complete !== true) errors.push('JSON 標記為未完成');
    if (payload.failedStockCount !== 0 || payload.failedStocks?.length !== 0) {
        errors.push(`仍有 ${payload.failedStockCount ?? payload.failedStocks?.length} 檔失敗`);
    }

    const expectedCodes = new Set(universe.stocks.map(stock => stock.code));
    const accountedCodes = new Set();
    for (const [code, stock] of Object.entries(payload.stocks || {})) {
        if (!expectedCodes.has(code)) errors.push(`包含股票清單外代碼：${code}`);
        if (accountedCodes.has(code)) errors.push(`重複代碼：${code}`);
        accountedCodes.add(code);
        if (stock.stockCode !== code) errors.push(`股票代碼欄位錯誤：${code}`);
        if (stock.date !== isoDate) errors.push(`股票日期錯誤：${code}`);
        if (!Array.isArray(stock.buyBrokers) || !Array.isArray(stock.sellBrokers)) {
            errors.push(`缺少買賣超券商陣列：${code}`);
            continue;
        }
        if (
            stock.buyBrokers.length < 1 ||
            stock.buyBrokers.length > 15 ||
            stock.buyBrokers.length !== stock.sellBrokers.length
        ) {
            errors.push(
                `買賣超券商列數錯誤：${code} Buy=${stock.buyBrokers.length} Sell=${stock.sellBrokers.length}`
            );
        }
        if (
            !Number.isFinite(stock.totals?.netBuy) ||
            !Number.isFinite(stock.totals?.netSell) ||
            stock.totals.net !== stock.totals.netBuy - stock.totals.netSell
        ) {
            errors.push(`合計欄位錯誤：${code}`);
        }
        for (const item of stock.buyBrokers) {
            if (!item.brokerName || !Number.isFinite(item.buy) || !Number.isFinite(item.sell) ||
                !Number.isFinite(item.netBuy) ||
                (item.sharePercent !== null && !Number.isFinite(item.sharePercent))) {
                errors.push(`買超券商欄位錯誤：${code} rank=${item.rank}`);
            }
        }
        for (const item of stock.sellBrokers) {
            if (!item.brokerName || !Number.isFinite(item.buy) || !Number.isFinite(item.sell) ||
                !Number.isFinite(item.netSell) ||
                (item.sharePercent !== null && !Number.isFinite(item.sharePercent))) {
                errors.push(`賣超券商欄位錯誤：${code} rank=${item.rank}`);
            }
        }
    }

    for (const stock of payload.unavailableStocks || []) {
        if (!expectedCodes.has(stock.code)) errors.push(`無資料清單含未知代碼：${stock.code}`);
        if (accountedCodes.has(stock.code)) errors.push(`重複代碼：${stock.code}`);
        accountedCodes.add(stock.code);
    }
    if (accountedCodes.size !== universe.stocks.length) {
        errors.push(`已交代股票數錯誤：${accountedCodes.size}/${universe.stocks.length}`);
    }
    if (payload.successfulStockCount !== Object.keys(payload.stocks || {}).length) {
        errors.push('successfulStockCount 錯誤');
    }
    if (payload.unavailableStockCount !== (payload.unavailableStocks || []).length) {
        errors.push('unavailableStockCount 錯誤');
    }
    return [...new Set(errors)];
}

async function crawlDate(context, isoDate, universe, options) {
    const filePath = outputPath(options.outputDir, isoDate);
    const existing = options.force ? null : readPayload(filePath);
    let payload = existingPayloadCanResume(existing, isoDate, universe)
        ? existing
        : createEmptyPayload(isoDate, universe);

    if (!options.force && payload.complete) {
        const errors = validatePayload(payload, isoDate, universe);
        if (errors.length === 0) {
            console.log(`⏭️  ${isoDate} 已完整，跳過`);
            return { skipped: true, failed: false };
        }
    }

    const done = completedCodes(payload);
    const pending = universe.stocks.filter(stock => !done.has(stock.code));
    console.log(
        `\n🚀 ${isoDate}：股票母體 ${universe.stocks.length}，已完成 ${done.size}，待抓 ${pending.length}`
    );

    for (let offset = 0; offset < pending.length; offset += options.checkpointSize) {
        const batch = pending.slice(offset, offset + options.checkpointSize);
        console.log(
            `📦 ${isoDate} 批次 ${offset + 1}-${offset + batch.length}/${pending.length}`
        );
        const results = await crawlStocks(context, batch, isoDate, options);
        payload = mergeResults(payload, results, universe);
        writeAtomically(filePath, payload);
        console.log(
            `💾 進度：成功 ${payload.successfulStockCount}、該日無資料 ${payload.unavailableStockCount}、失敗 ${payload.failedStockCount}`
        );
    }

    // 重跑先前失敗項目時，failedStocks 會在 mergeResults 中更新。
    payload = mergeResults(payload, [], universe);
    writeAtomically(filePath, payload);
    const errors = validatePayload(payload, isoDate, universe);
    if (errors.length > 0) {
        console.error(`❌ ${isoDate} 未完成：`);
        errors.slice(0, 30).forEach(error => console.error(`   - ${error}`));
        if (errors.length > 30) console.error(`   ...另有 ${errors.length - 30} 項`);
        return { skipped: false, failed: true };
    }

    console.log(
        `✅ ${isoDate} 完成：${payload.successfulStockCount} 檔有資料、${payload.unavailableStockCount} 檔該日無資料`
    );
    return { skipped: false, failed: false };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const universe = loadStockUniverse(options.stocks);
    const nonTradingDays = loadNonTradingDays();
    const requestedDates = resolveDates(options);
    const tradingDates = requestedDates.filter(
        date => !isWeekend(date) && !nonTradingDays.has(date)
    );
    const skippedDates = requestedDates.length - tradingDates.length;

    console.log(`📅 要求日期：${requestedDates[0]} ～ ${requestedDates.at(-1)}`);
    console.log(`🏦 交易日：${tradingDates.length}；略過非交易日：${skippedDates}`);
    console.log(`📋 股票母體：${universe.stocks.length} 檔（不含權證、不依賴排行 CSV）`);
    console.log(`📁 輸出：${options.outputDir}`);
    console.log(
        `🛡️ 節流：請求後 ${options.minDelayMs}-${options.maxDelayMs}ms；日期間 ${options.dateMinDelayMs}-${options.dateMaxDelayMs}ms；併行 ${options.concurrency}`
    );

    let jobs = tradingDates.map(isoDate => ({
        isoDate,
        filePath: outputPath(options.outputDir, isoDate)
    }));
    if (!options.force && !options.checkOnly) {
        jobs = jobs.filter(job => {
            const payload = readPayload(job.filePath);
            return !(
                existingPayloadCanResume(payload, job.isoDate, universe) &&
                payload.complete &&
                validatePayload(payload, job.isoDate, universe).length === 0
            );
        });
    }
    if (options.maxDates > 0) jobs = jobs.slice(0, options.maxDates);

    if (options.dryRun) {
        jobs.forEach(job =>
            console.log(`DRY RUN ${job.isoDate}: ${universe.stocks.length} 檔股票`)
        );
        return;
    }

    if (options.checkOnly) {
        let failed = false;
        for (const job of jobs) {
            const errors = validatePayload(
                readPayload(job.filePath),
                job.isoDate,
                universe
            );
            if (errors.length === 0) {
                console.log(`✅ ${job.isoDate} JSON 檢查通過`);
            } else {
                failed = true;
                console.error(`❌ ${job.isoDate} JSON 檢查失敗：`);
                errors.slice(0, 30).forEach(error => console.error(`   - ${error}`));
            }
        }
        if (failed) process.exitCode = 2;
        return;
    }

    if (jobs.length === 0) {
        console.log('沒有需要下載的日期。');
        return;
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36'
    });

    let failed = false;
    try {
        for (let index = 0; index < jobs.length; index += 1) {
            const result = await crawlDate(
                context,
                jobs[index].isoDate,
                universe,
                options
            );
            failed ||= result.failed;
            if (index < jobs.length - 1) {
                const delay = randomInteger(
                    options.dateMinDelayMs,
                    options.dateMaxDelayMs
                );
                console.log(`⏳ 下一個交易日前隨機等待 ${formatDelay(delay)}`);
                await wait(delay);
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
