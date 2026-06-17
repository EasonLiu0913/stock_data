const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.twse.com.tw/rwd/zh/fund/TWT43U';
const OUTPUT_DIR = path.join(__dirname, '../data_twse_dealers');
const TRADING_DAYS_FILE = path.join(__dirname, '../data_history_sma/trading_days.json');
const NON_TRADING_DAYS_FILE = path.join(__dirname, '../data_history_sma/non_trading_days.json');
const DEFAULT_START_DATE = '2025/11/02';
const DEFAULT_MIN_DELAY_MS = 3000;
const DEFAULT_MAX_DELAY_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MISMATCH_COOLDOWN_MS = 90000;
const RATE_LIMIT_STATUS_CODES = new Set([307, 429, 503]);

const args = process.argv.slice(2);

function getArg(flag) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
}

function getPositionalDate() {
    const flagsWithValue = new Set(['--date', '--start', '--end']);
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

function compactToKey(dateStr) {
    return `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
}

function keyToCompact(dateStr) {
    return normalizeDateInput(dateStr);
}

function parseKey(dateStr) {
    const [year, month, day] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
}

function formatKey(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
}

function getTaipeiTodayKey() {
    const taipeiDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour12: false }));
    return formatKey(taipeiDate);
}

function isWeekend(dateKey) {
    const day = parseKey(dateKey).getDay();
    return day === 0 || day === 6;
}

function loadCalendar(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.warn(`⚠️ Failed to read calendar: ${filePath}`);
        return {};
    }
}

function calendarToSet(calendar) {
    return new Set(Object.values(calendar).flat());
}

function isKnownDate(calendar, dateKey) {
    const year = dateKey.slice(0, 4);
    return Array.isArray(calendar[year]) && calendar[year].includes(dateKey);
}

function buildDateRange(startKey, endKey) {
    const dates = [];
    const current = parseKey(startKey);
    const end = parseKey(endKey);

    while (current <= end) {
        dates.push(formatKey(current));
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

function outputPathForDate(dateCompact) {
    return path.join(OUTPUT_DIR, `${dateCompact}_twse_dealers.json`);
}

function refreshFilesJson() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(file => /^\d{8}_twse_dealers\.json$/.test(file))
        .sort();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

function shouldSkipDate(dateKey, tradingCalendar, nonTradingCalendar) {
    if (isKnownDate(tradingCalendar, dateKey)) return false;
    if (isWeekend(dateKey)) return true;
    return isKnownDate(nonTradingCalendar, dateKey);
}

function validatePayload(payload) {
    for (const key of ['fields', 'groups', 'data']) {
        if (!Array.isArray(payload[key])) {
            throw new Error(`TWSE response missing array field: ${key}`);
        }
    }

    if (!payload.date || !/^\d{8}$/.test(payload.date)) {
        throw new Error(`TWSE response has invalid date: ${payload.date || '(empty)'}`);
    }
}

async function fetchTwseForeignInvestorsOnce(dateCompact) {
    const params = new URLSearchParams({
        date: dateCompact,
        response: 'json',
        _: String(Date.now())
    });
    const response = await fetch(`${API_URL}?${params.toString()}`, {
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

async function fetchTwseForeignInvestors(dateCompact, options) {
    let attempt = 0;
    while (true) {
        try {
            return await fetchTwseForeignInvestorsOnce(dateCompact);
        } catch (error) {
            attempt++;
            const shouldRetry = RATE_LIMIT_STATUS_CODES.has(error.status) && attempt <= options.maxRetries;
            if (!shouldRetry) throw error;

            const cooldown = options.rateLimitCooldownMs * attempt;
            console.log(`   🕒 ${dateCompact} got ${error.status}; cooling down ${Math.round(cooldown / 1000)}s before retry ${attempt}/${options.maxRetries}`);
            await sleep(cooldown);
        }
    }
}

async function crawlDate(dateKey, options) {
    const dateCompact = keyToCompact(dateKey);
    const outputPath = outputPathForDate(dateCompact);

    if (!options.force && fs.existsSync(outputPath)) {
        console.log(`⏭️ ${dateCompact} exists, skipping`);
        return { status: 'exists' };
    }

    let payload = null;
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
        payload = await fetchTwseForeignInvestors(dateCompact, options);
        if (payload.date === dateCompact) break;

        if (attempt >= options.maxRetries) {
            console.log(`⚠️ ${dateCompact} returned ${payload.date}, skipping write after ${attempt + 1} attempts`);
            return { status: 'mismatch' };
        }

        const retryDelay = attempt === 0
            ? randomDelay(options.minDelayMs, options.maxDelayMs)
            : options.mismatchCooldownMs * attempt;
        console.log(`   🕒 ${dateCompact} returned ${payload.date}; waiting ${Math.round(retryDelay / 1000)}s before mismatch retry ${attempt + 1}/${options.maxRetries}`);
        await sleep(retryDelay);
    }

    if (!Array.isArray(payload.data) || payload.data.length === 0) {
        console.log(`🔸 ${dateCompact} has no rows, skipping write`);
        return { status: 'empty' };
    }

    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`✅ ${dateCompact} saved (${payload.data.length} rows)`);
    return { status: 'saved' };
}

(async () => {
    try {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        const force = args.includes('--force');
        const minDelayMs = getNumberArg('--min-delay', DEFAULT_MIN_DELAY_MS);
        const maxDelayMs = getNumberArg('--max-delay', DEFAULT_MAX_DELAY_MS);
        const maxRetries = getNumberArg('--max-retries', DEFAULT_MAX_RETRIES);
        const rateLimitCooldownMs = getNumberArg('--rate-limit-cooldown', 90000);
        const mismatchCooldownMs = getNumberArg('--mismatch-cooldown', DEFAULT_MISMATCH_COOLDOWN_MS);
        const singleDate = normalizeDateInput(getArg('--date') || getPositionalDate());
        const startKey = singleDate ? compactToKey(singleDate) : compactToKey(normalizeDateInput(getArg('--start') || DEFAULT_START_DATE));
        const endKey = singleDate
            ? compactToKey(singleDate)
            : compactToKey(normalizeDateInput(getArg('--end') || getTaipeiTodayKey()));

        if (startKey > endKey) {
            throw new Error(`Start date ${startKey} is after end date ${endKey}`);
        }

        const tradingCalendar = loadCalendar(TRADING_DAYS_FILE);
        const nonTradingCalendar = loadCalendar(NON_TRADING_DAYS_FILE);
        const tradingCount = calendarToSet(tradingCalendar).size;
        const nonTradingCount = calendarToSet(nonTradingCalendar).size;
        const dates = buildDateRange(startKey, endKey)
            .filter(dateKey => singleDate || !shouldSkipDate(dateKey, tradingCalendar, nonTradingCalendar));

        console.log('🚀 TWSE dealers history crawl');
        console.log(`📅 Range: ${startKey} ~ ${endKey}`);
        console.log(`📚 Calendar: trading=${tradingCount}, nonTrading=${nonTradingCount}`);
        console.log(`📌 Dates to check: ${dates.length}`);
        console.log(`⏱️ Delay: ${minDelayMs}-${maxDelayMs}ms, rate-limit cooldown: ${rateLimitCooldownMs}ms, mismatch cooldown: ${mismatchCooldownMs}ms, retries: ${maxRetries}`);
        if (force) console.log('♻️ Force mode: existing files will be overwritten');

        const stats = { saved: 0, exists: 0, empty: 0, mismatch: 0, failed: 0 };
        for (let i = 0; i < dates.length; i++) {
            const dateKey = dates[i];
            try {
                const result = await crawlDate(dateKey, {
                    force,
                    maxRetries,
                    rateLimitCooldownMs,
                    mismatchCooldownMs,
                    minDelayMs,
                    maxDelayMs
                });
                stats[result.status] = (stats[result.status] || 0) + 1;
            } catch (error) {
                stats.failed++;
                console.error(`❌ ${keyToCompact(dateKey)} failed: ${error.message}`);
            }

            if (i < dates.length - 1) {
                await sleep(randomDelay(minDelayMs, maxDelayMs));
            }
        }

        console.log('\n✅ History crawl finished');
        console.log(`Saved=${stats.saved}, Exists=${stats.exists}, Empty=${stats.empty}, Mismatch=${stats.mismatch}, Failed=${stats.failed}`);
        refreshFilesJson();
        console.log('📁 Refreshed data_twse_dealers/files.json');
    } catch (error) {
        console.error(`❌ Failed to crawl TWSE dealers history: ${error.message}`);
        process.exit(1);
    }
})();
