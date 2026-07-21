const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.twse.com.tw/exchangeReport/MI_MARGN?response=open_data&selectType=ALL';
const OUTPUT_DIR = path.join(__dirname, '../data_twse_margin_balance');
const OUTPUT_SUFFIX = 'twse_margin_balance';
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

function getDateFromContentDisposition(value) {
    const match = String(value || '').match(/MI_MARGN_ALL_(\d{8})\.csv/i);
    return match ? match[1] : '';
}

function validateCsv(csvText) {
    const lines = csvText
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        throw new Error('TWSE margin balance CSV does not contain any data rows.');
    }

    const requiredHeaders = ['股票代號', '股票名稱', '融資今日餘額', '融券今日餘額'];
    for (const header of requiredHeaders) {
        if (!lines[0].includes(header)) {
            throw new Error(`TWSE margin balance CSV missing header: ${header}`);
        }
    }

    return lines.length - 1;
}

function refreshFilesJson() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(file => new RegExp(`^\\d{8}_${OUTPUT_SUFFIX}\\.csv$`).test(file))
        .sort();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

async function fetchCsv(expectedDate = '') {
    const url = expectedDate ? `${API_URL}&date=${expectedDate}` : API_URL;
    const response = await fetch(url, {
        headers: {
            accept: 'text/csv,*/*',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`TWSE margin balance request failed: ${response.status} ${response.statusText}`);
    }

    const payloadDate = getDateFromContentDisposition(response.headers.get('content-disposition'));
    if (!payloadDate) {
        throw new Error('TWSE margin balance response filename did not include a YYYYMMDD date.');
    }

    return {
        date: payloadDate,
        text: await response.text()
    };
}

(async () => {
    try {
        const expectedDate = normalizeDate(getArg('--date'));
        const payload = await fetchCsv(expectedDate);
        const rowCount = validateCsv(payload.text);

        if (expectedDate && payload.date !== expectedDate) {
            throw new Error(`TWSE returned ${payload.date} for requested ${expectedDate}. This open-data URL only returns the latest available file.`);
        }

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        const outputFile = `${payload.date}_${OUTPUT_SUFFIX}.csv`;
        const outputPath = path.join(OUTPUT_DIR, outputFile);
        fs.writeFileSync(outputPath, payload.text, 'utf8');
        refreshFilesJson();

        console.log(`Saved ${outputFile}`);
        console.log(`Path: ${outputPath}`);
        console.log(`Rows: ${rowCount}`);
    } catch (error) {
        console.error(`Failed to crawl TWSE margin balance data: ${error.message}`);
        process.exit(1);
    }
})();
