const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const MAX_CONCURRENCY = 5; // Set concurrency to 5
const args = process.argv.slice(2);
function getArg(flag) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
}

const DEFAULT_TARGET_DATE_STR = '2025/11/02';
const argStart = getArg('--start');
const TARGET_DATE_STR = argStart || DEFAULT_TARGET_DATE_STR;
const OUTPUT_DIR = path.join(__dirname, '../data_history_sma');
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

    const browser = await chromium.launch({ headless: true });

    console.log(`🚀 Starting concurrent processing with ${MAX_CONCURRENCY} workers...`);

    // Worker Pool Implementation
    const queue = stocksToProcess.map((stock, idx) => ({
        stock,
        originalIndex: startIndex + idx
    }));
    const totalStocks = stocks.length;

    // Shared results stats (optional, mainly for logging)
    let processedCount = 0;

    async function processStock(page, task) {
        const { stock, originalIndex } = task;
        const currentProgress = originalIndex + 1;

        const outputFile = path.join(OUTPUT_DIR, `${stock.code}.json`);
        let existingData = {};
        let stopDate = TARGET_DATE_STR;

        if (fs.existsSync(outputFile)) {
            try {
                const content = fs.readFileSync(outputFile, 'utf8');
                existingData = JSON.parse(content);
                const dates = Object.keys(existingData).sort();
                if (dates.length > 0) {
                    stopDate = dates[dates.length - 1];
                    // console.log(`[${stock.code}] Existing data found. Latest: ${stopDate}.`);
                }
            } catch (e) {
                console.error(`[${stock.code}] Error reading existing file, starting fresh.`);
            }
        }

        // Check if we already have today's data
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}/${month}/${day}`;

        if (stopDate === todayStr) {
            console.log(`[${currentProgress}/${totalStocks}] [${stock.code}] Data up-to-date (${todayStr}). Skipping.`);
            return;
        }

        console.log(`[${currentProgress}/${totalStocks}] [${stock.code}] Starting crawl (Until ${stopDate})...`);

        try {
            const newData = await crawlStock(page, stock.code, stopDate);

            // Merge data
            const mergedData = { ...existingData, ...newData };

            // Sort data by date (ascending)
            const sortedData = {};
            Object.keys(mergedData).sort().forEach(date => {
                sortedData[date] = mergedData[date];
            });

            // Save if we got new data or if it's a fresh file
            if (Object.keys(newData).length > 0) {
                fs.writeFileSync(outputFile, JSON.stringify(sortedData, null, 2), 'utf8');
                console.log(`   ✅ [${stock.code}] Saved. New: ${Object.keys(newData).length}, Total: ${Object.keys(sortedData).length}.`);
            } else {
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
            // Create a new context/page per worker
            // Reuse page for efficiency, but maybe recreate context every N stocks if memory leaks (not implementing complex recycle now)
            const context = await browser.newContext();
            const page = await context.newPage();

            // Stagger start slightly
            await page.waitForTimeout(i * 300);

            while (queue.length > 0) {
                const task = queue.shift();
                if (task) {
                    await processStock(page, task);

                    // Random delay between stocks per worker
                    const delay = Math.floor(Math.random() * 500) + 500;
                    await page.waitForTimeout(delay);
                }
            }
            await context.close();
        })());
    }

    await Promise.all(workers);
    await browser.close();
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
            sma5: extractValue(legendText, REGEX_PATTERNS.SMA5),
            sma20: extractValue(legendText, REGEX_PATTERNS.SMA20),
            sma60: extractValue(legendText, REGEX_PATTERNS.SMA60),
            sma120: extractValue(legendText, REGEX_PATTERNS.SMA120),
            sma240: extractValue(legendText, REGEX_PATTERNS.SMA240)
        };

        collectedData[currentDate] = dataPoint;

        // 3. Navigate to Previous Day
        await page.keyboard.press('ArrowLeft');
        // Wait a bit for update. 
        // 100ms is usually enough for JS update if network not involved for data points (canvas redraw)
        // If it sends network request content, need more. Fubon usually has data loaded.
        await page.waitForTimeout(150);
    }

    return collectedData;
}

function extractValue(text, regex) {
    const match = text.match(regex);
    if (match && match[1]) {
        return parseFloat(match[1].replace(/,/g, ''));
    }
    return null;
}
