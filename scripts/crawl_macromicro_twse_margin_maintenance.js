const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://www.macromicro.me';
const CHART_ID = '53117';
const CHART_PAGE = `${ORIGIN}/collections/46/tw-stock-relative/${CHART_ID}/taiwan-taiex-maintenance-margin`;
const VIEW_CHART_URL = `${ORIGIN}/api/view/chart/${CHART_ID}`;
const DATA_URL = `${ORIGIN}/charts/data/${CHART_ID}`;
const DEFAULT_STK_PAGE = CHART_PAGE;
const OUTPUT_DIR = path.join(__dirname, '../data_macromicro_twse_margin_maintenance');
const OUTPUT_SUFFIX = 'macromicro_twse_margin_maintenance';
const REQUIRED_COOKIE_NAMES = ['cf_clearance', 'PHPSESSID'];
const BRAVE_EXECUTABLE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const args = process.argv.slice(2);

function getArg(flag) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null;
}

function getTaipeiTodayCompact() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}${parts.month}${parts.day}`;
}

function normalizeDate(value) {
    if (value == null) return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
        const date = new Date(value > 100000000000 ? value : value * 1000);
        if (!Number.isNaN(date.getTime())) {
            return date.toISOString().slice(0, 10).replace(/-/g, '');
        }
    }

    const text = String(value).trim();
    const compact = text.replace(/[^\d]/g, '');
    if (/^\d{8}$/.test(compact)) return compact;
    if (/^\d{13}$/.test(compact)) return new Date(Number(compact)).toISOString().slice(0, 10).replace(/-/g, '');
    if (/^\d{10}$/.test(compact)) return new Date(Number(compact) * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    return '';
}

function parseJsonCookieFile(filePath) {
    const cookies = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(cookies)) throw new Error(`${filePath} is not a JSON cookie array`);
    return cookies
        .filter(cookie => cookie && cookie.name && cookie.value)
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
}

function parseNetscapeCookieFile(filePath) {
    return fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))
        .map(line => line.replace(/^#HttpOnly_/, '').split(/\t+/))
        .filter(parts => parts.length >= 7)
        .map(parts => `${parts[5]}=${parts[6]}`)
        .join('; ');
}

function getCookieHeader() {
    const inlineCookie = getArg('--cookie') || process.env.MACROMICRO_COOKIE;
    if (inlineCookie) return inlineCookie.trim();

    const cookieFile = getArg('--cookie-file') || process.env.MACROMICRO_COOKIE_FILE;
    if (!cookieFile) {
        return '';
    }

    const resolved = path.resolve(cookieFile);
    const text = fs.readFileSync(resolved, 'utf8').trimStart();
    return text.startsWith('[') ? parseJsonCookieFile(resolved) : parseNetscapeCookieFile(resolved);
}

function validateCookies(cookieHeader) {
    if (!cookieHeader) return;
    const cookieNames = new Set(cookieHeader.split(';').map(item => item.trim().split('=')[0]).filter(Boolean));
    const missing = REQUIRED_COOKIE_NAMES.filter(name => !cookieNames.has(name));
    if (missing.length > 0) {
        throw new Error(`MacroMicro cookies missing required entries: ${missing.join(', ')}. Export cookies from a logged-in browser visit.`);
    }
}

function getHeaders(cookieHeader, stk = '') {
    const headers = {
        accept: '*/*',
        'accept-language': 'zh-TW,zh;q=0.9,en;q=0.7',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        cookie: cookieHeader,
        docref: 'https://www.google.com/',
        pragma: 'no-cache',
        referer: CHART_PAGE,
        'sec-ch-ua': '"Brave";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
    };
    if (stk) headers.authorization = `Bearer ${stk}`;
    return headers;
}

function parseCookieHeader(cookieHeader) {
    return cookieHeader
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
            const eqIdx = part.indexOf('=');
            if (eqIdx === -1) return null;
            return {
                name: part.slice(0, eqIdx),
                value: part.slice(eqIdx + 1),
                domain: '.macromicro.me',
                path: '/',
                secure: true,
                sameSite: 'Lax'
            };
        })
        .filter(Boolean);
}

function extractStk(html) {
    const match = String(html).match(/data-stk=["']([a-f0-9]{32})["']/i);
    if (!match) {
        throw new Error('Could not find MacroMicro App.stk in page HTML. Cookies may be expired or Cloudflare may be challenging the request.');
    }
    return match[1];
}

async function fetchText(url, cookieHeader) {
    const response = await fetch(url, {
        headers: {
            ...getHeaders(cookieHeader),
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`MacroMicro HTML request failed: ${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
    }
    return text;
}

async function getStk(cookieHeader) {
    const explicitStk = getArg('--stk') || process.env.MACROMICRO_STK;
    if (explicitStk) return explicitStk.trim();

    const html = await fetchText(DEFAULT_STK_PAGE, cookieHeader);
    return extractStk(html);
}

function getChartNode(payload) {
    return payload?.data?.[`c:${CHART_ID}`] || payload?.data?.[CHART_ID] || payload?.[`c:${CHART_ID}`] || payload;
}

function validatePayload(payload) {
    const node = getChartNode(payload);
    if (!node || !Array.isArray(node.series)) {
        throw new Error('MacroMicro payload missing expected series array.');
    }

    if (!Array.isArray(node.series[0]) || !Array.isArray(node.series[1])) {
        throw new Error('MacroMicro payload must contain series[0] and series[1].');
    }

    if (node.series[0].length === 0) {
        throw new Error('MacroMicro 大盤融資維持率 series is empty.');
    }

    return node;
}

function getLatestDateFromSeries(series) {
    for (let i = series.length - 1; i >= 0; i--) {
        const point = series[i];
        const date = normalizeDate(Array.isArray(point) ? point[0] : point?.date);
        if (date) return date;
    }
    return getTaipeiTodayCompact();
}

async function fetchChartPayload(cookieHeader, stk) {
    await fetch(VIEW_CHART_URL, {
        method: 'POST',
        headers: getHeaders(cookieHeader, stk),
        body: '{}'
    });

    const response = await fetch(DATA_URL, {
        headers: getHeaders(cookieHeader, stk)
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`MacroMicro chart request failed: ${response.status} ${response.statusText}: ${text.slice(0, 220)}`);
    }

    let payload;
    try {
        payload = JSON.parse(text);
    } catch (error) {
        throw new Error(`MacroMicro chart response was not JSON: ${error.message}: ${text.slice(0, 220)}`);
    }

    if (payload?.success === 0 || payload?.success === false) {
        throw new Error(`MacroMicro rejected request: ${payload.msg || JSON.stringify(payload).slice(0, 220)}`);
    }

    return payload;
}

async function fetchChartPayloadWithBrowser(cookieHeader) {
    let chromium;
    try {
        ({ chromium } = require('playwright'));
    } catch (error) {
        throw new Error(`Playwright is required for browser fallback: ${error.message}`);
    }

    const browserExecutable = getArg('--browser-executable')
        || process.env.MACROMICRO_BROWSER_EXECUTABLE
        || (fs.existsSync(BRAVE_EXECUTABLE_PATH) ? BRAVE_EXECUTABLE_PATH : '');
    const headless = Boolean(getArg('--headless') || process.env.MACROMICRO_HEADLESS);
    const browser = await chromium.launch({
        headless,
        ...(browserExecutable ? { executablePath: browserExecutable } : {})
    });
    try {
        const context = await browser.newContext({
            locale: 'zh-TW',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
        });
        if (cookieHeader) await context.addCookies(parseCookieHeader(cookieHeader));

        const page = await context.newPage();
        const payloadPromise = page.waitForResponse(
            response => response.url() === DATA_URL && response.status() === 200,
            { timeout: 60000 }
        );
        await page.goto(CHART_PAGE, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const response = await payloadPromise;
        const text = await response.text();

        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error(`MacroMicro browser chart response was not JSON: ${error.message}: ${text.slice(0, 220)}`);
        }
    } finally {
        await browser.close();
    }
}

function refreshFilesJson() {
    const files = fs.readdirSync(OUTPUT_DIR)
        .filter(file => new RegExp(`^\\d{8}_${OUTPUT_SUFFIX}\\.json$`).test(file))
        .sort();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2), 'utf8');
}

(async () => {
    try {
        const cookieHeader = getCookieHeader();
        validateCookies(cookieHeader);

        let payload;
        if (getArg('--fetch') || process.env.MACROMICRO_USE_FETCH) {
            let stk = '';
            try {
                stk = await getStk(cookieHeader);
            } catch (error) {
                console.warn(`Could not load MacroMicro stk; trying browser capture. ${error.message}`);
            }
            try {
                payload = await fetchChartPayload(cookieHeader, stk);
            } catch (error) {
                console.warn(`Node fetch failed; trying browser capture. ${error.message}`);
                payload = await fetchChartPayloadWithBrowser(cookieHeader);
            }
        } else {
            payload = await fetchChartPayloadWithBrowser(cookieHeader);
        }
        const chartNode = validatePayload(payload);
        const dataDate = getLatestDateFromSeries(chartNode.series[0]);

        fs.mkdirSync(OUTPUT_DIR, { recursive: true });

        const outputFile = `${dataDate}_${OUTPUT_SUFFIX}.json`;
        const outputPath = path.join(OUTPUT_DIR, outputFile);
        fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
        refreshFilesJson();

        console.log(`Saved ${outputFile}`);
        console.log(`Path: ${outputPath}`);
        console.log(`大盤融資維持率 points: ${chartNode.series[0].length}`);
        console.log(`加權股價指數 points: ${chartNode.series[1].length}`);
        if (chartNode.series[0].length <= 2 || chartNode.series[1].length <= 2) {
            console.warn('Warning: MacroMicro returned only a limited series. The site may be enforcing chart view limits for this session.');
        }
    } catch (error) {
        console.error(`Failed to crawl MacroMicro Taiwan margin maintenance data: ${error.message}`);
        process.exit(1);
    }
})();
