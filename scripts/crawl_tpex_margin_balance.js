const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.tpex.org.tw/www/zh-tw/margin/balance';
const OUTPUT_DIR = path.join(__dirname, '../data_tpex_margin_balance');
const OUTPUT_SUFFIX = 'tpex_margin_balance';
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
        throw new Error(`TPEx margin balance request failed: ${payload?.stat || 'invalid response'}`);
    }

    if (payload.date !== expectedDate) {
        throw new Error(`TPEx returned ${payload?.date || '(no date)'} for requested ${expectedDate}.`);
    }

    const table = payload.tables?.[0];
    if (!table || !Array.isArray(table.fields) || !Array.isArray(table.data)) {
        throw new Error('TPEx margin balance response is missing its table data.');
    }

    const requiredFields = ['代號', '名稱', '資餘額'];
    for (const field of requiredFields) {
        if (!table.fields.includes(field)) {
            throw new Error(`TPEx margin balance response is missing field: ${field}`);
        }
    }

    if (table.data.length === 0) {
        throw new Error(`TPEx margin balance response contains no rows for ${expectedDate}.`);
    }

    const financingAmountRow = table.summary?.find(row => row[1] === '融資金(仟元)');
    const financingAmountThousand = Number(String(financingAmountRow?.[6] || '').replaceAll(',', ''));
    if (!Number.isFinite(financingAmountThousand)) {
        throw new Error('TPEx margin balance response is missing the current financing amount summary.');
    }

    return {
        rowCount: table.data.length,
        financingAmountThousand
    };
}

function refreshFilesJson() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(file => new RegExp(`^\\d{8}_${OUTPUT_SUFFIX}\\.json$`).test(file))
        .sort();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

async function fetchMarginBalance(compactDate) {
    const body = new URLSearchParams({
        date: toApiDate(compactDate),
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
        throw new Error(`TPEx margin balance request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`TPEx margin balance response was not JSON: ${error.message}: ${text.slice(0, 200)}`);
    }
}

(async () => {
    try {
        const targetDate = normalizeDate(getArg('--date'));
        const payload = await fetchMarginBalance(targetDate);
        const { rowCount, financingAmountThousand } = validatePayload(payload, targetDate);

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        const outputFile = `${targetDate}_${OUTPUT_SUFFIX}.json`;
        const outputPath = path.join(OUTPUT_DIR, outputFile);
        fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
        refreshFilesJson();

        console.log(`Saved ${outputFile}`);
        console.log(`Path: ${outputPath}`);
        console.log(`Rows: ${rowCount}`);
        console.log(`Financing amount: ${financingAmountThousand.toLocaleString('en-US')} thousand TWD`);
    } catch (error) {
        console.error(`Failed to crawl TPEx margin balance data: ${error.message}`);
        process.exit(1);
    }
})();
