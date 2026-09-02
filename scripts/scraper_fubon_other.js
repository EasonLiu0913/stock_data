const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { resolveFubonRankingDate, requiredAnchorFromEnv } = require('./resolve_fubon_ranking_date');

const targets = [
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/Z/ZG/ZG_C.djhtm', name: '上市值增排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/Z/ZG/ZG_CA.djhtm', name: '上市值縮排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/Z/ZG/ZG_B.djhtm', name: '上市量增排行' },
    { url: 'https://fubon-ebrokerdj.fbs.com.tw/Z/ZG/ZG_BA.djhtm', name: '上市量縮排行' }
];

function selectTargets(allTargets) {
    const raw = String(process.env.FUBON_TARGET_NAMES || '').trim();
    if (!raw) return allTargets;
    let requested;
    try { requested = JSON.parse(raw); } catch (error) { throw new Error(`Invalid FUBON_TARGET_NAMES JSON: ${error.message}`); }
    if (!Array.isArray(requested) || requested.some(name => typeof name !== 'string')) throw new Error('FUBON_TARGET_NAMES must be a JSON array of strings');
    const known = new Set(allTargets.map(target => target.name));
    const unknown = requested.filter(name => !known.has(name));
    if (unknown.length) console.log(`Skipping ${unknown.length} recovery target(s) owned by other Fubon crawlers.`);
    return allTargets.filter(target => requested.includes(target.name));
}

(async () => {
    const selectedTargets = selectTargets(targets);
    if (selectedTargets.length === 0) {
        console.log('✅ No market-cap/volume ranking targets need recovery; skipping browser launch.');
        return;
    }
    console.log(`Market-cap/volume ranking targets selected: ${selectedTargets.length}/${targets.length}`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const dateAnchor = requiredAnchorFromEnv();

    try {
        for (const target of selectedTargets) {
            console.log(`Navigating to ${target.url}...`);
            await page.goto(target.url, { waitUntil: 'domcontentloaded' });
            const data = await page.evaluate(() => {
                const targetTable = Array.from(document.querySelectorAll('table')).find(table => table.innerText.includes('名次') && table.innerText.includes('股票名稱'));
                if (!targetTable) return [];
                return Array.from(targetTable.querySelectorAll('tr'))
                    .filter(row => { const cells = row.querySelectorAll('td'); return cells.length >= 5 && /^\d+$/.test(cells[0].innerText.trim()); })
                    .map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.innerText.trim()));
            });
            const pageDate = await page.evaluate(() => {
                const bodyText = document.body.innerText;
                const match = bodyText.match(/日期：(\d{2}\/\d{2})/);
                if (match) return match[1];
                const match2 = bodyText.match(/(\d{2}\/\d{2})/);
                return match2 ? match2[1] : null;
            });
            console.log(`Extracted ${data.length} rows for ${target.name}. Date: ${pageDate}`);
            if (data.length > 0) {
                const headers = ['Rank', 'Stock', 'Price', 'Change', 'ChangePercent', 'Buy', 'Sell', 'NetBuy'];
                const csvContent = [headers.join(','), ...data.map(row => row.map(cell => cell.includes(',') ? `"${cell}"` : cell).join(','))].join('\n');
                const dateStr = resolveFubonRankingDate(pageDate, dateAnchor);
                const dirPath = path.join(__dirname, '../data_fubon');
                if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
                const filename = `fubon_${dateStr}_${target.name}.csv`;
                fs.writeFileSync(path.join(dirPath, filename), csvContent, 'utf8');
                console.log(`✅ Successfully saved data to ${filename}`);
            } else {
                console.log(`❌ No data extracted for ${target.name}.`);
            }
            await page.waitForTimeout(1000);
        }
    } catch (error) {
        console.error('Error:', error);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
