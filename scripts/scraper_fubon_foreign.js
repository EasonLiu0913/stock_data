const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        for (const target of targets) {
            console.log(`Navigating to ${target.url}...`);
            await page.goto(target.url, { waitUntil: 'domcontentloaded' });

            const data = await page.evaluate(() => {
                const normalizeText = text => text.replace(/\s+/g, ' ').trim();
                const tables = Array.from(document.querySelectorAll('table'));
                const targetTable = tables.find(table => {
                    const text = table.innerText;
                    return text.includes('名次') && text.includes('股票名稱');
                });

                if (!targetTable) {
                    return [];
                }

                const tableRows = Array.from(targetTable.querySelectorAll('tr'));
                return tableRows
                    .filter(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length < 5) return false;

                        const firstCellText = normalizeText(cells[0].innerText);
                        return /^\d+$/.test(firstCellText);
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

            console.log(`Extracted ${data.length} rows for ${target.name}. Date: ${pageDate}`);

            if (data.length > 0) {
                const csvContent = [
                    getHeaders(target.name).map(csvEscape).join(','),
                    ...data.map(row => row.map(csvEscape).join(',')),
                ].join('\n');

                const dateStr = getDateString(pageDate);
                const dirPath = path.join(__dirname, '../data_fubon');
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                const filename = `fubon_${dateStr}_${target.name}.csv`;
                const filePath = path.join(dirPath, filename);

                fs.writeFileSync(filePath, csvContent, 'utf8');
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
