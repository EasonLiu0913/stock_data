const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.twse.com.tw/holidaySchedule/holidaySchedule?response=open_data';
const NON_TRADING_DAYS_FILE = path.join(__dirname, '../data_history_sma/non_trading_days.json');
const SKIP_NAME_PATTERNS = ['開始交易日', '最後交易日'];
const args = process.argv.slice(2);

function hasFlag(flag) {
    return args.includes(flag);
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && inQuotes && next === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(current);
            current = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') i++;
            row.push(current);
            if (row.some(cell => cell.trim() !== '')) rows.push(row);
            row = [];
            current = '';
        } else {
            current += char;
        }
    }

    if (current || row.length) {
        row.push(current);
        if (row.some(cell => cell.trim() !== '')) rows.push(row);
    }

    return rows;
}

function rocDateToKey(value) {
    const normalized = String(value || '').trim();
    const match = normalized.match(/^(\d{3})(\d{2})(\d{2})$/);
    if (!match) {
        throw new Error(`Invalid TWSE holiday date: ${value}`);
    }

    const year = Number(match[1]) + 1911;
    return `${year}/${match[2]}/${match[3]}`;
}

function loadNonTradingDays() {
    if (!fs.existsSync(NON_TRADING_DAYS_FILE)) return {};
    return JSON.parse(fs.readFileSync(NON_TRADING_DAYS_FILE, 'utf8'));
}

function sortCalendar(calendar) {
    const sorted = {};
    for (const year of Object.keys(calendar).sort()) {
        sorted[year] = Array.from(new Set(calendar[year])).sort();
    }
    return sorted;
}

function parseHolidayDates(csvText) {
    const rows = parseCsv(csvText.replace(/^\uFEFF/, ''));
    if (rows.length < 2) {
        throw new Error('TWSE holiday CSV has no data rows.');
    }

    const headers = rows[0].map(header => header.trim());
    const nameIndex = headers.indexOf('名稱');
    const dateIndex = headers.indexOf('日期');

    if (nameIndex === -1 || dateIndex === -1) {
        throw new Error(`TWSE holiday CSV missing required headers. Headers: ${headers.join(', ')}`);
    }

    const holidays = [];
    const skipped = [];

    for (const row of rows.slice(1)) {
        const name = (row[nameIndex] || '').trim();
        const rawDate = (row[dateIndex] || '').trim();
        if (!rawDate) continue;

        const dateKey = rocDateToKey(rawDate);
        if (SKIP_NAME_PATTERNS.some(pattern => name.includes(pattern))) {
            skipped.push({ date: dateKey, name });
            continue;
        }

        holidays.push({ date: dateKey, name });
    }

    return { holidays, skipped };
}

function mergeHolidayDates(calendar, holidays) {
    const added = [];
    const existing = [];

    for (const holiday of holidays) {
        const year = holiday.date.slice(0, 4);
        if (!Array.isArray(calendar[year])) calendar[year] = [];

        if (calendar[year].includes(holiday.date)) {
            existing.push(holiday);
        } else {
            calendar[year].push(holiday.date);
            added.push(holiday);
        }
    }

    return { calendar: sortCalendar(calendar), added, existing };
}

async function fetchHolidayCsv() {
    const response = await fetch(API_URL, {
        headers: {
            accept: 'text/csv,*/*',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`TWSE holiday request failed: ${response.status} ${response.statusText}`);
    }

    return response.text();
}

(async () => {
    try {
        const dryRun = hasFlag('--dry-run');
        const csvText = await fetchHolidayCsv();
        const { holidays, skipped } = parseHolidayDates(csvText);
        const currentCalendar = loadNonTradingDays();
        const { calendar, added, existing } = mergeHolidayDates(currentCalendar, holidays);

        if (!dryRun) {
            fs.writeFileSync(NON_TRADING_DAYS_FILE, `${JSON.stringify(calendar, null, 2)}\n`, 'utf8');
        }

        console.log(`${dryRun ? 'Dry run' : 'Updated'} ${NON_TRADING_DAYS_FILE}`);
        console.log(`Holiday rows included: ${holidays.length}`);
        console.log(`Added dates: ${added.length}`);
        console.log(`Already present: ${existing.length}`);
        console.log(`Skipped trading-day marker rows: ${skipped.length}`);

        if (added.length) {
            console.log('New dates:');
            for (const item of added) {
                console.log(`- ${item.date} ${item.name}`);
            }
        }
    } catch (error) {
        console.error(`Failed to update non-trading days: ${error.message}`);
        process.exit(1);
    }
})();
