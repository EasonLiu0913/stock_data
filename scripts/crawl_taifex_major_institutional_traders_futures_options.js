const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.taifex.com.tw/data_gov/taifex_open_data.asp?data_name=MarketDataOfMajorInstitutionalTradersDividedByFuturesAndOptionsBytheDate';
const OUTPUT_DIR = path.join(__dirname, '../data_taifex_major_institutional_traders_futures_options');
const OUTPUT_SUFFIX = 'taifex_major_institutional_traders_futures_options';
const args = process.argv.slice(2);

function getArg(flag) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
}

function normalizeDate(value) {
    if (!value) return '';
    const normalized = String(value).replace(/[^\d]/g, '');
    if (!/^\d{8}$/.test(normalized)) {
        throw new Error(`Invalid date: ${value}. Expected YYYYMMDD, YYYY-MM-DD, or YYYY/MM/DD.`);
    }
    return normalized;
}

function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"' && inQuotes && next === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            cells.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    cells.push(current);
    return cells;
}

function getPayloadDate(csvText) {
    const lines = csvText
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        throw new Error('TAIFEX CSV does not contain any data rows.');
    }

    const firstDataRow = parseCsvLine(lines[1]);
    return normalizeDate(firstDataRow[0]);
}

function refreshFilesJson() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(file => new RegExp(`^\\d{8}_${OUTPUT_SUFFIX}\\.csv$`).test(file))
        .sort();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

async function fetchCsv() {
    const response = await fetch(API_URL, {
        headers: {
            accept: 'text/csv,application/octet-stream,*/*',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`TAIFEX request failed: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('utf8');
}

(async () => {
    try {
        const expectedDate = normalizeDate(getArg('--date'));
        const csvText = await fetchCsv();
        const payloadDate = getPayloadDate(csvText);

        if (expectedDate && payloadDate !== expectedDate) {
            throw new Error(`TAIFEX returned ${payloadDate} for requested ${expectedDate}. This open-data URL only returns the latest available file.`);
        }

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        const outputFile = `${payloadDate}_${OUTPUT_SUFFIX}.csv`;
        const outputPath = path.join(OUTPUT_DIR, outputFile);
        fs.writeFileSync(outputPath, csvText, 'utf8');
        refreshFilesJson();

        const rowCount = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).length - 1;
        console.log(`Saved ${outputFile}`);
        console.log(`Path: ${outputPath}`);
        console.log(`Rows: ${rowCount}`);
    } catch (error) {
        console.error(`Failed to crawl TAIFEX futures/options institutional trader data: ${error.message}`);
        process.exit(1);
    }
})();
