const fs = require('fs');
const path = require('path');

const ETF_ID = '00981A';
const HOLDINGS_API_URL = 'https://www.pocket.tw/api/cm/MobileService/ashx/GetDtnoData.ashx?action=getdtnodata&DtNo=59449513&ParamStr=AssignID%3D00981A%3BMTPeriod%3D0%3BDTMode%3D0%3BDTRange%3D1%3BDTOrder%3D1%3BMajorTable%3DM722%3B&FilterNo=0';
const INDUSTRY_API_URL = 'https://www.pocket.tw/api/cm/MobileService/ashx/GetDtnoData.ashx?action=getdtnodata&DtNo=61495191&ParamStr=AssignID%3D98642180%3BMTPeriod%3D0%3BDTMode%3D0%3BDTRange%3D1%3BDTOrder%3D1%3BMajorTable%3DM066%3B&FilterNo=0';
const ANONYMOUS_TOKEN_URL = 'https://www.pocket.tw/api/cm/identity/token';
const POCKET_CLIENT_ID = 'cm-etf-web';
// Verification trigger: Pocket guest-token flow v2
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function bodyPreview(text, maxLength = 1200) {
    const compact = String(text || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return compact.length <= maxLength ? compact : compact.slice(0, maxLength) + '… [truncated]';
}

async function fetchAnonymousToken() {
    const body = new URLSearchParams({
        grant_type: 'guest',
        client_id: POCKET_CLIENT_ID
    });

    console.log('[auth] requesting anonymous guest token');

    const response = await fetch(ANONYMOUS_TOKEN_URL, {
        method: 'POST',
        headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        body
    });

    const rawText = await response.text();
    console.log(
        '[auth] response status=' + response.status + ' ' + response.statusText +
        '; content-type=' + (response.headers.get('content-type') || '(missing)') +
        '; body-bytes=' + Buffer.byteLength(rawText, 'utf8')
    );

    if (!response.ok) {
        throw new Error('[auth] anonymous token request failed: HTTP ' + response.status + ' ' + response.statusText + '; body-preview=' + bodyPreview(rawText));
    }

    let payload;
    try {
        payload = JSON.parse(rawText);
    } catch (error) {
        throw new Error('[auth] anonymous token response is invalid JSON: ' + error.message + '; body-preview=' + bodyPreview(rawText));
    }

    if (!payload || typeof payload.access_token !== 'string' || !payload.access_token) {
        throw new Error('[auth] anonymous token response missing access_token; keys=' + Object.keys(payload || {}).join(',') + '; body-preview=' + bodyPreview(rawText));
    }

    let exp = null;
    try {
        const parts = payload.access_token.split('.');
        if (parts.length >= 2) {
            const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
            const claims = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
            exp = claims.exp || null;
        }
    } catch (error) {
        console.warn('[auth] token received but exp could not be decoded: ' + error.message);
    }

    console.log('[auth] anonymous access token received' + (exp ? '; exp=' + exp : ''));
    return payload.access_token;
}

async function fetchPocketData(url, label, accessToken) {
    const retryDelaysMs = [0, 3000, 10000];
    let lastError = null;

    for (let attempt = 1; attempt <= retryDelaysMs.length; attempt++) {
        const delayMs = retryDelaysMs[attempt - 1];
        if (delayMs > 0) {
            console.warn('[' + label + '] retry wait ' + delayMs + 'ms before attempt ' + attempt + '/' + retryDelaysMs.length);
            await sleep(delayMs);
        }

        let response = null;
        let rawText = '';
        try {
            console.log('[' + label + '] request attempt ' + attempt + '/' + retryDelaysMs.length);
            console.log('[' + label + '] request url: ' + url);

            response = await fetch(url, {
                method: 'GET',
                headers: {
                    accept: 'application/json, text/plain, */*',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    authorization: 'Bearer ' + accessToken
                }
            });

            rawText = await response.text();
            const contentType = response.headers.get('content-type') || '(missing)';
            const contentLengthHeader = response.headers.get('content-length') || '(missing)';
            console.log('[' + label + '] response status=' + response.status + ' ' + response.statusText + '; content-type=' + contentType + '; content-length-header=' + contentLengthHeader + '; body-bytes=' + Buffer.byteLength(rawText, 'utf8') + '; final-url=' + (response.url || url));

            if (!response.ok) {
                throw new Error('HTTP ' + response.status + ' ' + response.statusText + '; body-preview=' + bodyPreview(rawText));
            }

            let payload;
            try {
                payload = JSON.parse(rawText);
            } catch (jsonError) {
                throw new Error('invalid JSON: ' + jsonError.message + '; body-preview=' + bodyPreview(rawText));
            }

            const keys = payload && typeof payload === 'object' && !Array.isArray(payload) ? Object.keys(payload) : [];
            const titleCount = Array.isArray(payload && payload.Title) ? payload.Title.length : '(missing)';
            const dataCount = Array.isArray(payload && payload.Data) ? payload.Data.length : '(missing)';
            console.log('[' + label + '] payload keys=' + (keys.length ? keys.join(',') : '(none)') + '; Title.length=' + titleCount + '; Data.length=' + dataCount);

            try {
                validatePayload(payload);
            } catch (validationError) {
                throw new Error(validationError.message + '; body-preview=' + bodyPreview(rawText));
            }

            console.log('[' + label + '] payload validation passed on attempt ' + attempt + '/' + retryDelaysMs.length);
            return payload;
        } catch (error) {
            lastError = error;
            const statusSuffix = response ? ' status=' + response.status + ' ' + response.statusText : '';
            console.error('[' + label + '] attempt ' + attempt + '/' + retryDelaysMs.length + ' failed:' + statusSuffix + ' ' + error.message);
        }
    }

    throw new Error('[' + label + '] all ' + retryDelaysMs.length + ' attempts failed. Last error: ' + (lastError ? lastError.message : 'unknown error'));
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
        const accessToken = await fetchAnonymousToken();
        const holdingsPayload = await fetchPocketData(HOLDINGS_API_URL, 'holdings', accessToken);
        const holdings = holdingsPayload.Data.map(normalizeHolding);
        const holdingsSummary = summarize(holdings);
        assertCompactDate(holdingsSummary.date, 'Pocket holdings response');
        console.log(
            '[holdings] accepted data date=' + holdingsSummary.date +
            '; rows=' + holdingsSummary.totalRows +
            '; equityRows=' + holdingsSummary.equityRows +
            '; cashRows=' + holdingsSummary.cashRows +
            '; totalWeightPercent=' + holdingsSummary.totalWeightPercent
        );

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

        const industryPayload = await fetchPocketData(INDUSTRY_API_URL, 'industry', accessToken);
        const industryDistribution = normalizeIndustryDistribution(industryPayload);
        const industrySummary = summarizeIndustry(industryDistribution);
        assertCompactDate(industrySummary.date, 'Pocket industry response');
        console.log(
            '[industry] accepted data date=' + industrySummary.date +
            '; rows=' + industrySummary.totalRows +
            '; positiveRows=' + industrySummary.positiveRows +
            '; totalWeightPercent=' + industrySummary.totalWeightPercent
        );

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
