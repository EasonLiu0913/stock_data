const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    const url = 'https://fubon-ebrokerdj.fbs.com.tw/z/zg/zgb/zgb0.djhtm?a=1030&b=1030&c=B&e=2025-12-1&f=2025-12-1';

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for date dropdowns
    await page.waitForSelector('select[name="Y1"]', { timeout: 15000 });

    // Get the date values
    const dateInfo = await page.evaluate(() => {
        const y = document.querySelector('select[name="Y1"]')?.value;
        const m = document.querySelector('select[name="M1"]')?.value;
        const d = document.querySelector('select[name="D1"]')?.value;
        return { y, m, d };
    });

    console.log('Date on page:', dateInfo);

    // Wait for data to load
    try {
        await page.waitForFunction(() => {
            return document.body.innerText.includes('買超') || document.body.innerText.includes('賣超');
        }, { timeout: 5000 });
    } catch (e) {
        console.log('Warning: 買超/賣超 not found');
    }

    // Extract data like the scraper does
    const data = await page.evaluate(() => {
        const results = [];
        const stockLinks = Array.from(document.querySelectorAll('a[href*="Link2Stk"]'));

        console.log('Found stock links:', stockLinks.length);

        const tds = Array.from(document.querySelectorAll('td'));
        const buyHeader = tds.find(td => td.innerText.trim() === '買超');
        const sellHeader = tds.find(td => td.innerText.trim() === '賣超');

        stockLinks.forEach(link => {
            const row = link.closest('tr');
            if (!row) return;

            let type = 'Buy';
            if (sellHeader) {
                if (sellHeader.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) {
                    type = 'Sell';
                }
            }

            const name = link.innerText.trim();
            const cells = Array.from(row.querySelectorAll('td'));

            let buyAmt = '0';
            let sellAmt = '0';
            let netAmt = '0';

            if (cells.length >= 4) {
                buyAmt = cells[1].innerText.trim().replace(/,/g, '');
                sellAmt = cells[2].innerText.trim().replace(/,/g, '');
                netAmt = cells[3].innerText.trim().replace(/,/g, '');
            }

            results.push({ name, amount: netAmt, type, buyAmt, sellAmt });
        });

        return results;
    });

    console.log(`\nExtracted ${data.length} rows`);
    console.log('\nFirst 10 Buy entries:');
    data.filter(d => d.type === 'Buy').slice(0, 10).forEach((d, i) => {
        console.log(`${i+1}. ${d.name} - Net: ${d.amount}, Buy: ${d.buyAmt}, Sell: ${d.sellAmt}`);
    });

    console.log('\nFirst 10 Sell entries:');
    data.filter(d => d.type === 'Sell').slice(0, 10).forEach((d, i) => {
        console.log(`${i+1}. ${d.name} - Net: ${d.amount}, Buy: ${d.buyAmt}, Sell: ${d.sellAmt}`);
    });

    await browser.close();
})();
