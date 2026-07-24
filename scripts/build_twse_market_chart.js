const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data_twse_market_chart');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'market_chart.json');
const FOREIGN_CACHE_PATH = path.join(OUTPUT_DIR, '.foreign_cache.json');
const DEFAULT_START_DATE = '20251103';
const DEFAULT_MIN_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 1100;
const RETRYABLE_STATUS_CODES = new Set([307, 429, 500, 502, 503, 504]);
const args = process.argv.slice(2);

function getArg(flag) {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : '';
}

function normalizeDate(value, label) {
    const normalized = String(value || '').replace(/[^\d]/g, '');
    if (!/^\d{8}$/.test(normalized)) {
        throw new Error(`${label} must use YYYYMMDD: ${value || '(empty)'}`);
    }
    return normalized;
}

function getNumberArg(flag, fallback) {
    const value = getArg(flag);
    if (!value) return fallback;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
        throw new Error(`${flag} must be a non-negative number: ${value}`);
    }
    return number;
}

function getTaipeiToday() {
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

function parseNumber(value) {
    const number = Number(String(value ?? '').replaceAll(',', '').trim());
    return Number.isFinite(number) ? number : null;
}

function parseRocDate(value) {
    const match = String(value || '').trim().match(/^(\d{2,3})\/(\d{2})\/(\d{2})$/);
    if (!match) throw new Error(`Invalid ROC date: ${value}`);
    return `${String(Number(match[1]) + 1911)}${match[2]}${match[3]}`;
}

function listMonths(startDate, endDate) {
    const months = [];
    let year = Number(startDate.slice(0, 4));
    let month = Number(startDate.slice(4, 6));
    const endYear = Number(endDate.slice(0, 4));
    const endMonth = Number(endDate.slice(4, 6));

    while (year < endYear || (year === endYear && month <= endMonth)) {
        months.push(`${year}${String(month).padStart(2, '0')}01`);
        month += 1;
        if (month === 13) {
            year += 1;
            month = 1;
        }
    }
    return months;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
    if (maxMs <= minMs) return minMs;
    return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

async function fetchJson(url, label, maxRetries) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const response = await fetch(url, {
                headers: {
                    accept: 'application/json, text/plain, */*',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36'
                }
            });
            if (!response.ok) {
                const error = new Error(`${label} failed: ${response.status} ${response.statusText}`);
                error.status = response.status;
                throw error;
            }
            const payload = await response.json();
            if (payload.stat !== 'OK') {
                throw new Error(`${label} returned stat=${payload.stat || '(empty)'}`);
            }
            return payload;
        } catch (error) {
            const retryable = RETRYABLE_STATUS_CODES.has(error.status) || error.name === 'TypeError';
            if (!retryable || attempt >= maxRetries) throw error;
            const cooldown = 3000 * (attempt + 1);
            console.log(`🕒 ${label} retry ${attempt + 1}/${maxRetries} after ${cooldown}ms`);
            await sleep(cooldown);
        }
    }
    throw new Error(`${label} failed unexpectedly`);
}

function getExistingRows() {
    const rows = new Map();
    for (const filePath of [OUTPUT_PATH, FOREIGN_CACHE_PATH]) {
        if (!fs.existsSync(filePath)) continue;
        const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        for (const row of payload.data || []) rows.set(row.date, row);
    }
    return rows;
}

function writeForeignCache(rowsByDate) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const data = [...rowsByDate.values()]
        .filter(row => [
            row.foreignBuyAmount,
            row.foreignSellAmount,
            row.foreignNetAmount
        ].every(Number.isFinite))
        .map(row => ({
            date: row.date,
            foreignBuyAmount: row.foreignBuyAmount,
            foreignSellAmount: row.foreignSellAmount,
            foreignNetAmount: row.foreignNetAmount
        }))
        .sort((left, right) => left.date.localeCompare(right.date));
    fs.writeFileSync(
        FOREIGN_CACHE_PATH,
        `${JSON.stringify({ updatedAt: new Date().toISOString(), data }, null, 2)}\n`,
        'utf8'
    );
}

function validateMonthlyPayload(payload, expectedFields, label) {
    if (!Array.isArray(payload.fields) || !Array.isArray(payload.data)) {
        throw new Error(`${label} is missing fields or data`);
    }
    for (const field of expectedFields) {
        if (!payload.fields.includes(field)) {
            throw new Error(`${label} is missing field: ${field}`);
        }
    }
}

function mergeOhlcRows(target, payload, startDate, endDate) {
    const requiredFields = ['日期', '開盤指數', '最高指數', '最低指數', '收盤指數'];
    validateMonthlyPayload(payload, requiredFields, 'TWSE MI_5MINS_HIST');
    const indexes = Object.fromEntries(requiredFields.map(field => [field, payload.fields.indexOf(field)]));

    for (const row of payload.data) {
        const date = parseRocDate(row[indexes['日期']]);
        if (date < startDate || date > endDate) continue;
        const values = {
            open: parseNumber(row[indexes['開盤指數']]),
            high: parseNumber(row[indexes['最高指數']]),
            low: parseNumber(row[indexes['最低指數']]),
            close: parseNumber(row[indexes['收盤指數']])
        };
        if (Object.values(values).some(value => value === null)) {
            throw new Error(`TWSE OHLC contains invalid value on ${date}`);
        }
        target.set(date, { ...(target.get(date) || { date }), ...values });
    }
}

function mergeVolumeRows(target, payload, startDate, endDate) {
    const requiredFields = ['日期', '成交股數', '成交金額', '成交筆數', '發行量加權股價指數'];
    validateMonthlyPayload(payload, requiredFields, 'TWSE FMTQIK');
    const indexes = Object.fromEntries(requiredFields.map(field => [field, payload.fields.indexOf(field)]));

    for (const row of payload.data) {
        const date = parseRocDate(row[indexes['日期']]);
        if (date < startDate || date > endDate) continue;
        const values = {
            volumeShares: parseNumber(row[indexes['成交股數']]),
            turnover: parseNumber(row[indexes['成交金額']]),
            transactions: parseNumber(row[indexes['成交筆數']]),
            officialClose: parseNumber(row[indexes['發行量加權股價指數']])
        };
        if (Object.values(values).some(value => value === null)) {
            throw new Error(`TWSE volume contains invalid value on ${date}`);
        }
        target.set(date, { ...(target.get(date) || { date }), ...values });
    }
}

function getForeignAmounts(payload, date) {
    const nameIndex = payload.fields?.indexOf('單位名稱') ?? -1;
    const buyIndex = payload.fields?.indexOf('買進金額') ?? -1;
    const sellIndex = payload.fields?.indexOf('賣出金額') ?? -1;
    const netIndex = payload.fields?.indexOf('買賣差額') ?? -1;
    if ([nameIndex, buyIndex, sellIndex, netIndex].some(index => index === -1)) {
        throw new Error(`TWSE BFI82U is missing fields on ${date}`);
    }
    const row = (payload.data || []).find(item =>
        String(item[nameIndex] || '').startsWith('外資及陸資(不含外資自營商)')
    );
    if (!row) throw new Error(`TWSE BFI82U is missing foreign investor row on ${date}`);
    return {
        foreignBuyAmount: parseNumber(row[buyIndex]),
        foreignSellAmount: parseNumber(row[sellIndex]),
        foreignNetAmount: parseNumber(row[netIndex])
    };
}

function validateRows(rows) {
    const requiredFields = [
        'open',
        'high',
        'low',
        'close',
        'volumeShares',
        'turnover',
        'transactions',
        'foreignBuyAmount',
        'foreignSellAmount',
        'foreignNetAmount'
    ];
    for (const row of rows) {
        for (const field of requiredFields) {
            if (!Number.isFinite(row[field])) {
                throw new Error(`Output row ${row.date} is missing numeric field: ${field}`);
            }
        }
        if (Math.abs(row.close - row.officialClose) > 0.01) {
            throw new Error(
                `TWSE close mismatch on ${row.date}: OHLC=${row.close}, FMTQIK=${row.officialClose}`
            );
        }
        if (row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close)) {
            throw new Error(`Invalid OHLC range on ${row.date}`);
        }
    }
}

async function main() {
    const startDate = normalizeDate(getArg('--start-date') || DEFAULT_START_DATE, '--start-date');
    const endDate = normalizeDate(getArg('--date') || getTaipeiToday(), '--date');
    if (startDate > endDate) throw new Error('--start-date cannot be after --date');

    const minDelayMs = getNumberArg('--min-delay', DEFAULT_MIN_DELAY_MS);
    const maxDelayMs = getNumberArg('--max-delay', DEFAULT_MAX_DELAY_MS);
    const maxRetries = getNumberArg('--max-retries', 3);
    const forceForeign = args.includes('--force-foreign');
    const existingRows = getExistingRows();
    const rowsByDate = new Map();
    const months = listMonths(startDate, endDate);

    for (const [index, monthDate] of months.entries()) {
        console.log(`📅 月資料 ${index + 1}/${months.length}: ${monthDate.slice(0, 6)}`);
        const ohlcUrl =
            `https://www.twse.com.tw/indicesReport/MI_5MINS_HIST?date=${monthDate}&response=json`;
        const volumeUrl =
            `https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date=${monthDate}&response=json`;
        const [ohlcPayload, volumePayload] = await Promise.all([
            fetchJson(ohlcUrl, `MI_5MINS_HIST ${monthDate}`, maxRetries),
            fetchJson(volumeUrl, `FMTQIK ${monthDate}`, maxRetries)
        ]);
        mergeOhlcRows(rowsByDate, ohlcPayload, startDate, endDate);
        mergeVolumeRows(rowsByDate, volumePayload, startDate, endDate);
        if (index < months.length - 1) await sleep(randomDelay(minDelayMs, maxDelayMs));
    }

    const tradingDates = [...rowsByDate.keys()].sort();
    let fetchedForeignCount = 0;
    for (const [index, date] of tradingDates.entries()) {
        const existing = existingRows.get(date);
        const hasCachedForeign = existing && [
            existing.foreignBuyAmount,
            existing.foreignSellAmount,
            existing.foreignNetAmount
        ].every(Number.isFinite);

        if (hasCachedForeign && !forceForeign) {
            Object.assign(rowsByDate.get(date), {
                foreignBuyAmount: existing.foreignBuyAmount,
                foreignSellAmount: existing.foreignSellAmount,
                foreignNetAmount: existing.foreignNetAmount
            });
            continue;
        }

        console.log(`🌏 外資金額 ${index + 1}/${tradingDates.length}: ${date}`);
        const url =
            `https://www.twse.com.tw/rwd/zh/fund/BFI82U?dayDate=${date}&type=day&response=json`;
        const payload = await fetchJson(url, `BFI82U ${date}`, maxRetries);
        Object.assign(rowsByDate.get(date), getForeignAmounts(payload, date));
        fetchedForeignCount += 1;
        if (fetchedForeignCount % 10 === 0) writeForeignCache(rowsByDate);
        if (index < tradingDates.length - 1) {
            await sleep(randomDelay(minDelayMs, maxDelayMs));
        }
    }

    const rows = tradingDates.map(date => {
        const { officialClose, ...row } = rowsByDate.get(date);
        return row;
    });
    validateRows(rows.map(row => ({
        ...row,
        officialClose: rowsByDate.get(row.date).officialClose
    })));

    const existingOutput = fs.existsSync(OUTPUT_PATH)
        ? JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
        : null;
    const dataUnchanged = existingOutput
        && existingOutput.startDate === startDate
        && existingOutput.endDate === (rows.at(-1)?.date || endDate)
        && JSON.stringify(existingOutput.data || []) === JSON.stringify(rows);
    const output = {
        generatedAt: dataUnchanged && existingOutput.generatedAt
            ? existingOutput.generatedAt
            : new Date().toISOString(),
        startDate,
        endDate: rows.at(-1)?.date || endDate,
        count: rows.length,
        units: {
            price: 'index points',
            volumeShares: 'shares',
            turnover: 'TWD',
            foreignAmounts: 'TWD'
        },
        sources: {
            ohlc: 'TWSE MI_5MINS_HIST',
            volume: 'TWSE FMTQIK',
            foreign: 'TWSE BFI82U 外資及陸資(不含外資自營商)'
        },
        data: rows
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    if (fs.existsSync(FOREIGN_CACHE_PATH)) fs.unlinkSync(FOREIGN_CACHE_PATH);
    console.log(`✅ Saved ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
    console.log(`📊 ${rows.length} trading days; fetched ${fetchedForeignCount} foreign rows`);
}

main().catch(error => {
    console.error(`❌ Failed to build TWSE market chart data: ${error.message}`);
    process.exit(1);
});
