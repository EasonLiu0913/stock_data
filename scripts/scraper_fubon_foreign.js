const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const NAVIGATION_TIMEOUT_MS = 45000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

const targets = [
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_D_0_1.djhtm', name: '上市外資買超1日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_D_0_2.djhtm', name: '上市外資買超2日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_D_0_3.djhtm', name: '上市外資買超3日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_D_0_4.djhtm', name: '上市外資買超4日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_D_0_5.djhtm', name: '上市外資買超5日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_D_0_10.djhtm', name: '上市外資買超10日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_D_0_20.djhtm', name: '上市外資買超20日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_D_0_30.djhtm', name: '上市外資買超30日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_DA_0_1.djhtm', name: '上市外資賣超1日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_DA_0_2.djhtm', name: '上市外資賣超2日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_DA_0_3.djhtm', name: '上市外資賣超3日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_DA_0_4.djhtm', name: '上市外資賣超4日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_DA_0_5.djhtm', name: '上市外資賣超5日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_DA_0_10.djhtm', name: '上市外資賣超10日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_DA_0_20.djhtm', name: '上市外資賣超20日排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_DA_0_30.djhtm', name: '上市外資賣超30日排行' },
];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function getHeaders(targetName) {
    return ['Rank', 'Stock', 'Price', 'Change', 'ChangePercent', targetName.includes('賣超') ? 'NetSell' : 'NetBuy'];
}

function getDateString(pageDate) {
    if (pageDate) {
        const currentYear = new Date().getFullYear();
        const [month, day] = pageDate.split('/');
        return `${currentYear}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
    }

    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

async function extractTarget(browser, target) {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const page = await browser.newPage();
        try {
            console.log(`Navigating to ${target.url} (attempt ${attempt}/${MAX_ATTEMPTS})...`);
            await page.goto(target.url, {
                waitUntil: 'domcontentloaded',
                timeout: NAVIGATION_TIMEOUT_MS,
            });

            const data = await page.evaluate(() => {
                const normalizeText = text => text.replace(/\s+/g, ' ').trim();
                const tables = Array.from(document.querySelectorAll('table'));
                const targetTable = tables.find(table => {
                    const text = table.innerText;
                    return text.includes('名次') && text.includes('股票名稱');
                });

                if (!targetTable) return [];

                return Array.from(targetTable.querySelectorAll('tr'))
                    .filter(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length < 5) return false;
                        return /^\d+$/.test(normalizeText(cells[0].innerText));
                    })
                    .map(row => Array.from(row.querySelectorAll('td')).map(cell => normalizeText(cell.innerText)));
            });

            const pageDate = await page.evaluate(() => {
                const bodyText = document.body.innerText;
                const labeledDate = bodyText.match(/日期：(\d{2}\/\d{2})/);
                if (labeledDate) return labeledDate[1];
                const anyDate = bodyText.match(/(\d{2}\/\d{2})/);
                return anyDate ? anyDate[1] : null;
            });

            if (data.length === 0) {
                throw new Error(`No data extracted for ${target.name}`);
            }

            console.log(`Extracted ${data.length} rows for ${target.name}. Date: ${pageDate}`);
            return { data, pageDate };
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ ${target.name} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}`);
        } finally {
            await page.close().catch(() => {});
        }

        if (attempt < MAX_ATTEMPTS) {
            await wait(RETRY_DELAY_MS * attempt);
        }
    }

    throw lastError;
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const failedTargets = [];
    const dirPath = path.join(__dirname, '../data_fubon');
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    try {
        for (const target of targets) {
            try {
                const { data, pageDate } = await extractTarget(browser, target);
                const csvContent = [
                    getHeaders(target.name).map(csvEscape).join(','),
                    ...data.map(row => row.map(csvEscape).join(',')),
                ].join('\n') + '\n';

                const dateStr = getDateString(pageDate);
                const filename = `fubon_${dateStr}_${target.name}.csv`;
                const filePath = path.join(dirPath, filename);
                fs.writeFileSync(filePath, csvContent, 'utf8');
                console.log(`✅ Successfully saved data to ${filename}`);
            } catch (error) {
                failedTargets.push({ name: target.name, url: target.url, error: error.message });
                console.error(`❌ Giving up on ${target.name} after ${MAX_ATTEMPTS} attempts: ${error.message}`);
            }

            await wait(1000);
        }

        if (failedTargets.length > 0) {
            console.error(`\n❌ ${failedTargets.length} foreign ranking target(s) still failed:`);
            for (const failure of failedTargets) {
                console.error(`- ${failure.name}: ${failure.error}`);
            }
            process.exitCode = 1;
        } else {
            console.log(`\n✅ All ${targets.length} foreign ranking targets completed successfully.`);
        }
    } finally {
        await browser.close();
    }
})();
