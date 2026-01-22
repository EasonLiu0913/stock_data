const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const TARGET_DATE_STR = '2025/12/02';
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
    for (const stock of stocks) {
        const outputFile = path.join(OUTPUT_DIR, `${stock.code}.json`);

        // Skip if already exists (resume capability)
        if (fs.existsSync(outputFile)) {
            console.log(`[${stock.code}] Data already exists, skipping.`);
            continue;
        }

        console.log(`\n[${stock.code}] Starting crawl...`);
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            await crawlStock(page, stock.code, outputFile);
        } catch (error) {
            console.error(`[${stock.code}] Error crawling:`, error.message);
            // Delete partial file if it exists to avoid corruption?
            // Actually crawlStock saves at the end, so no partial file.
        } finally {
            await context.close();
        }

        // Small delay between stocks to be nice
        await new Promise(r => setTimeout(r, 1000));
    }

    await browser.close();
})();

async function crawlStock(page, stockCode, outputFile) {
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

    const collectedData = [];
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

        // Stop condition: Date <= TARGET_DATE
        if (currentDate <= TARGET_DATE_STR) {
            // console.log(`Reached target date ${TARGET_DATE_STR}. Stopping.`);
            break;
        }

        // 2. Extract SMA Values from Legend
        const legendContainer = await page.$('#SysJustIFRAMEDIV');
        let legendText = '';
        if (legendContainer) {
            legendText = await legendContainer.innerText();
        }

        const dataPoint = {
            date: currentDate,
            sma5: extractValue(legendText, REGEX_PATTERNS.SMA5),
            sma20: extractValue(legendText, REGEX_PATTERNS.SMA20),
            sma60: extractValue(legendText, REGEX_PATTERNS.SMA60),
            sma120: extractValue(legendText, REGEX_PATTERNS.SMA120),
            sma240: extractValue(legendText, REGEX_PATTERNS.SMA240)
        };

        collectedData.push(dataPoint);

        // 3. Navigate to Previous Day
        // Interaction: ArrowLeft (after initial setup)
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(200); // Reduced timeout for speed, adjust if flaky
    }

    if (collectedData.length > 0) {
        fs.writeFileSync(outputFile, JSON.stringify(collectedData, null, 2), 'utf8');
        console.log(`[${stockCode}] Saved ${collectedData.length} records.`);
    } else {
        console.log(`[${stockCode}] No data collected.`);
    }
}

function extractValue(text, regex) {
    const match = text.match(regex);
    if (match && match[1]) {
        return parseFloat(match[1].replace(/,/g, ''));
    }
    return null;
}
