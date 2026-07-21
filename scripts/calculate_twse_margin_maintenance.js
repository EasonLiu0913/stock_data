const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data_twse_margin_maintenance');
const OUTPUT_SUFFIX = 'twse_margin_maintenance';
const FORMULA_VERSION = 'twse-stock-exclude-punish-short-sale-restricted-ky-v1';
const args = process.argv.slice(2);

function getArg(flag) {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : '';
}

function normalizeDate(value) {
    const normalized = String(value || '').replace(/[^\d]/g, '');
    if (!/^\d{8}$/.test(normalized)) {
        throw new Error(`Invalid date: ${value || '(empty)'}. Expected YYYYMMDD.`);
    }
    return normalized;
}

function parseNumber(value) {
    const number = Number(String(value ?? '').replaceAll(',', '').trim());
    return Number.isFinite(number) ? number : 0;
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (quoted) {
            if (char === '"' && next === '"') {
                cell += '"';
                index += 1;
            } else if (char === '"') {
                quoted = false;
            } else {
                cell += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === ',') {
            row.push(cell);
            cell = '';
        } else if (char === '\n') {
            row.push(cell.replace(/\r$/, ''));
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }

    if (cell || row.length) {
        row.push(cell.replace(/\r$/, ''));
        if (row.some(value => value !== '')) rows.push(row);
    }

    return rows;
}

function getFieldIndex(fields, name, sourceLabel) {
    const index = fields.indexOf(name);
    if (index === -1) throw new Error(`${sourceLabel} is missing field: ${name}`);
    return index;
}

function loadClosingPrices(date) {
    const quotePath = path.join(ROOT_DIR, 'data_twse_mi_index', `${date}_twse_mi_index.json`);
    const quotePayload = JSON.parse(fs.readFileSync(quotePath, 'utf8'));
    const quoteTable = (quotePayload.tables || []).find(table => {
        const tableFields = table?.fields || [];
        return tableFields.includes('證券代號') && tableFields.includes('收盤價');
    });
    if (!quoteTable) throw new Error(`${quotePath} is missing daily quote table.`);

    const quoteCodeIndex = getFieldIndex(quoteTable.fields, '證券代號', quotePath);
    const closeIndex = getFieldIndex(quoteTable.fields, '收盤價', quotePath);
    return new Map(quoteTable.data.map(row => [
        String(row[quoteCodeIndex] || '').trim(),
        parseNumber(row[closeIndex])
    ]));
}

function getStockMarginRecords(payload, prices) {
    const table = (payload.tables || []).find(item => {
        const fields = item?.fields || [];
        return fields.includes('代號') && fields.includes('名稱') && fields.includes('今日餘額');
    });
    if (!table) throw new Error('TWSE STOCK margin payload is missing detail table.');

    const codeIndex = getFieldIndex(table.fields, '代號', 'TWSE STOCK margin payload');
    const nameIndex = getFieldIndex(table.fields, '名稱', 'TWSE STOCK margin payload');
    const balanceIndex = 6;
    const noteIndex = table.fields.length - 1;

    return (table.data || [])
        .filter(row => String(row[codeIndex] || '').trim() && String(row[nameIndex] || '').trim() !== '合計')
        .map(row => {
        const code = String(row[codeIndex] || '').trim();
        const marginBalanceLots = parseNumber(row[balanceIndex]);
        const close = prices.get(code) || 0;
        return {
            code,
            name: String(row[nameIndex] || '').trim(),
            marginBalanceLots,
            close,
            marketValue: marginBalanceLots * 1000 * close,
            note: String(row[noteIndex] || '').trim()
        };
        });
}

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: {
            accept: 'application/json, text/plain, */*',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36'
        }
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}: ${url}`);
    const payload = await response.json();
    if (payload.stat !== 'OK') throw new Error(`TWSE response is not OK: ${url}`);
    return payload;
}

function loadJsonOverride(flag) {
    const filePath = getArg(flag);
    return filePath ? JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')) : null;
}

function getFinancingAmount(payload) {
    for (const table of payload.tables || []) {
        const itemIndex = table?.fields?.indexOf('項目') ?? -1;
        const currentIndex = table?.fields?.indexOf('今日餘額') ?? -1;
        if (itemIndex === -1 || currentIndex === -1) continue;
        const row = (table.data || []).find(item => String(item[itemIndex] || '').includes('融資金額'));
        if (row) return parseNumber(row[currentIndex]) * 1000;
    }
    throw new Error('TWSE margin summary is missing current financing amount.');
}

function getCodes(payload, codeField, predicate = () => true) {
    const codeIndex = getFieldIndex(payload.fields || [], codeField, 'TWSE list payload');
    return new Set((payload.data || [])
        .filter(predicate)
        .map(row => String(row[codeIndex] || '').trim())
        .filter(Boolean));
}

function summarizeExcluded(records, codes, alreadyExcluded = new Set()) {
    const matched = records
        .filter(record => codes.has(record.code) && !alreadyExcluded.has(record.code))
        .sort((left, right) => right.marketValue - left.marketValue);
    return {
        codes: matched.map(record => record.code),
        count: matched.length,
        marketValue: matched.reduce((sum, record) => sum + record.marketValue, 0),
        securities: matched.map(record => ({
            code: record.code,
            name: record.name,
            marginBalanceLots: record.marginBalanceLots,
            close: record.close,
            marketValue: record.marketValue
        }))
    };
}

function refreshFilesJson(outputDir) {
    const files = fs.readdirSync(outputDir)
        .filter(file => new RegExp(`^\\d{8}_${OUTPUT_SUFFIX}\\.json$`).test(file))
        .sort();
    fs.writeFileSync(path.join(outputDir, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

async function main() {
    const date = normalizeDate(getArg('--date'));
    const outputDir = path.resolve(getArg('--output-dir') || OUTPUT_DIR);
    const marginSummaryUrl = `https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date=${date}&selectType=ALL&response=json`;
    const stockMarginUrl = `https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date=${date}&selectType=STOCK&response=json`;
    const punishUrl = `https://www.twse.com.tw/rwd/zh/announcement/punish?startDate=${date}&endDate=${date}&querytype=3&stockNo=&selectType=&proceType=&remarkType=&sortKind=STKNO&response=json`;

    const prices = loadClosingPrices(date);
    const [marginSummary, stockMarginPayload, punishPayload] = await Promise.all([
        loadJsonOverride('--margin-summary-file') || fetchJson(marginSummaryUrl),
        loadJsonOverride('--stock-margin-file') || fetchJson(stockMarginUrl),
        loadJsonOverride('--punish-file') || fetchJson(punishUrl)
    ]);

    const financingAmount = getFinancingAmount(marginSummary);
    const records = getStockMarginRecords(stockMarginPayload, prices);
    const punishCodes = getCodes(punishPayload, '證券代號');
    const shortSaleRestrictedCodes = new Set(records
        .filter(record => record.note.includes('X'))
        .map(record => record.code));
    const kyCodes = new Set(records
        .filter(record => record.name.includes('-KY'))
        .map(record => record.code));

    const baselineMarketValue = records.reduce((sum, record) => sum + record.marketValue, 0);
    const excludedCodes = new Set();
    const punish = summarizeExcluded(records, punishCodes, excludedCodes);
    punish.codes.forEach(code => excludedCodes.add(code));
    const shortSaleRestrictedX = summarizeExcluded(records, shortSaleRestrictedCodes, excludedCodes);
    shortSaleRestrictedX.codes.forEach(code => excludedCodes.add(code));
    const ky = summarizeExcluded(records, kyCodes, excludedCodes);
    ky.codes.forEach(code => excludedCodes.add(code));

    const numerator = baselineMarketValue - punish.marketValue - shortSaleRestrictedX.marketValue - ky.marketValue;
    const maintenanceRatio = financingAmount ? numerator / financingAmount * 100 : null;
    const missingPrices = records
        .filter(record => record.marginBalanceLots > 0 && !record.close)
        .map(record => ({ code: record.code, name: record.name, marginBalanceLots: record.marginBalanceLots }));

    const output = {
        date,
        formulaVersion: FORMULA_VERSION,
        formula: '(TWSE STOCK 融資股票市值－當日處置股融資市值－註記 X 股票融資市值－KY 股票融資市值)／證交所融資金額今日餘額',
        maintenanceRatio,
        numerator,
        denominator: financingAmount,
        baseline: {
            stockMarketValue: baselineMarketValue,
            securityCount: records.length
        },
        excluded: {
            punish,
            shortSaleRestrictedX,
            ky
        },
        dataQuality: { missingPrices },
        sources: {
            marginSummary: marginSummaryUrl,
            stockMargin: stockMarginUrl,
            punish: punishUrl,
            closingPrices: `data_twse_mi_index/${date}_twse_mi_index.json`
        }
    };

    if (args.includes('--stdout')) {
        process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
        return;
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = `${date}_${OUTPUT_SUFFIX}.json`;
    const outputPath = path.join(outputDir, outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    refreshFilesJson(outputDir);

    console.log(`Saved ${outputFile}`);
    console.log(`Path: ${outputPath}`);
    console.log(`Margin maintenance ratio: ${maintenanceRatio.toFixed(4)}%`);
}

main().catch(error => {
    console.error(`Failed to calculate TWSE margin maintenance: ${error.message}`);
    process.exit(1);
});
