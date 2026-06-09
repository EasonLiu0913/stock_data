const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const MAX_CONCURRENCY = 5; // Set concurrency to 5
const NON_TRADING_START_YEAR = 2026;
const args = process.argv.slice(2);
function getArg(flag) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
}

const DEFAULT_TARGET_DATE_STR = '2025/11/02';
const argStart = getArg('--start');
const TARGET_DATE_STR = argStart || DEFAULT_TARGET_DATE_STR;
const OUTPUT_DIR = path.join(__dirname, '../data_history_sma');
const DAILY_SMA_DIR = path.join(__dirname, '../data_fubon');
const TRADING_DAYS_FILE = path.join(__dirname, '../data_history_sma/trading_days.json');
const NON_TRADING_DAYS_FILE = path.join(__dirname, '../data_history_sma/non_trading_days.json');
const CSV_FILE = path.join(__dirname, '../data_twse/twse_industry.csv');
const FOCUS_SELECTOR = '#SysJustIFRAMEDIV > table > tbody > tr:nth-child(2) > td:nth-child(2) > table > tbody > tr > td > form > table > tbody > tr > td > table > tbody > tr:nth-child(1) > td';

// Legend Regex Patterns
const REGEX_PATTERNS = {
    // Note: The spaces might be &nbsp; or normal spaces, so we use [\s\u00a0]+
    SMA5: /SMA5[\s\u00a0]+([\d,.]+)/,
    SMA20: /SMA20[\s\u00a0]+([\d,.]+)/,
    SMA60: /SMA60[\s\u00a0]+([\d,.]+)/,
    SMA120: /SMA120[\s\u00a0]+([\d,.]+)/,
    SMA240: /SMA240[\s\u00a0]+([\d,.]+)/
};

(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Read CSV
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`CSV file not found: ${CSV_FILE}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(CSV_FILE, 'utf8');
    const lines = fileContent.trim().split('\n');
    const stocks = [];

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 1) {
            stocks.push({
                code: parts[0].trim(),
                name: parts[1] ? parts[1].trim() : ''
            });
        }
    }

    console.log(`Found ${stocks.length} stocks in CSV.`);

    // 解析位置參數: node crawl_history_sma.js [start_index] [limit]
    const startIndex = parseInt(args[0], 10) || 0;
    const limit = args[1] ? parseInt(args[1], 10) : null; // null 表示處理全部

    // 計算實際處理範圍
    const endIndex = limit ? Math.min(startIndex + limit, stocks.length) : stocks.length;
    const stocksToProcess = stocks.slice(startIndex, endIndex);

    console.log(`Processing stocks from index ${startIndex} to ${endIndex - 1} (${stocksToProcess.length} stocks)`);
    if (!limit) {
        console.log(`ℹ️  No limit specified, processing all remaining stocks.`);
    }

    const tradingCalendar = loadTradingCalendar();
    const nonTradingCalendar = loadNonTradingCalendar();
    addKnownDailySmaDates(tradingCalendar);
    let browser = null;
    let browserPromise = null;
    const getBrowser = async () => {
        if (!browserPromise) {
            browserPromise = chromium.launch({ headless: true });
        }
        browser = await browserPromise;
        return browser;
    };

    console.log(`🚀 Starting concurrent processing with ${MAX_CONCURRENCY} workers...`);

    // Worker Pool Implementation
    const queue = stocksToProcess.map((stock, idx) => ({
        stock,
        originalIndex: startIndex + idx
    }));
    const totalStocks = stocks.length;

    // Shared results stats (optional, mainly for logging)
    let processedCount = 0;

    async function processStock(getPage, task) {
        const { stock, originalIndex } = task;
        const currentProgress = originalIndex + 1;

        const outputFile = path.join(OUTPUT_DIR, `${stock.code}.json`);
        let existingData = {};
        let crawlPlan = {
            shouldCrawl: true,
            stopDate: TARGET_DATE_STR,
            reason: 'no existing data'
        };

        if (fs.existsSync(outputFile)) {
            try {
                const content = fs.readFileSync(outputFile, 'utf8');
                existingData = JSON.parse(content);
                crawlPlan = getCrawlPlan(existingData, TARGET_DATE_STR, tradingCalendar, nonTradingCalendar);
                logCrawlPlan(stock.code, existingData, crawlPlan, tradingCalendar, nonTradingCalendar);
            } catch (e) {
                console.error(`[${stock.code}] Error reading existing file, starting fresh.`);
            }
        }

        if (!crawlPlan.shouldCrawl) {
            saveTradingCalendar(tradingCalendar);
            saveNonTradingCalendar(nonTradingCalendar);
            console.log(`[${currentProgress}/${totalStocks}] [${stock.code}] Data complete. Skipping.`);
            return;
        }

        console.log(`[${currentProgress}/${totalStocks}] [${stock.code}] Starting crawl (${crawlPlan.reason}, until ${crawlPlan.stopDate})...`);

        try {
            const page = await getPage();
            const crawlResult = await crawlStock(page, stock.code, crawlPlan.stopDate);
            const crawledData = crawlResult.data;
            learnTradingDaysFromTradingDates(tradingCalendar, crawlResult.visitedDates);
            learnNonTradingDaysFromTradingDates(nonTradingCalendar, [
                ...crawlResult.visitedDates
            ], tradingCalendar);

            // Merge data
            const mergedData = { ...existingData, ...crawledData };

            // Sort data by date (descending: newest first)
            const sortedData = {};
            Object.keys(mergedData).sort().reverse().forEach(date => {
                sortedData[date] = mergedData[date];
            });

            const crawledCount = Object.keys(crawledData).length;
            const addedCount = Object.keys(crawledData).filter(date => !existingData[date]).length;

            // Save if we got crawled data or learned non-trading days.
            if (crawledCount > 0) {
                fs.writeFileSync(outputFile, JSON.stringify(sortedData, null, 2), 'utf8');
                saveTradingCalendar(tradingCalendar);
                saveNonTradingCalendar(nonTradingCalendar);
                console.log(`   ✅ [${stock.code}] Saved. Crawled: ${crawledCount}, Added: ${addedCount}, Total: ${Object.keys(sortedData).length}.`);
            } else {
                saveTradingCalendar(tradingCalendar);
                saveNonTradingCalendar(nonTradingCalendar);
                console.log(`   🔸 [${stock.code}] No new data found.`);
            }

        } catch (error) {
            console.error(`   ❌ [${stock.code}] Error crawling:`, error.message);
        }
    }

    // Worker Function
    const workers = [];
    for (let i = 0; i < MAX_CONCURRENCY; i++) {
        workers.push((async () => {
            let context = null;
            let page = null;

            const getPage = async () => {
                if (!page) {
                    const activeBrowser = await getBrowser();
                    context = await activeBrowser.newContext();
                    page = await context.newPage();
                    await page.waitForTimeout(i * 300);
                }
                return page;
            };

            while (queue.length > 0) {
                const task = queue.shift();
                if (task) {
                    await processStock(getPage, task);

                    // Random delay between stocks per worker
                    if (page) {
                        const delay = Math.floor(Math.random() * 500) + 500;
                        await page.waitForTimeout(delay);
                    }
                }
            }
            if (context) {
                await context.close();
            }
        })());
    }

    await Promise.all(workers);
    if (browser) {
        await browser.close();
    }
    console.log('\n✅ All stocks processed.');

})();

async function crawlStock(page, stockCode, stopDate) {
    const url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stockCode}.djhtm`;
    // console.log(`Navigating to ${url}...`);
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (e) {
        // Retry once or just fail
        // Using domcontentloaded is faster but might miss chart load trigger?
        // Let's try domcontentloaded + wait for selector
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    // Wait for chart date element
    try {
        await page.waitForSelector('.opsBtmTitleK', { timeout: 15000 });
    } catch (e) {
        throw new Error('Chart did not load or selector not found');
    }

    const collectedData = {};
    const visitedDates = [];
    let previousDate = '';
    let consecutiveSameDateCount = 0;

    // Initial Click to focus + Tab x4 + ArrowLeft
    try {
        // Wait for iframe or element inside it? The selector is deep.
        // Assuming page structure is consistent.
        // Try simple focus first.
        // If the selector is very specific, might need to wait for it.
        const focusEl = await page.$(FOCUS_SELECTOR);
        if (focusEl) {
            await focusEl.click();
        } else {
            // Fallback click on body or just rely on keyboard?
            // Maybe click on canvas/graph area?
            await page.click('body');
        }
        await page.waitForTimeout(500);

        // Perform initial Tab navigation
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(100); // Faster tab
        }
    } catch (e) {
        // console.error(`Error initial focus interaction: ${e.message}`);
    }

    // Limit infinite loops
    let safetyCounter = 0;
    const MAX_DAYS_BACK = 2000; // Limit roughly 5 years

    while (safetyCounter++ < MAX_DAYS_BACK) {
        // 1. Extract Date
        let dateText = '';
        try {
            dateText = await page.innerText('.opsBtmTitleK');
        } catch (e) {
            break; // Element gone?
        }

        const currentDate = dateText.trim();
        if (isDateKey(currentDate)) {
            visitedDates.push(currentDate);
        }

        // Safety check: duplicate date
        if (currentDate === previousDate) {
            consecutiveSameDateCount++;
            if (consecutiveSameDateCount >= 3) {
                break;
            }
        } else {
            consecutiveSameDateCount = 0;
        }
        previousDate = currentDate;

        // Stop condition
        if (currentDate <= stopDate) {
            break;
        }

        // 2. Extract SMA Values from Legend
        // Optimization: Get innerText of the legend container directly
        const legendContainer = await page.$('#SysJustIFRAMEDIV');
        let legendText = '';
        if (legendContainer) {
            legendText = await legendContainer.innerText();
        }

        const dataPoint = {
            ...(await extractMarketData(page)),
            sma5: extractValue(legendText, REGEX_PATTERNS.SMA5),
            sma20: extractValue(legendText, REGEX_PATTERNS.SMA20),
            sma60: extractValue(legendText, REGEX_PATTERNS.SMA60),
            sma120: extractValue(legendText, REGEX_PATTERNS.SMA120),
            sma240: extractValue(legendText, REGEX_PATTERNS.SMA240)
        };

        collectedData[currentDate] = dataPoint;

        // 3. Navigate to Previous Day
        const nextDate = await moveChartToPreviousDay(page, currentDate, stockCode);

        if (nextDate === currentDate) {
            console.log(`   ⚠️ [${stockCode}] Date did not change after ArrowLeft: ${currentDate}`);
        } else {
            consecutiveSameDateCount = 0;
        }

        previousDate = nextDate || currentDate;
    }

    return { data: collectedData, visitedDates };
}

async function getChartDate(page) {
    try {
        const dateText = await page.locator('.opsBtmTitleK').first().textContent({ timeout: 2000 });
        return dateText ? dateText.trim() : '';
    } catch (e) {
        return '';
    }
}

async function focusChart(page) {
    try {
        const focusEl = await page.$(FOCUS_SELECTOR);
        if (focusEl) {
            await focusEl.click({ force: true });
        } else {
            await page.click('body', { force: true });
        }
        await page.waitForTimeout(250);
        return true;
    } catch (e) {
        return false;
    }
}

async function moveChartToPreviousDay(page, currentDate, stockCode) {
    const attempts = 3;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            await page.keyboard.press('ArrowLeft');
            await page.waitForTimeout(250);

            const nextDate = await getChartDate(page);
            if (nextDate && nextDate !== currentDate) {
                return nextDate;
            }

            console.log(`   ⚠️ [${stockCode}] ArrowLeft attempt ${attempt}/${attempts} did not move date from ${currentDate}. Refocusing...`);
            await focusChart(page);
        } catch (e) {
            console.log(`   ⚠️ [${stockCode}] ArrowLeft attempt ${attempt}/${attempts} failed: ${e.message}`);
            await focusChart(page);
        }
    }

    return await getChartDate(page);
}

function isMissingMarketData(dataPoint) {
    return !dataPoint || ['price', 'open', 'high', 'low', 'volume'].some(key => dataPoint[key] == null);
}

function isDateKey(dateStr) {
    return /^\d{4}\/\d{2}\/\d{2}$/.test(dateStr);
}

function parseDateString(dateStr) {
    const [year, month, day] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
}

function formatDateKey(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
}

function nextDateString(dateStr) {
    const date = parseDateString(dateStr);
    date.setDate(date.getDate() + 1);
    return formatDateKey(date);
}

function isWeekend(dateStr) {
    const day = parseDateString(dateStr).getDay();
    return day === 0 || day === 6;
}

function isTrackedNonTradingYear(dateStr) {
    return parseInt(dateStr.substring(0, 4), 10) >= NON_TRADING_START_YEAR;
}

function filenameDateToKey(dateStr) {
    return `${dateStr.substring(0, 4)}/${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`;
}

function addCalendarDate(calendar, dateStr) {
    if (!isDateKey(dateStr) || !isTrackedNonTradingYear(dateStr) || isWeekend(dateStr)) return false;

    const year = dateStr.substring(0, 4);
    if (!calendar[year]) calendar[year] = [];
    if (calendar[year].includes(dateStr)) return false;

    calendar[year].push(dateStr);
    calendar[year].sort();
    return true;
}

function calendarToSet(calendar) {
    return new Set(Object.values(calendar).flat());
}

function loadTradingCalendar() {
    if (!fs.existsSync(TRADING_DAYS_FILE)) return {};

    try {
        return JSON.parse(fs.readFileSync(TRADING_DAYS_FILE, 'utf8'));
    } catch (e) {
        console.warn(`⚠️  Failed to read trading calendar: ${TRADING_DAYS_FILE}`);
        return {};
    }
}

function saveTradingCalendar(calendar) {
    saveCalendar(TRADING_DAYS_FILE, calendar);
}

function loadKnownDailySmaDates() {
    if (!fs.existsSync(DAILY_SMA_DIR)) return [];

    return fs.readdirSync(DAILY_SMA_DIR)
        .map(file => {
            const match = file.match(/^fubon_(\d{8})_sma\.json$/);
            return match ? filenameDateToKey(match[1]) : null;
        })
        .filter(Boolean)
        .sort();
}

function addKnownDailySmaDates(calendar) {
    loadKnownDailySmaDates().forEach(date => addCalendarDate(calendar, date));
}

function loadNonTradingCalendar() {
    if (!fs.existsSync(NON_TRADING_DAYS_FILE)) return {};

    try {
        return JSON.parse(fs.readFileSync(NON_TRADING_DAYS_FILE, 'utf8'));
    } catch (e) {
        console.warn(`⚠️  Failed to read non-trading calendar: ${NON_TRADING_DAYS_FILE}`);
        return {};
    }
}

function saveCalendar(filePath, calendar) {
    const normalized = {};
    Object.keys(calendar).sort().forEach(year => {
        normalized[year] = [...new Set(calendar[year])].sort();
    });
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
}

function saveNonTradingCalendar(calendar) {
    saveCalendar(NON_TRADING_DAYS_FILE, calendar);
}

function isKnownNonTradingDate(calendar, dateStr) {
    const year = dateStr.substring(0, 4);
    return Array.isArray(calendar[year]) && calendar[year].includes(dateStr);
}

function addNonTradingDate(calendar, dateStr) {
    return addCalendarDate(calendar, dateStr);
}

function getDatesBetweenExclusive(olderDate, newerDate) {
    const dates = [];
    let current = nextDateString(olderDate);
    while (current < newerDate) {
        dates.push(current);
        current = nextDateString(current);
    }
    return dates;
}

function learnTradingDaysFromTradingDates(calendar, tradingDates) {
    tradingDates
        .filter(isDateKey)
        .filter(isTrackedNonTradingYear)
        .forEach(date => addCalendarDate(calendar, date));
}

function learnNonTradingDaysFromTradingDates(calendar, tradingDates, tradingCalendar) {
    const dates = [...new Set(tradingDates.filter(isDateKey))]
        .sort();
    const tradingDatesSet = calendarToSet(tradingCalendar);

    for (let i = 1; i < dates.length; i++) {
        getDatesBetweenExclusive(dates[i - 1], dates[i]).forEach(date => {
            if (tradingDatesSet.has(date)) return;
            addNonTradingDate(calendar, date);
        });
    }
}

function getMissingDatesBetween(existingData, olderDate, newerDate, tradingCalendar, nonTradingCalendar) {
    const tradingDates = calendarToSet(tradingCalendar);
    return getDatesBetweenExclusive(olderDate, newerDate)
        .filter(isTrackedNonTradingYear)
        .filter(date => !isWeekend(date))
        .filter(date => !isKnownNonTradingDate(nonTradingCalendar, date))
        .filter(date => tradingDates.has(date) || !existingData[date]);
}

function getLatestKnownTradingDate(tradingCalendar) {
    return [...calendarToSet(tradingCalendar)].sort().reverse()[0] || formatDateKey(new Date());
}

function getCrawlPlan(existingData, fallbackStopDate, tradingCalendar, nonTradingCalendar) {
    const dates = Object.keys(existingData).sort();
    if (dates.length === 0) {
        return {
            shouldCrawl: true,
            stopDate: fallbackStopDate,
            reason: 'no existing data'
        };
    }

    const gaps = [];
    for (let i = dates.length - 1; i > 0; i--) {
        const newerDate = dates[i];
        const olderDate = dates[i - 1];
        const missingDates = getMissingDatesBetween(existingData, olderDate, newerDate, tradingCalendar, nonTradingCalendar);

        if (missingDates.length > 0) {
            gaps.push({ olderDate, newerDate, missingDates });
        }
    }

    if (gaps.length > 0) {
        const oldestGap = gaps[gaps.length - 1];
        const missingCount = gaps.reduce((sum, gap) => sum + gap.missingDates.length, 0);
        return {
            shouldCrawl: true,
            stopDate: isMissingMarketData(existingData[oldestGap.olderDate]) ? previousDateString(oldestGap.olderDate) : oldestGap.olderDate,
            reason: `missing ${missingCount} possible trading dates across ${gaps.length} gaps`
        };
    }

    const latestDate = dates[dates.length - 1];
    const latestKnownMarketDate = getLatestKnownTradingDate(tradingCalendar);
    const missingRecentDates = getMissingDatesBetween(existingData, latestDate, latestKnownMarketDate, tradingCalendar, nonTradingCalendar);

    if (latestDate < latestKnownMarketDate && missingRecentDates.length > 0) {
        return {
            shouldCrawl: true,
            stopDate: isMissingMarketData(existingData[latestDate]) ? previousDateString(latestDate) : latestDate,
            reason: `missing ${missingRecentDates.length} possible recent trading dates after ${latestDate}`
        };
    }

    return {
        shouldCrawl: false,
        stopDate: latestDate,
        reason: 'complete'
    };
}

function logCrawlPlan(stockCode, existingData, crawlPlan, tradingCalendar, nonTradingCalendar) {
    const dates = Object.keys(existingData).sort();
    const latestDate = dates[dates.length - 1] || '-';
    const oldestDate = dates[0] || '-';
    const tradingDates = calendarToSet(tradingCalendar);
    const nonTradingDates = calendarToSet(nonTradingCalendar);
    const gaps = [];

    for (let i = dates.length - 1; i > 0; i--) {
        const newerDate = dates[i];
        const olderDate = dates[i - 1];
        const missingDates = getMissingDatesBetween(existingData, olderDate, newerDate, tradingCalendar, nonTradingCalendar);
        if (missingDates.length > 0) {
            gaps.push({
                olderDate,
                newerDate,
                missingDates: missingDates.slice(0, 5),
                missingCount: missingDates.length
            });
        }
    }

    console.log(`   📋 [${stockCode}] Plan: latest=${latestDate}, oldest=${oldestDate}, stop=${crawlPlan.stopDate}, reason=${crawlPlan.reason}`);
    console.log(`   📋 [${stockCode}] Calendar: trading=${tradingDates.size}, nonTrading=${nonTradingDates.size}, gaps=${gaps.length}`);
    gaps.slice(0, 3).forEach((gap, idx) => {
        console.log(`   📋 [${stockCode}] Gap${idx + 1}: ${gap.olderDate} -> ${gap.newerDate}, missing=${gap.missingCount}, sample=${gap.missingDates.join(', ')}`);
    });
}

function previousDateString(dateStr) {
    const date = parseDateString(dateStr);
    date.setDate(date.getDate() - 1);
    return formatDateKey(date);
}

async function extractMarketData(page) {
    return page.evaluate(() => {
        const removeCommas = (str) => (typeof str === 'string' ? str.replace(/,/g, '') : str);
        const extractNumber = (text) => {
            const match = removeCommas(text || '').match(/\d+(\.\d+)?/);
            return match ? Number(match[0]) : null;
        };

        const data = {};
        const priceLegend = Array.from(document.querySelectorAll('.notehead .opsLegendK'))
            .find(el => {
                const notehead = el.closest('.notehead');
                return el.innerText.trim() === '股價' || (notehead && notehead.innerText.includes('股價'));
            });

        if (priceLegend) {
            const priceContainer = priceLegend.closest('.notehead');
            const priceSpan = priceContainer ? priceContainer.querySelector('.opsTopTitleK span') : null;
            data.price = extractNumber(priceSpan ? priceSpan.innerText.trim() : '');
        }

        const setField = (fieldName, selector, extractor) => {
            const el = document.querySelector(selector);
            data[fieldName] = el ? extractNumber(extractor ? extractor(el) : el.innerText.trim()) : null;
        };

        setField('open', '.opsLegendK-o span', el => el.innerText.trim());
        setField('high', '.opsLegendK-h span', el => el.innerText.trim());
        setField('low', '.opsLegendK-l span', el => el.innerText.trim());
        setField('volume', '.opsLegendK-v', el => el.innerText.trim());

        return data;
    });
}

function extractValue(text, regex) {
    const match = text.match(regex);
    if (match && match[1]) {
        return parseFloat(match[1].replace(/,/g, ''));
    }
    return null;
}
