const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.tpex.org.tw/www/zh-tw/ETFReport/monthly';
const OUTPUT_DIR = path.join(__dirname, '../data_tpex_etf_list');
const OUTPUT_SUFFIX = 'tpex_etf_list';
const args = process.argv.slice(2);

function getArg(flag) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
}

function normalizeMonth(value) {
    const normalized = String(value || '').replace(/[^\d]/g, '');
    if (!/^\d{6}$/.test(normalized)) {
        throw new Error(`Invalid month: ${value || '(empty)'}. Expected YYYYMM, YYYY-MM, or YYYY/MM.`);
    }
    return normalized;
}

function toApiDate(compactMonth) {
    return `${compactMonth.slice(0, 4)}/${compactMonth.slice(4, 6)}/01`;
}

function extractEtfList(payload, expectedMonth) {
    if (!payload || payload.stat !== 'ok') {
        throw new Error(`TPEx ETF monthly report failed: ${payload?.stat || 'invalid response'}`);
    }

    if (!String(payload.date || '').startsWith(expectedMonth)) {
        throw new Error(`TPEx returned ${payload.date || '(no date)'} for requested month ${expectedMonth}.`);
    }

    const table = payload.tables?.[0];
    if (!table || !Array.isArray(table.fields) || !Array.isArray(table.data)) {
        throw new Error('TPEx ETF monthly report is missing its table data.');
    }

    const codeIndex = table.fields.indexOf('證券代號');
    const nameIndex = table.fields.indexOf('證券名稱');
    if (codeIndex === -1 || nameIndex === -1) {
        throw new Error('TPEx ETF monthly report is missing the security code or name field.');
    }

    const etfs = table.data
        .map(row => ({
            code: String(row[codeIndex] || '').trim(),
            name: String(row[nameIndex] || '').trim()
        }))
        .filter(etf => etf.code && etf.name)
        .sort((a, b) => a.code.localeCompare(b.code));

    if (etfs.length === 0) {
        throw new Error(`TPEx ETF monthly report contains no ETF rows for ${expectedMonth}. The month may not be published yet.`);
    }

    return etfs;
}

function refreshFilesJson() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(file => new RegExp(`^\\d{6}_${OUTPUT_SUFFIX}\\.json$`).test(file))
        .sort();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

async function fetchEtfReport(compactMonth) {
    const body = new URLSearchParams({
        date: toApiDate(compactMonth),
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
        throw new Error(`TPEx ETF monthly report request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`TPEx ETF monthly report response was not JSON: ${error.message}: ${text.slice(0, 200)}`);
    }
}

(async () => {
    try {
        const targetMonth = normalizeMonth(getArg('--month'));
        const payload = await fetchEtfReport(targetMonth);
        const etfs = extractEtfList(payload, targetMonth);

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        const outputFile = `${targetMonth}_${OUTPUT_SUFFIX}.json`;
        const outputPath = path.join(OUTPUT_DIR, outputFile);
        fs.writeFileSync(outputPath, JSON.stringify({
            month: targetMonth,
            sourceDate: payload.date,
            source: API_URL,
            count: etfs.length,
            etfs
        }, null, 2), 'utf8');
        refreshFilesJson();

        console.log(`Saved ${outputFile}`);
        console.log(`Path: ${outputPath}`);
        console.log(`ETFs: ${etfs.length}`);
    } catch (error) {
        console.error(`Failed to crawl TPEx ETF list: ${error.message}`);
        process.exit(1);
    }
})();
