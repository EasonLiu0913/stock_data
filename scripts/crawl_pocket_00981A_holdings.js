const fs = require('fs');
const path = require('path');

const ETF_ID = '00981A';
const HOLDINGS_API_URL = 'https://www.pocket.tw/api/cm/MobileService/ashx/GetDtnoData.ashx?action=getdtnodata&DtNo=59449513&ParamStr=AssignID%3D00981A%3BMTPeriod%3D0%3BDTMode%3D0%3BDTRange%3D1%3BDTOrder%3D1%3BMajorTable%3DM722%3B&FilterNo=0';
const INDUSTRY_API_URL = 'https://www.pocket.tw/api/cm/MobileService/ashx/GetDtnoData.ashx?action=getdtnodata&DtNo=61495191&ParamStr=AssignID%3D98642180%3BMTPeriod%3D0%3BDTMode%3D0%3BDTRange%3D1%3BDTOrder%3D1%3BMajorTable%3DM066%3B&FilterNo=0';
const OUTPUT_DIR = path.join(__dirname, '../data_pocket');
const HOLDINGS_LATEST_FILE = `${ETF_ID}_holdings_latest.json`;
const INDUSTRY_LATEST_FILE = `${ETF_ID}_industry_distribution_latest.json`;

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

function parseNumber(value) {
    const normalized = String(value ?? '').replace(/,/g, '').trim();
    if (normalized === '') return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
}

function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Pocket response is not an object');
    }

    if (!Array.isArray(payload.Title) || payload.Title.length === 0) {
        throw new Error('Pocket response missing Title array');
    }

    if (!Array.isArray(payload.Data)) {
        throw new Error('Pocket response missing Data array');
    }

    for (const [index, row] of payload.Data.entries()) {
        if (!Array.isArray(row)) {
            throw new Error(`Pocket response row ${index} is not an array`);
        }
    }
}

function normalizeHolding(row, index) {
    const [date, symbol, name, weight, quantity, unit] = row;
    return {
        rank: index + 1,
        date: String(date ?? '').trim(),
        symbol: String(symbol ?? '').trim(),
        name: String(name ?? '').trim(),
        weightPercent: parseNumber(weight),
        quantity: parseNumber(quantity),
        unit: String(unit ?? '').trim()
    };
}

function normalizeIndustryTitle(title) {
    return String(title ?? '').replace(/\d+$/, '').trim();
}

function normalizeIndustryDistribution(payload) {
    const row = payload.Data[0];
    if (!row) {
        throw new Error('Pocket industry response has no data rows');
    }

    return payload.Title
        .map((title, index) => ({
            date: String(row[0] ?? '').trim(),
            industry: normalizeIndustryTitle(title),
            weightPercent: parseNumber(row[index])
        }))
        .filter(item => {
            if (item.industry === '日期') return false;
            if (item.industry.startsWith('上市') || item.industry.startsWith('上櫃')) return false;
            return item.weightPercent != null;
        })
        .sort((a, b) => b.weightPercent - a.weightPercent);
}

function summarize(holdings) {
    const equityRows = holdings.filter(item => item.unit === '股');
    const cashRows = holdings.filter(item => item.unit === '元');
    const totalWeightPercent = equityRows.reduce((sum, item) => sum + (item.weightPercent || 0), 0);
    const dates = [...new Set(holdings.map(item => item.date).filter(Boolean))].sort();

    return {
        date: dates[dates.length - 1] || '',
        totalRows: holdings.length,
        equityRows: equityRows.length,
        cashRows: cashRows.length,
        totalWeightPercent: Number(totalWeightPercent.toFixed(2))
    };
}

function summarizeIndustry(distribution) {
    const positiveRows = distribution.filter(item => item.weightPercent > 0);
    const dates = [...new Set(distribution.map(item => item.date).filter(Boolean))].sort();
    const totalWeightPercent = positiveRows.reduce((sum, item) => sum + item.weightPercent, 0);

    return {
        date: dates[dates.length - 1] || '',
        totalRows: distribution.length,
        positiveRows: positiveRows.length,
        totalWeightPercent: Number(totalWeightPercent.toFixed(2))
    };
}

function assertCompactDate(date, label) {
    if (!/^\d{8}$/.test(String(date || ''))) {
        throw new Error(`${label} has invalid data date: ${date || '(empty)'}`);
    }
}

async function fetchPocketData(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            accept: 'application/json, text/plain, */*',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Pocket request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    validatePayload(payload);
    return payload;
}

function refreshFilesJson() {
    const allFiles = fs.readdirSync(OUTPUT_DIR);
    const holdings = allFiles
        .filter(file => new RegExp(`^${ETF_ID}_holdings_\\d{8}\\.json$`).test(file))
        .sort();
    const industryDistribution = allFiles
        .filter(file => new RegExp(`^${ETF_ID}_industry_distribution_\\d{8}\\.json$`).test(file))
        .sort();
    const updates = allFiles
        .filter(file => new RegExp(`^${ETF_ID}_update_\\d{8}\\.json$`).test(file))
        .sort();

    const files = {
        holdings,
        industryDistribution,
        updates,
        latest: {
            holdings: HOLDINGS_LATEST_FILE,
            industryDistribution: INDUSTRY_LATEST_FILE
        }
    };

    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

(async () => {
    try {
        const holdingsPayload = await fetchPocketData(HOLDINGS_API_URL);
        const industryPayload = await fetchPocketData(INDUSTRY_API_URL);

        const holdings = holdingsPayload.Data.map(normalizeHolding);
        const holdingsSummary = summarize(holdings);
        assertCompactDate(holdingsSummary.date, 'Pocket holdings response');

        const holdingsOutput = {
            source: 'Pocket 口袋證券',
            sourceUrl: HOLDINGS_API_URL,
            etfId: ETF_ID,
            title: `${ETF_ID} ETF 持股內容`,
            fetchedAt: new Date().toISOString(),
            fields: holdingsPayload.Title,
            summary: holdingsSummary,
            rawData: holdingsPayload.Data,
            holdings
        };

        const industryDistribution = normalizeIndustryDistribution(industryPayload);
        const industrySummary = summarizeIndustry(industryDistribution);
        assertCompactDate(industrySummary.date, 'Pocket industry response');

        const industryOutput = {
            source: 'Pocket 口袋證券',
            sourceUrl: INDUSTRY_API_URL,
            etfId: ETF_ID,
            title: `${ETF_ID} ETF 產業分布比重`,
            fetchedAt: new Date().toISOString(),
            fields: industryPayload.Title,
            summary: industrySummary,
            rawData: industryPayload.Data,
            distribution: industryDistribution
        };

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        const holdingsOutputFile = `${ETF_ID}_holdings_${holdingsSummary.date}.json`;
        const industryOutputFile = `${ETF_ID}_industry_distribution_${industrySummary.date}.json`;
        const holdingsOutputPath = path.join(OUTPUT_DIR, holdingsOutputFile);
        const industryOutputPath = path.join(OUTPUT_DIR, industryOutputFile);
        const updateDate = getTaipeiTodayCompact();
        const updateOutputFile = `${ETF_ID}_update_${updateDate}.json`;
        const updateOutput = {
            source: 'Pocket 口袋證券',
            etfId: ETF_ID,
            updateDate,
            updatedAt: new Date().toISOString(),
            holdings: {
                file: holdingsOutputFile,
                latestFile: HOLDINGS_LATEST_FILE,
                dataDate: holdingsSummary.date,
                rows: holdingsSummary.totalRows
            },
            industryDistribution: {
                file: industryOutputFile,
                latestFile: INDUSTRY_LATEST_FILE,
                dataDate: industrySummary.date,
                rows: industrySummary.totalRows,
                positiveRows: industrySummary.positiveRows
            }
        };

        fs.writeFileSync(holdingsOutputPath, JSON.stringify(holdingsOutput, null, 2), 'utf8');
        fs.writeFileSync(industryOutputPath, JSON.stringify(industryOutput, null, 2), 'utf8');
        fs.writeFileSync(path.join(OUTPUT_DIR, HOLDINGS_LATEST_FILE), JSON.stringify(holdingsOutput, null, 2), 'utf8');
        fs.writeFileSync(path.join(OUTPUT_DIR, INDUSTRY_LATEST_FILE), JSON.stringify(industryOutput, null, 2), 'utf8');
        fs.writeFileSync(path.join(OUTPUT_DIR, updateOutputFile), JSON.stringify(updateOutput, null, 2), 'utf8');
        refreshFilesJson();

        console.log(`Saved ${holdingsOutput.title}`);
        console.log(`Date: ${holdingsOutput.summary.date}`);
        console.log(`Rows: ${holdingsOutput.summary.totalRows}`);
        console.log(`File: ${holdingsOutputPath}`);
        console.log(`Saved ${industryOutput.title}`);
        console.log(`Date: ${industryOutput.summary.date}`);
        console.log(`Rows: ${industryOutput.summary.totalRows}, Positive rows: ${industryOutput.summary.positiveRows}`);
        console.log(`File: ${industryOutputPath}`);
        console.log(`Update marker: ${path.join(OUTPUT_DIR, updateOutputFile)}`);
    } catch (error) {
        console.error(`Failed to crawl Pocket data: ${error.message}`);
        process.exit(1);
    }
})();
