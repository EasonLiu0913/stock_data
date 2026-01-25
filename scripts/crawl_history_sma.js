const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
// Configuration
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
    // Simple CSV parsing assuming no commas in fields
    const lines = fileContent.trim().split('\n');
    const headers = lines[0].split(',');
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

    const browser = await chromium.launch({ headless: true });

    // Process each stock
    // You can implement batching here using process.argv if needed
    for (let i = 0; i < stocks.length; i++) {
        const stock = stocks[i];
        const currentProgress = i + 1;
        const totalStocks = stocks.length;

        const outputFile = path.join(OUTPUT_DIR, `${stock.code}.json`);
        let existingData = {};
        let stopDate = TARGET_DATE_STR;

        if (fs.existsSync(outputFile)) {
            try {
                const content = fs.readFileSync(outputFile, 'utf8');
                existingData = JSON.parse(content);
                const dates = Object.keys(existingData).sort();
                if (dates.length > 0) {
                    // Start from the latest date found (reverse sorted usually, or just end of sort)
                    // standard sort "2026/01/01", "2026/01/02" -> "2026/01/02" is last
                    stopDate = dates[dates.length - 1];
                    console.log(`[${stock.code}] Found existing data. Latest date: ${stopDate}. Updating from there.`);
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
            continue;
        }

        console.log(`\n[${currentProgress}/${totalStocks}] [${stock.code}] Starting crawl (Until ${stopDate})...`);
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            const newData = await crawlStock(page, stock.code, stopDate);

            // Merge data
            // newData keys overwrite existingData keys (if overlap)
            // But usually newData are newer dates.
            const mergedData = { ...existingData, ...newData };

            // Save if we got new data or if it's a fresh file
            if (Object.keys(newData).length > 0) {
                fs.writeFileSync(outputFile, JSON.stringify(mergedData, null, 2), 'utf8');
                console.log(`[${stock.code}] Saved. New records: ${Object.keys(newData).length}, Total: ${Object.keys(mergedData).length}.`);
            } else {
                console.log(`[${stock.code}] No new data found.`);
            }

        } catch (error) {
            console.error(`[${stock.code}] Error crawling:`, error.message);
        } finally {
            await context.close();
        }

        // Small delay between stocks to be nice
        await new Promise(r => setTimeout(r, 1000));
    }

    await browser.close();
})();

async function crawlStock(page, stockCode, stopDate) {
    const url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcw/zcw1_${stockCode}.djhtm`;
    // console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for chart date element
    // Some stocks might not have data or load differently, add timeout
    try {
        await page.waitForSelector('.opsBtmTitleK', { timeout: 10000 });
    } catch (e) {
        throw new Error('Chart did not load or selector not found');
    }

    const collectedData = {};
    let previousDate = '';
    let consecutiveSameDateCount = 0;

    // console.log(`Getting initial focus on chart...`);

    // Initial Click to focus + Tab x4 + ArrowLeft (First backward step)
    try {
        await page.click(FOCUS_SELECTOR);
        await page.waitForTimeout(500);

        // Perform initial Tab navigation
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(200);
        }
    } catch (e) {
        console.error(`Error initial focus interaction: ${e.message}`);
        // Continue anyway, maybe it works?
    }

    while (true) {
        // 1. Extract Date
        const dateText = await page.innerText('.opsBtmTitleK');
        const currentDate = dateText.trim();

        // console.log(`Processing Date: ${currentDate}`);

        // Safety check: duplicate date (end of data or navigation fail)
        if (currentDate === previousDate) {
            consecutiveSameDateCount++;
            if (consecutiveSameDateCount >= 3) {
                // console.log('Date has not changed for 3 iterations. Stopping.');
                break;
            }
        } else {
            consecutiveSameDateCount = 0;
        }
        previousDate = currentDate;

        // Stop condition: Date < stopDate
        // We want to stop when we reach data older than (or equal to? No, strictly older so we cover everything up to limit)
        // If stopDate is 2025/12/02, and we see 2025/12/03, we keep going.
        // If we see 2025/12/02, we process it? The user said "crawling date range to the latest date" (inclusive?).
        // If existing latest is 12/05, and we see 12/05, do we re-crawl?
        // User: "crawling date range just to the latest date"
        // Safest is to duplicate the overlap day or just stop when < stopDate.
        // If stopDate is the last captured date, we should probably stop if <= stopDate?
        // If file has 12/05. We crawl 12/06. Next is 12/05. we stop.
        // So `if (currentDate <= stopDate) break;`
        // But user asked to *include* default target date 12/02.
        // If stopDate is a previous crawl max date (e.g. 12/05), we can stop at 12/05 (since we have it).
        // So `currentDate <= stopDate` is appropriate for incremental update.
        // For default target (12/02), user wanted *until* 12/02 (inclusive), so condition was `<`.
        // To support both, I will use `<=` generally, but for default target I'll pass `2025/12/01` as limit?
        // Or just use `<` logic and set stopDate appropriately.
        // Let's stick to `<` check so we *include* the stopDate in the new data if standard logic applies.
        // Wait, if I have 12/05, I don't need to re-crawl 12/05. So checking `<= 12/05` breaks immediately. Correct.
        // If stopDate = TARGET_DATE_STR (12/02) and I want to Include 12/02.
        // Then logic `currentDate < stopDate` works (stops at 12/01).
        // So if incremental, I pass `latestDate` and use `<=`.
        // If fresh, I pass `TARGET_DATE_STR` and use `<`.
        // This is complex. Let's simplify.
        // I will use `<` logic.
        // If incremental: `stopDate` = `latestDate`. If `currentDate == latestDate` (12/05), `12/05 < 12/05` is False. We process 12/05. We store 12/05 again (overlap). This is fine (overwrite).
        // Then next is 12/04. `12/04 < 12/05` is True. We break.
        // Result: We re-crawled 12/05 and everything new. This is safe.
        // If fresh: `stopDate` = `TARGET_DATE_STR` (12/02). We process 12/02. Next 12/01 < 12/02 Break.
        // This logic works for both!

        if (currentDate <= stopDate) {
            // console.log(`Reached stop date ${stopDate}. Stopping.`);
            break;
        }

        // 2. Extract SMA Values from Legend
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
        // Interaction: ArrowLeft (after initial setup)
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(200); // Reduced timeout for speed, adjust if flaky
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
