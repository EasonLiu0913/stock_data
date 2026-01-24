const fs = require('fs');
const path = require('path');

// Configuration
const INSTITUTIONAL_DIR = path.join(__dirname, '../data_institutional');
const SMA_DIR = path.join(__dirname, '../data_history_sma');
const OUTPUT_DIR = path.join(__dirname, '../data_fubon');
const CSV_FILE = path.join(__dirname, '../data_twse/twse_industry.csv');
const START_DATE_STR = '2025/12/02';
const END_DATE_STR = '2026/01/22';

// Helper: Convert YYYY/MM/DD to Date object
function parseDate(dateStr) {
    // Format: YYYY/MM/DD or YYYY-MM-DD
    const parts = dateStr.split(/[\/-]/);
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const d = parseInt(parts[2]);
    return new Date(y, m, d);
}

// Helper: Format Date object to YYYYMMDD (filename)
function formatFilenameDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

// Helper: Format Date object to YYYY/MM/DD (SMA Key)
function formatADDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
}

// Helper: Format Date object to ROC YYY/MM/DD (Institutional Key)
function formatROCDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y - 1911}/${m}/${d}`;
}

// Generate array of dates between start and end (inclusive)
function getDatesInRange(startStr, endStr) {
    const start = parseDate(startStr);
    const end = parseDate(endStr);
    const list = [];
    const current = new Date(start);
    while (current <= end) {
        // Skip weekends? Stock market is closed.
        // But let's check if dayOfWeek is Sat(6) or Sun(0).
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
            list.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
    }
    return list;
}

(async () => {
    // 1. Read Stock List
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`CSV file not found: ${CSV_FILE}`);
        process.exit(1);
    }
    const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
    const lines = csvContent.trim().split('\n');
    const stockMap = new Map(); // Code -> Name

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 2) {
            stockMap.set(parts[0].trim(), parts[1].trim());
        }
    }
    console.log(`Loaded ${stockMap.size} stocks from CSV.`);

    // 2. Prepare Data Cache to avoid re-reading files constantly (Memory intensive?)
    // 1000 stocks * 2 small JSONs is fine in memory.
    const smaDataCache = new Map();
    const instDataCache = new Map();

    console.log('Loading source files...');
    for (const [code, name] of stockMap) {
        // Load SMA
        const smaFile = path.join(SMA_DIR, `${code}.json`);
        if (fs.existsSync(smaFile)) {
            try {
                smaDataCache.set(code, JSON.parse(fs.readFileSync(smaFile, 'utf8')));
            } catch (e) {
                // console.error(`Error reading SMA for ${code}: ${e.message}`);
            }
        }

        // Load Institutional
        const instFile = path.join(INSTITUTIONAL_DIR, `${code}.json`);
        if (fs.existsSync(instFile)) {
            try {
                instDataCache.set(code, JSON.parse(fs.readFileSync(instFile, 'utf8')));
            } catch (e) {
                // console.error(`Error reading Inst for ${code}: ${e.message}`);
            }
        }
    }
    console.log('Source files loaded.');

    // 3. Generate Daily Files
    const targetDates = getDatesInRange(START_DATE_STR, END_DATE_STR);
    console.log(`Generating files for ${targetDates.length} days (${START_DATE_STR} ~ ${END_DATE_STR})...`);

    for (const date of targetDates) {
        const dateFilename = formatFilenameDate(date); // YYYYMMDD
        const dateKeyAD = formatADDate(date); // YYYY/MM/DD
        const outputFile = path.join(OUTPUT_DIR, `fubon_${dateFilename}_stock_data.json`);

        const dailyResult = {};
        let stockCount = 0;

        for (const [code, name] of stockMap) {
            const smaAll = smaDataCache.get(code);
            const instAll = instDataCache.get(code);

            // If no SMA data for this specific date, likely no trading or data missing
            // Skip this stock for this day? Or include partial?
            // Existing logic usually needs SMA data as base.
            if (!smaAll || !smaAll[dateKeyAD]) {
                continue;
            }

            const smaDay = smaAll[dateKeyAD];

            // Prepare Institutional Data (History up to this date)
            // We want last ~30 entries up to dateKeyAD
            const foreignInv = {};
            const investTrust = {};
            const dealers = {};
            const dailyTotal = {};

            if (instAll) {
                // Filter keys <= dateKeyAD
                // Sort keys descending to get latest
                const sortedKeys = Object.keys(instAll).sort((a, b) => b.localeCompare(a));

                // Find index of current date or closest previous date?
                // Actually we just want history up to target date.
                // Since keys are YYYY/MM/DD, we can compare strings.

                const validKeys = sortedKeys.filter(k => k <= dateKeyAD);
                // Take top 30? Or match logic of scraper?
                // Scraper usually extracts what is on page (approx 30 days).
                // Let's take up to 30.
                const historyKeys = validKeys.slice(0, 30);

                historyKeys.forEach(k => {
                    const rocDate = formatROCDate(parseDate(k)); // Convert Key to ROC
                    const data = instAll[k];
                    if (data) {
                        foreignInv[rocDate] = data.ForeignInvestors;
                        investTrust[rocDate] = data.InvestmentTrust;
                        dealers[rocDate] = data.Dealers;
                        dailyTotal[rocDate] = data.DailyTotal;
                    }
                });
            }

            // Format numbers in SMA to string with 2 decimals if needed?
            // Existing file used string "25.92".
            const formatSMA = (val) => (typeof val === 'number' ? val.toFixed(2) : val);

            dailyResult[code] = {
                StockName: name,
                [dateKeyAD]: { // SMA Data
                    SMA5: formatSMA(smaDay.sma5),
                    SMA20: formatSMA(smaDay.sma20),
                    SMA60: formatSMA(smaDay.sma60),
                    SMA120: formatSMA(smaDay.sma120),
                    SMA240: formatSMA(smaDay.sma240)
                },
                ForeignInvestors: foreignInv,
                InvestmentTrust: investTrust,
                Dealers: dealers,
                DailyTotal: dailyTotal
            };
            stockCount++;
        }

        if (stockCount > 0) {
            fs.writeFileSync(outputFile, JSON.stringify(dailyResult, null, 2), 'utf8');
            console.log(`Saved ${outputFile} (${stockCount} stocks)`);
        } else {
            console.log(`Skipped ${dateFilename} (No Data)`);
        }
    }

    console.log('Done.');
})();
