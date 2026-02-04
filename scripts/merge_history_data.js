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

        const smaOutputFile = path.join(OUTPUT_DIR, `fubon_${dateFilename}_sma.json`);
        const instOutputFile = path.join(OUTPUT_DIR, `fubon_${dateFilename}_institutional.json`);

        const dailySmaResult = {};
        const dailyInstResult = {};

        let smaCount = 0;
        let instCount = 0;

        for (const [code, name] of stockMap) {
            const smaAll = smaDataCache.get(code);
            const instAll = instDataCache.get(code);

            // --- 處理 SMA 資料 ---
            if (smaAll && smaAll[dateKeyAD]) {
                const smaDay = smaAll[dateKeyAD];
                const formatSMA = (val) => (typeof val === 'number' ? val.toFixed(2) : val);

                dailySmaResult[code] = {
                    StockName: name,
                    [dateKeyAD]: {
                        SMA5: formatSMA(smaDay.sma5),
                        SMA20: formatSMA(smaDay.sma20),
                        SMA60: formatSMA(smaDay.sma60),
                        SMA120: formatSMA(smaDay.sma120),
                        SMA240: formatSMA(smaDay.sma240)
                    }
                };
                smaCount++;
            }

            // --- 處理 Institutional 資料 ---
            // Institutional data usually has history, but we want the snapshot "as of" this date
            // The scraper extracts ~30 days relative to the query date.
            // For backfill, we can reconstruct the object with key "ForeignInvestors", "InvestmentTrust", etc.
            // containing dates UP TO dateKeyAD.

            // Only generate if we have data for this stock at all?
            // Or if we specifically have data for this date?
            // The frontend displays historical table, so we need the history object.

            if (instAll) {
                const foreignInv = {};
                const investTrust = {};
                const dealers = {};
                const dailyTotal = {};

                const sortedKeys = Object.keys(instAll).sort((a, b) => b.localeCompare(a));
                const validKeys = sortedKeys.filter(k => k <= dateKeyAD);

                // If no data up to this date, skip this stock for institutional file
                if (validKeys.length > 0) {
                    // Take top 30
                    const historyKeys = validKeys.slice(0, 30);

                    historyKeys.forEach(k => {
                        const rocDate = formatROCDate(parseDate(k));
                        const data = instAll[k];
                        if (data) {
                            foreignInv[rocDate] = data.ForeignInvestors;
                            investTrust[rocDate] = data.InvestmentTrust;
                            dealers[rocDate] = data.Dealers;
                            dailyTotal[rocDate] = data.DailyTotal;
                        }
                    });

                    dailyInstResult[code] = {
                        StockName: name,
                        ForeignInvestors: foreignInv,
                        InvestmentTrust: investTrust,
                        Dealers: dealers,
                        DailyTotal: dailyTotal
                    };
                    instCount++;
                }
            }
        }

        if (smaCount > 0) {
            fs.writeFileSync(smaOutputFile, JSON.stringify(dailySmaResult, null, 2), 'utf8');
            console.log(`Saved ${smaOutputFile} (${smaCount} stocks)`);
        }

        if (instCount > 0) {
            fs.writeFileSync(instOutputFile, JSON.stringify(dailyInstResult, null, 2), 'utf8');
            console.log(`Saved ${instOutputFile} (${instCount} stocks)`);
        }

        if (smaCount === 0 && instCount === 0) {
            console.log(`Skipped ${dateFilename} (No Data)`);
        }
    }

    console.log('Done.');
})();
