const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data_twse_margin_maintenance');
const OUTPUT_SUFFIX = 'twse_margin_maintenance';
const FORMULA_VERSION = 'exclude-etf-punish-notice-clause-11-v1';
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

function readCsvCodes(filePath) {
    const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
    const fields = rows.shift() || [];
    const codeIndex = fields.indexOf('Code');
    if (codeIndex === -1) throw new Error(`${filePath} is missing Code field.`);
    return new Set(rows.map(row => String(row[codeIndex] || '').trim()).filter(Boolean));
}

function getFieldIndex(fields, name, sourceLabel) {
    const index = fields.indexOf(name);
    if (index === -1) throw new Error(`${sourceLabel} is missing field: ${name}`);
    return index;
}

function loadMarginRecords(date, etfCodes) {
    const filePath = path.join(ROOT_DIR, 'data_twse_margin_balance', `${date}_twse_margin_balance.csv`);
    const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
    const fields = rows.shift() || [];
    const codeIndex = getFieldIndex(fields, '股票代號', filePath);
    const nameIndex = getFieldIndex(fields, '股票名稱', filePath);
    const balanceIndex = getFieldIndex(fields, '融資今日餘額', filePath);

    const quotePath = path.join(ROOT_DIR, 'data_twse_mi_index', `${date}_twse_mi_index.json`);
    const quotePayload = JSON.parse(fs.readFileSync(quotePath, 'utf8'));
    const quoteTable = (quotePayload.tables || []).find(table => {
        const tableFields = table?.fields || [];
        return tableFields.includes('證券代號') && tableFields.includes('收盤價');
    });
    if (!quoteTable) throw new Error(`${quotePath} is missing daily quote table.`);

    const quoteCodeIndex = getFieldIndex(quoteTable.fields, '證券代號', quotePath);
    const closeIndex = getFieldIndex(quoteTable.fields, '收盤價', quotePath);
    const prices = new Map(quoteTable.data.map(row => [
        String(row[quoteCodeIndex] || '').trim(),
        parseNumber(row[closeIndex])
    ]));

    return rows.map(row => {
        const code = String(row[codeIndex] || '').trim();
        const marginBalanceLots = parseNumber(row[balanceIndex]);
        const close = prices.get(code) || 0;
        return {
            code,
            name: String(row[nameIndex] || '').trim(),
            marginBalanceLots,
            close,
            marketValue: marginBalanceLots * 1000 * close,
            isEtf: etfCodes.has(code)
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
    const punishUrl = `https://www.twse.com.tw/rwd/zh/announcement/punish?startDate=${date}&endDate=${date}&querytype=3&stockNo=&selectType=&proceType=&remarkType=&sortKind=STKNO&response=json`;
    const noticeUrl = `https://www.twse.com.tw/rwd/zh/announcement/notice?startDate=${date}&endDate=${date}&stockNo=&response=json`;

    const etfCodes = readCsvCodes(path.join(ROOT_DIR, 'data_twse', 'twse_industry_ETF.csv'));
    const records = loadMarginRecords(date, etfCodes);
    const [marginSummary, punishPayload, noticePayload] = await Promise.all([
        loadJsonOverride('--margin-summary-file') || fetchJson(marginSummaryUrl),
        loadJsonOverride('--punish-file') || fetchJson(punishUrl),
        loadJsonOverride('--notice-file') || fetchJson(noticeUrl)
    ]);

    const financingAmount = getFinancingAmount(marginSummary);
    const punishCodes = getCodes(punishPayload, '證券代號');
    const noticeTextIndex = getFieldIndex(noticePayload.fields || [], '注意交易資訊', 'TWSE notice payload');
    const noticeClause11Codes = getCodes(
        noticePayload,
        '證券代號',
        row => String(row[noticeTextIndex] || '').includes('第十一款')
    );

    const includedRecords = records.filter(record => !record.isEtf);
    const baselineMarketValue = includedRecords.reduce((sum, record) => sum + record.marketValue, 0);
    const excludedCodes = new Set();
    const punish = summarizeExcluded(includedRecords, punishCodes, excludedCodes);
    punish.codes.forEach(code => excludedCodes.add(code));
    const noticeClause11 = summarizeExcluded(includedRecords, noticeClause11Codes, excludedCodes);
    noticeClause11.codes.forEach(code => excludedCodes.add(code));

    const numerator = baselineMarketValue - punish.marketValue - noticeClause11.marketValue;
    const maintenanceRatio = financingAmount ? numerator / financingAmount * 100 : null;
    const missingPrices = includedRecords
        .filter(record => record.marginBalanceLots > 0 && !record.close)
        .map(record => ({ code: record.code, name: record.name, marginBalanceLots: record.marginBalanceLots }));

    const output = {
        date,
        formulaVersion: FORMULA_VERSION,
        formula: '(非 ETF 融資股票市值－當日處置股融資市值－當日注意交易第十一款股票融資市值)／證交所融資金額今日餘額',
        maintenanceRatio,
        numerator,
        denominator: financingAmount,
        baseline: {
            nonEtfMarketValue: baselineMarketValue,
            securityCount: includedRecords.length
        },
        excluded: {
            etf: {
                count: records.filter(record => record.isEtf).length,
                marketValue: records.filter(record => record.isEtf).reduce((sum, record) => sum + record.marketValue, 0)
            },
            punish,
            noticeClause11
        },
        dataQuality: { missingPrices },
        sources: {
            marginSummary: marginSummaryUrl,
            punish: punishUrl,
            notice: noticeUrl,
            marginBalance: `data_twse_margin_balance/${date}_twse_margin_balance.csv`,
            closingPrices: `data_twse_mi_index/${date}_twse_mi_index.json`,
            etfList: 'data_twse/twse_industry_ETF.csv'
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
