const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const branchesMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'broker_branches.json'), 'utf8'));
    const namesMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'broker_names.json'), 'utf8'));

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    const baseUrl = 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm';
    const brokerId = '1030';
    const branchId = '1030';
    const targetY = '2025';
    const targetM = '12';
    const targetD = '1';

    console.log('Testing fixed scraper for: 土銀 (1030)');

    await page.goto(`${baseUrl}?a=${brokerId}&b=${branchId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('select[name="Y1"]', { timeout: 15000 });

    // Set date dropdowns
    const setIfExists = async (selector, val) => {
        const option = await page.$(`${selector} option[value="${val}"]`);
        if (option) {
            await page.selectOption(selector, val);
        }
    };
    await setIfExists('select[name="Y1"]', targetY);
    await setIfExists('select[name="M1"]', targetM);
    await setIfExists('select[name="D1"]', targetD);
    await setIfExists('select[name="Y2"]', targetY);
    await setIfExists('select[name="M2"]', targetM);
    await setIfExists('select[name="D2"]', targetD);

    // Click the query button to reload data
    const queryButton = await page.$('input[type="button"][value="查詢"]');
    if (queryButton) {
        console.log('Clicking query button...');
        await queryButton.click();
        await page.waitForTimeout(2000); // Wait for page to reload
    }

    // Extract data
    await page.waitForFunction(() => {
        return document.body.innerText.includes('買超') || document.body.innerText.includes('賣超');
    }, { timeout: 5000 });

    const data = await page.evaluate(() => {
        const results = [];
        const stockLinks = Array.from(document.querySelectorAll('a[href*="Link2Stk"]'));
        stockLinks.slice(0, 10).forEach(link => {
            const row = link.closest('tr');
            if (!row) return;
            const name = link.innerText.trim();
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 4) {
                const buyAmt = cells[1].innerText.trim().replace(/,/g, '');
                const sellAmt = cells[2].innerText.trim().replace(/,/g, '');
                const netAmt = cells[3].innerText.trim().replace(/,/g, '');
                results.push({ name, buyAmt, sellAmt, netAmt });
            }
        });
        return results;
    });

    console.log('\nFirst 10 stocks (Buy section):');
    data.forEach((d, i) => {
        console.log(`${i+1}. ${d.name} - Net: ${d.netAmt}, Buy: ${d.buyAmt}, Sell: ${d.sellAmt}`);
    });

    await browser.close();
})();
