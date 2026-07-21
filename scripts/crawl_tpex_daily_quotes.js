const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes';
const OUTPUT_DIR = path.join(__dirname, '../data_tpex_daily_quotes');
const OUTPUT_SUFFIX = 'tpex_daily_quotes';
const args = process.argv.slice(2);

function getArg(flag) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
}

function normalizeDate(value) {
    const normalized = String(value || '').replace(/[^\d]/g, '');
    if (!/^\d{8}$/.test(normalized)) {
        throw new Error(`Invalid date: ${value || '(empty)'}. Expected YYYYMMDD, YYYY-MM-DD, or YYYY/MM/DD.`);
    }
    return normalized;
}

function toApiDate(compactDate) {
    return `${compactDate.slice(0, 4)}/${compactDate.slice(4, 6)}/${compactDate.slice(6, 8)}`;
}

function validatePayload(payload, expectedDate) {
    if (!payload || payload.stat !== 'ok') {
        throw new Error(`TPEx daily quotes request failed: ${payload?.stat || 'invalid response'}`);
    }

    if (payload.date !== expectedDate) {
        throw new Error(`TPEx returned ${payload.date || '(no date)'} for requested ${expectedDate}.`);
    }

    const table = payload.tables?.find(item => item.title === '上櫃股票行情');
    if (!table || !Array.isArray(table.fields) || !Array.isArray(table.data)) {
        throw new Error('TPEx daily quotes response is missing the mainboard quote table.');
    }

    const requiredFields = ['代號', '名稱', '收盤'];
    for (const field of requiredFields) {
        if (!table.fields.includes(field)) {
            throw new Error(`TPEx daily quotes response is missing field: ${field}`);
        }
    }

    if (table.data.length === 0) {
        throw new Error(`TPEx daily quotes response contains no rows for ${expectedDate}.`);
    }

    return table.data.length;
}

function refreshFilesJson() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(file => new RegExp(`^\\d{8}_${OUTPUT_SUFFIX}\\.json$`).test(file))
        .sort();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

async function fetchDailyQuotes(compactDate) {
    const body = new URLSearchParams({
        date: toApiDate(compactDate),
        id: '',
        response: 'json'
    });

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            accept: 'application/json,*/*',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        body
    });

    if (!response.ok) {
        throw new Error(`TPEx daily quotes request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`TPEx daily quotes response was not JSON: ${error.message}: ${text.slice(0, 200)}`);
    }
}

(async () => {
    try {
        const targetDate = normalizeDate(getArg('--date'));
        const payload = await fetchDailyQuotes(targetDate);
        const rowCount = validatePayload(payload, targetDate);

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        const outputFile = `${targetDate}_${OUTPUT_SUFFIX}.json`;
        const outputPath = path.join(OUTPUT_DIR, outputFile);
        fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
        refreshFilesJson();

        console.log(`Saved ${outputFile}`);
        console.log(`Path: ${outputPath}`);
        console.log(`Rows: ${rowCount}`);
    } catch (error) {
        console.error(`Failed to crawl TPEx daily quotes: ${error.message}`);
        process.exit(1);
    }
})();
