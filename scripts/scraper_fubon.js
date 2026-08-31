const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { resolveFubonRankingDate, requiredAnchorFromEnv } = require('./resolve_fubon_ranking_date');

(async () => {
    const targets = [
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_1.djhtm', name: '上市主力買超1日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_2.djhtm', name: '上市主力買超2日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_3.djhtm', name: '上市主力買超3日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_4.djhtm', name: '上市主力買超4日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_5.djhtm', name: '上市主力買超5日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_10.djhtm', name: '上市主力買超10日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_20.djhtm', name: '上市主力買超20日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_F_0_30.djhtm', name: '上市主力買超30日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_FA_0_1.djhtm', name: '上市主力賣超1日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_FA_0_2.djhtm', name: '上市主力賣超2日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_FA_0_3.djhtm', name: '上市主力賣超3日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_FA_0_4.djhtm', name: '上市主力賣超4日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_FA_0_5.djhtm', name: '上市主力賣超5日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_FA_0_10.djhtm', name: '上市主力賣超10日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_FA_0_20.djhtm', name: '上市主力賣超20日排行' },
        { url: 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zg_FA_0_30.djhtm', name: '上市主力賣超30日排行' }
    ];

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const dateAnchor = requiredAnchorFromEnv();

    try {
        for (const target of targets) {
            console.log(`Navigating to ${target.url}...`);
            await page.goto(target.url, { waitUntil: 'domcontentloaded' });
            const data = await page.evaluate(() => {
                const tables = Array.from(document.querySelectorAll('table'));
                const targetTable = tables.find(table => table.innerText.includes('名次') && table.innerText.includes('股票名稱'));
                if (!targetTable) return [];
                return Array.from(targetTable.querySelectorAll('tr'))
                    .filter(row => { const cells = row.querySelectorAll('td'); return cells.length >= 5 && /^\d+$/.test(cells[0].innerText.trim()); })
                    .map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.innerText.trim()));
            });
            const pageDate = await page.evaluate(() => {
                const match = document.body.innerText.match(/日期：(\d{2}\/\d{2})/);
                return match ? match[1] : null;
            });
            console.log(`Extracted ${data.length} rows for ${target.name}. Date: ${pageDate}`);
            if (data.length > 0) {
                const netColumn = target.name.includes('賣超') ? 'NetSell' : 'NetBuy';
                const headers = ['Rank', 'Stock', 'Price', 'Change', 'ChangePercent', 'Buy', 'Sell', netColumn];
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
