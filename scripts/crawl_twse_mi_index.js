const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX';
const OUTPUT_DIR = path.join(__dirname, '../data_twse_mi_index');
const RATE_LIMIT_STATUS_CODES = new Set([307, 429, 503]);
const DEFAULT_MIN_DELAY_MS = 3000;
const DEFAULT_MAX_DELAY_MS = 5000;
const DEFAULT_MISMATCH_COOLDOWN_MS = 90000;
const args = process.argv.slice(2);

function getArg(flag) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
}

function getPositionalDate() {
    const flagsWithValue = new Set(['--date', '--type']);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (flagsWithValue.has(arg)) {
            i++;
            continue;
        }
        if (/^\d{8}$/.test(arg)) return arg;
    }
    return '';
}

function normalizeDateInput(value) {
    if (!value) return '';
    const normalized = String(value).replace(/[/-]/g, '');
    if (!/^\d{8}$/.test(normalized)) {
        throw new Error(`Invalid date: ${value}. Expected YYYYMMDD, YYYY-MM-DD, or YYYY/MM/DD.`);
    }
    return normalized;
}

function getNumberArg(flag, fallback) {
    const value = getArg(flag);
    if (value == null) return fallback;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
        throw new Error(`Invalid ${flag}: ${value}`);
    }
    return number;
}

function getTaipeiTodayCompact() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(new Date()).map(part => [part.type, part.value])
    );
    return `${parts.year}${parts.month}${parts.day}`;
}

function refreshFilesJson() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(file => /^\d{8}_twse_mi_index\.json$/.test(file))
        .sort();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

function validatePayload(payload) {
    if (payload.stat !== 'OK') {
        throw new Error(`TWSE response stat is not OK: ${payload.stat || '(empty)'}`);
    }

    if (!payload.date || !/^\d{8}$/.test(payload.date)) {
        throw new Error(`TWSE response has invalid date: ${payload.date || '(empty)'}`);
    }

    if (!Array.isArray(payload.tables)) {
        throw new Error('TWSE response missing array field: tables');
    }

    const dataTables = payload.tables.filter(table => table && Object.keys(table).length > 0);
    if (dataTables.length === 0) {
        throw new Error('TWSE response has no data tables');
    }

    for (const [idx, table] of dataTables.entries()) {
        if (!table || typeof table !== 'object') {
            throw new Error(`TWSE response has invalid table at index ${idx}`);
        }
        if (!Array.isArray(table.fields)) {
            throw new Error(`TWSE response table ${idx} missing array field: fields`);
        }
        if (!Array.isArray(table.data)) {
            throw new Error(`TWSE response table ${idx} missing array field: data`);
        }
    }
}

async function fetchTwseMiIndexOnce(dateStr, type = 'ALL') {
    const params = new URLSearchParams({
        date: dateStr,
        type,
        response: 'json',
        _: String(Date.now())
    });
    const url = `${API_URL}?${params.toString()}`;
    const response = await fetch(url, {
        headers: {
            accept: 'application/json, text/plain, */*',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const location = response.headers.get('location');
        const error = new Error(`TWSE request failed: ${response.status} ${response.statusText}${location ? ` (${location})` : ''}`);
        error.status = response.status;
        throw error;
    }

    const payload = await response.json();
    validatePayload(payload);
    return payload;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
    if (maxMs <= minMs) return minMs;
    return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

async function fetchTwseMiIndex(dateStr, type) {
    const maxRetries = getNumberArg('--max-retries', 3);
    const rateLimitCooldownMs = getNumberArg('--rate-limit-cooldown', 90000);
    let attempt = 0;

    while (true) {
        try {
            return await fetchTwseMiIndexOnce(dateStr, type);
        } catch (error) {
            attempt++;
            const shouldRetry = RATE_LIMIT_STATUS_CODES.has(error.status) && attempt <= maxRetries;
            if (!shouldRetry) throw error;

            const cooldown = rateLimitCooldownMs * attempt;
            console.log(`🕒 Got ${error.status}; cooling down ${Math.round(cooldown / 1000)}s before retry ${attempt}/${maxRetries}`);
            await sleep(cooldown);
        }
    }
}

(async () => {
    try {
        const targetDate = normalizeDateInput(getArg('--date') || getPositionalDate()) || getTaipeiTodayCompact();
        const type = getArg('--type') || 'ALL';
        const maxRetries = getNumberArg('--max-retries', 3);
        const minDelayMs = getNumberArg('--min-delay', DEFAULT_MIN_DELAY_MS);
        const maxDelayMs = getNumberArg('--max-delay', DEFAULT_MAX_DELAY_MS);
        const mismatchCooldownMs = getNumberArg('--mismatch-cooldown', DEFAULT_MISMATCH_COOLDOWN_MS);
        let payload = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            payload = await fetchTwseMiIndex(targetDate, type);
            if (payload.date === targetDate) break;

            if (attempt >= maxRetries) {
                throw new Error(`TWSE returned ${payload.date} for requested ${targetDate} after ${attempt + 1} attempts`);
            }

            const retryDelay = attempt === 0
                ? randomDelay(minDelayMs, maxDelayMs)
                : mismatchCooldownMs * attempt;
            console.log(`🕒 Requested ${targetDate} but got ${payload.date}; waiting ${Math.round(retryDelay / 1000)}s before mismatch retry ${attempt + 1}/${maxRetries}`);
            await sleep(retryDelay);
        }

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        const outputFile = `${payload.date}_twse_mi_index.json`;
        const outputPath = path.join(OUTPUT_DIR, outputFile);
        fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
        refreshFilesJson();

        const dataTables = payload.tables.filter(table => table && Array.isArray(table.data));
        const totalRows = dataTables.reduce((sum, table) => sum + table.data.length, 0);
        console.log(`✅ Saved TWSE MI_INDEX ${payload.date}`);
        console.log(`📁 ${outputPath}`);
        console.log(`📊 Tables: ${dataTables.length}, Rows: ${totalRows}`);
    } catch (error) {
        console.error(`❌ Failed to crawl TWSE MI_INDEX data: ${error.message}`);
        process.exit(1);
    }
})();
