'use strict';

const fs = require('fs');
const path = require('path');

function buildWarrantFilename(rawTitle) {
    const title = String(rawTitle || '').trim();
    if (!title) {
        throw new Error('TWSE warrant source title is missing; refusing to fabricate an artifact date from runner time.');
    }

    const match = title.match(/~\s*(\d{3})年(\d{1,2})月(\d{1,2})日\s*(.+)$/);
    if (!match) {
        throw new Error(`TWSE warrant source title does not contain the expected source date range: ${title}`);
    }

    const yearROC = Number(match[1]);
    const yearAD = yearROC + 1911;
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        throw new Error(`TWSE warrant source title contains an invalid source date: ${title}`);
    }

    const suffix = match[4].trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    if (!suffix) {
        throw new Error(`TWSE warrant source title is missing its artifact suffix: ${title}`);
    }

    return `${yearAD}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}${suffix}.csv`;
}

async function main() {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        const url = 'https://www.twse.com.tw/zh/products/securities/warrant/rank/securities.html';
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle' });

        try {
            await page.waitForSelector('div#reports table, div.rwd-table table', { timeout: 10000 });
        } catch (error) {
            console.log('Timeout waiting for table selector, proceeding to inspect page...');
        }

        const result = await page.evaluate(() => {
            let title = '';

            const h2 = document.querySelector('h2');
            if (h2) title = h2.innerText.trim();

            if (!title) {
                const titleEl = document.querySelector('.title') || document.querySelector('.h1') || document.querySelector('h1');
                if (titleEl) title = titleEl.innerText.trim();
            }

            if (!title) {
                const bodyText = document.body.innerText;
                const match = bodyText.match(/(\d{3}年.+?發行之標的證券排行)/);
                if (match) title = match[1];
            }

            let table = document.querySelector('div#reports table');
            if (!table) table = document.querySelector('div.rwd-table table');
            if (!table) table = document.querySelector('table');
            if (!table) return { error: 'Table not found', rawTitle: title };

            const rows = Array.from(table.querySelectorAll('tr'));
            const data = rows.map(row => {
                const cells = Array.from(row.querySelectorAll('th, td'));
                return cells.map(cell => {
                    let text = cell.innerText.trim();
                    if (text.includes(',')) text = `"${text}"`;
                    return text;
                }).join(',');
            });

            return { rawTitle: title, csv: data.join('\n') };
        });

        if (result.error) throw new Error(result.error);
        if (!result.csv) throw new Error('TWSE warrant page contained no extractable table data.');

        const filename = buildWarrantFilename(result.rawTitle);
        const dirPath = path.join(__dirname, '../data_twse');
        fs.mkdirSync(dirPath, { recursive: true });
        const filePath = path.join(dirPath, filename);

        fs.writeFileSync(filePath, result.csv, 'utf8');
        console.log(`✅ Successfully saved data to ${filePath}`);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`Failed to extract TWSE warrant data: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    buildWarrantFilename,
};
